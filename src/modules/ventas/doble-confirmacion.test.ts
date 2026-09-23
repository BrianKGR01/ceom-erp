import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { registrarAjusteManualStock } from "@/modules/productos/actions";
import { productos } from "@/modules/productos/schema";
import { crearFixturePermisosCruzados, type FixturePermisosCruzados } from "@/test-utils/fixture-permisos-cruzados";
import { crearCanalVenta, crearMetodoPago, registrarAjusteVenta, registrarPagoVenta, registrarVenta } from "./actions";
import { pagosVenta, ventas } from "./schema";

/**
 * Guardas del servidor contra la doble confirmación (informe de ventas
 * duplicadas del 2026-09-23). La pantalla ya no deja reconfirmar, pero el
 * servidor tiene que sostener la regla solo: recargas, doble toque, otra
 * pestaña. Los tres casos salieron de datos reales de producción:
 * - una venta de Bs 37 con DOS anulaciones totales (en reportes valía −37);
 * - ventas de Bs 15 y Bs 27 cobradas dos veces;
 * - (pago inicial mayor al total: se valida antes de crear la venta).
 */
const hasPostgres = Boolean(process.env.DATABASE_URL);
vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 });

describe.skipIf(!hasPostgres)("Ventas — guardas contra la doble confirmación", () => {
  let f: FixturePermisosCruzados;
  let productoId: string;
  let canalVentaId: string;
  let metodoPagoId: string;

  beforeAll(async () => {
    f = await crearFixturePermisosCruzados("doble-confirmacion", []);
    const [producto] = await db
      .insert(productos)
      .values({ tenantId: f.tenantId, nombre: "Cuñapé", unidadVenta: "unidad", precioVenta: "15" })
      .returning();
    productoId = producto.id;
    const entrada = await registrarAjusteManualStock(f.owner, f.tenantId, {
      productoId,
      sucursalId: f.sucursalId,
      tipo: "entrada_ajuste_manual",
      cantidad: 100,
      motivo: "Stock del test",
    });
    if (!entrada.ok) throw new Error(entrada.error);
    const canal = await crearCanalVenta(f.owner, f.tenantId, { nombre: "Local" });
    if (!canal.ok) throw new Error(canal.error);
    canalVentaId = canal.data.canalVentaId;
    const metodo = await crearMetodoPago(f.owner, f.tenantId, { nombre: "QR" });
    if (!metodo.ok) throw new Error(metodo.error);
    metodoPagoId = metodo.data.metodoPagoId;
  });

  afterAll(async () => {
    await f?.limpiar();
  });

  async function nuevaVenta(cantidad = 1) {
    const res = await registrarVenta(f.owner, f.tenantId, {
      sucursalId: f.sucursalId,
      canalVentaId,
      lineas: [{ productoId, cantidad }],
    });
    if (!res.ok) throw new Error(res.error);
    return res.data.ventaId;
  }

  const totalPagado = async (ventaId: string) => {
    const [fila] = await db
      .select({ total: sql<string>`coalesce(sum(${pagosVenta.monto}), 0)` })
      .from(pagosVenta)
      .where(eq(pagosVenta.ventaId, ventaId));
    return Number(fila.total);
  };

  describe("ajustes", () => {
    it("una segunda anulación total de la misma venta se rechaza (el caso −37)", async () => {
      const ventaId = await nuevaVenta();
      const anulacion = { tipo: "anulacion_total" as const, montoAjuste: -15, motivo: "Venta duplicada" };

      const primera = await registrarAjusteVenta(f.owner, ventaId, anulacion);
      expect(primera.ok).toBe(true);

      const segunda = await registrarAjusteVenta(f.owner, ventaId, anulacion);
      expect(segunda).toEqual({ ok: false, error: "Esta venta ya está anulada por completo: no se le puede descontar más." });
    });

    it("un descuento que dejaría la venta en negativo se rechaza con los montos", async () => {
      const ventaId = await nuevaVenta(2); // Bs 30
      const descuento = await registrarAjusteVenta(f.owner, ventaId, {
        tipo: "descuento_posterior",
        montoAjuste: -20,
        motivo: "Promo",
      });
      expect(descuento.ok).toBe(true);

      const excede = await registrarAjusteVenta(f.owner, ventaId, {
        tipo: "descuento_posterior",
        montoAjuste: -15,
        motivo: "Otra promo",
      });
      expect(excede).toEqual({
        ok: false,
        error: "El ajuste no puede dejar la venta en negativo: hoy vale 10.00, y este ajuste la bajaría a -5.00.",
      });
      // El resto que sí entra, entra.
      await expect(
        registrarAjusteVenta(f.owner, ventaId, { tipo: "descuento_posterior", montoAjuste: -10, motivo: "Resto" })
      ).resolves.toMatchObject({ ok: true });
    });
  });

  describe("pagos", () => {
    it("un segundo pago del total se rechaza: la venta ya está pagada (el caso Bs 15 cobrada 30)", async () => {
      const ventaId = await nuevaVenta();
      const pago = { monto: 15, metodoPagoId };

      await expect(registrarPagoVenta(f.owner, ventaId, pago)).resolves.toMatchObject({ ok: true });
      await expect(registrarPagoVenta(f.owner, ventaId, pago)).resolves.toEqual({
        ok: false,
        error: "Esta venta ya está pagada por completo.",
      });
      expect(await totalPagado(ventaId)).toBe(15);
    });

    it("un pago mayor al saldo se rechaza con el saldo", async () => {
      const ventaId = await nuevaVenta(2); // Bs 30
      await expect(registrarPagoVenta(f.owner, ventaId, { monto: 10, metodoPagoId })).resolves.toMatchObject({ ok: true });
      await expect(registrarPagoVenta(f.owner, ventaId, { monto: 25, metodoPagoId })).resolves.toEqual({
        ok: false,
        error: "El pago supera el saldo pendiente de la venta (20.00).",
      });
      expect(await totalPagado(ventaId)).toBe(10);
    });

    it("dos pagos del total en simultáneo: entra exactamente uno", async () => {
      const ventaId = await nuevaVenta();
      const resultados = await Promise.all([
        registrarPagoVenta(f.owner, ventaId, { monto: 15, metodoPagoId }),
        registrarPagoVenta(f.owner, ventaId, { monto: 15, metodoPagoId }),
      ]);
      expect(resultados.filter((r) => r.ok)).toHaveLength(1);
      expect(await totalPagado(ventaId)).toBe(15);
    });

    it("un pago inicial mayor al total se rechaza ANTES de crear la venta", async () => {
      const contar = async () =>
        (await db.select({ id: ventas.id }).from(ventas).where(eq(ventas.tenantId, f.tenantId))).length;
      const antes = await contar();

      const res = await registrarVenta(f.owner, f.tenantId, {
        sucursalId: f.sucursalId,
        canalVentaId,
        lineas: [{ productoId, cantidad: 1 }],
        pagoInicial: { metodoPagoId, monto: 20 },
      });

      expect(res).toEqual({
        ok: false,
        error: "El pago (20.00) supera el total de la venta (15.00). Cargá el total, no el efectivo recibido.",
      });
      expect(await contar()).toBe(antes);
    });
  });
});
