"use server";

import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { costoFijoTotal, margenPorProducto } from "@/modules/financiero/actions";
import { consultarCostoOperativo, consultarPrecioVenta } from "@/modules/productos/actions";
import { consultarUnidadesVendidasPeriodo } from "@/modules/ventas/actions";
import {
  actualizarUmbralAlerta,
  calcularPuntoEquilibrio,
  comparativoMultiSku,
  listarSimulaciones,
  obtenerConfiguracion,
  simularPrecio,
  type DatosPuntoEquilibrio,
  type DatosSimularPrecio,
} from "@/modules/simulaciones/actions";

interface Periodo {
  desde: string;
  hasta: string;
}

// Server Actions delgadas (mismo patron que reportes/actions.ts): resuelven
// la sesion server-side y delegan en los actions.ts de cada modulo —
// Simulaciones no tiene ruta propia de sesion, y Financiero (margenPorProducto)
// se suma aca porque no tiene ruta propia tampoco (ver docs/ui/pantallas.md
// modulo 9 — decision de no duplicar UI en dos rutas).

export async function simularPrecioAction(input: DatosSimularPrecio) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return simularPrecio(usuario, usuario.tenantId, input);
}

export async function calcularPuntoEquilibrioAction(input: DatosPuntoEquilibrio) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return calcularPuntoEquilibrio(usuario, usuario.tenantId, input);
}

export async function comparativoMultiSkuAction() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return comparativoMultiSku(usuario, usuario.tenantId);
}

export async function obtenerConfiguracionAction() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return obtenerConfiguracion(usuario, usuario.tenantId);
}

export async function actualizarUmbralAlertaAction(umbralPct: string | number) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return actualizarUmbralAlerta(usuario, usuario.tenantId, umbralPct);
}

export async function listarSimulacionesAction(productoId?: string) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return listarSimulaciones(usuario, usuario.tenantId, productoId);
}

export async function margenPorProductoAction(productoId: string, periodo: Periodo) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return margenPorProducto(usuario, usuario.tenantId, productoId, periodo);
}

/**
 * Datos de solo lectura para la previsualizacion automatica al elegir un
 * producto (Modulo_09 seccion 1.1) — a proposito NO usa simularPrecio ni
 * calcularPuntoEquilibrio, que persisten un registro en el historial cada
 * vez que se llaman. Esta previa se recalcula libremente mientras el
 * usuario cambia producto/periodo, sin ensuciar el Historial de
 * Simulaciones; recien "Guardar simulación" llama a las acciones que sí
 * persisten.
 */
export async function obtenerDatosPreviaAction(productoId: string, periodo: Periodo) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const [costoRes, precioRes, rotacionRes, costoFijoRes] = await Promise.all([
    consultarCostoOperativo(usuario, productoId),
    consultarPrecioVenta(usuario, productoId),
    consultarUnidadesVendidasPeriodo(usuario, usuario.tenantId, productoId, periodo),
    costoFijoTotal(usuario, usuario.tenantId, periodo),
  ]);
  if (!costoRes.ok) return costoRes;
  if (!precioRes.ok) return precioRes;
  if (!rotacionRes.ok) return rotacionRes;
  if (!costoFijoRes.ok) return costoFijoRes;

  return {
    ok: true as const,
    data: {
      costoOperativoVigente: costoRes.data.costoOperativoVigente,
      precioVenta: precioRes.data.precioVenta,
      unidadesVendidas: rotacionRes.data.unidadesVendidas,
      costoFijoTotalPeriodo: costoFijoRes.data.costoFijoTotal,
    },
  };
}
