// Financiero NO tiene tablas propias (Modulo_07 seccion 0) — es una capa de
// consulta/agregacion pura sobre eventos que ya generan Ventas, Costos y
// Gastos, y Proveedores/Compras. No hay schema.ts ni repository.ts en este
// modulo: cada funcion combina agregados por periodo que esos tres modulos
// exponen en su propio actions.ts (caja negra, nunca sus tablas directo).
import { tienePermiso } from "@/modules/identidad/actions";
import type { UsuarioConRol } from "@/modules/identidad/actions";
import { consultarTotalCostosFijos, consultarPagosGastoEnPeriodo, consultarTotalGastosEnPeriodo } from "@/modules/gastos/actions";
import {
  consultarCostoExtraAjustesCompraEnPeriodo,
  consultarPagosCompraEnPeriodo,
} from "@/modules/proveedores/actions";
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

/**
 * estado_resultados = ingresos − COGS − gastos ± ajustes de venta
 *                     − costo extra de ajustes de compra
 * todos por su fecha de ocurrencia economica (base devengado, seccion 1.2).
 *
 * `costoExtraAjustesCompra` (H-31) es lo que las compras del periodo
 * terminaron costando de MAS de lo registrado — un costo que los
 * `costo_unitario_snapshot` ya congelados no van a recoger nunca, asi que si
 * no resta aca no aparece en ninguna parte. Llega ya filtrado a una sola
 * direccion por Proveedores (ver `sumarCostoExtraAjustesCompraPeriodo`), y
 * **aca se vuelve a clampear a proposito**: el `Math.max(0, ...)` hace
 * estructuralmente imposible que un ajuste de compra le SUME al resultado,
 * pase lo que pase aguas arriba. Es la clase de error que ya nos costo H-30 y
 * H-24 — un costo que termina inflando la utilidad —, y una segunda red
 * cuesta una linea.
 *
 * Parametro opcional con default 0: cualquier llamador viejo sigue dando el
 * mismo numero que antes.
 */
export function calcularEstadoResultados(
  ingresos: number,
  costos: number,
  gastos: number,
  ajustesVenta: number,
  costoExtraAjustesCompra: number = 0
): number {
  return ingresos - costos - gastos + ajustesVenta - Math.max(0, costoExtraAjustesCompra);
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
    ajustesCompra: number;
    /** H-15: cuánto de `ingresos` viene de ventas cuyo costo no se conocía.
     * El resultado de arriba **no cambia** por esto —no hay costo que
     * restar—, pero deja de presentarse como completo: la pantalla puede
     * decir "de estos ingresos, Bs X no tienen costo cargado, tu margen real
     * es menor". Marcar el hueco, nunca estimar un número para taparlo. */
    ingresosSinCostoConocido: number;
  }>
> {
  if (!(await tienePermiso(solicitante, tenantId, "financiero", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver Financiero." };
  }

  const [ingresosCostosRes, gastosRes, ajustesRes, ajustesCompraRes] = await Promise.all([
    consultarIngresosPeriodo(solicitante, tenantId, periodo, opts),
    consultarTotalGastosEnPeriodo(solicitante, tenantId, periodo, opts),
    consultarAjustesVentaEnPeriodo(solicitante, tenantId, periodo, opts),
    consultarCostoExtraAjustesCompraEnPeriodo(solicitante, tenantId, periodo, opts),
  ]);
  if (!ingresosCostosRes.ok) return ingresosCostosRes;
  if (!gastosRes.ok) return gastosRes;
  if (!ajustesRes.ok) return ajustesRes;
  if (!ajustesCompraRes.ok) return ajustesCompraRes;

  const { ingresos, costos, ingresosSinCostoConocido } = ingresosCostosRes.data;
  const gastos = gastosRes.data.totalGastos;
  const ajustesVenta = ajustesRes.data.totalAjustes;
  // Siempre >= 0 (Proveedores solo devuelve la direccion de costo) — se
  // expone tal cual y la pantalla lo muestra restando, para no repetir la
  // ambiguedad de signo de `ajustesVenta`.
  const ajustesCompra = ajustesCompraRes.data.costoExtraAjustes;

  return {
    ok: true,
    data: {
      estadoResultados: calcularEstadoResultados(
        ingresos,
        costos,
        gastos,
        ajustesVenta,
        ajustesCompra
      ),
      ingresos,
      costos,
      gastos,
      ajustesVenta,
      ajustesCompra,
      ingresosSinCostoConocido,
    },
  };
}

/**
 * `margenPorcentaje` es `null` cuando **no se puede afirmar** un margen, y
 * hay dos motivos distintos que el llamador tiene que poder separar:
 * no hubo ingresos en el período (`ingresosAjustados === 0`), o parte de esos
 * ingresos son de ventas sin costo cargado (`ingresosSinCostoConocido > 0`,
 * H-15). Antes el segundo caso devolvía **100%** —un costo desconocido
 * contado como cero— y eso es una afirmación falsa, no un dato faltante.
 * Es el criterio que Simulaciones ya aplicaba y que Ventas/Financiero/
 * Reportes no seguían.
 */
export async function margenPorProducto(
  solicitante: UsuarioConRol,
  tenantId: string,
  productoId: string,
  periodo: PeriodoFinanciero
): Promise<
  Resultado<{
    margenPorcentaje: number | null;
    ingresosAjustados: number;
    costos: number;
    ingresosSinCostoConocido: number;
  }>
> {
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
  const ingresosSinCostoConocido = ingresosCostosRes.data.ingresosSinCostoConocido;

  return {
    ok: true,
    data: {
      margenPorcentaje:
        ingresosSinCostoConocido > 0
          ? null
          : calcularMargenPorcentaje(ingresosAjustados, costos),
      ingresosAjustados,
      costos,
      ingresosSinCostoConocido,
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
