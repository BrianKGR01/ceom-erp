"use server";

import { revalidatePath } from "next/cache";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import {
  actualizarComposicionReceta,
  actualizarInsumo,
  actualizarReceta,
  consultarCapacidadAlmacenamientoUsada,
  consultarCapacidadProduccionUsada,
  crearInsumo,
  crearReceta,
  eliminarInsumo,
  eliminarReceta,
  fichaReceta,
  listarMovimientosInsumo,
  registrarAjusteManualInsumo,
  registrarEntradaCompraInsumo,
  registrarMermaAlmacenamiento,
  registrarProduccion,
  registrarProduccionDeAjuste,
} from "@/modules/operativo/nichos/nicho-1/actions";
import {
  ajusteInsumoSchema,
  composicionRecetaSchema,
  entradaCompraInsumoSchema,
  insumoFormSchema,
  mermaAlmacenamientoSchema,
  produccionAjusteSchema,
  produccionFormSchema,
  recetaFormSchema,
} from "@/modules/operativo/nichos/nicho-1/validation";

export type ResultadoAccion<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// Server Actions delgadas (mismo patron que src/app/app/(shell)/gastos/actions.ts):
// resuelven la sesion server-side y delegan en operativo/nichos/nicho-1/actions.ts.

// --- Insumos ---------------------------------------------------------

export async function crearInsumoAction(
  input: unknown
): Promise<ResultadoAccion<{ insumoId: string }>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const parsed = insumoFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }

  const resultado = await crearInsumo(usuario, usuario.tenantId, parsed.data);
  if (!resultado.ok) return resultado;
  revalidatePath("/app/produccion/insumos");
  return { ok: true, data: { insumoId: resultado.data.insumoId } };
}

export async function actualizarInsumoAction(
  insumoId: string,
  input: unknown
): Promise<ResultadoAccion<undefined>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const parsed = insumoFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }

  const resultado = await actualizarInsumo(usuario, insumoId, parsed.data);
  if (!resultado.ok) return resultado;
  revalidatePath("/app/produccion/insumos");
  return { ok: true, data: undefined };
}

export async function eliminarInsumoAction(insumoId: string): Promise<ResultadoAccion<undefined>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const resultado = await eliminarInsumo(usuario, insumoId);
  if (!resultado.ok) return resultado;
  revalidatePath("/app/produccion/insumos");
  return { ok: true, data: undefined };
}

export async function registrarEntradaCompraInsumoAction(
  insumoId: string,
  input: unknown
): Promise<ResultadoAccion<{ movimientoId: string; cantidadActual: number; costoUnitarioVigente: number }>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const parsed = entradaCompraInsumoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }

  const { fechaVencimiento, ...resto } = parsed.data;
  const resultado = await registrarEntradaCompraInsumo(usuario, usuario.tenantId, {
    insumoId,
    ...resto,
    fechaVencimiento: fechaVencimiento || undefined,
  });
  if (!resultado.ok) return resultado;
  revalidatePath("/app/produccion/insumos");
  return { ok: true, data: resultado.data };
}

export async function registrarAjusteManualInsumoAction(
  insumoId: string,
  input: unknown
): Promise<ResultadoAccion<{ movimientoId: string; cantidadActual: number }>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const parsed = ajusteInsumoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }

  const resultado = await registrarAjusteManualInsumo(usuario, usuario.tenantId, {
    insumoId,
    ...parsed.data,
  });
  if (!resultado.ok) return resultado;
  revalidatePath("/app/produccion/insumos");
  return { ok: true, data: resultado.data };
}

export async function listarMovimientosInsumoAction(insumoId: string, sucursalId: string) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  return listarMovimientosInsumo(usuario, insumoId, sucursalId);
}

export async function registrarMermaAlmacenamientoAction(
  insumoId: string,
  input: unknown
): Promise<ResultadoAccion<{ movimientoId: string; cantidadActual: number }>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const parsed = mermaAlmacenamientoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }

  const resultado = await registrarMermaAlmacenamiento(usuario, usuario.tenantId, {
    insumoId,
    ...parsed.data,
  });
  if (!resultado.ok) return resultado;
  revalidatePath("/app/produccion/insumos");
  return { ok: true, data: resultado.data };
}

