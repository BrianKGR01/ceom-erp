"use server";

import { asignarNicho, actualizarTenant, obtenerUsuarioActual } from "@/modules/identidad/actions";
import { actualizarTenantSchema, asignarNichoSchema } from "@/modules/identidad/validation";

export type ResultadoAccion = { ok: true } | { ok: false; error: string };

// Server Actions delgadas (mismo patron que login/actions.ts): resuelven la
// sesion server-side y delegan en identidad/actions.ts — el cliente nunca
// arma ni envia un UsuarioConRol.

export async function guardarNegocio(input: unknown): Promise<ResultadoAccion> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const parsed = actualizarTenantSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }

  const resultado = await actualizarTenant(usuario, parsed.data);
  if (!resultado.ok) return resultado;
  return { ok: true };
}

export async function elegirRubro(nicho: "nicho_1" | "nicho_4"): Promise<ResultadoAccion> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const parsed = asignarNichoSchema.safeParse({ nicho });
  if (!parsed.success) return { ok: false, error: "Rubro inválido." };

  const resultado = await asignarNicho(usuario, parsed.data.nicho);
  if (!resultado.ok) return resultado;
  return { ok: true };
}
