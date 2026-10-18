import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import {
  actualizarComposicionReceta,
  cambiarModoConsumoProducto,
  crearInsumo,
  crearReceta,
  registrarEntradaCompraInsumo,
  vincularProductoAReceta,
} from "@/modules/operativo/nichos/nicho-1/actions";
import { movimientosInsumo, stockInsumo } from "@/modules/operativo/nichos/nicho-1/schema";
import { registrarAjusteManualStock } from "@/modules/productos/actions";
import { movimientosStock, productos } from "@/modules/productos/schema";
import {
  crearFixturePermisosCruzados,
  type FixturePermisosCruzados,
} from "@/test-utils/fixture-permisos-cruzados";
import { crearCanalVenta, registrarVenta } from "./actions";
import { detallesVenta, ventas } from "./schema";

/**
 * Roadmap Cafiatto, Fase 1 — un producto "preparado al vender" descuenta los
 * insumos de su receta al registrar la venta, sin Produccion previa (cierra
 * H-53). Cada caso afirma un numero que la falla no puede producir
 * (dev-practices 6.1 b): el saldo/ledger de insumos, no solo `ok: true`.
 *
 * Receta por unidad (rendimiento 1, base 1), como las 21 de CAFIATTO:
 * 0,0150 kg de cafe y 0,2 L de leche por unidad. El cafe va con 4 decimales a
 * proposito: con la precision vieja (2) cada venta guardaba 0,02.
 */
const hasPostgres = Boolean(process.env.DATABASE_URL);
vi.setConfig({ testTimeout: 40_000, hookTimeout: 60_000 });

