"use server";

import { obtenerUsuarioActual, obtenerTenantPorId } from "@/modules/identidad/actions";
import { obtenerPlanPorId } from "@/modules/suscripcion/actions";
import {
  aprobarSolicitud,
  consultarAprobacionesPorTenant,
  generarCodigoAcceso,
  listarCodigosAcceso,
  listarSolicitudesPorTenant,
  obtenerInstitucionPorId,
  rechazarSolicitud,
  revocarCodigoAcceso,
  revocarConsentimiento,
  type ModuloVeedor,
} from "@/modules/consentimiento/actions";

// Server Actions delgadas (mismo patron que reportes/actions.ts): resuelven
// la sesion server-side y delegan en consentimiento/actions.ts.

export async function obtenerModulosPermitidosAction() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const tenantRes = await obtenerTenantPorId(usuario, usuario.tenantId);
  if (!tenantRes.ok) return tenantRes;
  if (!tenantRes.data.planId) {
    return { ok: true as const, data: { modulosVeedorPermitidos: [] as ModuloVeedor[] } };
  }
  const plan = await obtenerPlanPorId(tenantRes.data.planId);
  return {
    ok: true as const,
    data: { modulosVeedorPermitidos: (plan?.modulosVeedorPermitidos ?? []) as ModuloVeedor[] },
  };
}

export async function generarCodigoAccesoAction(input: { modulosHabilitados: ModuloVeedor[] }) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return generarCodigoAcceso(usuario, usuario.tenantId, input);
}

export async function listarCodigosAccesoAction() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return listarCodigosAcceso(usuario, usuario.tenantId);
}

export async function revocarCodigoAccesoAction(codigoAccesoId: string) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return revocarCodigoAcceso(usuario, codigoAccesoId);
}

export async function consultarAprobacionesPorTenantAction() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return consultarAprobacionesPorTenant(usuario, usuario.tenantId);
}

export async function revocarConsentimientoAction(aprobacionId: string) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return revocarConsentimiento(usuario, aprobacionId);
}

export async function listarSolicitudesPorTenantAction() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return listarSolicitudesPorTenant(usuario, usuario.tenantId);
}

export async function aprobarSolicitudAction(
  solicitudId: string,
  input: { modulosAprobados: ModuloVeedor[] }
) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return aprobarSolicitud(usuario, solicitudId, input);
}

export async function obtenerInstitucionPorIdAction(institucionId: string) {
  return obtenerInstitucionPorId(institucionId);
}

export async function rechazarSolicitudAction(solicitudId: string) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return rechazarSolicitud(usuario, solicitudId);
}
