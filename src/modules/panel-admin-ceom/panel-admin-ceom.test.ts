import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { crearClienteAdmin } from "@/lib/supabase/server";
import { listarLogsAcceso } from "@/modules/consentimiento/actions";
import { logsAccesoAdminCeom } from "@/modules/consentimiento/schema";
import { CEOM_OPS_TENANT_ID, ROL_CEOM_ADMIN_ID, ROL_OWNER_ID } from "@/modules/identidad/constants";
import * as identidadRepo from "@/modules/identidad/repository";
import { roles, sucursales, tenants, usuarios } from "@/modules/identidad/schema";
import { crearProducto } from "@/modules/productos/actions";
import { movimientosStock, productos, stock } from "@/modules/productos/schema";
import { registrarCompra, registrarPagoCompra } from "@/modules/proveedores/actions";
import { compras, pagosCompra } from "@/modules/proveedores/schema";
import { crearPlan } from "@/modules/suscripcion/actions";
import { planes } from "@/modules/suscripcion/schema";
import {
  consultarFinancieroTenant,
  consultarTenantDetalle,
  saludAgregadaPlataforma,
} from "./actions";

const hasCredenciales = Boolean(
  process.env.DATABASE_URL && process.env.SUPABASE_SECRET_KEY
);

vi.setConfig({ testTimeout: 20000 });

const periodo = { desde: "2020-01-01", hasta: "2030-01-01" };