describe.skipIf(!hasPostgres)("Ventas — consumo de insumos por receta al vender (Fase 1)", () => {
  let f: FixturePermisosCruzados;
  let canalVentaId: string;
  let cafeId: string;
  let lecheId: string;
  let latteId: string; // al_vender: 0,0150 kg cafe + 0,2 L leche
  let espressoId: string; // al_vender: 0,0150 kg cafe (comparte insumo con el latte)
  let medialunaId: string; // al_producir (normal), con stock de producto

  const saldo = async (insumoId: string) => {
    const [fila] = await db
      .select({ c: stockInsumo.cantidadActual })
      .from(stockInsumo)
      .where(and(eq(stockInsumo.insumoId, insumoId), eq(stockInsumo.sucursalId, f.sucursalId)));
    return Number(fila?.c ?? 0);
  };
  const movimientosDeVenta = (ventaId: string) =>
    db.select().from(movimientosInsumo).where(eq(movimientosInsumo.referenciaId, ventaId));
  const cuentaVentas = async () =>
    (await db.select({ id: ventas.id }).from(ventas).where(eq(ventas.tenantId, f.tenantId))).length;

  async function nuevoProducto(nombre: string, precio: string, composicion: Array<[string, number]>) {
    const [producto] = await db
      .insert(productos)
      .values({ tenantId: f.tenantId, nombre, unidadVenta: "unidad", precioVenta: precio })
      .returning();
    const receta = await crearReceta(f.owner, f.tenantId, {
      nombre: `Receta ${nombre}`,
      rendimientoPorLote: 1,
      unidadRendimiento: "UND",
    });
    if (!receta.ok) throw new Error(receta.error);
    const comp = await actualizarComposicionReceta(
      f.owner,
      receta.data.recetaId,
      composicion.map(([insumoId, cantidadPorLote]) => ({ insumoId, cantidadPorLote }))
    );
    if (!comp.ok) throw new Error(comp.error);
    const vinculo = await vincularProductoAReceta(f.owner, f.tenantId, {
      productoId: producto.id,
      recetaId: receta.data.recetaId,
      cantidadBaseConsumidaPorUnidad: 1,
      modoConsumo: "al_vender",
    });
    if (!vinculo.ok) throw new Error(vinculo.error);
    return producto.id;
  }

  async function entradaInsumo(insumoId: string, cantidad: number, costoCompra: number) {
    const r = await registrarEntradaCompraInsumo(f.owner, f.tenantId, {
      insumoId,
      sucursalId: f.sucursalId,
      cantidad,
      costoCompra,
    });
    if (!r.ok) throw new Error(r.error);
  }

  beforeAll(async () => {
    f = await crearFixturePermisosCruzados("consumo-receta", [
      ["productos", "ver"],
      ["ventas", "ver"],
      ["ventas", "crear"],
    ]);
    const canal = await crearCanalVenta(f.owner, f.tenantId, { nombre: "Local" });
    if (!canal.ok) throw new Error(canal.error);
    canalVentaId = canal.data.canalVentaId;

    const cafe = await crearInsumo(f.owner, f.tenantId, { nombre: "Café en grano", unidadMedida: "kg" });
    const leche = await crearInsumo(f.owner, f.tenantId, { nombre: "Leche", unidadMedida: "litros" });
    if (!cafe.ok || !leche.ok) throw new Error("insumos");
    cafeId = cafe.data.insumoId;
    lecheId = leche.data.insumoId;
    await entradaInsumo(cafeId, 1, 100); // 1 kg a Bs 100/kg
    await entradaInsumo(lecheId, 10, 8); // 10 L a Bs 8/L

    latteId = await nuevoProducto("Latte", "20", [
      [cafeId, 0.015],
      [lecheId, 0.2],
    ]);
    espressoId = await nuevoProducto("Espresso", "10", [[cafeId, 0.015]]);

    const [medialuna] = await db
      .insert(productos)
      .values({ tenantId: f.tenantId, nombre: "Medialuna", unidadVenta: "unidad", precioVenta: "5" })
      .returning();
    medialunaId = medialuna.id;
    const ajuste = await registrarAjusteManualStock(f.owner, f.tenantId, {
      productoId: medialunaId,
      sucursalId: f.sucursalId,
      tipo: "entrada_ajuste_manual",
      cantidad: 10,
      motivo: "Stock del test",
    });
    if (!ajuste.ok) throw new Error(ajuste.error);
  });

  afterAll(async () => {
    await f?.limpiar();
  });

  const vender = (usuario: FixturePermisosCruzados["owner"], lineas: Array<[string, number]>, clave?: string) =>
    registrarVenta(usuario, f.tenantId, {
      sucursalId: f.sucursalId,
      canalVentaId,
      claveIdempotencia: clave,
      lineas: lineas.map(([productoId, cantidad]) => ({ productoId, cantidad })),
    });

  it("descuenta los insumos de la receta con 4 decimales, congela el costo y no toca stock de producto", async () => {
    const cafeAntes = await saldo(cafeId);
    const lecheAntes = await saldo(lecheId);

    const res = await vender(f.owner, [[latteId, 3]]);
    if (!res.ok) throw new Error(res.error);

    // 3 x 0,0150 = 0,0450 (con 2 decimales habria sido 0,06) y 3 x 0,2 = 0,6.
    expect(cafeAntes - (await saldo(cafeId))).toBeCloseTo(0.045, 4);
    expect(lecheAntes - (await saldo(lecheId))).toBeCloseTo(0.6, 4);

    const movs = await movimientosDeVenta(res.data.ventaId);
    expect(movs).toHaveLength(2);
    expect(movs.every((m) => m.tipo === "salida_venta")).toBe(true);
    expect(Number(movs.find((m) => m.insumoId === cafeId)?.cantidad)).toBeCloseTo(0.045, 4);

    // Costo congelado en la linea: 0,015 x 100 + 0,2 x 8 = 3,10 por unidad.
    const [linea] = await db.select().from(detallesVenta).where(eq(detallesVenta.ventaId, res.data.ventaId));
    expect(Number(linea.costoUnitarioSnapshot)).toBeCloseTo(3.1, 4);
    expect(linea.costoDesconocido).toBe(false);

    // Producto preparado al vender: ningun movimiento de stock de producto terminado.
    const deProducto = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(movimientosStock)
      .where(eq(movimientosStock.productoId, latteId));
    expect(deProducto[0].n).toBe(0);
  });

  it("agrega el mismo insumo de varios productos de la venta", async () => {
    const cafeAntes = await saldo(cafeId);
    const res = await vender(f.owner, [
      [latteId, 2],
      [espressoId, 4],
    ]);
    if (!res.ok) throw new Error(res.error);
    // (2 + 4) x 0,0150 = 0,09, en UN solo movimiento de cafe.
    expect(cafeAntes - (await saldo(cafeId))).toBeCloseTo(0.09, 4);
    const movsCafe = (await movimientosDeVenta(res.data.ventaId)).filter((m) => m.insumoId === cafeId);
    expect(movsCafe).toHaveLength(1);
  });

  it("un producto en modo al_producir sigue descontando stock de producto, no insumos", async () => {
    const cafeAntes = await saldo(cafeId);
    const res = await vender(f.owner, [[medialunaId, 2]]);
    if (!res.ok) throw new Error(res.error);
    expect(await saldo(cafeId)).toBe(cafeAntes);
    expect(await movimientosDeVenta(res.data.ventaId)).toHaveLength(0);
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(movimientosStock)
      .where(and(eq(movimientosStock.productoId, medialunaId), eq(movimientosStock.referenciaId, res.data.ventaId)));
    expect(n).toBe(1);
  });

  it("sin stock de insumo y sin vender_sin_stock: se rechaza la venta ENTERA, sin dejar restos", async () => {
    const ventasAntes = await cuentaVentas();
    const lecheAntes = await saldo(lecheId);
    // Pide 100 lattes = 20 L de leche; hay ~8,6 L.
    const res = await vender(f.colaborador, [[latteId, 100]]);
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("inalcanzable");
    expect(res.error).toMatch(/^Insumo insuficiente \("(Leche|Café en grano)"\)/);
    expect(await cuentaVentas()).toBe(ventasAntes);
    expect(await saldo(lecheId)).toBe(lecheAntes);
  });

  it("con vender_sin_stock (owner) la venta pasa y el insumo queda en negativo, avisado", async () => {
    const res = await vender(f.owner, [[latteId, 100]]);
    if (!res.ok) throw new Error(res.error);
    expect(await saldo(lecheId)).toBeLessThan(0);
    expect(res.data.consumoInsumos).toMatchObject({ ok: true });
    const negativos =
      res.data.consumoInsumos?.ok === true
        ? res.data.consumoInsumos.data.saldos.filter((s) => s.cantidadActual < 0)
        : [];
    expect(negativos.map((s) => s.insumoNombre)).toContain("Leche");
  });

  it("repetir el mismo intento no vuelve a consumir insumos", async () => {
    // Se repone stock para que el caso mida solo la repeticion.
    await entradaInsumo(lecheId, 50, 8);
    await entradaInsumo(cafeId, 5, 100);
    const clave = randomUUID();
    const lecheAntes = await saldo(lecheId);

    const primera = await vender(f.owner, [[latteId, 1]], clave);
    const segunda = await vender(f.owner, [[latteId, 1]], clave);
    if (!primera.ok || !segunda.ok) throw new Error("inalcanzable");

    expect(segunda.data.repetida).toBe(true);
    expect(segunda.data.ventaId).toBe(primera.data.ventaId);
    expect(lecheAntes - (await saldo(lecheId))).toBeCloseTo(0.2, 4);
    expect(await movimientosDeVenta(primera.data.ventaId)).toHaveLength(2);
  });

  it("pasar a al_vender una receta sin insumos se rechaza", async () => {
    const [producto] = await db
      .insert(productos)
      .values({ tenantId: f.tenantId, nombre: "Vacio", unidadVenta: "unidad", precioVenta: "1" })
      .returning();
    const receta = await crearReceta(f.owner, f.tenantId, {
      nombre: "Receta vacia",
      rendimientoPorLote: 1,
      unidadRendimiento: "UND",
    });
    if (!receta.ok) throw new Error(receta.error);
    const vinculo = await vincularProductoAReceta(f.owner, f.tenantId, {
      productoId: producto.id,
      recetaId: receta.data.recetaId,
      cantidadBaseConsumidaPorUnidad: 1,
    });
    if (!vinculo.ok) throw new Error(vinculo.error);

    const cambio = await cambiarModoConsumoProducto(f.owner, producto.id, "al_vender");
    expect(cambio).toEqual({
      ok: false,
      error: "La receta no tiene insumos: cargá su composición antes de descontarla al vender.",
    });
  });
});
