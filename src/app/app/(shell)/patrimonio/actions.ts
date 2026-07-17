"use server";

import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import {
  actualizarActivo,
  crearActivo,
  darDeBajaActivo,
  transferirActivo,
} from "@/modules/patrimonio/actions";
import {
  activoFormSchema,
  darDeBajaActivoSchema,
  transferirActivoSchema,
  type ActivoFormInput,
} from "@/modules/patrimonio/validation";

export type ResultadoAccion<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// Server Actions delgadas (mismo patron que src/app/app/(shell)/productos/actions.ts):
// resuelven la sesion server-side y delegan en patrimonio/actions.ts.

// DatosActivo (modulo) espera los campos numericos como string — el form
// los manda como number (react-hook-form + valueAsNumber). Conversion en
// un solo lugar para crear/actualizar.
function aDatosActivo(input: ActivoFormInput) {
  return {
    nombre: input.nombre,
    tipo: input.tipo,
    sucursalId: input.sucursalId || undefined,
    valorCompra: input.valorCompra,
    fechaAdquisicion: input.fechaAdquisicion,
    vidaUtilMeses: input.vidaUtilMeses !== undefined ? String(input.vidaUtilMeses) : undefined,
    proveedorId: input.proveedorId || undefined,
    numeroSerie: input.numeroSerie || undefined,
    vencimientoGarantia: input.vencimientoGarantia || undefined,
    capacidadProduccionCantidad:
      input.capacidadProduccionCantidad !== undefined
        ? String(input.capacidadProduccionCantidad)
        : undefined,
    capacidadProduccionUnidad: input.capacidadProduccionUnidad || undefined,
    capacidadAlmacenamientoCantidad:
      input.capacidadAlmacenamientoCantidad !== undefined
        ? String(input.capacidadAlmacenamientoCantidad)
        : undefined,
    capacidadAlmacenamientoUnidad: input.capacidadAlmacenamientoUnidad || undefined,
  };
}

export async function crearActivoAction(
  input: unknown
): Promise<ResultadoAccion<{ activoId: string }>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const parsed = activoFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }

  const resultado = await crearActivo(usuario, usuario.tenantId, aDatosActivo(parsed.data));
  if (!resultado.ok) return resultado;
  return { ok: true, data: { activoId: resultado.data.activoId } };
}

export async function actualizarActivoAction(
  activoId: string,
  input: unknown
): Promise<ResultadoAccion<undefined>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const parsed = activoFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }

  const resultado = await actualizarActivo(usuario, activoId, aDatosActivo(parsed.data));
  if (!resultado.ok) return resultado;
  return { ok: true, data: undefined };
}

export async function darDeBajaActivoAction(
  activoId: string,
  input: unknown
): Promise<ResultadoAccion<undefined>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const parsed = darDeBajaActivoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }

  const resultado = await darDeBajaActivo(usuario, activoId, parsed.data.motivo);
  if (!resultado.ok) return resultado;
  return { ok: true, data: undefined };
}

export async function transferirActivoAction(
  activoId: string,
  input: unknown
): Promise<ResultadoAccion<undefined>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const parsed = transferirActivoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }

  const resultado = await transferirActivo(usuario, activoId, parsed.data.nuevaSucursalId);
  if (!resultado.ok) return resultado;
  return { ok: true, data: undefined };
}
