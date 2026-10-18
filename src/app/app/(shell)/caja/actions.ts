"use server";

import { revalidatePath } from "next/cache";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import {
  abrirTurno,
  cerrarTurno,
  configurarCaja,
  registrarMovimientoCaja,
} from "@/modules/caja/actions";
import {
  abrirTurnoSchema,
  cerrarTurnoSchema,
  configurarCajaSchema,
  movimientoCajaSchema,
} from "@/modules/caja/validation";

export type ResultadoAccion<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// Server Actions delgadas (mismo patron que el resto): resuelven la sesion en el
// servidor y delegan en caja/actions.ts, que es quien autoriza.

function refrescar() {
  revalidatePath("/app/caja");
  revalidatePath("/app/caja/historial");
  revalidatePath("/app/ventas");
}

export async function configurarCajaAction(input: unknown): Promise<ResultadoAccion> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  const parsed = configurarCajaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }
  const resultado = await configurarCaja(usuario, usuario.tenantId, parsed.data);
  if (!resultado.ok) return resultado;
  refrescar();
  return { ok: true, data: undefined };
}

export async function abrirTurnoAction(
  input: unknown
): Promise<ResultadoAccion<{ turnoId: string; numero: number }>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  const parsed = abrirTurnoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }
  const resultado = await abrirTurno(usuario, usuario.tenantId, parsed.data);
  if (!resultado.ok) return resultado;
  refrescar();
  return { ok: true, data: resultado.data };
}

export async function registrarMovimientoCajaAction(
  input: unknown
): Promise<ResultadoAccion<{ efectivoEsperado: number }>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  const parsed = movimientoCajaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }
  const resultado = await registrarMovimientoCaja(usuario, usuario.tenantId, parsed.data);
  if (!resultado.ok) return resultado;
  refrescar();
  return { ok: true, data: { efectivoEsperado: resultado.data.efectivoEsperado } };
}

export async function cerrarTurnoAction(
  input: unknown
): Promise<ResultadoAccion<{ turnoId: string; diferencia: number }>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  const parsed = cerrarTurnoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }
  const resultado = await cerrarTurno(usuario, usuario.tenantId, parsed.data);
  if (!resultado.ok) return resultado;
  refrescar();
  return { ok: true, data: { turnoId: resultado.data.turnoId, diferencia: resultado.data.diferencia ?? 0 } };
}
