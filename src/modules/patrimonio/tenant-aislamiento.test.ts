import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { comoSistema, comoUsuario } from "@/db/contexto";
import { ROL_OWNER_ID } from "@/modules/identidad/constants";
import { authUsers, tenants, usuarios } from "@/modules/identidad/schema";
import * as repo from "./repository";
import { activos } from "./schema";

// Aisla el mecanismo de RLS (docs/security/PLAN-RLS-BACKSTOP.md §4.3) del
// guard de aplicación: setup por SQL directo (insert crudo en auth.users,
// nunca crearClienteAdmin().auth.admin.createUser()) porque este test no
// necesita una sesión real de GoTrue — auth.uid() solo lee el GUC que
// comoUsuario() fija, sin importar si ese id nació de un login real. Esto
// deja el test corriendo tanto contra Supabase Cloud real (DATABASE_URL de
// desarrollo) como contra el contenedor postgres:16 de CI (§4.2), sin
// depender de un servicio de Auth en ninguno de los dos casos.
const hasPostgres = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasPostgres)("Patrimonio — aislamiento cross-tenant (RLS real, no el guard de app)", () => {
  const sufijo = Date.now();
  let tenantA: string;
  let tenantB: string;
  let usuarioA: string;
  let usuarioB: string;
  let activoDeA: string;

  beforeAll(async () => {
    usuarioA = randomUUID();
    usuarioB = randomUUID();
    await db.insert(authUsers).values([{ id: usuarioA }, { id: usuarioB }]);

    const [ta] = await db
      .insert(tenants)
      .values({
        nombreNegocio: `Aislamiento RLS A ${sufijo}`,
        monedaPrincipal: "BOB",
        estadoSuscripcion: "activa",
        fechaInicioSuscripcion: new Date().toISOString().slice(0, 10),
      })
      .returning();
    const [tb] = await db
      .insert(tenants)
      .values({
        nombreNegocio: `Aislamiento RLS B ${sufijo}`,
        monedaPrincipal: "BOB",
        estadoSuscripcion: "activa",
        fechaInicioSuscripcion: new Date().toISOString().slice(0, 10),
      })
      .returning();
    tenantA = ta.id;
    tenantB = tb.id;

    await db.insert(usuarios).values([
      {
        id: usuarioA,
        tenantId: tenantA,
        rolId: ROL_OWNER_ID,
        nombreCompleto: "Owner A",
        email: `owner-a-${sufijo}@ceom-erp.test`,
        esOwner: true,
      },
      {
        id: usuarioB,
        tenantId: tenantB,
        rolId: ROL_OWNER_ID,
        nombreCompleto: "Owner B",
        email: `owner-b-${sufijo}@ceom-erp.test`,
        esOwner: true,
      },
    ]);

    const [activo] = await db
      .insert(activos)
      .values({
        tenantId: tenantA,
        nombre: "Activo de A",
        tipo: "mobiliario",
        valorCompra: "100",
        fechaAdquisicion: "2025-01-01",
        creadoPor: usuarioA,
      })
      .returning();
    activoDeA = activo.id;
  });

  afterAll(async () => {
    // Cadena única de FK, nada paralelizable: `usuarios.id` referencia
    // `auth.users.id` (`usuarios_id_users_id_fk`, ON DELETE NO ACTION), así
    // que auth.users va SIEMPRE al final. El setup de este archivo es SQL
    // crudo (sin la API de Auth), así que ese borrado sale por la misma
    // conexión que el resto y no necesita limpiarConAuthGarantizada().
    await db.delete(activos).where(eq(activos.tenantId, tenantA));
    await db.delete(usuarios).where(inArray(usuarios.tenantId, [tenantA, tenantB]));
    await db.delete(tenants).where(inArray(tenants.id, [tenantA, tenantB]));
    await db.delete(authUsers).where(inArray(authUsers.id, [usuarioA, usuarioB]));
  });

  it("tenant B no ve el activo de tenant A vía comoUsuario() (RLS filtra la fila)", async () => {
    const filas = await comoUsuario(usuarioB, (tx) => repo.listarActivosPorTenant(tx, tenantA));
    expect(filas).toHaveLength(0);
  });

  it("tenant A sí ve su propio activo vía comoUsuario()", async () => {
    const filas = await comoUsuario(usuarioA, (tx) => repo.listarActivosPorTenant(tx, tenantA));
    expect(filas).toHaveLength(1);
    expect(filas[0].id).toBe(activoDeA);
  });

  it("tenant B no puede escribir (UPDATE) el activo de tenant A vía comoUsuario() — RLS bloquea, no solo la app", async () => {
    await comoUsuario(usuarioB, (tx) => repo.actualizarActivo(tx, activoDeA, { nombre: "hackeado por B" }));

    // Verificación con comoSistema() (bypass total, mismo criterio que hoy)
    // para confirmar el estado real en la base, no lo que ve el atacante.
    const real = await comoSistema((tx) => repo.obtenerActivoPorId(tx, activoDeA));
    expect(real?.nombre).toBe("Activo de A");
  });

  it("sin contexto de RLS (comoSistema, bypass total) SÍ se ve la fila de cualquier tenant — confirma que el test mide RLS y no el guard de aplicación", async () => {
    const real = await comoSistema((tx) => repo.obtenerActivoPorId(tx, activoDeA));
    expect(real).not.toBeNull();
  });
});
