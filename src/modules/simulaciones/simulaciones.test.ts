import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { crearClienteAdmin } from "@/lib/supabase/server";
import { limpiarConAuthGarantizada, limpiarEnParalelo } from "@/test-utils/limpieza";
import { crearCategoriaGasto, crearGastoManual, registrarPagoGasto } from "@/modules/gastos/actions";
import { categoriasGasto, gastos, pagosGasto } from "@/modules/gastos/schema";
import { ROL_OWNER_ID } from "@/modules/identidad/constants";
import * as identidadRepo from "@/modules/identidad/repository";
import { roles, sucursales, tenants, usuarios } from "@/modules/identidad/schema";
import {
  consultarCostoOperativo,
  crearProducto,
  registrarAjusteManualStock,
} from "@/modules/productos/actions";
import { categoriasProducto, movimientosStock, productos, stock } from "@/modules/productos/schema";
import { crearCanalVenta, registrarVenta } from "@/modules/ventas/actions";
import { canalesVenta, detallesVenta, ventas } from "@/modules/ventas/schema";
import {
  actualizarUmbralAlerta,
  calcularPuntoEquilibrio,
  comparativoMultiSku,
  simularPrecio,
} from "./actions";
import { configuracionSimulaciones, simulaciones } from "./schema";

const hasCredenciales = Boolean(
  process.env.DATABASE_URL && process.env.SUPABASE_SECRET_KEY
);

// beforeAll encadena bastantes pasos (tenant + canal + gasto fijo + 3
// productos + stock + 1 venta) — hookTimeout tambien necesita ampliarse,
// no solo testTimeout (son configs separadas en Vitest).
vi.setConfig({ testTimeout: 20000, hookTimeout: 20000 });

const periodo = { desde: "2026-01-01", hasta: "2026-12-31" };

