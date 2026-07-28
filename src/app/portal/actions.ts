"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  canjearCodigoAcceso,
  canjearCodigoAccesoAutenticada,
  obtenerInstitucionActual,
  registrarIntentoCanjeYVerificarLimite,
  resumenAccesosPropios,
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

/**
 * Huella del origen de la request, para el límite de intentos de canje.
 *
 * **Hash, nunca la IP en claro**: para limitar alcanza con saber si es el
 * mismo origen, no cuál es. El secreto sale de `SUPABASE_SECRET_KEY` (ya
 * obligatoria en el servidor) para que la huella no sea reversible con un
 * diccionario de IPs — un SHA-256 pelado de una IPv4 se rompe por fuerza
 * bruta en segundos.
 *
 * Vive en la capa de ruta y no en el módulo: es la única que ve los headers,
 * y `consentimiento` no debería saber que existe una IP.
 */
async function huellaDelOrigen(): Promise<string> {
  const cabeceras = await headers();
  const ip =
    cabeceras.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    cabeceras.get("x-real-ip") ||
    "desconocido";
  return createHash("sha256")
    .update(`${process.env.SUPABASE_SECRET_KEY ?? ""}:${ip}`)
    .digest("hex");
}

/** `{ok:false}` si este origen se pasó del límite; `null` si puede seguir. */
async function limiteDeCanjeSuperado(): Promise<{ ok: false; error: string } | null> {
  const { superado } = await registrarIntentoCanjeYVerificarLimite(await huellaDelOrigen());
  if (!superado) return null;
  return {
    ok: false,
    error:
      "Demasiados intentos. Esperá unos minutos y volvé a probar — si el código no te funciona, " +
      "pedile al negocio que te genere uno nuevo.",
  };
}

export async function canjearCodigoAccesoAction(input: {
  codigo: string;
  institucionNueva: DatosInstitucion;
}) {
  const limite = await limiteDeCanjeSuperado();
  if (limite) return limite;
  return canjearCodigoAcceso(input);
}

/**
 * Canje estando ya autenticada — el cierre de H-42 del lado de la UI.
 *
 * Resuelve la Institucion desde SU PROPIA sesion (`obtenerInstitucionActual`),
 * nunca desde un `institucionId` que venga del cliente: si lo recibiera por
 * parametro, cualquiera podria canjear un codigo en nombre de otra
 * institucion. Mismo criterio que las 5 acciones delgadas de abajo.
 *
 * No pasa por `limiteDeCanjeSuperado()`: acá ya hay una sesión real detrás, y
 * el límite existe para la única escritura SIN autenticar del producto.
 */
export async function canjearCodigoAutenticadaAction(codigo: string) {
  const institucion = await obtenerInstitucionActual();
  if (!institucion)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return canjearCodigoAccesoAutenticada(institucion.id, codigo);
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

export async function resumenAccesosPropiosAction(tenantId: string) {
  const institucion = await obtenerInstitucionActual();
  if (!institucion)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return resumenAccesosPropios(institucion.id, tenantId);
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
