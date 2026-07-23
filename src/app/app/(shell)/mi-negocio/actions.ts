"use server";

import { urlCallbackApp } from "@/lib/site-url";
import {
  actualizarPermisosRol,
  calcularEstadoAcceso,
  cambiarRolUsuario,
  crearRolPersonalizado,
  eliminarRol,
  invitarUsuario,
  listarCapacidadesEspeciales,
  listarPermisosPorRol,
  listarRoles,
  listarUsuarios,
  obtenerTenantPorId,
  obtenerUsuarioActual,
  otorgarCapacidadEspecialPorRol,
  otorgarCapacidadEspecialPorUsuario,
  reactivarUsuario,
  suspenderUsuario,
  transferirOwner,
  type Accion,
  type Capacidad,
  type Modulo,
} from "@/modules/identidad/actions";
import {
  editarColaboradorSchema,
  invitarColaboradorSchema,
  crearRolFormSchema,
} from "@/modules/identidad/validation";
import { obtenerPlanPorId } from "@/modules/suscripcion/actions";

// Server Actions delgadas (mismo patron que onboarding/actions.ts): resuelven
// la sesion server-side y delegan en identidad/actions.ts.

export async function listarUsuariosAction() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return listarUsuarios(usuario);
}

export async function invitarColaboradorAction(input: unknown) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  const parsed = invitarColaboradorSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }
  return invitarUsuario(usuario, parsed.data, urlCallbackApp());
}

export async function editarColaboradorAction(usuarioId: string, input: unknown) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  const parsed = editarColaboradorSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }
  return cambiarRolUsuario(usuario, usuarioId, parsed.data.rolId);
}

export async function suspenderColaboradorAction(usuarioId: string) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return suspenderUsuario(usuario, usuarioId);
}

export async function reactivarColaboradorAction(usuarioId: string) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return reactivarUsuario(usuario, usuarioId);
}

export async function transferirOwnerAction(nuevoOwnerUsuarioId: string, rolParaOwnerSaliente: string) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return transferirOwner(usuario, nuevoOwnerUsuarioId, rolParaOwnerSaliente);
}

export async function listarRolesAction() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return listarRoles(usuario);
}

export async function listarPermisosPorRolAction(rolId: string) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return listarPermisosPorRol(usuario, rolId);
}

export async function crearRolAction(
  input: unknown,
  permisos: { modulo: Modulo; accion: Accion; permitido: boolean }[]
) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  const parsed = crearRolFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }
  return crearRolPersonalizado(usuario, { nombre: parsed.data.nombre, permisos });
}

export async function actualizarPermisosRolAction(
  rolId: string,
  permisos: { modulo: Modulo; accion: Accion; permitido: boolean }[]
) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return actualizarPermisosRol(usuario, rolId, permisos);
}

export async function eliminarRolAction(rolId: string) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return eliminarRol(usuario, rolId);
}

export async function listarCapacidadesEspecialesAction() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return listarCapacidadesEspeciales(usuario);
}

export async function otorgarCapacidadEspecialPorRolAction(
  rolId: string,
  capacidad: Capacidad,
  habilitado: boolean
) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return otorgarCapacidadEspecialPorRol(usuario, rolId, capacidad, habilitado);
}

export async function otorgarCapacidadEspecialPorUsuarioAction(
  usuarioId: string,
  capacidad: Capacidad,
  habilitado: boolean
) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return otorgarCapacidadEspecialPorUsuario(usuario, usuarioId, capacidad, habilitado);
}

export async function obtenerMiPlanAction() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  // Gate propio de la action, no solo del page — una Server Action es un
  // endpoint POST invocable directamente, no puede confiar en que el page que
  // la renderiza ya validó (UI-044). Los datos de plan/facturación son
  // exclusivos del Owner, mismo criterio que listarUsuarios/listarRoles.
  if (!usuario.esOwner) {
    return { ok: false as const, error: "Solo el dueño del negocio puede ver el plan del negocio." };
  }
  const tenantRes = await obtenerTenantPorId(usuario, usuario.tenantId);
  if (!tenantRes.ok) return tenantRes;
  const tenant = tenantRes.data;
  const plan = tenant.planId ? await obtenerPlanPorId(tenant.planId) : null;
  return {
    ok: true as const,
    data: {
      estadoSuscripcion: tenant.estadoSuscripcion,
      estadoAcceso: calcularEstadoAcceso(tenant),
      fechaInicioSuscripcion: tenant.fechaInicioSuscripcion,
      fechaProximoPago: tenant.fechaProximoPago,
      plan,
    },
  };
}
