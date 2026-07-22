"use server";

import {
  asignarNicho,
  actualizarTenant,
  completarOnboarding,
  obtenerTenantPorId,
  obtenerUsuarioActual,
} from "@/modules/identidad/actions";
import { actualizarTenantSchema, asignarNichoSchema } from "@/modules/identidad/validation";
import { eliminarImagen, pathDesdeUrlPublica, subirImagen } from "@/lib/supabase/storage";

export type ResultadoAccion = { ok: true } | { ok: false; error: string };

// Server Actions delgadas (mismo patron que login/actions.ts): resuelven la
// sesion server-side y delegan en identidad/actions.ts — el cliente nunca
// arma ni envia un UsuarioConRol.

/** Sube el logo del negocio a Storage y devuelve la URL pública — el
 * cliente la guarda en el formulario y la manda recién con "Guardar y
 * continuar" (guardarNegocio), no en esta misma llamada, para no persistir
 * un logo huérfano si el usuario cancela el resto del formulario. Borra el
 * logo anterior (si había) para no acumular huérfanos en el bucket. */
export async function subirLogoAction(
  file: File
): Promise<{ ok: true; data: { url: string } } | { ok: false; error: string }> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  if (!usuario.esOwner) return { ok: false, error: "Solo el dueño del negocio puede cambiar el logo." };

  const resultado = await subirImagen(usuario.tenantId, "logos", file);
  if (!resultado.ok) return resultado;

  const tenantActual = await obtenerTenantPorId(usuario, usuario.tenantId);
  if (tenantActual.ok && tenantActual.data.logoUrl) {
    const pathAnterior = pathDesdeUrlPublica(tenantActual.data.logoUrl);
    if (pathAnterior) await eliminarImagen(pathAnterior);
  }

  return { ok: true, data: { url: resultado.data.url } };
}

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
  if (!parsed.success) return { ok: false, error: "Elegí uno de los rubros de la lista." };

  const resultado = await asignarNicho(usuario, parsed.data.nicho);
  if (!resultado.ok) return resultado;
  return { ok: true };
}

/** Se llama al terminar el paso 2, sin importar si se eligió un rubro real
 * o Modo Básico — es la única señal real de "onboarding terminado", ver
 * decisión en identidad/ANCLA.md. */
export async function finalizarOnboarding(): Promise<ResultadoAccion> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const resultado = await completarOnboarding(usuario);
  if (!resultado.ok) return resultado;
  return { ok: true };
}
