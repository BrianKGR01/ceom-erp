// Financiero NO tiene tablas propias (Modulo_07 seccion 0) — es una capa de
// consulta/agregacion pura sobre eventos que ya generan Ventas, Costos y
// Gastos, y Proveedores/Compras. No hay schema.ts ni repository.ts en este
// modulo: cada funcion combina agregados por periodo que esos tres modulos
// exponen en su propio actions.ts (caja negra, nunca sus tablas directo).
import { tienePermiso } from "@/modules/identidad/actions";
import type { UsuarioConRol } from "@/modules/identidad/actions";
import { consultarTotalCostosFijos, consultarPagosGastoEnPeriodo, consultarTotalGastosEnPeriodo } from "@/modules/gastos/actions";
import { consultarPagosCompraEnPeriodo } from "@/modules/proveedores/actions";
import {
  consultarAjustesVentaEnPeriodo,
  consultarIngresosPeriodo,
  consultarPagosVentaEnPeriodo,
} from "@/modules/ventas/actions";

export type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

export interface PeriodoFinanciero {
  desde: string;
  hasta: string;
}

// --- Calculos puros (Modulo_07 secciones 1.1, 1.2, 1.3) ---------------------------------------------------------

/** flujo_caja = Pagos de Venta − Pagos de Compra − Pagos de Gasto, todos
 * por fecha_pago (base caja, seccion 1.1). */
export function calcularFlujoCaja(
  pagosVenta: number,
  pagosCompra: number,
  pagosGasto: number
): number {
  return pagosVenta - pagosCompra - pagosGasto;
}

/** estado_resultados = ingresos − COGS − gastos ± ajustes de venta, todos
 * por su fecha de ocurrencia economica (base devengado, seccion 1.2). */
export function calcularEstadoResultados(
  ingresos: number,
  costos: number,
  gastos: number,
  ajustesVenta: number
): number {
  return ingresos - costos - gastos + ajustesVenta;
}

/** margen % = (ingresos_ajustados − costos) / ingresos_ajustados x 100
 * (seccion 1.3, ajustado por AjusteVenta segun decision del plan: el monto
 * del ajuste se suma a los ingresos brutos antes de calcular el
 * porcentaje). null si no hubo ingresos en el periodo (evita division por
 * 0, no tiene sentido un margen sin ventas). */
export function calcularMargenPorcentaje(
  ingresosAjustados: number,
  costos: number
): number | null {
  if (ingresosAjustados === 0) return null;
  return ((ingresosAjustados - costos) / ingresosAjustados) * 100;
}

// --- Funciones expuestas (Modulo_07 seccion 1 y 2) ---------------------------------------------------------

export async function flujoCaja(
  solicitante: UsuarioConRol,
  tenantId: string,
  periodo: PeriodoFinanciero,
  opts: { sucursalId?: string } = {}
): Promise<
  Resultado<{
    flujoCaja: number;
    pagosVenta: number;
    pagosCompra: number;
    pagosGasto: number;
  }>
> {
  if (!(await tienePermiso(solicitante, tenantId, "financiero", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver Financiero." };
  }

  const [pagosVentaRes, pagosCompraRes, pagosGastoRes] = await Promise.all([
    consultarPagosVentaEnPeriodo(solicitante, tenantId, periodo, opts),
    consultarPagosCompraEnPeriodo(solicitante, tenantId, periodo, opts),
    consultarPagosGastoEnPeriodo(solicitante, tenantId, periodo, opts),
  ]);
  if (!pagosVentaRes.ok) return pagosVentaRes;
  if (!pagosCompraRes.ok) return pagosCompraRes;
  if (!pagosGastoRes.ok) return pagosGastoRes;

  const pagosVenta = pagosVentaRes.data.totalPagado;
  const pagosCompra = pagosCompraRes.data.totalPagado;
  const pagosGasto = pagosGastoRes.data.totalPagado;

  return {
    ok: true,
    data: {
      flujoCaja: calcularFlujoCaja(pagosVenta, pagosCompra, pagosGasto),
      pagosVenta,
      pagosCompra,
      pagosGasto,
    },
  };
}

export async function estadoResultados(
  solicitante: UsuarioConRol,
  tenantId: string,
  periodo: PeriodoFinanciero,
  opts: { sucursalId?: string } = {}
): Promise<
  Resultado<{
    estadoResultados: number;
    ingresos: number;
    costos: number;
    gastos: number;
    ajustesVenta: number;
  }>
> {
  if (!(await tienePermiso(solicitante, tenantId, "financiero", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver Financiero." };
  }

  const [ingresosCostosRes, gastosRes, ajustesRes] = await Promise.all([
    consultarIngresosPeriodo(solicitante, tenantId, periodo, opts),
    consultarTotalGastosEnPeriodo(solicitante, tenantId, periodo, opts),
    consultarAjustesVentaEnPeriodo(solicitante, tenantId, periodo, opts),
  ]);
  if (!ingresosCostosRes.ok) return ingresosCostosRes;
  if (!gastosRes.ok) return gastosRes;
  if (!ajustesRes.ok) return ajustesRes;

  const { ingresos, costos } = ingresosCostosRes.data;
  const gastos = gastosRes.data.totalGastos;
  const ajustesVenta = ajustesRes.data.totalAjustes;

  return {
    ok: true,
    data: {
      estadoResultados: calcularEstadoResultados(ingresos, costos, gastos, ajustesVenta),
      ingresos,
      costos,
      gastos,
      ajustesVenta,
    },
  };
}

export async function margenPorProducto(
  solicitante: UsuarioConRol,
  tenantId: string,
  productoId: string,
  periodo: PeriodoFinanciero
): Promise<Resultado<{ margenPorcentaje: number | null; ingresosAjustados: number; costos: number }>> {
  if (!(await tienePermiso(solicitante, tenantId, "financiero", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver Financiero." };
  }

  const [ingresosCostosRes, ajustesRes] = await Promise.all([
    consultarIngresosPeriodo(solicitante, tenantId, periodo, { productoId }),
    consultarAjustesVentaEnPeriodo(solicitante, tenantId, periodo, { productoId }),
  ]);
  if (!ingresosCostosRes.ok) return ingresosCostosRes;
  if (!ajustesRes.ok) return ajustesRes;

  const ingresosAjustados = ingresosCostosRes.data.ingresos + ajustesRes.data.totalAjustes;
  const costos = ingresosCostosRes.data.costos;

  return {
    ok: true,
    data: {
      margenPorcentaje: calcularMargenPorcentaje(ingresosAjustados, costos),
      ingresosAjustados,
      costos,
    },
  };
}

/** Reutiliza directamente consultarTotalCostosFijos() de Módulo 4 — no
 * duplica la lógica, Financiero solo expone el mismo dato bajo su propio
 * gate ("financiero" en vez de "costos_gastos"), como insumo de
 * Simulaciones (seccion 1.4). */
export async function costoFijoTotal(
  solicitante: UsuarioConRol,
  tenantId: string,
  periodo: PeriodoFinanciero
): Promise<Resultado<{ costoFijoTotal: number }>> {
  if (!(await tienePermiso(solicitante, tenantId, "financiero", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver Financiero." };
  }

  const resultado = await consultarTotalCostosFijos(solicitante, tenantId, periodo);
  if (!resultado.ok) return resultado;

  return { ok: true, data: { costoFijoTotal: resultado.data.totalCostosFijos } };
}
