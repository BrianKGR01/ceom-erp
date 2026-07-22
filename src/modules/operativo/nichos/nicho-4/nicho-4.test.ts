import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { crearClienteAdmin } from "@/lib/supabase/server";
import { borrarUsuariosAuth, limpiarConAuthGarantizada, limpiarEnParalelo } from "@/test-utils/limpieza";
import { ROL_OWNER_ID } from "@/modules/identidad/constants";
import * as identidadRepo from "@/modules/identidad/repository";
import { roles, sucursales, tenants, usuarios } from "@/modules/identidad/schema";
import { crearActivo } from "@/modules/patrimonio/actions";
import { activos } from "@/modules/patrimonio/schema";
import { crearProducto, registrarAjusteManualStock } from "@/modules/productos/actions";
import { movimientosStock, productos, stock } from "@/modules/productos/schema";
import { consultarCapacidadAlmacenamientoUsada } from "./actions";

const hasCredenciales = Boolean(
  process.env.DATABASE_URL && process.env.SUPABASE_SECRET_KEY
);

vi.setConfig({ testTimeout: 20000 });

describe.skipIf(!hasCredenciales)(
  "Roadmap #12 - Modulo Operativo Nicho 4 (integracion)",
  () => {
    let admin: ReturnType<typeof crearClienteAdmin>;
    const sufijo = Date.now();
    let tenantId: string;
    let ownerId: string;
    let sucursalId: string;
    let productoId: string;

    beforeAll(async () => {
      admin = crearClienteAdmin();
      const { data, error } = await admin.auth.admin.createUser({
        email: `nicho4-owner-${sufijo}@ceom-erp.test`,
        email_confirm: true,
      });
      if (error || !data.user) {
        throw error ?? new Error("No se pudo crear el usuario de Auth de prueba");
      }
      ownerId = data.user.id;

      const { tenant, sucursal } = await identidadRepo.crearTenantConOwner({
        tenant: {
          nombreNegocio: `Nicho 4 Test ${sufijo}`,
          monedaPrincipal: "BOB",
          estadoSuscripcion: "activa",
          fechaInicioSuscripcion: new Date().toISOString().slice(0, 10),
        },
        ownerId,
        ownerNombreCompleto: "Owner Nicho 4",
        ownerEmail: `nicho4-owner-${sufijo}@ceom-erp.test`,
        rolOwnerId: ROL_OWNER_ID,
        creadoPor: null,
      });
      tenantId = tenant.id;
      sucursalId = sucursal.id;

      const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
      const producto = await crearProducto(owner!, tenantId, {
        nombre: "Producto reventa Nicho 4",
        unidadVenta: "unidad",
        precioVenta: 15,
        tipoOrigenProducto: "reventa_simple",
      });
      if (!producto.ok) throw new Error("setup fallo: crearProducto");
      productoId = producto.data.productoId;

      const ajuste = await registrarAjusteManualStock(owner!, tenantId, {
        productoId,
        sucursalId,
        tipo: "entrada_ajuste_manual",
        cantidad: 30,
        motivo: "Carga inicial de stock para test",
      });
      if (!ajuste.ok) throw new Error("setup fallo: registrarAjusteManualStock");
    });

    afterAll(async () => {
      await limpiarConAuthGarantizada(
        async () => {
          await limpiarEnParalelo([
            () => db.delete(activos).where(eq(activos.tenantId, tenantId)),
            async () => {
              await db.delete(movimientosStock).where(eq(movimientosStock.productoId, productoId));
              await db.delete(stock).where(eq(stock.productoId, productoId));
              await db.delete(productos).where(eq(productos.id, productoId));
            },
          ]);
          await db.delete(usuarios).where(eq(usuarios.tenantId, tenantId));
          await db.delete(roles).where(eq(roles.tenantId, tenantId));
          await db.delete(sucursales).where(eq(sucursales.tenantId, tenantId));
          await db.delete(tenants).where(eq(tenants.id, tenantId));
        },
        () => borrarUsuariosAuth(admin, [ownerId])
      );
    });

    it("consultarCapacidadAlmacenamientoUsada cruza stock real de Productos contra la capacidad del Activo", async () => {
      const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
      const activo = await crearActivo(owner!, tenantId, {
        nombre: "Depósito Nicho 4",
        tipo: "equipo_productivo",
        sucursalId,
        capacidadAlmacenamientoCantidad: "100",
        capacidadAlmacenamientoUnidad: "unidad",
        valorCompra: 3000,
        fechaAdquisicion: "2025-01-01",
      });
      if (!activo.ok) throw new Error("setup fallo: crearActivo");

      const resultado = await consultarCapacidadAlmacenamientoUsada(
        owner!,
        tenantId,
        activo.data.activoId,
        sucursalId
      );
      expect(resultado.ok).toBe(true);
      if (!resultado.ok) return;
      expect(resultado.data.capacidadAlmacenamientoCantidad).toBe(100);
      expect(resultado.data.stockActualTotal).toBe(30);
      // calcularPorcentajeCapacidadUsada devuelve una fraccion (0-1), no un
      // porcentaje ya multiplicado por 100 — mismo criterio que Nicho 1.
      expect(resultado.data.porcentajeUsado).toBe(0.3);
    });

    it("caso borde: capacidadAlmacenamientoCantidad=null -> porcentajeUsado=null", async () => {
      const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
      const activo = await crearActivo(owner!, tenantId, {
        nombre: "Depósito sin capacidad definida",
        tipo: "equipo_productivo",
        sucursalId,
        valorCompra: 1000,
        fechaAdquisicion: "2025-01-01",
      });
      if (!activo.ok) throw new Error("setup fallo: crearActivo");

      const resultado = await consultarCapacidadAlmacenamientoUsada(
        owner!,
        tenantId,
        activo.data.activoId,
        sucursalId
      );
      expect(resultado.ok).toBe(true);
      if (!resultado.ok) return;
      expect(resultado.data.capacidadAlmacenamientoCantidad).toBeNull();
      expect(resultado.data.porcentajeUsado).toBeNull();
    });
  }
);
