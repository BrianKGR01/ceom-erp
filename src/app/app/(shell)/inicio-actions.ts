"use server";

import { obtenerUsuarioActual, type UsuarioConRol } from "@/modules/identidad/actions";
import { listarProductos } from "@/modules/productos/actions";
import { listarCategoriasGasto } from "@/modules/gastos/actions";
import {
  controlMerma,
  distribucionGastos,
  flujoCaja,
  rankingProductos,
  resumenPeriodo,
} from "@/modules/reportes/actions";
import { calcularPeriodoAnterior } from "./periodo-presets";

export type ResultadoAccion<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

interface Periodo {
  desde: string;
  hasta: string;
}

// Server Action delgada + funcion compartida server-side (mismo patron que
// el resto de las rutas de /app) — page.tsx llama construirDashboard()
// directo (ya corre en el servidor) para tener datos iniciales sin flash
// de loading; el cliente llama obtenerDashboardAction() cuando cambia un
// filtro.
export async function construirDashboard(
  usuario: UsuarioConRol,
  periodo: Periodo,
  sucursalId?: string
) {
  const opts = sucursalId ? { sucursalId } : {};
  const periodoAnterior = calcularPeriodoAnterior(periodo);

  const [
    resumenRes,
    resumenAnteriorRes,
    flujoRes,
    rankingRotacionRes,
    rankingMargenRes,
    gastosRes,
    mermaRes,
    productosRes,
    categoriasGastoRes,
  ] = await Promise.all([
    resumenPeriodo(usuario, usuario.tenantId, periodo, opts),
    resumenPeriodo(usuario, usuario.tenantId, periodoAnterior, opts),
    flujoCaja(usuario, usuario.tenantId, periodo, opts),
    rankingProductos(usuario, usuario.tenantId, periodo, { criterio: "rotacion" }),
    rankingProductos(usuario, usuario.tenantId, periodo, { criterio: "margen" }),
    distribucionGastos(usuario, usuario.tenantId, periodo),
    controlMerma(usuario, usuario.tenantId, periodo),
    listarProductos(usuario, usuario.tenantId),
    listarCategoriasGasto(usuario, usuario.tenantId),
  ]);

  const productoPorId = new Map(
    (productosRes.ok ? productosRes.data : []).map((p) => [p.id, p.nombre])
  );
  const categoriaGastoPorId = new Map(
    (categoriasGastoRes.ok ? categoriasGastoRes.data : []).map((c) => [c.id, c.nombre])
  );

  return {
    resumen: resumenRes,
    resumenAnterior: resumenAnteriorRes,
    flujo: flujoRes,
    rankingRotacion: rankingRotacionRes,
    rankingMargen: rankingMargenRes,
    gastos: gastosRes,
    merma: mermaRes,
    productoPorId: Object.fromEntries(productoPorId),
    categoriaGastoPorId: Object.fromEntries(categoriaGastoPorId),
  };
}

export type DatosDashboard = Awaited<ReturnType<typeof construirDashboard>>;

export async function obtenerDashboardAction(
  periodo: Periodo,
  sucursalId?: string
): Promise<ResultadoAccion<DatosDashboard>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const datos = await construirDashboard(usuario, periodo, sucursalId);
  return { ok: true, data: datos };
}
