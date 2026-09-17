import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { limpiarEnParalelo } from "@/test-utils/limpieza";
import { preautorizarSobreRecurso, tienePermiso } from "./actions";
import {
  CEOM_OPS_TENANT_ID,
  GATEWAY_SISTEMA_USUARIO_ID,
  ROL_CEOM_ADMIN_ID,
  ROL_OWNER_ID,
} from "./constants";
import * as repo from "./repository";
import type { UsuarioConRol } from "./repository";
import { permisos, roles, tenants } from "./schema";

/**
 * `preautorizarSobreRecurso()` reemplazó a `tienePermiso(solicitante,
 * recurso.tenantId, …)` dentro de las transacciones de Proveedores y
 * Patrimonio (incidente de pool del 2026-09-17). El chequeo de aplicación es
 * hoy la única defensa cross-tenant en la mayoría de los módulos
 * (AUDITORIA-AUTORIZACION.md), así que el reemplazo tiene que ser equivalente
 * — y esto lo prueba contra la matriz completa, no contra un caso feliz.
 *
 * La matriz tiene respuestas `true` Y `false` de `tienePermiso` en cada eje
 * (dev-practices §6.1 b): si la función nueva devolviera siempre `false`, o
 * siempre lo mismo que la pertenencia, falla.
 */
