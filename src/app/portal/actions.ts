"use server";

import { redirect } from "next/navigation";
import {
  canjearCodigoAcceso,
  obtenerInstitucionActual,
  solicitarMagicLinkInstitucion,
} from "@/modules/consentimiento/actions";
import type { DatosInstitucion } from "@/modules/consentimiento/actions";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { PeriodoFinanciero } from "@/modules/financiero/actions";
import {
  detalleFinanciero,
  detalleInventarioOperativo,
  detalleOperativo,
  estadoTenant,
  listarCartera,
  tendenciaVentas,
} from "@/modules/monitoreo-institucional/actions";

export async function canjearCodigoAccesoAction(input: {
  codigo: string;
  institucionNueva: DatosInstitucion;
}) {
  return canjearCodigoAcceso(input);
}

// Server Actions delgadas (mismo patron que reportes/actions.ts): resuelven
// la sesion de Institucion server-side (obtenerInstitucionActual, no
// obtenerUsuarioActual — Institucion no es un UsuarioConRol, ver
// CEOM_Arquitectura.md seccion 8.3) y delegan en
// monitoreo-institucional/actions.ts.

export async function listarCarteraAction() {
  const institucion = await obtenerInstitucionActual();
  if (!institucion)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return listarCartera(institucion.id);
}

export async function estadoTenantAction(tenantId: string) {
  const institucion = await obtenerInstitucionActual();
  if (!institucion)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return estadoTenant(institucion.id, tenantId);
}

export async function tendenciaVentasAction(tenantId: string, periodo: PeriodoFinanciero) {
  const institucion = await obtenerInstitucionActual();
  if (!institucion)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return tendenciaVentas(institucion.id, tenantId, periodo);
}

export async function detalleFinancieroAction(tenantId: string, periodo: PeriodoFinanciero) {
  const institucion = await obtenerInstitucionActual();
  if (!institucion)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return detalleFinanciero(institucion.id, tenantId, periodo);
}

export async function detalleOperativoAction(
  tenantId: string,
  periodo: { desde: string; hasta: string }
) {
  const institucion = await obtenerInstitucionActual();
  if (!institucion)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return detalleOperativo(institucion.id, tenantId, periodo);
}

export async function detalleInventarioOperativoAction(tenantId: string) {
  const institucion = await obtenerInstitucionActual();
  if (!institucion)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return detalleInventarioOperativo(institucion.id, tenantId);
}

// Delgada: solo resuelve la URL de redirect del magic link (especifica de
// esta ruta) y delega la decision real (¿existe una Institucion con este
// email?) en el modulo — ver solicitarMagicLinkInstitucion,
// consentimiento/actions.ts.
export async function solicitarMagicLinkInstitucionAction(email: string) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return solicitarMagicLinkInstitucion(email, `${siteUrl}/portal/auth/callback`);
}

// La cerrarSesion() compartida (src/lib/supabase/actions.ts) siempre
// redirige a /login — no tiene sentido para una Institucion, que no tiene
// contraseña ni cuenta ahi.
export async function cerrarSesionInstitucionAction() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect("/portal");
}