describe.skipIf(!hasCredenciales)(
  "Roadmap #11 - Panel Admin CEOM (integracion)",
  () => {
    let admin: ReturnType<typeof crearClienteAdmin>;
    const sufijo = Date.now();
    let tenantId: string;
    let sucursalId: string;
    let productoId: string;
    let compraId: string;
    let ownerId: string;
    let planId: string;
    let ceomAdminId: string;
    let ceomAdmin: identidadRepo.UsuarioConRol;

    beforeAll(async () => {
      admin = crearClienteAdmin();
      // registrarAccesoAdminCeom() inserta una fila real con FK a
      // usuarios.id — a diferencia del fixture en memoria de
      // identidad.test.ts (que solo ejercita un path de lectura que falla
      // antes de cualquier insert), acá hace falta un usuario CEOM Admin
      // real sembrado en la base.
      const { data: dataCeomAdmin, error: errorCeomAdmin } = await admin.auth.admin.createUser({
        email: `panel-admin-ceomadmin-${sufijo}@ceom-erp.test`,
        email_confirm: true,
      });
      if (errorCeomAdmin || !dataCeomAdmin.user) {
        throw errorCeomAdmin ?? new Error("No se pudo crear el usuario CEOM Admin de prueba");
      }
      ceomAdminId = dataCeomAdmin.user.id;
      await identidadRepo.insertarUsuario({
        id: ceomAdminId,
        tenantId: CEOM_OPS_TENANT_ID,
        nombreCompleto: "CEOM Admin (test panel-admin-ceom)",
        email: `panel-admin-ceomadmin-${sufijo}@ceom-erp.test`,
        rolId: ROL_CEOM_ADMIN_ID,
        esOwner: false,
        activo: true,
      });
      ceomAdmin = (await identidadRepo.obtenerUsuarioConRolPorId(ceomAdminId))!;

      const { data, error } = await admin.auth.admin.createUser({
        email: `panel-admin-owner-${sufijo}@ceom-erp.test`,
        email_confirm: true,
      });
      if (error || !data.user) {
        throw error ?? new Error("No se pudo crear el usuario de Auth de prueba");
      }
      ownerId = data.user.id;

      const plan = await crearPlan(
        { rolId: ROL_CEOM_ADMIN_ID, rol: { esRolSistema: true } },
        {
          nombre: `Plan Panel Admin Test ${sufijo}`,
          precioMensual: 0,
          moneda: "BOB",
        }
      );
      if (!plan.ok) throw new Error("setup fallo: crearPlan");
      planId = plan.data.planId;

      const { tenant, sucursal } = await identidadRepo.crearTenantConOwner({
        tenant: {
          nombreNegocio: `Panel Admin Test ${sufijo}`,
          monedaPrincipal: "BOB",
          planId,
          estadoSuscripcion: "activa",
          fechaInicioSuscripcion: new Date().toISOString().slice(0, 10),
        },
        ownerId,
        ownerNombreCompleto: "Owner Panel Admin",
        ownerEmail: `panel-admin-owner-${sufijo}@ceom-erp.test`,
        rolOwnerId: ROL_OWNER_ID,
        creadoPor: null,
      });
      tenantId = tenant.id;
      sucursalId = sucursal.id;

      // Compra + Pago de Compra reales para este tenant -- sin esto,
      // "caso 3" no puede distinguir un flujoCaja correctamente en 0 (tenant
      // vacío, sin movimientos) de un flujoCaja incorrectamente en 0 porque
      // RLS filtró todo (docs/security/PLAN-RLS-BACKSTOP.md §9.6: hallazgo
      // real encontrado con esta misma aserción, antes solo verificaba
      // `typeof === "number"`).
      const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
      const producto = await crearProducto(owner!, tenantId, {
        nombre: `Producto Panel Admin Test ${sufijo}`,
        unidadVenta: "unidad",
        precioVenta: 20,
      });
      if (!producto.ok) throw new Error("setup fallo: crearProducto");
      productoId = producto.data.productoId;
      const compra = await registrarCompra(owner!, tenantId, {
        sucursalId,
        tipo: "reventa",
        productoId,
        cantidad: 10,
        montoTotal: 100,
        fechaCompra: "2025-06-01",
      });
      if (!compra.ok) throw new Error("setup fallo: registrarCompra");
      compraId = compra.data.compraId;
      const pago = await registrarPagoCompra(owner!, compraId, {
        monto: 100,
        fechaPago: "2025-06-01",
      });
      if (!pago.ok) throw new Error("setup fallo: registrarPagoCompra");
    });

    afterAll(async () => {
      // Orden por FK: movimientos_stock/stock -> productos (sin tenant_id
      // propio, solo producto_id), pagos_compra -> compras, antes de poder
      // borrar productos/compras/tenant (mismo criterio que el resto de los
      // tests de integración de este repo).
      await db.delete(movimientosStock).where(eq(movimientosStock.productoId, productoId));
      await db.delete(stock).where(eq(stock.productoId, productoId));
      await db.delete(pagosCompra).where(eq(pagosCompra.compraId, compraId));
      await db.delete(compras).where(eq(compras.id, compraId));
      await db.delete(productos).where(eq(productos.id, productoId));
      await db.delete(logsAccesoAdminCeom).where(eq(logsAccesoAdminCeom.tenantId, tenantId));
      await db.delete(usuarios).where(eq(usuarios.tenantId, tenantId));
      await db.delete(roles).where(eq(roles.tenantId, tenantId));
      await db.delete(sucursales).where(eq(sucursales.tenantId, tenantId));
      await db.delete(tenants).where(eq(tenants.id, tenantId));
      await db.delete(planes).where(eq(planes.id, planId));
      await admin.auth.admin.deleteUser(ownerId);

      await db.delete(usuarios).where(eq(usuarios.id, ceomAdminId));
      await admin.auth.admin.deleteUser(ceomAdminId);
    });

    it("caso 1: saludAgregadaPlataforma con ceom_admin real cuenta el tenant de prueba", async () => {
      const salud = await saludAgregadaPlataforma(ceomAdmin);
      expect(salud.ok).toBe(true);
      if (!salud.ok) return;
      expect(salud.data.totalTenants).toBeGreaterThanOrEqual(1);
      expect(salud.data.porEstadoAcceso.activo).toBeGreaterThanOrEqual(1);
      const filaPlan = salud.data.porPlan.find((p) => p.planId === planId);
      expect(filaPlan?.cantidad).toBe(1);
    });

    it("caso 2: saludAgregadaPlataforma con un usuario normal (Owner) rechaza sin exponer datos", async () => {
      const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
      const salud = await saludAgregadaPlataforma(owner!);
      expect(salud.ok).toBe(false);
    });

    it("caso 3: ceom_admin lee un tenant ajeno y queda logueado en logs_acceso_admin_ceom", async () => {
      const detalle = await consultarTenantDetalle(ceomAdmin, tenantId);
      expect(detalle.ok).toBe(true);
      if (!detalle.ok) return;
      expect(detalle.data.nombreNegocio).toBe(`Panel Admin Test ${sufijo}`);

      const financiero = await consultarFinancieroTenant(ceomAdmin, tenantId, periodo);
      expect(financiero.ok).toBe(true);
      if (!financiero.ok) return;
      // Valor real, no solo `typeof === "number"`: flujoCaja = pagosVenta -
      // pagosCompra - pagosGasto. Sin ventas/gastos sembrados, el único
      // movimiento es el Pago de Compra de 100 de este setup -> -100. Un
      // `typeof` a secas no distinguía "0 porque el tenant está vacío" de "0
      // porque RLS filtró todo" (docs/security/PLAN-RLS-BACKSTOP.md §9.6 —
      // exactamente el hallazgo real que este assert dejaba pasar en verde).
      expect(financiero.data.flujoCaja).toBe(-100);

      const logs = await listarLogsAcceso({ rolId: ROL_CEOM_ADMIN_ID, rol: { esRolSistema: true } }, { tenantId });
      expect(logs.ok).toBe(true);
      if (!logs.ok) return;
      const logFinanciero = logs.data.find((l) => l.moduloConsultado === "financiero");
      expect(logFinanciero).toBeDefined();
      expect(logFinanciero?.usuarioCeomId).toBe(ceomAdmin.id);
    });

    it("caso 4: un usuario normal no puede leer un tenant ajeno, y no queda log", async () => {
      const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);

      // otro tenant, ajeno a este owner
      const otroPlan = await crearPlan(
        { rolId: ROL_CEOM_ADMIN_ID, rol: { esRolSistema: true } },
        { nombre: `Plan Ajeno Test ${sufijo}`, precioMensual: 0, moneda: "BOB" }
      );
      if (!otroPlan.ok) throw new Error("setup fallo");
      const { data: otroAuth, error: otroError } = await admin.auth.admin.createUser({
        email: `panel-admin-ajeno-${sufijo}@ceom-erp.test`,
        email_confirm: true,
      });
      if (otroError || !otroAuth.user) throw new Error("setup fallo: auth ajeno");
      const { tenant: tenantAjeno } = await identidadRepo.crearTenantConOwner({
        tenant: {
          nombreNegocio: `Ajeno Test ${sufijo}`,
          monedaPrincipal: "BOB",
          planId: otroPlan.data.planId,
          estadoSuscripcion: "activa",
          fechaInicioSuscripcion: new Date().toISOString().slice(0, 10),
        },
        ownerId: otroAuth.user.id,
        ownerNombreCompleto: "Owner Ajeno",
        ownerEmail: `panel-admin-ajeno-${sufijo}@ceom-erp.test`,
        rolOwnerId: ROL_OWNER_ID,
        creadoPor: null,
      });

      const detalle = await consultarTenantDetalle(owner!, tenantAjeno.id);
      expect(detalle.ok).toBe(false);

      const logs = await listarLogsAcceso(
        { rolId: ROL_CEOM_ADMIN_ID, rol: { esRolSistema: true } },
        { tenantId: tenantAjeno.id }
      );
      expect(logs.ok).toBe(true);
      if (!logs.ok) return;
      expect(logs.data.length).toBe(0);

      await db.delete(usuarios).where(eq(usuarios.tenantId, tenantAjeno.id));
      await db.delete(roles).where(eq(roles.tenantId, tenantAjeno.id));
      await db.delete(sucursales).where(eq(sucursales.tenantId, tenantAjeno.id));
      await db.delete(tenants).where(eq(tenants.id, tenantAjeno.id));
      await db.delete(planes).where(eq(planes.id, otroPlan.data.planId));
      await admin.auth.admin.deleteUser(otroAuth.user.id);
    });
  }
);
