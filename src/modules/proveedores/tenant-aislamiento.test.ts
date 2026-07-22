import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { comoCeomAdmin, comoGatewaySistema, comoSistema, comoUsuario } from "@/db/contexto";
import { aprobacionesTenant, instituciones } from "@/modules/consentimiento/schema";
import { CEOM_OPS_TENANT_ID, ROL_CEOM_ADMIN_ID, ROL_OWNER_ID } from "@/modules/identidad/constants";
import { authUsers, sucursales, tenants, usuarios } from "@/modules/identidad/schema";
import { productos } from "@/modules/productos/schema";
import { limpiarEnParalelo } from "@/test-utils/limpieza";
import * as repo from "./repository";
import { compras, pagosCompra, proveedores } from "./schema";

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
  let sucursalDeA: string;
  let productoDeA: string;
  let compraDeA: string;
  // Etapa 4.b.0 del backstop de RLS (docs/security/PLAN-RLS-BACKSTOP.md
  // §16.10, tests ANTES de la policy): tenantC tiene compra+pago reales
  // igual que tenantA, pero SIN ninguna fila en aprobaciones_tenant -- el
  // par exacto que hace falta para probar que la ausencia de consentimiento
  // bloquea al Gateway, no solo que la presencia de consentimiento lo deja
  // pasar (eso ya lo prueba, sin querer, el test viejo de tenantA).
  let tenantC: string;
  let sucursalDeC: string;
  let productoDeC: string;
  let compraDeC: string;
  let institucionId: string;

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
    const [tc] = await db
      .insert(tenants)
      .values({
        nombreNegocio: `Aislamiento RLS Proveedores C sin consentimiento ${sufijo}`,
        monedaPrincipal: "BOB",
        estadoSuscripcion: "activa",
        fechaInicioSuscripcion: new Date().toISOString().slice(0, 10),
      })
      .returning();
    tenantA = ta.id;
    tenantB = tb.id;
    tenantC = tc.id;

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

    // Compra + Pago de Compra reales para tenantA (Etapa 4.a, docs/security/
    // PLAN-RLS-BACKSTOP.md §13.11/§15.3) — gatewaySistemaBypassPolicy() se
    // aplica a "compras"/"pagos_compra", no a "proveedores", así que el test
    // del Gateway necesita ejercitar esas dos tablas específicamente, no
    // reusar proveedorDeA.
    const [sucursal] = await db
      .insert(sucursales)
      .values({ tenantId: tenantA, nombre: "Sucursal A", esPrincipal: true })
      .returning();
    sucursalDeA = sucursal.id;

    const [producto] = await db
      .insert(productos)
      .values({ tenantId: tenantA, nombre: "Producto A", unidadVenta: "unidad", precioVenta: "20" })
      .returning();
    productoDeA = producto.id;

    const [compra] = await db
      .insert(compras)
      .values({
        tenantId: tenantA,
        sucursalId: sucursalDeA,
        tipo: "reventa",
        productoId: productoDeA,
        cantidad: "10",
        costoUnitario: "10",
        montoTotal: "100",
        fechaCompra: "2025-06-01",
      })
      .returning();
    compraDeA = compra.id;

    await db.insert(pagosCompra).values({
      compraId: compraDeA,
      monto: "250",
      fechaPago: "2025-06-01",
    });

    // Etapa 4.b.0 (docs/security/PLAN-RLS-BACKSTOP.md §16.10): institución
    // real + aprobación vigente ("financiero", no revocada) para tenantA —
    // sin esto, el test viejo de la línea ~250 ("el Gateway ve los pagos de
    // compra de un tenant ajeno") dejaría de pasar en cuanto la policy pase
    // a exigir vigencia, y quedaría indistinguible de un bug real.
    const [institucion] = await db
      .insert(instituciones)
      .values({ nombre: `Institucion Aislamiento Proveedores ${sufijo}`, tipo: "incubadora" })
      .returning();
    institucionId = institucion.id;
    await db.insert(aprobacionesTenant).values({
      tenantId: tenantA,
      institucionId,
      modulosAprobados: ["financiero"],
      aprobadoPor: usuarioA,
    });

    // tenantC: compra + pago reales, igual forma que tenantA, pero SIN
    // ninguna fila en aprobaciones_tenant — el par que prueba que la
    // AUSENCIA de consentimiento bloquea al Gateway (§16.10, caso negativo).
    const [sucursalC] = await db
      .insert(sucursales)
      .values({ tenantId: tenantC, nombre: "Sucursal C", esPrincipal: true })
      .returning();
    sucursalDeC = sucursalC.id;

    const [productoC] = await db
      .insert(productos)
      .values({ tenantId: tenantC, nombre: "Producto C", unidadVenta: "unidad", precioVenta: "20" })
      .returning();
    productoDeC = productoC.id;

    const [compraC] = await db
      .insert(compras)
      .values({
        tenantId: tenantC,
        sucursalId: sucursalDeC,
        tipo: "reventa",
        productoId: productoDeC,
        cantidad: "10",
        costoUnitario: "50",
        montoTotal: "500",
        fechaCompra: "2025-06-01",
      })
      .returning();
    compraDeC = compraC.id;

    await db.insert(pagosCompra).values({
      compraId: compraDeC,
      monto: "500",
      fechaPago: "2025-06-01",
    });
  });

  afterAll(async () => {
    const authIds = [usuarioA, usuarioB, usuarioCeomAdmin, usuarioCeomAdminDesactivado];

    // Dos cadenas por tenant (A y C) sin FK entre sí: dentro de cada una el
    // orden importa (pagos_compra -> compras -> productos -> sucursales,
    // aprobaciones_tenant -> instituciones), entre ellas no.
    await limpiarEnParalelo([
      async () => {
        await db.delete(pagosCompra).where(eq(pagosCompra.compraId, compraDeA));
        await db.delete(compras).where(eq(compras.id, compraDeA));
        await db.delete(productos).where(eq(productos.id, productoDeA));
        await db.delete(sucursales).where(eq(sucursales.id, sucursalDeA));
        await db.delete(proveedores).where(eq(proveedores.tenantId, tenantA));
        await db.delete(aprobacionesTenant).where(eq(aprobacionesTenant.tenantId, tenantA));
        await db.delete(instituciones).where(eq(instituciones.id, institucionId));
      },
      async () => {
        await db.delete(pagosCompra).where(eq(pagosCompra.compraId, compraDeC));
        await db.delete(compras).where(eq(compras.id, compraDeC));
        await db.delete(productos).where(eq(productos.id, productoDeC));
        await db.delete(sucursales).where(eq(sucursales.id, sucursalDeC));
      },
    ]);

    // `usuarios.id` referencia `auth.users.id` (`usuarios_id_users_id_fk`,
    // ON DELETE NO ACTION): auth.users va SIEMPRE después de usuarios, nunca
    // en paralelo. Paralelizarlo revienta con 23503 -- verificado corriendo
    // este archivo, no razonado.
    await db.delete(usuarios).where(inArray(usuarios.tenantId, [tenantA, tenantB]));
    await db.delete(usuarios).where(inArray(usuarios.id, authIds));
    await db.delete(tenants).where(inArray(tenants.id, [tenantA, tenantB, tenantC]));
    await db.delete(authUsers).where(inArray(authUsers.id, authIds));
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

  // Etapa 4.a del backstop de RLS (docs/security/PLAN-RLS-BACKSTOP.md
  // §13/§15.3, Opción A′): a diferencia de usuarioCeomAdmin/
  // usuarioCeomAdminDesactivado arriba (UUIDs generados por test,
  // cualquiera con rolId=ROL_CEOM_ADMIN_ID pasa es_ceom_admin()),
  // GATEWAY_SISTEMA_USUARIO_ID es un id FIJO — es_gateway_sistema() filtra
  // por ese id puntual, no por rol, así que no se puede fabricar un usuario
  // de prueba nuevo que lo satisfaga: se usa la fila real sembrada en
  // 0034_gateway_sistema_seed.sql.
  it("el Gateway ve los pagos de compra de un tenant CON consentimiento vigente vía comoGatewaySistema() (4.a.3 + 4.b.0)", async () => {
    const total = await comoGatewaySistema((tx) =>
      repo.sumarPagosCompraPeriodo(tx, tenantA, "2020-01-01", "2030-01-01")
    );
    expect(total).toBe(250);
  });

  // Etapa 4.b.0 del backstop de RLS (docs/security/PLAN-RLS-BACKSTOP.md
  // §16.1.2/§16.10) — escrito y corrido ANTES de aplicar
  // gatewayVigenciaBypassPolicy(): confirmado que este test FALLABA con la
  // policy vieja (gatewaySistemaBypassPolicy(), sin ninguna restricción de
  // tenant) — daba 500, no 0, exactamente el gap real que motivó esta etapa.
  // No es una tautología: tenantC tiene un pago real de 500 (mismo seed que
  // tenantA), la única diferencia es que tenantC no tiene ninguna fila en
  // aprobaciones_tenant. Con gatewayVigenciaBypassPolicy() aplicada, pasa a
  // dar 0 — ver el mensaje del commit que aplica la policy para el estado
  // "antes" documentado, mismo criterio que §11.1 punto 4 del plan.
  it("el Gateway NO ve los pagos de compra de un tenant SIN consentimiento vigente — antes de 4.b.0 esto es la vulnerabilidad real (§16.1.2)", async () => {
    const total = await comoGatewaySistema((tx) =>
      repo.sumarPagosCompraPeriodo(tx, tenantC, "2020-01-01", "2030-01-01")
    );
    expect(total).toBe(0);
  });

  it("el Gateway NO puede escribir (UPDATE) una compra de un tenant ajeno — gatewayVigenciaBypassPolicy() es for:\"select\" únicamente, no \"all\"", async () => {
    // Ataca "compras" directo (no "proveedores", que ni siquiera tiene
    // gatewayVigenciaBypassPolicy() — probar ahí no demostraría nada sobre
    // el recorte for:"select"). tx.update() en vez de un helper de
    // repository.ts: no hace falta uno nuevo solo para este negativo.
    await comoGatewaySistema((tx) =>
      tx.update(compras).set({ montoTotal: "999999" }).where(eq(compras.id, compraDeA))
    );

    const [real] = await comoSistema((tx) => tx.select().from(compras).where(eq(compras.id, compraDeA)));
    expect(Number(real.montoTotal)).toBe(100);
  });
});
