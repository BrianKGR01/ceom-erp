import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { comoCeomAdmin, comoSistema, comoUsuario } from "@/db/contexto";
import { CEOM_OPS_TENANT_ID, ROL_CEOM_ADMIN_ID, ROL_OWNER_ID } from "@/modules/identidad/constants";
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
  let usuarioCeomAdmin: string;
  let usuarioCeomAdminDesactivado: string;
  let proveedorDeA: string;

  beforeAll(async () => {
    usuarioA = randomUUID();
    usuarioB = randomUUID();
    usuarioCeomAdmin = randomUUID();
    usuarioCeomAdminDesactivado = randomUUID();
    await db.insert(authUsers).values([
      { id: usuarioA },
      { id: usuarioB },
      { id: usuarioCeomAdmin },
      { id: usuarioCeomAdminDesactivado },
    ]);

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
      // Etapa 3 del backstop de RLS (docs/security/PLAN-RLS-BACKSTOP.md
      // §10.9) — dos usuarios con rolId=ROL_CEOM_ADMIN_ID real, uno activo y
      // uno no, para probar el bypass de es_ceom_admin() y su filtro
      // eliminado_en/activo ANTES de que exista ninguna policy (3.a/3.b
      // todavía no aplicados en este punto del plan).
      {
        id: usuarioCeomAdmin,
        tenantId: CEOM_OPS_TENANT_ID,
        rolId: ROL_CEOM_ADMIN_ID,
        nombreCompleto: "CEOM Admin (test aislamiento Proveedores)",
        email: `ceom-admin-proveedores-${sufijo}@ceom-erp.test`,
        esOwner: false,
      },
      {
        id: usuarioCeomAdminDesactivado,
        tenantId: CEOM_OPS_TENANT_ID,
        rolId: ROL_CEOM_ADMIN_ID,
        nombreCompleto: "CEOM Admin desactivado (test aislamiento Proveedores)",
        email: `ceom-admin-desactivado-proveedores-${sufijo}@ceom-erp.test`,
        esOwner: false,
        activo: false,
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
    await db.delete(usuarios).where(eq(usuarios.id, usuarioCeomAdmin));
    await db.delete(usuarios).where(eq(usuarios.id, usuarioCeomAdminDesactivado));
    await db.delete(tenants).where(eq(tenants.id, tenantA));
    await db.delete(tenants).where(eq(tenants.id, tenantB));
    await db.delete(authUsers).where(eq(authUsers.id, usuarioA));
    await db.delete(authUsers).where(eq(authUsers.id, usuarioB));
    await db.delete(authUsers).where(eq(authUsers.id, usuarioCeomAdmin));
    await db.delete(authUsers).where(eq(authUsers.id, usuarioCeomAdminDesactivado));
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

  // Etapa 3 del backstop de RLS (docs/security/PLAN-RLS-BACKSTOP.md §10.9):
  // escritos y corridos ANTES de que existiera es_ceom_admin() ni la policy
  // de bypass (3.a/3.b) — confirmado en su momento que el primero daba 0
  // filas (RLS filtrando de verdad, no una tautología) y el segundo también
  // — ver el commit de esa etapa para el estado "antes". Con 3.a/3.b ya
  // aplicados (policy real en las 4 tablas de Proveedores, verificada con
  // EXPLAIN ANALYZE real antes de escribirla, §10.3), el primero pasa a
  // dar 1 fila; el segundo se queda en 0 — prueba que el filtro
  // eliminado_en/activo de es_ceom_admin() funciona con el bypass ya real,
  // no solo en ausencia de él.
  it("un ceom_admin real ve el proveedor de un tenant ajeno vía comoCeomAdmin() — bypass de RLS real (3.b), no del guard de app", async () => {
    const filas = await comoCeomAdmin(usuarioCeomAdmin, (tx) => repo.listarProveedoresPorTenant(tx, tenantA));
    expect(filas).toHaveLength(1);
    expect(filas[0].id).toBe(proveedorDeA);
  });

  it("un ceom_admin desactivado (activo=false) NO ve el proveedor de un tenant ajeno, con o sin bypass de RLS", async () => {
    const filas = await comoCeomAdmin(usuarioCeomAdminDesactivado, (tx) =>
      repo.listarProveedoresPorTenant(tx, tenantA)
    );
    expect(filas).toHaveLength(0);
  });
});
