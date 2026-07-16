"use server";

import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import {
  actualizarCategoria,
  actualizarProducto,
  crearCategoria,
  crearProducto,
  eliminarCategoria,
  eliminarProducto,
  listarMovimientosStock,
  registrarAjusteManualStock,
  registrarTransferenciaStock,
} from "@/modules/productos/actions";
import { productoFormSchema } from "@/modules/productos/validation";

export type ResultadoAccion<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// Server Actions delgadas (mismo patron que src/app/app/onboarding/actions.ts):
// resuelven la sesion server-side y delegan en productos/actions.ts.

export async function crearProductoAction(
  input: unknown
): Promise<ResultadoAccion<{ productoId: string }>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const parsed = productoFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }
  const { stockInicial, sucursalId, categoriaId, fechaVencimientoReferencia, ...datosProducto } =
    parsed.data;

  const resultado = await crearProducto(usuario, usuario.tenantId, {
    ...datosProducto,
    // El Select de categoria manda "" cuando no se elige nada — la columna
    // es un uuid, no acepta string vacio (rechaza en DB si se lo pasamos tal cual).
    categoriaId: categoriaId || undefined,
    fechaVencimientoReferencia: fechaVencimientoReferencia || undefined,
  });
  if (!resultado.ok) return resultado;

  if (stockInicial && stockInicial > 0) {
    if (!sucursalId) {
      return { ok: false, error: "Elegí una sucursal para cargar el stock inicial." };
    }
    const ajuste = await registrarAjusteManualStock(usuario, usuario.tenantId, {
      productoId: resultado.data.productoId,
      sucursalId,
      tipo: "entrada_ajuste_manual",
      cantidad: stockInicial,
      motivo: "Carga inicial",
    });
    if (!ajuste.ok) {
      return {
        ok: false,
        error: `Creamos el producto, pero no pudimos cargar el stock inicial: ${ajuste.error}`,
      };
    }
  }

  return { ok: true, data: { productoId: resultado.data.productoId } };
}

export async function actualizarProductoAction(
  productoId: string,
  input: unknown
): Promise<ResultadoAccion<undefined>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const parsed = productoFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }
  const {
    categoriaId,
    nombre,
    unidadVenta,
    precioVenta,
    costoOperativoVigente,
    vidaUtilDias,
    fechaVencimientoReferencia,
    activo,
  } = parsed.data;

  const resultado = await actualizarProducto(usuario, productoId, {
    categoriaId: categoriaId || undefined,
    nombre,
    unidadVenta,
    precioVenta,
    costoOperativoVigente,
    vidaUtilDias,
    fechaVencimientoReferencia: fechaVencimientoReferencia || undefined,
    activo,
  });
  if (!resultado.ok) return resultado;
  return { ok: true, data: undefined };
}

export async function eliminarProductoAction(
  productoId: string,
  confirmarConStock: boolean
): Promise<ResultadoAccion<undefined>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const resultado = await eliminarProducto(usuario, productoId, { confirmarConStock });
  if (!resultado.ok) return resultado;
  return { ok: true, data: undefined };
}

export async function ajustarStockAction(input: {
  productoId: string;
  sucursalId: string;
  tipo: "entrada_ajuste_manual" | "salida_ajuste_manual";
  cantidad: number;
  motivo: string;
}): Promise<ResultadoAccion<{ cantidadActual: number }>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const resultado = await registrarAjusteManualStock(usuario, usuario.tenantId, input);
  if (!resultado.ok) return resultado;
  return { ok: true, data: { cantidadActual: resultado.data.cantidadActual } };
}

export async function listarMovimientosStockAction(productoId: string, sucursalId: string) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  return listarMovimientosStock(usuario, productoId, sucursalId);
}

export async function transferirStockAction(input: {
  productoId: string;
  sucursalOrigenId: string;
  sucursalDestinoId: string;
  cantidad: number;
}): Promise<ResultadoAccion<{ cantidadActualOrigen: number; cantidadActualDestino: number }>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const resultado = await registrarTransferenciaStock(usuario, usuario.tenantId, input);
  if (!resultado.ok) return resultado;
  return { ok: true, data: resultado.data };
}

export async function crearCategoriaAction(
  nombre: string
): Promise<ResultadoAccion<{ categoriaId: string }>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  return crearCategoria(usuario, usuario.tenantId, { nombre });
}

export async function actualizarCategoriaAction(
  categoriaId: string,
  nombre: string
): Promise<ResultadoAccion<undefined>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const resultado = await actualizarCategoria(usuario, categoriaId, { nombre });
  if (!resultado.ok) return resultado;
  return { ok: true, data: undefined };
}

export async function eliminarCategoriaAction(
  categoriaId: string
): Promise<ResultadoAccion<undefined>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const resultado = await eliminarCategoria(usuario, categoriaId);
  if (!resultado.ok) return resultado;
  return { ok: true, data: undefined };
}
