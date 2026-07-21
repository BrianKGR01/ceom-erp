import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { comoSistema, comoUsuario } from "@/db/contexto";
import { ROL_OWNER_ID } from "@/modules/identidad/constants";
import { authUsers, tenants, usuarios } from "@/modules/identidad/schema";
import * as repo from "./repository";
import { proveedores } from "./schema";

// Aisla el mecanismo de RLS (docs/security/PLAN-RLS-BACKSTOP.md §4.3) del
// guard de aplicación: setup por SQL directo (insert crudo en auth.users,
// nunca crearClienteAdmin().auth.admin.createUser()) porque este test no
// necesita una sesión real de GoTrue — auth.uid() solo lee el GUC que
// comoUsuario() fija, sin importar si ese id nació de un login real. Mismo
// criterio que src/modules/patrimonio/tenant-aislamiento.test.ts (Etapa 1).
const hasPostgres = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasPostgres)("Proveedores — aislamiento cross-tenant (RLS real, no el guard de app)", () => {
  const sufijo = Date.now();
  let tenantA: string;
  let tenantB: string;
  let usuarioA: string;
  let usuarioB: string;
  let proveedorDeA: string;

  beforeAll(async () => {
    usuarioA = randomUUID();
    usuarioB = randomUUID();
    await db.insert(authUsers).values([{ id: usuarioA }, { id: usuarioB }]);

    const [ta] = await db
      .insert(tenants)
      .values({
        nombreNegocio: `Aislamiento RLS Proveedores A ${sufijo}`,
        monedaPrincipal: "BOB",
        estadoSuscripcion: "activa",
        fechaInicioSuscripcion: new Date().toISOString().slice(0, 10),
      })
      .returning();
    const [tb] = await db
      .insert(tenants)
      .values({
        nombreNegocio: `Aislamiento RLS Proveedores B ${sufijo}`,
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
        email: `owner-a-proveedores-${sufijo}@ceom-erp.test`,
        esOwner: true,
      },
      {
        id: usuarioB,
        tenantId: tenantB,
        rolId: ROL_OWNER_ID,
        nombreCompleto: "Owner B",
        email: `owner-b-proveedores-${sufijo}@ceom-erp.test`,
        esOwner: true,
      },
    ]);

    const [proveedor] = await db
      .insert(proveedores)
      .values({
        tenantId: tenantA,
        nombre: "Proveedor de A",
        creadoPor: usuarioA,
      })
      .returning();
    proveedorDeA = proveedor.id;
  });

  afterAll(async () => {
    await db.delete(proveedores).where(eq(proveedores.tenantId, tenantA));
    await db.delete(usuarios).where(eq(usuarios.tenantId, tenantA));
    await db.delete(usuarios).where(eq(usuarios.tenantId, tenantB));
    await db.delete(tenants).where(eq(tenants.id, tenantA));
    await db.delete(tenants).where(eq(tenants.id, tenantB));
    await db.delete(authUsers).where(eq(authUsers.id, usuarioA));
    await db.delete(authUsers).where(eq(authUsers.id, usuarioB));
  });

  it("tenant B no ve el proveedor de tenant A vía comoUsuario() (RLS filtra la fila)", async () => {
    const filas = await comoUsuario(usuarioB, (tx) => repo.listarProveedoresPorTenant(tx, tenantA));
    expect(filas).toHaveLength(0);
  });

  it("tenant A sí ve su propio proveedor vía comoUsuario()", async () => {
    const filas = await comoUsuario(usuarioA, (tx) => repo.listarProveedoresPorTenant(tx, tenantA));
    expect(filas).toHaveLength(1);
    expect(filas[0].id).toBe(proveedorDeA);
  });

  it("tenant B no puede escribir (UPDATE) el proveedor de tenant A vía comoUsuario() — RLS bloquea, no solo la app", async () => {
    await comoUsuario(usuarioB, (tx) =>
      repo.actualizarProveedor(tx, proveedorDeA, { nombre: "hackeado por B" })
    );

    // Verificación con comoSistema() (bypass total, mismo criterio que hoy)
    // para confirmar el estado real en la base, no lo que ve el atacante.
    const real = await comoSistema((tx) => repo.obtenerProveedorPorId(tx, proveedorDeA));
    expect(real?.nombre).toBe("Proveedor de A");
  });

  it("sin contexto de RLS (comoSistema, bypass total) SÍ se ve la fila de cualquier tenant — confirma que el test mide RLS y no el guard de aplicación", async () => {
    const real = await comoSistema((tx) => repo.obtenerProveedorPorId(tx, proveedorDeA));
    expect(real).not.toBeNull();
  });
});
