"use server";

import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { consultarValorPatrimonialTotal } from "@/modules/patrimonio/actions";
import {
  estadoResultados,
  flujoCaja,
  historicoVentas,
  margenPorCanalYProducto,
  rankingProductos,
} from "@/modules/reportes/actions";

export type ResultadoAccion<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

interface Periodo {
  desde: string;
  hasta: string;
}

// Server Actions delgadas (mismo patron que src/app/app/(shell)/inicio-actions.ts):
// resuelven la sesion server-side y delegan en los actions.ts de cada modulo
// (Reportes, Patrimonio) — Reportes no tiene schema/repository propio, asi
// que esta capa de ruta es puramente de resolucion de usuario + delegacion.

export async function obtenerEstadoResultadosAction(
  periodo: Periodo,
  sucursalId?: string
) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return estadoResultados(usuario, usuario.tenantId, periodo, sucursalId ? { sucursalId } : {});
}

export async function obtenerFlujoCajaAction(periodo: Periodo, sucursalId?: string) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return flujoCaja(usuario, usuario.tenantId, periodo, sucursalId ? { sucursalId } : {});
}

export async function obtenerValorPatrimonialTotalAction() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return consultarValorPatrimonialTotal(usuario, usuario.tenantId);
}

export async function obtenerHistoricoVentasAction(
  periodo: Periodo,
  opts: { incluirEventos: boolean }
) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return historicoVentas(usuario, usuario.tenantId, periodo, opts);
}

export async function obtenerMargenPorCanalYProductoAction(periodo: Periodo) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return margenPorCanalYProducto(usuario, usuario.tenantId, periodo);
}

export async function obtenerRankingProductosAction(
  periodo: Periodo,
  opts: { canalVentaId?: string; criterio: "rotacion" | "margen" }
) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return rankingProductos(usuario, usuario.tenantId, periodo, opts);
}
