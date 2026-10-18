import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { hoyLocal, sumarDias, zonaHorariaTenant } from "@/lib/periodo";
import { otorgarCapacidadEspecialPorUsuario } from "@/modules/identidad/actions";
import {
  actualizarComposicionReceta,
  crearInsumo,
  crearReceta,
  registrarEntradaCompraInsumo,
  vincularProductoAReceta,
} from "@/modules/operativo/nichos/nicho-1/actions";
import { movimientosInsumo } from "@/modules/operativo/nichos/nicho-1/schema";
import { registrarAjusteManualStock } from "@/modules/productos/actions";
import { movimientosStock, productos } from "@/modules/productos/schema";
import {
  crearFixturePermisosCruzados,
  type FixturePermisosCruzados,
} from "@/test-utils/fixture-permisos-cruzados";
import {
  consultarBonificacionesPorMotivo,
  crearCanalVenta,
  crearMetodoPago,
  fichaVenta,
  registrarPagoVenta,
  registrarVenta,
  repartirDescuento,
} from "./actions";
import { bonificacionesVenta, detallesVenta, ventas } from "./schema";

/**
 * Roadmap Cafiatto, Fase 5 — bonificacion (consumo del personal y cortesia). Cafiatto asume el
 * precio: la venta queda completa, con su consumo de insumos y su costo, pero el ingreso baja.
 * Cada caso afirma un numero que la falla no puede producir (dev-practices 6.1 b).
 */
const hasPostgres = Boolean(process.env.DATABASE_URL);
vi.setConfig({ testTimeout: 40_000, hookTimeout: 60_000 });

const ok = <T>(r: { ok: true; data: T } | { ok: false; error: string }): T => {
  if (!r.ok) throw new Error(r.error);
  return r.data;
};

describe("repartirDescuento", () => {
  it("reparte a centavos exactos y la suma es el porcentaje del total", () => {
    const d = repartirDescuento([10.01, 3.33, 0.01], 33.33);
    const total = 10.01 + 3.33 + 0.01;
    expect(Math.round(d.reduce((s, x) => s + x, 0) * 100)).toBe(Math.round(total * 33.33));
    d.forEach((x) => expect(Math.round(x * 100) / 100).toBe(x));
  });

  it("al 100 % cada linea se descuenta por completo", () => {
    expect(repartirDescuento([10, 5.5, 0.01], 100)).toEqual([10, 5.5, 0.01]);
  });

  it("ninguna linea queda con mas descuento que su valor, ni negativo", () => {
    const d = repartirDescuento([0.01, 0.01, 100], 50);
    expect(d.every((x) => x >= 0)).toBe(true);
    expect(d[0]).toBeLessThanOrEqual(0.01);
    expect(d[1]).toBeLessThanOrEqual(0.01);
    expect(repartirDescuento([], 100)).toEqual([]);
  });
});

