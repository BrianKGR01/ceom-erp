import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { registrarAjusteManualStock } from "@/modules/productos/actions";
import { productos } from "@/modules/productos/schema";
import {
  crearCanalVenta,
  crearMetodoPago,
  registrarPagoVenta,
  registrarVenta,
} from "@/modules/ventas/actions";
import { pagosVenta, ventas } from "@/modules/ventas/schema";
import {
  crearFixturePermisosCruzados,
  type FixturePermisosCruzados,
} from "@/test-utils/fixture-permisos-cruzados";
import {
  abrirTurno,
  calcularEfectivoEsperado,
  cerrarTurno,
  configurarCaja,
  estadoDeCajas,
  fichaTurno,
  listarTurnos,
  obtenerConfiguracionCaja,
  registrarMovimientoCaja,
  turnoParaOperar,
} from "./actions";
import { cajas, turnosCaja } from "./schema";

/**
 * Roadmap Cafiatto, Fase 4 — caja y turnos. Cada caso afirma un numero que la falla
 * no puede producir (dev-practices 6.1 b): el efectivo esperado, la diferencia
 * guardada, a que turno fue cada cobro.
 */
const hasPostgres = Boolean(process.env.DATABASE_URL);
vi.setConfig({ testTimeout: 40_000, hookTimeout: 60_000 });

const ok = <T>(r: { ok: true; data: T } | { ok: false; error: string }): T => {
  if (!r.ok) throw new Error(r.error);
  return r.data;
};

describe("calcularEfectivoEsperado", () => {
  it("fondo + efectivo cobrado + entradas - salidas", () => {
    expect(calcularEfectivoEsperado(100, 50, 20, 10)).toBe(160);
    expect(calcularEfectivoEsperado(0, 0, 0, 0)).toBe(0);
    // Sin errores de coma flotante en centavos.
    expect(calcularEfectivoEsperado(0.1, 0.2, 0, 0)).toBe(0.3);
  });
});

