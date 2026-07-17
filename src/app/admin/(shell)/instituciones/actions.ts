"use server";

import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { listarTenants } from "@/modules/identidad/actions";
import {
  actualizarInstitucion,
  agregarTenantACartera,
  crearInstitucion,
  crearSolicitudSeguimiento,
  eliminarInstitucion,
  listarCarteraPorInstitucion,
  listarInstituciones,
  quitarDeCartera,
  type DatosInstitucion,
  type ModuloVeedor,
} from "@/modules/consentimiento/actions";

// Server Actions delgadas (mismo patron que reportes/actions.ts): resuelven
// la sesion server-side (ya gateada a ceom_admin por admin/layout.tsx) y
// delegan en consentimiento/actions.ts.

export async function listarInstitucionesAction() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return listarInstituciones(usuario);
}

export async function crearInstitucionAction(input: DatosInstitucion) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return crearInstitucion(usuario, input);
}

export async function actualizarInstitucionAction(
  institucionId: string,
  input: Partial<DatosInstitucion>
) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return actualizarInstitucion(usuario, institucionId, input);
}

export async function eliminarInstitucionAction(institucionId: string) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return eliminarInstitucion(usuario, institucionId);
}

export async function listarCarteraPorInstitucionAction(institucionId: string) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return listarCarteraPorInstitucion(usuario, institucionId);
}

export async function agregarTenantACarteraAction(input: {
  institucionId: string;
  tenantId: string;
  cohorte?: string;
  fechaInicio: string;
  fechaFin?: string;
}) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return agregarTenantACartera(usuario, input);
}

export async function quitarDeCarteraAction(carteraId: string) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return quitarDeCartera(usuario, carteraId);
}

export async function listarTenantsAction() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return listarTenants(usuario);
}

export async function crearSolicitudSeguimientoAction(input: {
  institucionId: string;
  tenantId: string;
  modulosSolicitados: ModuloVeedor[];
}) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return crearSolicitudSeguimiento(usuario, input);
}