describe.skipIf(!hasCredenciales)(
  "Roadmap #13 - Simulaciones (integracion)",
  () => {
    let admin: ReturnType<typeof crearClienteAdmin>;
    const sufijo = Date.now();
    let tenantId: string;
    let ownerId: string;
    let sucursalId: string;
    let canalVentaId: string;
    let productoAId: string; // rotacion, margen 60%
    let productoBId: string; // sin ventas, margen 50%
    let productoCId: string; // outlier, margen 10%

    beforeAll(async () => {
      admin = crearClienteAdmin();
      const { data, error } = await admin.auth.admin.createUser({
        email: `simulaciones-owner-${sufijo}@ceom-erp.test`,
        email_confirm: true,
      });
      if (error || !data.user) {
        throw error ?? new Error("No se pudo crear el usuario de Auth de prueba");
      }
      ownerId = data.user.id;

      const { tenant, sucursal } = await identidadRepo.crearTenantConOwner({
        tenant: {
          nombreNegocio: `Simulaciones Test ${sufijo}`,
          monedaPrincipal: "BOB",
          estadoSuscripcion: "activa",
          fechaInicioSuscripcion: new Date().toISOString().slice(0, 10),
        },
        ownerId,
        ownerNombreCompleto: "Owner Simulaciones",
        ownerEmail: `simulaciones-owner-${sufijo}@ceom-erp.test`,
        rolOwnerId: ROL_OWNER_ID,
        creadoPor: null,
      });
      tenantId = tenant.id;
      sucursalId = sucursal.id;

      const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);

      const canal = await crearCanalVenta(owner!, tenantId, { nombre: "Local" });
      if (!canal.ok) throw new Error("setup fallo: crearCanalVenta");
      canalVentaId = canal.data.canalVentaId;

      const categoria = await crearCategoriaGasto(owner!, tenantId, { nombre: "Servicios" });
      if (!categoria.ok) throw new Error("setup fallo: crearCategoriaGasto");
      const gastoFijo = await crearGastoManual(owner!, tenantId, {
        tipo: "fijo",
        categoriaId: categoria.data.categoriaId,
        monto: 150,
        fechaGasto: "2026-06-01",
      });
      if (!gastoFijo.ok) throw new Error("setup fallo: crearGastoManual");
      await registrarPagoGasto(owner!, gastoFijo.data.gastoId, { monto: 150, fechaPago: "2026-06-02" });

      const productoA = await crearProducto(owner!, tenantId, {
        nombre: "Producto A (rotacion)",
        unidadVenta: "unidad",
        precioVenta: 50,
        costoOperativoVigente: 20,
      });
      if (!productoA.ok) throw new Error("setup fallo: crearProducto A");
      productoAId = productoA.data.productoId;
      await registrarAjusteManualStock(owner!, tenantId, {
        productoId: productoAId,
        sucursalId,
        tipo: "entrada_ajuste_manual",
        cantidad: 100,
        motivo: "Carga inicial",
      });
      const venta = await registrarVenta(owner!, tenantId, {
        sucursalId,
        canalVentaId,
        fechaVenta: "2026-06-10",
        lineas: [{ productoId: productoAId, cantidad: 10 }],
      });
      if (!venta.ok) throw new Error("setup fallo: registrarVenta");

      const productoB = await crearProducto(owner!, tenantId, {
        nombre: "Producto B (sin ventas)",
        unidadVenta: "unidad",
        precioVenta: 30,
        costoOperativoVigente: 15,
      });
      if (!productoB.ok) throw new Error("setup fallo: crearProducto B");
      productoBId = productoB.data.productoId;

      const productoC = await crearProducto(owner!, tenantId, {
        nombre: "Producto C (outlier)",
        unidadVenta: "unidad",
        precioVenta: 40,
        costoOperativoVigente: 36,
      });
      if (!productoC.ok) throw new Error("setup fallo: crearProducto C");
      productoCId = productoC.data.productoId;
    });

    afterAll(async () => {
      // "detalles_venta" referencia producto_id -- "ventas" y "productos"
      // van en la misma cadena secuencial, no en ramas paralelas separadas
      // (bug real encontrado corriendo la suite completa, mismo patrón que
      // reportes.test.ts/financiero.test.ts). simulaciones/configuracion/
      // gastos sí son independientes (sin FK a productos ni a ventas).
      await limpiarConAuthGarantizada(
        async () => {
          await limpiarEnParalelo([
            () => db.delete(simulaciones).where(eq(simulaciones.tenantId, tenantId)),
            () => db.delete(configuracionSimulaciones).where(eq(configuracionSimulaciones.tenantId, tenantId)),
            async () => {
              const gastoIds = db.select({ id: gastos.id }).from(gastos).where(eq(gastos.tenantId, tenantId));
              await db.delete(pagosGasto).where(inArray(pagosGasto.gastoId, gastoIds));
              await db.delete(gastos).where(eq(gastos.tenantId, tenantId));
              await db.delete(categoriasGasto).where(eq(categoriasGasto.tenantId, tenantId));
            },
            async () => {
              const ventaIds = db.select({ id: ventas.id }).from(ventas).where(eq(ventas.tenantId, tenantId));
              await db.delete(detallesVenta).where(inArray(detallesVenta.ventaId, ventaIds));
              await db.delete(ventas).where(eq(ventas.tenantId, tenantId));
              await db.delete(canalesVenta).where(eq(canalesVenta.tenantId, tenantId));

              const productoIds = db
                .select({ id: productos.id })
                .from(productos)
                .where(eq(productos.tenantId, tenantId));
              await db.delete(movimientosStock).where(inArray(movimientosStock.productoId, productoIds));
              await db.delete(stock).where(inArray(stock.productoId, productoIds));
              await db.delete(productos).where(eq(productos.tenantId, tenantId));
              await db.delete(categoriasProducto).where(eq(categoriasProducto.tenantId, tenantId));
            },
          ]);

          await db.delete(usuarios).where(eq(usuarios.tenantId, tenantId));
          await db.delete(roles).where(eq(roles.tenantId, tenantId));
          await db.delete(sucursales).where(eq(sucursales.tenantId, tenantId));
          await db.delete(tenants).where(eq(tenants.id, tenantId));
        },
        () => admin.auth.admin.deleteUser(ownerId)
      );
    });

    it("caso 1: simularPrecio con rotacion real calcula impactoProyectadoBs y persiste la simulacion", async () => {
      const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
      const resultado = await simularPrecio(owner!, tenantId, {
        productoId: productoAId,
        frecuencia: "mensual",
        periodo,
        margenDeseadoPct: 50,
      });
      expect(resultado.ok).toBe(true);
      if (!resultado.ok) return;
      expect(resultado.data.rotacionPeriodo).toBeGreaterThanOrEqual(10);
      expect(resultado.data.precioSugerido).toBe(40); // 20 / (1 - 0.5)
      expect(resultado.data.impactoProyectadoBs).not.toBeNull();
      expect(resultado.data.simulacionId).toBeTruthy();
    });

    it("caso borde 1: simularPrecio sin ventas del producto deja impactoProyectadoBs en null", async () => {
      const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
      const resultado = await simularPrecio(owner!, tenantId, {
        productoId: productoBId,
        frecuencia: "mensual",
        periodo,
        margenDeseadoPct: 40,
      });
      expect(resultado.ok).toBe(true);
      if (!resultado.ok) return;
      expect(resultado.data.rotacionPeriodo).toBe(0);
      expect(resultado.data.impactoProyectadoBs).toBeNull();
      expect(resultado.data.precioSugerido).toBeCloseTo(25, 5); // 15 / (1 - 0.4)
    });

    it("regla 3.3: simularPrecio con costoManual no persiste ni modifica el costo real del producto", async () => {
      const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
      const resultado = await simularPrecio(owner!, tenantId, {
        productoId: productoAId,
        frecuencia: "mensual",
        periodo,
        margenDeseadoPct: 50,
        costoManual: 25,
      });
      expect(resultado.ok).toBe(true);
      if (!resultado.ok) return;
      expect(resultado.data.costoEsManual).toBe(true);
      expect(resultado.data.costoUsado).toBe(25);
      expect(resultado.data.precioSugerido).toBe(50); // 25 / (1 - 0.5)

      const costoReal = await consultarCostoOperativo(owner!, productoAId);
      expect(costoReal.ok).toBe(true);
      if (costoReal.ok) expect(costoReal.data.costoOperativoVigente).toBe(20);
    });

    it("caso 4: calcularPuntoEquilibrio con margen de contribucion positivo", async () => {
      const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
      const resultado = await calcularPuntoEquilibrio(owner!, tenantId, {
        productoId: productoAId,
        frecuencia: "mensual",
        periodo,
      });
      expect(resultado.ok).toBe(true);
      if (!resultado.ok) return;
      expect(resultado.data.margenContribucionUnitario).toBe(30); // 50 - 20
      expect(resultado.data.puntoEquilibrioUnidades).not.toBeNull();
      expect(resultado.data.advertencia).toBeNull();
    });

    it("comparativoMultiSku marca alerta en el producto que se aleja del promedio, no en el cercano", async () => {
      const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
      const resultado = await comparativoMultiSku(owner!, tenantId);
      expect(resultado.ok).toBe(true);
      if (!resultado.ok) return;

      const filaC = resultado.data.productos.find((p) => p.productoId === productoCId);
      const filaB = resultado.data.productos.find((p) => p.productoId === productoBId);
      expect(filaC?.alerta).toBe(true);
      expect(filaB?.alerta).toBe(false);
    });

    it("actualizarUmbralAlerta cambia el umbral usado por comparativoMultiSku", async () => {
      const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
      const actualizado = await actualizarUmbralAlerta(owner!, tenantId, 90);
      expect(actualizado.ok).toBe(true);
      if (actualizado.ok) expect(actualizado.data.umbralMargenAlertaPct).toBe(90);

      const resultado = await comparativoMultiSku(owner!, tenantId);
      expect(resultado.ok).toBe(true);
      if (!resultado.ok) return;
      // Con umbral 90, ninguna diferencia de margen del catalogo lo supera.
      expect(resultado.data.productos.every((p) => !p.alerta)).toBe(true);
    });

    it("caso borde 2: calcularPuntoEquilibrio con margen de contribucion <= 0 devuelve advertencia", async () => {
      const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
      const productoD = await crearProducto(owner!, tenantId, {
        nombre: "Producto D (margen negativo)",
        unidadVenta: "unidad",
        precioVenta: 20,
        costoOperativoVigente: 25,
      });
      if (!productoD.ok) throw new Error("setup fallo: crearProducto D");

      const resultado = await calcularPuntoEquilibrio(owner!, tenantId, {
        productoId: productoD.data.productoId,
        frecuencia: "mensual",
        periodo,
      });
      expect(resultado.ok).toBe(true);
      if (!resultado.ok) return;
      expect(resultado.data.margenContribucionUnitario).toBe(-5);
      expect(resultado.data.puntoEquilibrioUnidades).toBeNull();
      expect(resultado.data.advertencia).not.toBeNull();
    });
  }
);