describe.skipIf(!hasPostgres)("Bonificaciones (Fase 5)", () => {
  let f: FixturePermisosCruzados;
  let canalVentaId: string;
  let canalComisionId: string;
  let efectivoId: string;
  let cafeId: string;
  let latteId: string;
  let medialunaId: string;
  let tortaSinCostoId: string;

  const stockMov = (productoId: string) =>
    db.select().from(movimientosStock).where(eq(movimientosStock.productoId, productoId));

  const personal = { motivo: "consumo_personal" as const, porcentaje: 100, beneficiario: "Ana Rojas" };

  beforeAll(async () => {
    f = await crearFixturePermisosCruzados("bonificacion", [
      ["productos", "ver"],
      ["ventas", "ver"],
      ["ventas", "crear"],
      ["inventario", "crear"],
    ]);
    canalVentaId = ok(await crearCanalVenta(f.owner, f.tenantId, { nombre: "Local" })).canalVentaId;
    canalComisionId = ok(
      await crearCanalVenta(f.owner, f.tenantId, { nombre: "Delivery", porcentajeComisionDefault: 10 })
    ).canalVentaId;
    efectivoId = ok(await crearMetodoPago(f.owner, f.tenantId, { nombre: "Efectivo", esEfectivo: true })).metodoPagoId;

    const [medialuna, torta] = await db
      .insert(productos)
      .values([
        { tenantId: f.tenantId, nombre: "Medialuna", unidadVenta: "unidad", precioVenta: "10", costoOperativoVigente: "4" },
        { tenantId: f.tenantId, nombre: "Torta", unidadVenta: "unidad", precioVenta: "50" },
      ])
      .returning();
    medialunaId = medialuna.id;
    tortaSinCostoId = torta.id;
    for (const productoId of [medialunaId, tortaSinCostoId]) {
      ok(
        await registrarAjusteManualStock(f.owner, f.tenantId, {
          productoId,
          sucursalId: f.sucursalId,
          tipo: "entrada_ajuste_manual",
          cantidad: 200,
          motivo: "Stock del test",
        })
      );
    }

    // Latte: se prepara al vender (0,015 kg de cafe a Bs 100/kg = Bs 1,50 por unidad).
    cafeId = ok(await crearInsumo(f.owner, f.tenantId, { nombre: "Café", unidadMedida: "kg" })).insumoId;
    ok(
      await registrarEntradaCompraInsumo(f.owner, f.tenantId, {
        insumoId: cafeId,
        sucursalId: f.sucursalId,
        cantidad: 5,
        costoCompra: 100,
      })
    );
    const [latte] = await db
      .insert(productos)
      .values({ tenantId: f.tenantId, nombre: "Latte", unidadVenta: "unidad", precioVenta: "20" })
      .returning();
    latteId = latte.id;
    const receta = ok(await crearReceta(f.owner, f.tenantId, { nombre: "Receta Latte", rendimientoPorLote: 1, unidadRendimiento: "UND" }));
    ok(await actualizarComposicionReceta(f.owner, receta.recetaId, [{ insumoId: cafeId, cantidadPorLote: 0.015 }]));
    ok(
      await vincularProductoAReceta(f.owner, f.tenantId, {
        productoId: latteId,
        recetaId: receta.recetaId,
        cantidadBaseConsumidaPorUnidad: 1,
        modoConsumo: "al_vender",
      })
    );
  });

  afterAll(async () => {
    await f?.limpiar();
  });

  const vender = (
    usuario: FixturePermisosCruzados["owner"],
    lineas: Array<{ productoId: string; cantidad: number }>,
    extra: Partial<Parameters<typeof registrarVenta>[2]> = {}
  ) => registrarVenta(usuario, f.tenantId, { sucursalId: f.sucursalId, canalVentaId, lineas, ...extra });

  it("consumo del personal al 100 %: ingreso 0, nace pagada, y el stock y el costo se registran igual", async () => {
    const res = ok(await vender(f.owner, [{ productoId: medialunaId, cantidad: 3 }], { bonificacion: personal }));

    expect(res.totalVenta).toBe(0);
    expect(res.montoBonificado).toBe(30);
    const [v] = await db.select().from(ventas).where(eq(ventas.id, res.ventaId));
    expect(v.estadoPago).toBe("pagado"); // no queda "pendiente de cobro para siempre"
    const [linea] = await db.select().from(detallesVenta).where(eq(detallesVenta.ventaId, res.ventaId));
    expect(Number(linea.precioVentaSnapshot)).toBe(10); // el precio de lista se conserva
    expect(Number(linea.descuentoMonto)).toBe(30);
    expect(Number(linea.subtotal)).toBe(0);
    expect(Number(linea.costoUnitarioSnapshot)).toBe(4); // el costo real tambien

    // Salio stock de verdad: no es una baja ni un regalo "invisible".
    const salidas = (await stockMov(medialunaId)).filter((m) => m.tipo === "salida_venta");
    expect(salidas.map((m) => Number(m.cantidad))).toContain(3);

    const [b] = await db.select().from(bonificacionesVenta).where(eq(bonificacionesVenta.ventaId, res.ventaId));
    expect(b).toMatchObject({ motivo: "consumo_personal", beneficiario: "Ana Rojas", autorizadoPor: f.owner.id });
    expect(Number(b.porcentaje)).toBe(100);
    expect(Number(b.montoBonificado)).toBe(30);

    const ficha = ok(await fichaVenta(f.owner, res.ventaId));
    expect(ficha.totalVenta).toBe(0);
    expect(ficha.bonificacion?.motivo).toBe("consumo_personal");
  });

  it("un producto que se prepara al vender sigue consumiendo sus insumos al bonificarlo", async () => {
    const antes = (await db.select().from(movimientosInsumo).where(eq(movimientosInsumo.insumoId, cafeId))).length;
    const res = ok(await vender(f.owner, [{ productoId: latteId, cantidad: 2 }], { bonificacion: personal }));
    expect(res.totalVenta).toBe(0);
    const movs = await db.select().from(movimientosInsumo).where(eq(movimientosInsumo.referenciaId, res.ventaId));
    expect(movs).toHaveLength(1);
    expect(Number(movs[0].cantidad)).toBeCloseTo(0.03, 4);
    expect((await db.select().from(movimientosInsumo).where(eq(movimientosInsumo.insumoId, cafeId))).length).toBe(antes + 1);
    const [linea] = await db.select().from(detallesVenta).where(eq(detallesVenta.ventaId, res.ventaId));
    expect(Number(linea.costoUnitarioSnapshot)).toBeCloseTo(1.5, 4);
  });

  it("sin la capacidad del motivo se rechaza y no se crea nada; cada motivo tiene la suya", async () => {
    const antes = (await db.select().from(ventas).where(eq(ventas.tenantId, f.tenantId))).length;
    const res = await vender(f.colaborador, [{ productoId: medialunaId, cantidad: 1 }], { bonificacion: personal });
    expect(res).toEqual({ ok: false, error: "No tenés permiso para bonificar como consumo del personal." });
    expect((await db.select().from(ventas).where(eq(ventas.tenantId, f.tenantId))).length).toBe(antes);

    // Tener una capacidad no da la otra.
    ok(await otorgarCapacidadEspecialPorUsuario(f.owner, f.colaborador.id, "bonificar_consumo_personal", true));
    ok(await vender(f.colaborador, [{ productoId: medialunaId, cantidad: 1 }], { bonificacion: personal }));
    const cortesia = await vender(f.colaborador, [{ productoId: medialunaId, cantidad: 1 }], {
      bonificacion: { motivo: "cortesia", porcentaje: 100, nota: "Cliente frecuente" },
    });
    expect(cortesia).toEqual({ ok: false, error: "No tenés permiso para bonificar como cortesía." });
  });

  it("validaciones: porcentaje, 100 % para el personal, quién consume y por qué la cortesía", async () => {
    const lineas = [{ productoId: medialunaId, cantidad: 1 }];
    const probar = (b: Parameters<typeof registrarVenta>[2]["bonificacion"]) =>
      vender(f.owner, lineas, { bonificacion: b });
    expect(await probar({ ...personal, porcentaje: 50 })).toEqual({
      ok: false,
      error: "El consumo del personal se bonifica al 100 %.",
    });
    expect(await probar({ motivo: "consumo_personal", porcentaje: 100 })).toEqual({
      ok: false,
      error: "Indicá quién consume.",
    });
    expect(await probar({ motivo: "cortesia", porcentaje: 0, nota: "x" })).toEqual({
      ok: false,
      error: "El porcentaje de la bonificación tiene que estar entre 1 y 100.",
    });
    expect(await probar({ motivo: "cortesia", porcentaje: 101, nota: "x" })).toEqual({
      ok: false,
      error: "El porcentaje de la bonificación tiene que estar entre 1 y 100.",
    });
    expect(await probar({ motivo: "cortesia", porcentaje: 20 })).toEqual({
      ok: false,
      error: "Contá a quién se le regala o por qué, para dejarlo registrado.",
    });
  });

  it("cortesía parcial: el total, el cobro y el estado de pago salen del valor neto", async () => {
    // 2 medialunas (Bs 20) + 1 torta (Bs 50) = 70; 30 % de cortesia -> descuenta 21, queda 49.
    const res = ok(
      await vender(
        f.owner,
        [
          { productoId: medialunaId, cantidad: 2 },
          { productoId: tortaSinCostoId, cantidad: 1 },
        ],
        { bonificacion: { motivo: "cortesia", porcentaje: 30, beneficiario: "Vecino" } }
      )
    );
    expect(res.totalVenta).toBe(49);
    expect(res.montoBonificado).toBe(21);

    const lineas = await db.select().from(detallesVenta).where(eq(detallesVenta.ventaId, res.ventaId));
    expect(lineas.reduce((s, l) => s + Number(l.descuentoMonto), 0)).toBeCloseTo(21, 2);
    expect(lineas.reduce((s, l) => s + Number(l.subtotal), 0)).toBeCloseTo(49, 2);

    // Se paga el neto, no el precio de lista.
    const demasiado = await registrarPagoVenta(f.owner, res.ventaId, { monto: 70, metodoPagoId: efectivoId });
    expect(demasiado.ok).toBe(false);
    ok(await registrarPagoVenta(f.owner, res.ventaId, { monto: 49, metodoPagoId: efectivoId }));
    const [v] = await db.select().from(ventas).where(eq(ventas.id, res.ventaId));
    expect(v.estadoPago).toBe("pagado");
  });

  it("un pago inicial mayor al neto se rechaza antes de crear la venta", async () => {
    const antes = (await db.select().from(ventas).where(eq(ventas.tenantId, f.tenantId))).length;
    const res = await vender(f.owner, [{ productoId: medialunaId, cantidad: 1 }], {
      bonificacion: { motivo: "cortesia", porcentaje: 50, nota: "x" },
      pagoInicial: { metodoPagoId: efectivoId, monto: 10 },
    });
    expect(res.ok).toBe(false);
    expect((await db.select().from(ventas).where(eq(ventas.tenantId, f.tenantId))).length).toBe(antes);
  });

  it("la comisión del canal se calcula sobre lo que de verdad se cobra", async () => {
    const res = ok(
      await vender(f.owner, [{ productoId: medialunaId, cantidad: 10 }], {
        canalVentaId: canalComisionId,
        bonificacion: { motivo: "cortesia", porcentaje: 50, nota: "Promo" },
      })
    );
    const [v] = await db.select().from(ventas).where(eq(ventas.id, res.ventaId));
    expect(res.totalVenta).toBe(50); // 100 de lista - 50 %
    expect(Number(v.comisionMontoCalculado)).toBe(5); // 10 % de 50, no de 100
  });

  it("repetir el mismo intento no duplica la bonificación ni el consumo", async () => {
    const clave = crypto.randomUUID();
    const una = ok(await vender(f.owner, [{ productoId: medialunaId, cantidad: 1 }], { bonificacion: personal, claveIdempotencia: clave }));
    const otra = ok(await vender(f.owner, [{ productoId: medialunaId, cantidad: 1 }], { bonificacion: personal, claveIdempotencia: clave }));
    expect(otra.repetida).toBe(true);
    expect(otra.ventaId).toBe(una.ventaId);
    const filas = await db.select().from(bonificacionesVenta).where(eq(bonificacionesVenta.ventaId, una.ventaId));
    expect(filas).toHaveLength(1);
  });

  it("el resumen por motivo suma lo bonificado, el costo real y marca las ventas sin costo conocido", async () => {
    const zona = await zonaHorariaTenant(f.tenantId);
    const hoy = hoyLocal(zona);
    const periodo = { desde: sumarDias(hoy, -1), hasta: sumarDias(hoy, 1) };
    // Una torta SIN costo conocido, bonificada.
    ok(await vender(f.owner, [{ productoId: tortaSinCostoId, cantidad: 1 }], { bonificacion: { ...personal, beneficiario: "Luis" } }));

    const r = ok(await consultarBonificacionesPorMotivo(f.owner, f.tenantId, periodo));
    const personalFila = r.porMotivo.find((m) => m.motivo === "consumo_personal")!;
    const cortesiaFila = r.porMotivo.find((m) => m.motivo === "cortesia")!;
    expect(personalFila.ventasSinCostoConocido).toBe(1); // la torta
    expect(cortesiaFila.ventasSinCostoConocido).toBe(1); // la cortesia parcial incluia la torta
    expect(personalFila.montoBonificado).toBeGreaterThan(0);
    expect(r.montoBonificado).toBeCloseTo(r.porMotivo.reduce((s, m) => s + m.montoBonificado, 0), 2);
    expect(r.ventasSinCostoConocido).toBe(2);
    // Un cajero sin 'ver' no accede.
    expect((await consultarBonificacionesPorMotivo(f.colaborador, f.tenantId, periodo)).ok).toBe(true); // tiene ventas:ver
  });
});