const hasPostgres = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasPostgres)("preautorizarSobreRecurso ≡ tienePermiso por recurso", () => {
  const sufijo = Date.now();
  const hoy = new Date().toISOString().slice(0, 10);
  let tenantA: string;
  let tenantB: string;
  let tenantBloqueado: string;
  let tenantSoloLectura: string;
  let rolLimitado: string;

  const usuario = (overrides: Partial<UsuarioConRol> & { rol: UsuarioConRol["rol"] }): UsuarioConRol =>
    ({
      id: randomUUID(),
      tenantId: tenantA,
      rolId: overrides.rol.id,
      nombreCompleto: "x",
      email: "x@ceom-erp.test",
      esOwner: false,
      activo: true,
      eliminadoEn: null,
      ...overrides,
    }) as UsuarioConRol;

  const rolDe = (id: string, esRolSistema: boolean, tenantId: string | null) =>
    ({ id, nombre: id, esRolSistema, tenantId, creadoEn: new Date(), eliminadoEn: null }) as UsuarioConRol["rol"];

  beforeAll(async () => {
    const hace = (dias: number) => new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10);
    const filas = await db
      .insert(tenants)
      .values([
        { nombreNegocio: `Preautorizar A ${sufijo}`, monedaPrincipal: "BOB", estadoSuscripcion: "activa", fechaInicioSuscripcion: hoy },
        { nombreNegocio: `Preautorizar B ${sufijo}`, monedaPrincipal: "BOB", estadoSuscripcion: "activa", fechaInicioSuscripcion: hoy },
        { nombreNegocio: `Preautorizar bloqueado ${sufijo}`, monedaPrincipal: "BOB", estadoSuscripcion: "vencida", fechaInicioSuscripcion: hace(90), fechaProximoPago: hace(60) },
        { nombreNegocio: `Preautorizar solo lectura ${sufijo}`, monedaPrincipal: "BOB", estadoSuscripcion: "vencida", fechaInicioSuscripcion: hace(40), fechaProximoPago: hace(1) },
      ])
      .returning();
    [tenantA, tenantB, tenantBloqueado, tenantSoloLectura] = filas.map((t) => t.id);

    const [rol] = await db.insert(roles).values({ tenantId: tenantA, nombre: `Limitado ${sufijo}` }).returning();
    rolLimitado = rol.id;
    await db.insert(permisos).values([
      { rolId: rolLimitado, modulo: "proveedores", accion: "ver", permitido: true },
      { rolId: rolLimitado, modulo: "proveedores", accion: "crear", permitido: false },
    ]);
  });

  afterAll(async () => {
    await db.delete(permisos).where(inArray(permisos.rolId, [rolLimitado]));
    await db.delete(roles).where(inArray(roles.id, [rolLimitado]));
    await limpiarEnParalelo([
      () => db.delete(tenants).where(inArray(tenants.id, [tenantA, tenantB, tenantBloqueado, tenantSoloLectura])),
    ]);
  });

  type Caso = { nombre: string; solicitante: () => Promise<UsuarioConRol> | UsuarioConRol };

  const casos: Caso[] = [
    { nombre: "Owner de A", solicitante: () => usuario({ esOwner: true, rol: rolDe(ROL_OWNER_ID, true, null) }) },
    { nombre: "rol limitado de A", solicitante: () => usuario({ rol: rolDe(rolLimitado, false, tenantA) }) },
    {
      nombre: "Owner de un tenant bloqueado",
      solicitante: () => usuario({ tenantId: tenantBloqueado, esOwner: true, rol: rolDe(ROL_OWNER_ID, true, null) }),
    },
    {
      nombre: "Owner de un tenant en solo lectura",
      solicitante: () => usuario({ tenantId: tenantSoloLectura, esOwner: true, rol: rolDe(ROL_OWNER_ID, true, null) }),
    },
    {
      nombre: "ceom_admin",
      solicitante: () => usuario({ tenantId: CEOM_OPS_TENANT_ID, rol: rolDe(ROL_CEOM_ADMIN_ID, true, null) }),
    },
  ];

  const recursos = () => [tenantA, tenantB, tenantBloqueado, tenantSoloLectura, CEOM_OPS_TENANT_ID];
  const acciones = ["ver", "crear"] as const;

  it("la matriz ejercita permisos concedidos y denegados (si no, la equivalencia sería vacía)", async () => {
    const respuestas = new Set<boolean>();
    for (const caso of casos) {
      const s = await caso.solicitante();
      for (const t of recursos()) for (const a of acciones) respuestas.add(await tienePermiso(s, t, "proveedores", a));
    }
    expect([...respuestas].sort()).toEqual([false, true]);
  });

  for (const caso of casos) {
    it(`${caso.nombre}: idéntico a tienePermiso en cada tenant y acción`, async () => {
      const s = await caso.solicitante();
      const esperado: string[] = [];
      const obtenido: string[] = [];
      for (const a of acciones) {
        const puede = await preautorizarSobreRecurso(s, "proveedores", a);
        for (const t of recursos()) {
          esperado.push(`${a}@${t}=${await tienePermiso(s, t, "proveedores", a)}`);
          obtenido.push(`${a}@${t}=${puede(t)}`);
        }
      }
      expect(obtenido).toEqual(esperado);
    });
  }

  it("Gateway de Consentimiento: nunca más laxo; más estricto solo fuera de CEOM Ops", async () => {
    const gateway = await repo.obtenerUsuarioConRolPorId(GATEWAY_SISTEMA_USUARIO_ID);
    expect(gateway).not.toBeNull();
    const puedeVer = await preautorizarSobreRecurso(gateway!, "proveedores", "ver");
    const puedeCrear = await preautorizarSobreRecurso(gateway!, "proveedores", "crear");

    // Antes: "ver" en cualquier tenant. Ahora: solo en el suyo.
    expect(await tienePermiso(gateway!, tenantA, "proveedores", "ver")).toBe(true);
    expect(puedeVer(tenantA)).toBe(false);
    expect(puedeVer(CEOM_OPS_TENANT_ID)).toBe(true);
    // Escritura: denegada antes y después, en todos lados.
    for (const t of recursos()) {
      expect(await tienePermiso(gateway!, t, "proveedores", "crear")).toBe(false);
      expect(puedeCrear(t)).toBe(false);
    }
  });

  it("un recurso sin tenant (null) nunca pertenece", async () => {
    const owner = usuario({ esOwner: true, rol: rolDe(ROL_OWNER_ID, true, null) });
    const puedeVer = await preautorizarSobreRecurso(owner, "proveedores", "ver");
    expect(puedeVer(tenantA)).toBe(true);
    expect(puedeVer(null)).toBe(false);
  });
});
