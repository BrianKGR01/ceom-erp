// Reportes y Dashboard (Módulo 10, roadmap ítem #14 — último de Fase 1).
// Principio rector explícito del doc: "cero tablas propias, cero lógica de
// negocio propia, solo composición de lo que ya existe". Sin schema.ts ni
// repository.ts (mismo patrón que Financiero/Simulaciones). Esta es la
// vista INTERNA (Owner/equipo del tenant) — el Dashboard institucional
// gateado por el Gateway de Consentimiento ya es un módulo aparte:
// src/modules/monitoreo-institucional/ (roadmap ítem #11), no se duplica
// esa lógica acá.
import { calcularMargenPorcentaje, estadoResultados, flujoCaja } from "@/modules/financiero/actions";
import type { PeriodoFinanciero } from "@/modules/financiero/actions";
import { consultarDistribucionPorCategoria } from "@/modules/gastos/actions";
import type { UsuarioConRol } from "@/modules/identidad/actions";
import { consultarMermaPeriodo } from "@/modules/operativo/nichos/nicho-1/actions";
import {
  historicoVentas as historicoVentasVentas,
  margenPorCanalYProducto as margenPorCanalYProductoVentas,
  rankingProductos as rankingProductosVentas,
} from "@/modules/ventas/actions";

export type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

// --- Resumen del período (caso de uso 1) ---------------------------------------------------------

export async function resumenPeriodo(
  solicitante: UsuarioConRol,
  tenantId: string,
  periodo: PeriodoFinanciero,
  opts: { sucursalId?: string } = {}
) {
  return estadoResultados(solicitante, tenantId, periodo, opts);
}

// --- Ranking de productos (caso de uso 2) ---------------------------------------------------------

/** El margen% final se calcula acá (reutiliza calcularMargenPorcentaje de
 * Financiero) — Ventas no puede importar Financiero sin crear un ciclo
 * (Financiero ya importa Ventas), así que devuelve ingresos/costos crudos
 * y ordena por un ratio interno cuando criterio="margen". */
export async function rankingProductos(
  solicitante: UsuarioConRol,
  tenantId: string,
  periodo: PeriodoFinanciero,
  opts: { canalVentaId?: string; criterio: "rotacion" | "margen" }
): Promise<
  Resultado<
    Array<{
      productoId: string;
      unidadesVendidas: number;
      ingresos: number;
      costos: number;
      margenPct: number | null;
    }>
  >
> {
  const res = await rankingProductosVentas(solicitante, tenantId, periodo, opts);
  if (!res.ok) return res;
  return {
    ok: true,
    data: res.data.map((f) => ({
      ...f,
      margenPct: calcularMargenPorcentaje(f.ingresos, f.costos),
    })),
  };
}

// --- Distribución de gastos por categoría (caso de uso 3) ---------------------------------------------------------

export async function distribucionGastos(
  solicitante: UsuarioConRol,
  tenantId: string,
  periodo: PeriodoFinanciero
) {
  return consultarDistribucionPorCategoria(solicitante, tenantId, periodo);
}

// --- Histórico de ventas (caso de uso 4) ---------------------------------------------------------

export async function historicoVentas(
  solicitante: UsuarioConRol,
  tenantId: string,
  periodo: PeriodoFinanciero,
  opts: { incluirEventos: boolean }
) {
  return historicoVentasVentas(solicitante, tenantId, periodo, opts);
}

// --- Estado de Resultados y Flujo de Caja (caso de uso 5) ---------------------------------------------------------

export { estadoResultados, flujoCaja };

// --- Cruce canal x producto x margen (caso de uso 6) ---------------------------------------------------------

export async function margenPorCanalYProducto(
  solicitante: UsuarioConRol,
  tenantId: string,
  periodo: PeriodoFinanciero
): Promise<
  Resultado<
    Array<{ canalVentaId: string; productoId: string; ingresos: number; costos: number; margenPct: number | null }>
  >
> {
  const res = await margenPorCanalYProductoVentas(solicitante, tenantId, periodo);
  if (!res.ok) return res;
  return {
    ok: true,
    data: res.data.map((f) => ({
      ...f,
      margenPct: calcularMargenPorcentaje(f.ingresos, f.costos),
    })),
  };
}

// --- Control de merma (caso de uso 7) ---------------------------------------------------------

/** Para un tenant sin Producciones (Nicho 4, Modo Básico) esto da
 * naturalmente 0 — no hace falta lógica de nicho acá (caso borde 1: "un
 * módulo fuente sin datos para el período muestra vacío/cero, nunca
 * error"). */
export async function controlMerma(
  solicitante: UsuarioConRol,
  tenantId: string,
  periodo: { desde: string; hasta: string }
) {
  return consultarMermaPeriodo(solicitante, tenantId, periodo);
}