describe.skipIf(!hasPostgres)("Caja y turnos (Fase 4)", () => {
  let f: FixturePermisosCruzados;
  let otro: FixturePermisosCruzados;
  let canalVentaId: string;
  let efectivoId: string;
  let qrId: string;
  let productoId: string;
  let cajaId: string;

  const turnosAbiertos = async () =>
    db
      .select()
      .from(turnosCaja)
      .where(and(eq(turnosCaja.tenantId, f.tenantId), eq(turnosCaja.estado, "abierto")));

  async function vender(turnoId: string | null, pagos: Array<[string, number]> = [], cantidad = 1) {
    // Un solo producto de Bs 10 c/u: el total sale de la cantidad.
    const [primero, ...resto] = pagos;
    const res = ok(
      await registrarVenta(f.owner, f.tenantId, {
        sucursalId: f.sucursalId,
        canalVentaId,
        turnoId: turnoId ?? undefined,
        lineas: [{ productoId, cantidad }],
        pagoInicial: primero ? { metodoPagoId: primero[0], monto: primero[1] } : undefined,
      })
    );
    for (const [metodoPagoId, monto] of resto) {
      ok(await registrarPagoVenta(f.owner, res.ventaId, { metodoPagoId, monto, turnoId: turnoId ?? undefined }));
    }
    return res.ventaId;
  }

  beforeAll(async () => {
    f = await crearFixturePermisosCruzados("caja", [
      ["productos", "ver"],
      ["ventas", "ver"],
      ["ventas", "crear"],
    ]);
    otro = await crearFixturePermisosCruzados("caja-otro", []);
    canalVentaId = ok(await crearCanalVenta(f.owner, f.tenantId, { nombre: "Local" })).canalVentaId;
    efectivoId = ok(await crearMetodoPago(f.owner, f.tenantId, { nombre: "Efectivo", esEfectivo: true })).metodoPagoId;
    qrId = ok(await crearMetodoPago(f.owner, f.tenantId, { nombre: "QR" })).metodoPagoId;
    const [p] = await db
      .insert(productos)
      .values({ tenantId: f.tenantId, nombre: "Café", unidadVenta: "unidad", precioVenta: "10" })
      .returning();
    productoId = p.id;
    ok(
      await registrarAjusteManualStock(f.owner, f.tenantId, {
        productoId,
        sucursalId: f.sucursalId,
        tipo: "entrada_ajuste_manual",
        cantidad: 500,
        motivo: "Stock del test",
      })
    );
  });

  afterAll(async () => {
    await f?.limpiar();
    await otro?.limpiar();
  });

  it("viene apagada: no se exige nada y no se puede abrir un turno", async () => {
    expect(ok(await obtenerConfiguracionCaja(f.owner, f.tenantId))).toEqual({ habilitada: false, exigirTurno: true });
    expect(ok(await turnoParaOperar(f.owner, f.tenantId, f.sucursalId))).toEqual({ turnoId: null });
    expect(await abrirTurno(f.owner, f.tenantId, { cajaId: "00000000-0000-0000-0000-000000000000", fondoInicial: 0 })).toEqual({
      ok: false,
      error: "La caja no está activada en este negocio.",
    });
  });

  it("activarla exige permiso de supervisor, crea la caja una sola vez y se puede apagar", async () => {
    const denegado = await configurarCaja(f.colaborador, f.tenantId, { habilitada: true });
    expect(denegado.ok).toBe(false);
    expect(ok(await obtenerConfiguracionCaja(f.owner, f.tenantId)).habilitada).toBe(false);

    ok(await configurarCaja(f.owner, f.tenantId, { habilitada: true }));
    ok(await configurarCaja(f.owner, f.tenantId, { habilitada: true })); // idempotente
    const filas = await db.select().from(cajas).where(eq(cajas.tenantId, f.tenantId));
    expect(filas).toHaveLength(1);
    expect(filas[0].nombre).toBe("Caja Principal");
    cajaId = filas[0].id;
  });

  it("con la caja activa y sin turno no se vende ni se cobra; con exigir_turno apagado sí", async () => {
    expect(await turnoParaOperar(f.colaborador, f.tenantId, f.sucursalId)).toEqual({
      ok: false,
      error: "Para vender o cobrar, primero abrí el turno de la caja.",
    });
    // Excepcion administrativa: el dueño sí puede, y queda sin turno.
    expect(ok(await turnoParaOperar(f.owner, f.tenantId, f.sucursalId))).toEqual({ turnoId: null });
    ok(await configurarCaja(f.owner, f.tenantId, { habilitada: true, exigirTurno: false }));
    expect(ok(await turnoParaOperar(f.owner, f.tenantId, f.sucursalId))).toEqual({ turnoId: null });
    ok(await configurarCaja(f.owner, f.tenantId, { habilitada: true, exigirTurno: true }));
  });

  it("abrir: fondo no negativo, un solo turno por caja (también si se abren a la vez) y numeración correlativa", async () => {
    expect(await abrirTurno(f.owner, f.tenantId, { cajaId, fondoInicial: -1 })).toEqual({
      ok: false,
      error: "El fondo inicial no puede ser negativo.",
    });
    // Dos aperturas simultáneas de la misma caja: solo una pasa.
    const [a, b] = await Promise.all([
      abrirTurno(f.owner, f.tenantId, { cajaId, fondoInicial: 100 }),
      abrirTurno(f.colaborador, f.tenantId, { cajaId, fondoInicial: 100 }),
    ]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    const perdedor = a.ok ? b : a;
    expect(perdedor).toEqual({ ok: false, error: "Caja Principal ya tiene un turno abierto." });
    expect(await turnosAbiertos()).toHaveLength(1);
    expect(ok(a.ok ? a : b).numero).toBe(1);
  });

  it("el turno abierto es el que reciben las ventas de la sucursal", async () => {
    const [turno] = await turnosAbiertos();
    expect(ok(await turnoParaOperar(f.owner, f.tenantId, f.sucursalId))).toEqual({ turnoId: turno.id });
  });

  it("flujo completo: esperado = fondo + efectivo + entradas - salidas; el faltante queda registrado, no toca las ventas", async () => {
    const [turno] = await turnosAbiertos();
    // 5 cafés: Bs 50 en efectivo. 3 cafés: Bs 30 por QR.
    const v1 = await vender(turno.id, [[efectivoId, 50]], 5);
    const v2 = await vender(turno.id, [[qrId, 30]], 3);

    ok(await registrarMovimientoCaja(f.owner, f.tenantId, { turnoId: turno.id, tipo: "entrada", monto: 20, motivo: "Cambio del banco" }));
    const salida = ok(
      await registrarMovimientoCaja(f.owner, f.tenantId, { turnoId: turno.id, tipo: "salida", monto: 10, motivo: "Compra de hielo" })
    );
    expect(salida.efectivoEsperado).toBe(160); // 100 + 50 + 20 - 10

    const estado = ok(await estadoDeCajas(f.owner, f.tenantId));
    const resumen = estado.cajas[0].turno!;
    expect(resumen).toMatchObject({
      numero: 1,
      fondoInicial: 100,
      ventasCantidad: 2,
      ventasTotal: 80,
      efectivoCobrado: 50,
      entradas: 20,
      salidas: 10,
      efectivoEsperado: 160,
    });
    expect(resumen.porMedio.map((m) => [m.nombre, m.monto, m.esEfectivo])).toEqual([
      ["Efectivo", 50, true],
      ["QR", 30, false],
    ]);

    // Cierra con 155 contados: faltan 5. Sin explicacion no cierra.
    expect(await cerrarTurno(f.owner, f.tenantId, { turnoId: turno.id, efectivoContado: 155 })).toEqual({
      ok: false,
      error: "Hay una diferencia de -5.00 entre lo esperado y lo contado: explicala en las observaciones para cerrar.",
    });
    const cerrado = ok(
      await cerrarTurno(f.owner, f.tenantId, { turnoId: turno.id, efectivoContado: 155, observaciones: "Faltó un vuelto" })
    );
    expect(cerrado).toMatchObject({
      estado: "cerrado",
      efectivoEsperado: 160,
      efectivoContado: 155,
      diferencia: -5,
      observaciones: "Faltó un vuelto",
      ventasCantidad: 2,
      ventasTotal: 80,
    });

    // Las ventas y sus cobros siguen intactos: la diferencia no los modifica.
    const pagos = await db.select().from(pagosVenta).where(eq(pagosVenta.turnoId, turno.id));
    expect(pagos.map((p) => Number(p.monto)).sort((x, y) => x - y)).toEqual([30, 50]);
    const [venta1] = await db.select().from(ventas).where(eq(ventas.id, v1));
    expect(venta1.turnoId).toBe(turno.id);
    expect(venta1.estadoPago).toBe("pagado");
    const [venta2] = await db.select().from(ventas).where(eq(ventas.id, v2));
    expect(venta2.estadoPago).toBe("pagado");

    expect(await turnosAbiertos()).toHaveLength(0);
  });

  it("un turno cerrado no se vuelve a cerrar ni acepta movimientos, y su resumen sale de la foto del cierre", async () => {
    const [turno] = await db.select().from(turnosCaja).where(eq(turnosCaja.tenantId, f.tenantId));
    expect(await cerrarTurno(f.owner, f.tenantId, { turnoId: turno.id, efectivoContado: 160 })).toEqual({
      ok: false,
      error: "Este turno ya está cerrado.",
    });
    expect(
      await registrarMovimientoCaja(f.owner, f.tenantId, { turnoId: turno.id, tipo: "entrada", monto: 5, motivo: "x" })
    ).toEqual({ ok: false, error: "Este turno ya está cerrado." });

    // Un cobro tardío con el turno viejo no cambia lo que se firmó al cerrar.
    const ficha = ok(await fichaTurno(f.owner, f.tenantId, turno.id));
    expect(ficha.resumen).toMatchObject({ efectivoEsperado: 160, diferencia: -5, efectivoCobrado: 50 });
    expect(ficha.ventas).toHaveLength(2);
    expect(ficha.movimientos.map((m) => [m.tipo, Number(m.monto)])).toEqual([
      ["entrada", 20],
      ["salida", 10],
    ]);
  });

  it("un cobro cuenta en el turno donde se COBRÓ, no en el de la venta", async () => {
    const t1 = ok(await abrirTurno(f.owner, f.tenantId, { cajaId, fondoInicial: 50 }));
    const ventaFiada = await vender(t1.turnoId, [], 2); // Bs 20 sin cobrar
    ok(await cerrarTurno(f.owner, f.tenantId, { turnoId: t1.turnoId, efectivoContado: 50 }));

    const t2 = ok(await abrirTurno(f.owner, f.tenantId, { cajaId, fondoInicial: 0 }));
    ok(await registrarPagoVenta(f.owner, ventaFiada, { metodoPagoId: efectivoId, monto: 20, turnoId: t2.turnoId }));

    const viejo = ok(await fichaTurno(f.owner, f.tenantId, t1.turnoId)).resumen;
    expect(viejo.efectivoCobrado).toBe(0);
    expect(viejo.ventasCantidad).toBe(1); // la venta es del turno 1
    expect(viejo.diferencia).toBe(0);

    const nuevo = ok(await estadoDeCajas(f.owner, f.tenantId)).cajas[0].turno!;
    expect(nuevo.numero).toBe(3);
    expect(nuevo.efectivoCobrado).toBe(20); // el cobro es del turno 2
    expect(nuevo.ventasCantidad).toBe(0);
    expect(nuevo.efectivoEsperado).toBe(20);
  });

  it("validaciones de movimientos: monto, motivo y no sacar más efectivo del que debería haber", async () => {
    const [turno] = await turnosAbiertos();
    const mov = (datos: Partial<Parameters<typeof registrarMovimientoCaja>[2]>) =>
      registrarMovimientoCaja(f.owner, f.tenantId, { turnoId: turno.id, tipo: "salida", monto: 1, motivo: "x", ...datos });
    expect(await mov({ monto: 0 })).toEqual({ ok: false, error: "El monto tiene que ser mayor a cero." });
    expect(await mov({ motivo: "  " })).toEqual({ ok: false, error: "El motivo del movimiento es obligatorio." });
    expect(await mov({ monto: 21 })).toEqual({
      ok: false,
      error: "La salida (21.00) supera el efectivo esperado en caja (20.00).",
    });
    expect((await mov({ monto: 20 })).ok).toBe(true);
  });

  it("dos cierres simultáneos: solo uno cierra", async () => {
    const [turno] = await turnosAbiertos();
    const [a, b] = await Promise.all([
      cerrarTurno(f.owner, f.tenantId, { turnoId: turno.id, efectivoContado: 0 }),
      cerrarTurno(f.owner, f.tenantId, { turnoId: turno.id, efectivoContado: 0 }),
    ]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect(await turnosAbiertos()).toHaveLength(0);
  });

  it("historial: solo para supervisores, con filtro de diferencias; un turno ajeno no se ve", async () => {
    expect((await listarTurnos(f.colaborador, f.tenantId)).ok).toBe(false);

    const todos = ok(await listarTurnos(f.owner, f.tenantId));
    expect(todos).toHaveLength(3);
    const conDiferencia = ok(await listarTurnos(f.owner, f.tenantId, { conDiferencia: true }));
    expect(conDiferencia.map((t) => t.turno.numero)).toEqual([1]);
    const sinDiferencia = ok(await listarTurnos(f.owner, f.tenantId, { conDiferencia: false }));
    expect(sinDiferencia.map((t) => t.turno.numero).sort()).toEqual([2, 3]);

    // El colaborador ve SU turno, no el de otro.
    const suyo = ok(await abrirTurno(f.colaborador, f.tenantId, { cajaId, fondoInicial: 0 }));
    expect((await fichaTurno(f.colaborador, f.tenantId, suyo.turnoId)).ok).toBe(true);
    expect((await fichaTurno(f.colaborador, f.tenantId, todos[0].turno.id === suyo.turnoId ? todos[1].turno.id : todos[2].turno.id)).ok).toBe(false);

    // Otro negocio: ni el turno ni la caja existen.
    expect(await fichaTurno(otro.owner, otro.tenantId, suyo.turnoId)).toEqual({ ok: false, error: "Turno no encontrado." });
    expect(await abrirTurno(otro.owner, otro.tenantId, { cajaId, fondoInicial: 0 })).toEqual({
      ok: false,
      error: "La caja no está activada en este negocio.",
    });
  });
});
