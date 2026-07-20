"use server";

import { listarSucursalesPorTenant, obtenerUsuarioActual, type UsuarioConRol } from "@/modules/identidad/actions";
import { listarProductos } from "@/modules/productos/actions";
import { listarCategoriasGasto } from "@/modules/gastos/actions";
import { consultarCapacidadAlmacenamientoUsada } from "@/modules/operativo/nichos/nicho-4/actions";
import { listarActivos } from "@/modules/patrimonio/actions";
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

export interface CapacidadAlmacenamientoWidget {
  activoNombre: string;
  capacidadAlmacenamientoCantidad: number | null;
  stockActualTotal: number;
  porcentajeUsado: number | null;
}

// Widget de Nicho 4 (roadmap ítem #12, docs/ui/pantallas.md) — sin nav
// propia (este nicho no tiene entidades propias, ver
// operativo/nichos/nicho-4/ANCLA.md), vive acá como una card más del
// Dashboard, igual que Merma. No se gatea por tenant.nichoId — mismo
// criterio que el resto de la app (app-shell.tsx no oculta nav por nicho,
// Modo Básico es un estado permanente válido, no "sin nicho todavía").
// Se elige el primer Activo con capacidadAlmacenamientoCantidad definida
// (ese es "el depósito" desde la perspectiva de este widget); si ninguno
// la tiene definida se usa el primero igual, para que el widget muestre
// "sin capacidad definida" en vez de desaparecer si el tenant sí tiene
// activos pero ninguno tiene el campo cargado. Si el tenant no tiene
// ningún Activo, no hay nada que mostrar (`null`, igual que el
// EmptyState de la Capacidad Operativa de Nicho 1).
export async function obtenerCapacidadAlmacenamientoWidget(
  usuario: UsuarioConRol
): Promise<CapacidadAlmacenamientoWidget | null> {
  const [activosRes, sucursalesRes] = await Promise.all([
    listarActivos(usuario, usuario.tenantId, { excluirDadosDeBaja: true }),
    listarSucursalesPorTenant(usuario, usuario.tenantId),
  ]);
  if (!activosRes.ok || !sucursalesRes.ok) return null;

  const activo =
    activosRes.data.find((a) => a.capacidadAlmacenamientoCantidad !== null) ?? activosRes.data[0];
  if (!activo) return null;

  const sucursal = sucursalesRes.data.find((s) => s.esPrincipal) ?? sucursalesRes.data[0];
  if (!sucursal) return null;

  const resultado = await consultarCapacidadAlmacenamientoUsada(
    usuario,
    usuario.tenantId,
    activo.id,
    sucursal.id
  );
  if (!resultado.ok) return null;

  return { activoNombre: activo.nombre, ...resultado.data };
}
