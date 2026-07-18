import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { crearClienteAdmin } from "@/lib/supabase/server";
import { ROL_OWNER_ID } from "@/modules/identidad/constants";
import * as identidadRepo from "@/modules/identidad/repository";
import { roles, sucursales, tenants, usuarios } from "@/modules/identidad/schema";
import {
  crearCanalVenta,
  registrarVenta,
} from "@/modules/ventas/actions";
import { canalesVenta, detallesVenta, ventas } from "@/modules/ventas/schema";
import { crearProducto, registrarAjusteManualStock } from "@/modules/productos/actions";
import { movimientosStock, productos, stock } from "@/modules/productos/schema";
import { controlMerma, distribucionGastos, resumenPeriodo } from "./actions";

const hasCredenciales = Boolean(
  process.env.DATABASE_URL && process.env.SUPABASE_SECRET_KEY
);

// Rule 4 del propio Modulo_10: "este modulo se testea verificando que
// compone la vista correctamente — nunca testea reglas de negocio, porque
// no las tiene". No se duplica el fixture completo de produccion de
// operativo-nicho1.test.ts (insumos/receta/activo) solo para probar que
// controlMerma delega bien — alcanza con confirmar que un tenant sin
// producciones da 0 sin error (caso borde 1), la formula de merma en si ya
// esta probada en su modulo de origen.
vi.setConfig({ testTimeout: 20000, hookTimeout: 20000 });

const periodo = { desde: "2026-07-01", hasta: "2026-07-31" };

describe.skipIf(!hasCredenciales)(
  "Roadmap #14 - Reportes y Dashboard (integracion)",
  () => {
    const admin = crearClienteAdmin();
    const sufijo = Date.now();
    let tenantId: string;
    let ownerId: string;
    let sucursalId: string;

    beforeAll(async () => {
      const { data, error } = await admin.auth.admin.createUser({
        email: `reportes-owner-${sufijo}@ceom-erp.test`,
        email_confirm: true,
      });
      if (error || !data.user) {
        throw error ?? new Error("No se pudo crear el usuario de Auth de prueba");
      }
      ownerId = data.user.id;

      const { tenant, sucursal } = await identidadRepo.crearTenantConOwner({
        tenant: {
          nombreNegocio: `Reportes Test ${sufijo}`,
          monedaPrincipal: "BOB",
          estadoSuscripcion: "activa",
          fechaInicioSuscripcion: new Date().toISOString().slice(0, 10),
        },
        ownerId,
        ownerNombreCompleto: "Owner Reportes",
        ownerEmail: `reportes-owner-${sufijo}@ceom-erp.test`,
        rolOwnerId: ROL_OWNER_ID,
        creadoPor: null,
      });
      tenantId = tenant.id;
      sucursalId = sucursal.id;
    });

    afterAll(async () => {
      const ventasDelTenant = await db
        .select({ id: ventas.id })
        .from(ventas)
        .where(eq(ventas.tenantId, tenantId));
      for (const v of ventasDelTenant) {
        await db.delete(detallesVenta).where(eq(detallesVenta.ventaId, v.id));
      }
      await db.delete(ventas).where(eq(ventas.tenantId, tenantId));
      await db.delete(canalesVenta).where(eq(canalesVenta.tenantId, tenantId));

      const productosDelTenant = await db
        .select({ id: productos.id })
        .from(productos)
        .where(eq(productos.tenantId, tenantId));
      for (const p of productosDelTenant) {
        await db.delete(movimientosStock).where(eq(movimientosStock.productoId, p.id));
        await db.delete(stock).where(eq(stock.productoId, p.id));
      }
      await db.delete(productos).where(eq(productos.tenantId, tenantId));

      await db.delete(usuarios).where(eq(usuarios.tenantId, tenantId));
      await db.delete(roles).where(eq(roles.tenantId, tenantId));
      await db.delete(sucursales).where(eq(sucursales.tenantId, tenantId));
      await db.delete(tenants).where(eq(tenants.id, tenantId));
      await admin.auth.admin.deleteUser(ownerId);
    });

    it("caso de uso 1: resumenPeriodo compone el estado de resultados con datos reales", async () => {
      const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
      const canal = await crearCanalVenta(owner!, tenantId, { nombre: "Local" });
      if (!canal.ok) throw new Error("setup fallo");
      const producto = await crearProducto(owner!, tenantId, {
        nombre: "Producto Reportes",
        unidadVenta: "unidad",
        precioVenta: 40,
        costoOperativoVigente: 15,
      });
      if (!producto.ok) throw new Error("setup fallo");
      await registrarAjusteManualStock(owner!, tenantId, {
        productoId: producto.data.productoId,
        sucursalId,
        tipo: "entrada_ajuste_manual",
        cantidad: 20,
        motivo: "Carga inicial",
      });
      const venta = await registrarVenta(owner!, tenantId, {
        sucursalId,
        canalVentaId: canal.data.canalVentaId,
        fechaVenta: "2026-07-10",
        lineas: [{ productoId: producto.data.productoId, cantidad: 3 }],
      });
      expect(venta.ok).toBe(true);

      const resultado = await resumenPeriodo(owner!, tenantId, periodo);
      expect(resultado.ok).toBe(true);
      if (!resultado.ok) return;
      expect(resultado.data.ingresos).toBeGreaterThanOrEqual(120);
      expect(resultado.data.costos).toBeGreaterThanOrEqual(45);
    });

    it("caso borde 1: distribucionGastos en un tenant recien creado (sin gastos aun) devuelve vacio, no error", async () => {
      const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
      const resultado = await distribucionGastos(owner!, tenantId, periodo);
      expect(resultado.ok).toBe(true);
      if (resultado.ok) expect(resultado.data).toEqual([]);
    });

    it("caso borde 1: controlMerma en un tenant sin Producciones (Nicho 4/Modo Basico) da cero, no error", async () => {
      const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
      const resultado = await controlMerma(owner!, tenantId, periodo);
      expect(resultado.ok).toBe(true);
      if (resultado.ok) expect(resultado.data.mermaCostoTotal).toBe(0);
    });
  }
);
