import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { abrirTurno, cerrarTurno, configurarCaja } from "@/modules/caja/actions";
import { cajas } from "@/modules/caja/schema";
import type { UsuarioConRol } from "@/modules/identidad/repository";
import { registrarAjusteManualStock } from "@/modules/productos/actions";
import { productos } from "@/modules/productos/schema";
import { crearCanalVenta, crearMetodoPago } from "@/modules/ventas/actions";
import { pagosVenta, ventas } from "@/modules/ventas/schema";
import {
  crearFixturePermisosCruzados,
  type FixturePermisosCruzados,
} from "@/test-utils/fixture-permisos-cruzados";

/**
 * Roadmap Cafiatto, Fase 4 — la capa de acciones es quien decide el turno: la venta y
 * el cobro reciben el turno abierto de la sucursal, y sin turno (con la caja activa y
 * exigida) se rechazan. El cliente no puede elegir ni falsear el turno.
 *
 * Mismo harness que `ventas/avisos-stock.test.ts`: Server Actions reales, sesion simulada.
 */
const hasPostgres = Boolean(process.env.DATABASE_URL);

let sesion: UsuarioConRol | null = null;
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/modules/identidad/actions", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/modules/identidad/actions")>();
  return { ...original, obtenerUsuarioActual: async () => sesion };
});

vi.setConfig({ testTimeout: 40_000, hookTimeout: 60_000 });

const ok = <T>(r: { ok: true; data: T } | { ok: false; error: string }): T => {
  if (!r.ok) throw new Error(r.error);
  return r.data;
};

describe.skipIf(!hasPostgres)("Caja — Vender y Cobrar usan el turno que decide el servidor", () => {
  let f: FixturePermisosCruzados;
  let canalVentaId: string;
  let efectivoId: string;
  let productoId: string;
  let cajaId: string;

  beforeAll(async () => {
    f = await crearFixturePermisosCruzados("caja-ventas", [
      ["productos", "ver"],
      ["ventas", "ver"],
      ["ventas", "crear"],
    ]);
    canalVentaId = ok(await crearCanalVenta(f.owner, f.tenantId, { nombre: "Local" })).canalVentaId;
    efectivoId = ok(await crearMetodoPago(f.owner, f.tenantId, { nombre: "Efectivo", esEfectivo: true })).metodoPagoId;
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
        cantidad: 100,
        motivo: "Stock del test",
      })
    );
  });

  afterAll(async () => {
    await f?.limpiar();
  });

  beforeEach(() => {
    sesion = f.colaborador;
  });

  const venta = (conPago: boolean) => ({
    canalVentaId,
    lineas: [{ productoId, cantidad: 2 }],
    pagoInicial: conPago ? { metodoPagoId: efectivoId, monto: 20 } : undefined,
  });

  it("con la caja apagada la venta se registra sin turno, como siempre", async () => {
    const { registrarVentaAction } = await import("../ventas/actions");
    const res = await registrarVentaAction(f.sucursalId, venta(true));
    if (!res.ok) throw new Error(res.error);
    const [v] = await db.select().from(ventas).where(eq(ventas.id, res.data.ventaId));
    expect(v.turnoId).toBeNull();
  });

  it("con la caja activa y sin turno abierto, la venta se rechaza y no deja nada", async () => {
    const { registrarVentaAction } = await import("../ventas/actions");
    ok(await configurarCaja(f.owner, f.tenantId, { habilitada: true }));
    cajaId = (await db.select().from(cajas).where(eq(cajas.tenantId, f.tenantId)))[0].id;
    const antes = (await db.select().from(ventas).where(eq(ventas.tenantId, f.tenantId))).length;

    const res = await registrarVentaAction(f.sucursalId, venta(true));

    expect(res).toEqual({ ok: false, error: "Para vender o cobrar, primero abrí el turno de la caja." });
    expect((await db.select().from(ventas).where(eq(ventas.tenantId, f.tenantId))).length).toBe(antes);
  });

  it("excepcion administrativa: el dueño vende sin turno aunque se exija (queda sin turno); el cajero no", async () => {
    const { registrarVentaAction } = await import("../ventas/actions");
    sesion = f.owner;
    const res = await registrarVentaAction(f.sucursalId, venta(true));
    if (!res.ok) throw new Error(res.error);
    const [v] = await db.select().from(ventas).where(eq(ventas.id, res.data.ventaId));
    expect(v.turnoId).toBeNull();
    const [pago] = await db.select().from(pagosVenta).where(eq(pagosVenta.ventaId, v.id));
    expect(pago.turnoId).toBeNull();

    sesion = f.colaborador;
    expect(await registrarVentaAction(f.sucursalId, venta(true))).toEqual({
      ok: false,
      error: "Para vender o cobrar, primero abrí el turno de la caja.",
    });
  });

  it("con turno abierto, la venta y su cobro quedan en ese turno", async () => {
    const { registrarVentaAction } = await import("../ventas/actions");
    const turno = ok(await abrirTurno(f.owner, f.tenantId, { cajaId, fondoInicial: 0 }));

    const res = await registrarVentaAction(f.sucursalId, venta(true));
    if (!res.ok) throw new Error(res.error);

    const [v] = await db.select().from(ventas).where(eq(ventas.id, res.data.ventaId));
    expect(v.turnoId).toBe(turno.turnoId);
    const pagos = await db.select().from(pagosVenta).where(eq(pagosVenta.ventaId, v.id));
    expect(pagos).toHaveLength(1);
    expect(pagos[0].turnoId).toBe(turno.turnoId);
    ok(await cerrarTurno(f.owner, f.tenantId, { turnoId: turno.turnoId, efectivoContado: 20 }));
  });

  it("un cobro posterior cuenta en el turno vigente, y sin turno se rechaza", async () => {
    const { registrarVentaAction, registrarPagoVentaAction } = await import("../ventas/actions");
    // Venta fiada con un turno que despues se cierra.
    const t1 = ok(await abrirTurno(f.owner, f.tenantId, { cajaId, fondoInicial: 0 }));
    const fiada = await registrarVentaAction(f.sucursalId, venta(false));
    if (!fiada.ok) throw new Error(fiada.error);
    ok(await cerrarTurno(f.owner, f.tenantId, { turnoId: t1.turnoId, efectivoContado: 0 }));

    // Sin turno abierto no se puede cobrar.
    expect(await registrarPagoVentaAction(fiada.data.ventaId, { monto: 20, metodoPagoId: efectivoId })).toEqual({
      ok: false,
      error: "Para vender o cobrar, primero abrí el turno de la caja.",
    });

    const t2 = ok(await abrirTurno(f.owner, f.tenantId, { cajaId, fondoInicial: 0 }));
    const cobro = await registrarPagoVentaAction(fiada.data.ventaId, { monto: 20, metodoPagoId: efectivoId });
    expect(cobro.ok).toBe(true);
    const [pago] = await db.select().from(pagosVenta).where(eq(pagosVenta.ventaId, fiada.data.ventaId));
    expect(pago.turnoId).toBe(t2.turnoId);
    const [v] = await db.select().from(ventas).where(eq(ventas.id, fiada.data.ventaId));
    expect(v.turnoId).toBe(t1.turnoId); // la venta sigue siendo del turno donde se hizo
  });
});
