import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { hoyLocal, sumarDias, zonaHorariaTenant } from "@/lib/periodo";
import { registrarAjusteManualStock } from "@/modules/productos/actions";
import { movimientosStock, productos, stock } from "@/modules/productos/schema";
import {
  crearFixturePermisosCruzados,
  type FixturePermisosCruzados,
} from "@/test-utils/fixture-permisos-cruzados";
import {
  actualizarComposicionReceta,
  consultarBajasPorMotivo,
  crearInsumo,
  crearReceta,
  listarBajas,
  registrarBajaInsumo,
  registrarBajaProducto,
  registrarEntradaCompraInsumo,
  vincularProductoAReceta,
} from "./actions";
import { bajas, movimientosInsumo, stockInsumo } from "./schema";

/**
 * Roadmap Cafiatto, Fase 2 — bajas de insumo y de producto. Cada caso afirma un
 * numero que la falla no puede producir (dev-practices 6.1 b): saldo, ledger,
 * costo congelado y el movimiento atado a la baja, no solo `ok: true`.
 */
const hasPostgres = Boolean(process.env.DATABASE_URL);
vi.setConfig({ testTimeout: 40_000, hookTimeout: 60_000 });

describe.skipIf(!hasPostgres)("Bajas de insumo y de producto (Fase 2)", () => {
  let f: FixturePermisosCruzados;
  let otro: FixturePermisosCruzados;
  let cafeId: string;
  let lecheId: string;
  let sinCostoId: string;
  let latteId: string;
  let medialunaId: string;
  let tortaSinCostoId: string;

  const saldo = async (insumoId: string) => {
    const [fila] = await db
      .select({ c: stockInsumo.cantidadActual })
      .from(stockInsumo)
      .where(and(eq(stockInsumo.insumoId, insumoId), eq(stockInsumo.sucursalId, f.sucursalId)));
    return Number(fila?.c ?? 0);
  };
  const movimientosDeBaja = (bajaId: string) =>
    db.select().from(movimientosInsumo).where(eq(movimientosInsumo.referenciaId, bajaId));

  beforeAll(async () => {
    f = await crearFixturePermisosCruzados("bajas", [["operativo", "ver"]]);
    otro = await crearFixturePermisosCruzados("bajas-otro", []);

    const mk = async (nombre: string, unidadMedida: "kg" | "litros") => {
      const r = await crearInsumo(f.owner, f.tenantId, { nombre, unidadMedida });
      if (!r.ok) throw new Error(r.error);
      return r.data.insumoId;
    };
    cafeId = await mk("Café en grano", "kg");
    lecheId = await mk("Leche", "litros");
    sinCostoId = await mk("Vasos sin costo", "kg");
    for (const [insumoId, cantidad, costoCompra] of [
      [cafeId, 1, 100],
      [lecheId, 10, 8],
    ] as const) {
      const e = await registrarEntradaCompraInsumo(f.owner, f.tenantId, {
        insumoId,
        sucursalId: f.sucursalId,
        cantidad,
        costoCompra,
      });
      if (!e.ok) throw new Error(e.error);
    }

    // Latte: se prepara al vender (0,015 kg de cafe + 0,2 L de leche por unidad).
    const [latte] = await db
      .insert(productos)
      .values({ tenantId: f.tenantId, nombre: "Latte", unidadVenta: "unidad", precioVenta: "20" })
      .returning();
    latteId = latte.id;
    const receta = await crearReceta(f.owner, f.tenantId, {
      nombre: "Receta Latte",
      rendimientoPorLote: 1,
      unidadRendimiento: "UND",
    });
    if (!receta.ok) throw new Error(receta.error);
    const comp = await actualizarComposicionReceta(f.owner, receta.data.recetaId, [
      { insumoId: cafeId, cantidadPorLote: 0.015 },
      { insumoId: lecheId, cantidadPorLote: 0.2 },
    ]);
    if (!comp.ok) throw new Error(comp.error);
    const vinculo = await vincularProductoAReceta(f.owner, f.tenantId, {
      productoId: latteId,
      recetaId: receta.data.recetaId,
      cantidadBaseConsumidaPorUnidad: 1,
      modoConsumo: "al_vender",
    });
    if (!vinculo.ok) throw new Error(vinculo.error);

    // Productos con stock terminado: uno con costo, otro sin costo conocido.
    const [medialuna, torta] = await db
      .insert(productos)
      .values([
        { tenantId: f.tenantId, nombre: "Medialuna", unidadVenta: "unidad", precioVenta: "5", costoOperativoVigente: "2" },
        { tenantId: f.tenantId, nombre: "Torta", unidadVenta: "unidad", precioVenta: "90" },
      ])
      .returning();
    medialunaId = medialuna.id;
    tortaSinCostoId = torta.id;
    for (const productoId of [medialunaId, tortaSinCostoId]) {
      const a = await registrarAjusteManualStock(f.owner, f.tenantId, {
        productoId,
        sucursalId: f.sucursalId,
        tipo: "entrada_ajuste_manual",
        cantidad: 10,
        motivo: "Stock del test",
      });
      if (!a.ok) throw new Error(a.error);
    }
  });

  afterAll(async () => {
    await f?.limpiar();
    await otro?.limpiar();
  });

  it("baja de insumo: baja el saldo, congela el costo y ata el movimiento a la baja", async () => {
    const antes = await saldo(lecheId);
    const r = await registrarBajaInsumo(f.owner, f.tenantId, {
      insumoId: lecheId,
      sucursalId: f.sucursalId,
      cantidad: 1.5,
      motivo: "derrame_desperdicio",
    });
    if (!r.ok) throw new Error(r.error);

    expect(antes - (await saldo(lecheId))).toBeCloseTo(1.5, 4);
    expect(r.data.costoTotal).toBeCloseTo(12, 4); // 1,5 L x Bs 8
    const [baja] = await db.select().from(bajas).where(eq(bajas.id, r.data.bajaId));
    expect(Number(baja.costoTotal)).toBeCloseTo(12, 4);
    expect(baja.costoDesconocido).toBe(false);
    const movs = await movimientosDeBaja(r.data.bajaId);
    expect(movs).toHaveLength(1);
    expect(movs[0].tipo).toBe("salida_baja");
    expect(Number(movs[0].cantidad)).toBeCloseTo(1.5, 4);
  });

  it("baja de insumo que supera el saldo: pasa, el saldo queda en negativo y se informa", async () => {
    const r = await registrarBajaInsumo(f.owner, f.tenantId, {
      insumoId: cafeId,
      sucursalId: f.sucursalId,
      cantidad: 3,
      motivo: "vencimiento",
    });
    if (!r.ok) throw new Error(r.error);
    expect(r.data.saldos[0]).toMatchObject({ insumoNombre: "Café en grano" });
    expect(r.data.saldos[0].cantidadActual).toBeLessThan(0);
    expect(await saldo(cafeId)).toBeLessThan(0);
  });

  it("baja de insumo sin costo conocido: se marca, no se estima en cero", async () => {
    const r = await registrarBajaInsumo(f.owner, f.tenantId, {
      insumoId: sinCostoId,
      sucursalId: f.sucursalId,
      cantidad: 2,
      motivo: "danio",
    });
    if (!r.ok) throw new Error(r.error);
    expect(r.data.costoTotal).toBeNull();
    const [baja] = await db.select().from(bajas).where(eq(bajas.id, r.data.bajaId));
    expect(baja.costoTotal).toBeNull();
    expect(baja.costoDesconocido).toBe(true);
  });

  it("baja de un producto preparado: consume los insumos de su receta, sin tocar stock de producto", async () => {
    // Se repone leche y cafe para medir solo este caso.
    for (const insumoId of [cafeId, lecheId]) {
      const e = await registrarEntradaCompraInsumo(f.owner, f.tenantId, {
        insumoId,
        sucursalId: f.sucursalId,
        cantidad: 20,
        costoCompra: insumoId === cafeId ? 100 : 8,
      });
      if (!e.ok) throw new Error(e.error);
    }
    const cafeAntes = await saldo(cafeId);
    const lecheAntes = await saldo(lecheId);

    const r = await registrarBajaProducto(f.owner, f.tenantId, {
      productoId: latteId,
      sucursalId: f.sucursalId,
      cantidad: 2,
      motivo: "error_preparacion",
    });
    if (!r.ok) throw new Error(r.error);

    // 2 x 0,015 = 0,03 de cafe y 2 x 0,2 = 0,4 de leche.
    expect(cafeAntes - (await saldo(cafeId))).toBeCloseTo(0.03, 4);
    expect(lecheAntes - (await saldo(lecheId))).toBeCloseTo(0.4, 4);
    // Costo de la receta: ~0,015 x costo del cafe + 0,2 x costo de la leche, por 2 unidades.
    expect(r.data.costoTotal).not.toBeNull();
    const movs = await movimientosDeBaja(r.data.bajaId);
    expect(movs).toHaveLength(2);
    expect(movs.every((m) => m.tipo === "salida_baja")).toBe(true);
    const deProducto = await db.select().from(movimientosStock).where(eq(movimientosStock.productoId, latteId));
    expect(deProducto).toHaveLength(0);
  });

  it("baja de un producto con stock terminado: descuenta ese stock con el costo del producto", async () => {
    const r = await registrarBajaProducto(f.owner, f.tenantId, {
      productoId: medialunaId,
      sucursalId: f.sucursalId,
      cantidad: 3,
      motivo: "danio",
    });
    if (!r.ok) throw new Error(r.error);
    expect(r.data.stockProductoActual).toBe(7);
    expect(r.data.costoTotal).toBeCloseTo(6, 4); // 3 x Bs 2
    const [fila] = await db
      .select({ c: stock.cantidadActual })
      .from(stock)
      .where(and(eq(stock.productoId, medialunaId), eq(stock.sucursalId, f.sucursalId)));
    expect(Number(fila.c)).toBe(7);
    const [mov] = await db
      .select()
      .from(movimientosStock)
      .where(and(eq(movimientosStock.productoId, medialunaId), eq(movimientosStock.tipo, "salida_merma")));
    expect(Number(mov.cantidad)).toBe(3);
  });

  it("baja de un producto sin costo conocido queda marcada, no en cero", async () => {
    const r = await registrarBajaProducto(f.owner, f.tenantId, {
      productoId: tortaSinCostoId,
      sucursalId: f.sucursalId,
      cantidad: 1,
      motivo: "vencimiento",
    });
    if (!r.ok) throw new Error(r.error);
    expect(r.data.costoTotal).toBeNull();
    const [baja] = await db.select().from(bajas).where(eq(bajas.id, r.data.bajaId));
    expect(baja.costoDesconocido).toBe(true);
  });

  it("validaciones: cantidad > 0 y 'otro' exige nota", async () => {
    const sinCantidad = await registrarBajaInsumo(f.owner, f.tenantId, {
      insumoId: lecheId,
      sucursalId: f.sucursalId,
      cantidad: 0,
      motivo: "danio",
    });
    expect(sinCantidad).toEqual({ ok: false, error: "La cantidad de la baja tiene que ser mayor a cero." });
    const otroSinNota = await registrarBajaInsumo(f.owner, f.tenantId, {
      insumoId: lecheId,
      sucursalId: f.sucursalId,
      cantidad: 1,
      motivo: "otro",
    });
    expect(otroSinNota).toEqual({ ok: false, error: 'Con el motivo "Otro" explicá qué pasó en la nota.' });
  });

  it("autorización: sin permiso de anular/ajustar no se registra, y un insumo ajeno no existe", async () => {
    const lecheAntes = await saldo(lecheId);
    const denegado = await registrarBajaInsumo(f.colaborador, f.tenantId, {
      insumoId: lecheId,
      sucursalId: f.sucursalId,
      cantidad: 1,
      motivo: "danio",
    });
    expect(denegado.ok).toBe(false);
    expect(await saldo(lecheId)).toBe(lecheAntes);

    // El dueño de OTRO negocio no puede dar de baja un insumo de este.
    const ajeno = await registrarBajaInsumo(otro.owner, otro.tenantId, {
      insumoId: lecheId,
      sucursalId: otro.sucursalId,
      cantidad: 1,
      motivo: "danio",
    });
    expect(ajeno).toEqual({ ok: false, error: "Insumo no encontrado." });
    expect(await saldo(lecheId)).toBe(lecheAntes);
  });

  it("el resumen por motivo suma el costo y cuenta las bajas sin costo conocido", async () => {
    const zona = await zonaHorariaTenant(f.tenantId);
    const hoy = hoyLocal(zona);
    const periodo = { desde: sumarDias(hoy, -1), hasta: sumarDias(hoy, 1) };

    const lista = await listarBajas(f.owner, f.tenantId, periodo);
    if (!lista.ok) throw new Error(lista.error);
    expect(lista.data.length).toBeGreaterThanOrEqual(6);

    const resumen = await consultarBajasPorMotivo(f.owner, f.tenantId, periodo);
    if (!resumen.ok) throw new Error(resumen.error);
    // Sin costo conocido: los Vasos sin costo (danio) y la Torta (vencimiento).
    expect(resumen.data.bajasSinCostoConocido).toBe(2);
    const danio = resumen.data.porMotivo.find((m) => m.motivo === "danio");
    expect(danio?.cantidadBajas).toBe(2); // vasos + medialunas
    expect(danio?.sinCostoConocido).toBe(1);
    expect(danio?.costoTotal).toBeCloseTo(6, 4); // solo las medialunas tienen costo
    expect(resumen.data.costoTotal).toBeGreaterThan(18); // 12 (leche) + 6 (medialunas) + latte
  });
});