// --- Recetas ---------------------------------------------------------

export async function crearRecetaAction(
  input: unknown
): Promise<ResultadoAccion<{ recetaId: string }>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const parsed = recetaFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }

  const resultado = await crearReceta(usuario, usuario.tenantId, parsed.data);
  if (!resultado.ok) return resultado;
  revalidatePath("/app/produccion/recetas");
  return { ok: true, data: { recetaId: resultado.data.recetaId } };
}

export async function actualizarRecetaAction(
  recetaId: string,
  input: unknown
): Promise<ResultadoAccion<undefined>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const parsed = recetaFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }

  const resultado = await actualizarReceta(usuario, recetaId, parsed.data);
  if (!resultado.ok) return resultado;
  revalidatePath("/app/produccion/recetas");
  return { ok: true, data: undefined };
}

export async function eliminarRecetaAction(recetaId: string): Promise<ResultadoAccion<undefined>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const resultado = await eliminarReceta(usuario, recetaId);
  if (!resultado.ok) return resultado;
  revalidatePath("/app/produccion/recetas");
  return { ok: true, data: undefined };
}

export async function actualizarComposicionRecetaAction(
  recetaId: string,
  input: unknown
): Promise<ResultadoAccion<undefined>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const parsed = composicionRecetaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }

  const resultado = await actualizarComposicionReceta(usuario, recetaId, parsed.data);
  if (!resultado.ok) return resultado;
  revalidatePath("/app/produccion/recetas");
  return { ok: true, data: undefined };
}

export async function fichaRecetaAction(recetaId: string) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  return fichaReceta(usuario, recetaId);
}

// --- Produccion ---------------------------------------------------------

export async function registrarProduccionAction(input: unknown): Promise<
  ResultadoAccion<{
    produccionId: string;
    costoOperativoCalculado: number;
    mermaCantidad: number;
    mermaCosto: number;
    acreditacionOk: boolean;
  }>
> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const parsed = produccionFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }

  const { fechaVencimientoLote, ...resto } = parsed.data;
  const resultado = await registrarProduccion(usuario, usuario.tenantId, {
    ...resto,
    fechaVencimientoLote: fechaVencimientoLote || undefined,
  });
  if (!resultado.ok) return resultado;
  revalidatePath("/app/produccion");
  return {
    ok: true,
    data: {
      produccionId: resultado.data.produccionId,
      costoOperativoCalculado: resultado.data.costoOperativoCalculado,
      mermaCantidad: resultado.data.mermaCantidad,
      mermaCosto: resultado.data.mermaCosto,
      acreditacionOk: resultado.data.acreditacionProductos.ok,
    },
  };
}

// --- Capacidad Operativa (solo lectura) ---------------------------------------------------------

export async function consultarCapacidadAction(
  activoId: string,
  periodo: { desde: string; hasta: string }
) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const [produccion, almacenamiento] = await Promise.all([
    consultarCapacidadProduccionUsada(usuario, usuario.tenantId, activoId, periodo),
    consultarCapacidadAlmacenamientoUsada(usuario, usuario.tenantId, activoId),
  ]);
  if (!produccion.ok) return produccion;
  if (!almacenamiento.ok) return almacenamiento;
  return { ok: true as const, data: { produccion: produccion.data, almacenamiento: almacenamiento.data } };
}

export async function registrarProduccionDeAjusteAction(
  produccionId: string,
  input: unknown
): Promise<ResultadoAccion<{ ajusteId: string }>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const parsed = produccionAjusteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }

  const resultado = await registrarProduccionDeAjuste(usuario, produccionId, parsed.data);
  if (!resultado.ok) return resultado;
  revalidatePath("/app/produccion");
  return { ok: true, data: resultado.data };
}
