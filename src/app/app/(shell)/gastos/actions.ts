"use server";

import { revalidatePath } from "next/cache";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import {
  actualizarCategoriaGasto,
  actualizarGastoManual,
  actualizarGastoRecurrente,
  crearCategoriaGasto,
  crearGastoManual,
  crearGastoRecurrente,
  desactivarGastoRecurrente,
  eliminarCategoriaGasto,
  eliminarGastoManual,
  generarGastoDesdeRecurrente,
  registrarPagoGasto,
} from "@/modules/gastos/actions";
import {
  categoriaGastoFormSchema,
  gastoFormSchema,
  gastoRecurrenteFormSchema,
  registrarPagoGastoSchema,
} from "@/modules/gastos/validation";

export type ResultadoAccion<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// Server Actions delgadas (mismo patron que
// src/app/app/(shell)/proveedores/actions.ts): resuelven la sesion
// server-side y delegan en gastos/actions.ts.

export async function crearGastoAction(
  input: unknown
): Promise<ResultadoAccion<{ gastoId: string }>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const parsed = gastoFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }

  const { sucursalId, proveedorId, ...resto } = parsed.data;
  const resultado = await crearGastoManual(usuario, usuario.tenantId, {
    ...resto,
    sucursalId: sucursalId || undefined,
    proveedorId: proveedorId || undefined,
  });
  if (!resultado.ok) return resultado;
  revalidatePath("/app/gastos");
  return { ok: true, data: { gastoId: resultado.data.gastoId } };
}

export async function actualizarGastoAction(
  gastoId: string,
  input: unknown
): Promise<ResultadoAccion<undefined>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const parsed = gastoFormSchema.omit({ tipo: true }).safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }

  const { sucursalId, proveedorId, ...resto } = parsed.data;
  const resultado = await actualizarGastoManual(usuario, gastoId, {
    ...resto,
    sucursalId: sucursalId || undefined,
    proveedorId: proveedorId || undefined,
  });
  if (!resultado.ok) return resultado;
  revalidatePath("/app/gastos");
  return { ok: true, data: undefined };
}

export async function eliminarGastoAction(gastoId: string): Promise<ResultadoAccion<undefined>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const resultado = await eliminarGastoManual(usuario, gastoId);
  if (!resultado.ok) return resultado;
  revalidatePath("/app/gastos");
  return { ok: true, data: undefined };
}

export async function registrarPagoGastoAction(
  gastoId: string,
  input: unknown
): Promise<ResultadoAccion<{ estadoPago: string; totalPagado: number }>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const parsed = registrarPagoGastoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }

  const resultado = await registrarPagoGasto(usuario, gastoId, parsed.data);
  if (!resultado.ok) return resultado;
  revalidatePath("/app/gastos");
  return { ok: true, data: resultado.data };
}

// --- Categorías de Gasto ---------------------------------------------------------

export async function crearCategoriaGastoAction(
  input: unknown
): Promise<ResultadoAccion<{ categoriaId: string }>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const parsed = categoriaGastoFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }

  const resultado = await crearCategoriaGasto(usuario, usuario.tenantId, parsed.data);
  if (!resultado.ok) return resultado;
  revalidatePath("/app/gastos");
  return { ok: true, data: { categoriaId: resultado.data.categoriaId } };
}

export async function actualizarCategoriaGastoAction(
  categoriaId: string,
  nombre: string
): Promise<ResultadoAccion<undefined>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  if (!nombre.trim()) return { ok: false, error: "Ponele un nombre a la categoría." };

  const resultado = await actualizarCategoriaGasto(usuario, categoriaId, { nombre: nombre.trim() });
  if (!resultado.ok) return resultado;
  revalidatePath("/app/gastos");
  return { ok: true, data: undefined };
}

export async function eliminarCategoriaGastoAction(
  categoriaId: string
): Promise<ResultadoAccion<undefined>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const resultado = await eliminarCategoriaGasto(usuario, categoriaId);
  if (!resultado.ok) return resultado;
  revalidatePath("/app/gastos");
  return { ok: true, data: undefined };
}

// --- Gastos Recurrentes ---------------------------------------------------------

export async function crearGastoRecurrenteAction(
  input: unknown
): Promise<ResultadoAccion<{ gastoRecurrenteId: string }>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const parsed = gastoRecurrenteFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }

  const { sucursalId, fechaFin, ...resto } = parsed.data;
  const resultado = await crearGastoRecurrente(usuario, usuario.tenantId, {
    ...resto,
    sucursalId: sucursalId || undefined,
    fechaFin: fechaFin || undefined,
  });
  if (!resultado.ok) return resultado;
  revalidatePath("/app/gastos/recurrentes");
  return { ok: true, data: { gastoRecurrenteId: resultado.data.gastoRecurrenteId } };
}

export async function actualizarGastoRecurrenteAction(
  gastoRecurrenteId: string,
  input: unknown
): Promise<ResultadoAccion<undefined>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const parsed = gastoRecurrenteFormSchema.partial().safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }

  const { sucursalId, fechaFin, ...resto } = parsed.data;
  const resultado = await actualizarGastoRecurrente(usuario, gastoRecurrenteId, {
    ...resto,
    sucursalId: sucursalId || undefined,
    fechaFin: fechaFin || undefined,
  });
  if (!resultado.ok) return resultado;
  revalidatePath("/app/gastos/recurrentes");
  return { ok: true, data: undefined };
}

export async function desactivarGastoRecurrenteAction(
  gastoRecurrenteId: string
): Promise<ResultadoAccion<undefined>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const resultado = await desactivarGastoRecurrente(usuario, gastoRecurrenteId);
  if (!resultado.ok) return resultado;
  revalidatePath("/app/gastos/recurrentes");
  return { ok: true, data: undefined };
}

export async function generarGastoDesdeRecurrenteAction(
  gastoRecurrenteId: string,
  input: unknown
): Promise<ResultadoAccion<{ gastoId: string }>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const parsed = registrarPagoGastoSchema.pick({ fechaPago: true }).safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }

  const resultado = await generarGastoDesdeRecurrente(usuario, gastoRecurrenteId, {
    fechaGasto: parsed.data.fechaPago,
  });
  if (!resultado.ok) return resultado;
  revalidatePath("/app/gastos/recurrentes");
  revalidatePath("/app/gastos");
  return { ok: true, data: resultado.data };
}
