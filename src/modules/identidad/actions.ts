import { crearClienteAdmin, crearClienteServidor } from "@/lib/supabase/server";
import {
  obtenerPlanPorId,
  PLAN_BASICO_ID,
} from "@/modules/suscripcion/actions";
import {
  CEOM_OPS_TENANT_ID,
  DURACION_ETAPA_SOLO_LECTURA_DIAS,
  ROL_CEOM_ADMIN_ID,
  ROL_OWNER_ID,
} from "./constants";
import * as repo from "./repository";
import type { UsuarioConRol } from "./repository";
import type {
  accionPermisoEnum,
  capacidadEspecialEnum,
  estadoAccesoEnum,
  estadoSuscripcionEnum,
  moduloPermisoEnum,
} from "./schema";

export type Resultado<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type Modulo = (typeof moduloPermisoEnum.enumValues)[number];
type Accion = (typeof accionPermisoEnum.enumValues)[number];
type Capacidad = (typeof capacidadEspecialEnum.enumValues)[number];
type EstadoAcceso = (typeof estadoAccesoEnum.enumValues)[number];
type EstadoSuscripcion = (typeof estadoSuscripcionEnum.enumValues)[number];

// --- Sesion ---------------------------------------------------------

export async function obtenerUsuarioActual(): Promise<UsuarioConRol | null> {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return repo.obtenerUsuarioConRolPorId(user.id);
}

// --- Motor de autorizacion (Modulo_01 seccion 7) ---------------------------------------------------------

/**
 * Funcion pura: "Derivado, no editable a mano" (Modulo_01 seccion 1.1). No
 * confia en el campo persistido tenants.estado_acceso (nada lo mantiene al
 * dia todavia — el scheduler real es trabajo de Modulo 11), lo recalcula
 * siempre a partir de estado_suscripcion + fecha_proximo_pago.
 */
export function calcularEstadoAcceso(
  tenant: {
    estadoSuscripcion: EstadoSuscripcion;
    fechaProximoPago: string | null;
  },
  ahora: Date = new Date(),
  duracionEtapaSoloLecturaDias: number = DURACION_ETAPA_SOLO_LECTURA_DIAS
): EstadoAcceso {
  if (tenant.estadoSuscripcion === "activa") return "activo";
  // "pausada" no tiene comportamiento definido en Modulo_01 — se trata como
  // bloqueado por seguridad (un tenant pausado no deberia operar).
  if (tenant.estadoSuscripcion === "pausada") return "bloqueado";

  // vencida: etapa de gracia en solo_lectura, medida desde fecha_proximo_pago.
  if (duracionEtapaSoloLecturaDias <= 0) return "bloqueado";
  if (!tenant.fechaProximoPago) return "bloqueado";
  const finGracia = new Date(tenant.fechaProximoPago);
  finGracia.setDate(finGracia.getDate() + duracionEtapaSoloLecturaDias);
  return ahora <= finGracia ? "solo_lectura" : "bloqueado";
}

/**
 * tienePermiso(solicitante, tenantObjetivo, modulo, accion) — Modulo_01
 * seccion 7.1. Orden: CEOM Admin (bypass cross-tenant) -> estado_acceso ->
 * Owner (bypass matriz) -> matriz rol x modulo x accion.
 */
export async function tienePermiso(
  solicitante: UsuarioConRol,
  tenantObjetivoId: string,
  modulo: Modulo,
  accion: Accion
): Promise<boolean> {
  if (solicitante.rol.esRolSistema && solicitante.rolId === ROL_CEOM_ADMIN_ID) {
    // Alcance cross-tenant (Modulo_01 seccion 6.5). El consentimiento
    // externo institucional (seccion 7.2) es el futuro Gateway de
    // Consentimiento, un modulo aparte — no aplica aca.
    return true;
  }

  if (solicitante.tenantId !== tenantObjetivoId) return false;

  const tenant = await repo.obtenerTenantPorId(tenantObjetivoId);
  if (!tenant) return false;

  const estadoAcceso = calcularEstadoAcceso(tenant);
  if (estadoAcceso === "bloqueado") return false;
  if (estadoAcceso === "solo_lectura" && accion !== "ver") return false;

  if (solicitante.esOwner) return true;

  const filas = await repo.listarPermisosPorRol(solicitante.rolId);
  const permiso = filas.find((p) => p.modulo === modulo && p.accion === accion);
  return permiso?.permitido ?? false;
}

/** Resolucion: override por usuario > override por rol > false (seccion 13.1). */
export async function tieneCapacidadEspecial(
  solicitante: UsuarioConRol,
  capacidad: Capacidad
): Promise<boolean> {
  const overrideUsuario = await repo.obtenerCapacidadEspecialPorUsuario(
    solicitante.id,
    capacidad
  );
  if (overrideUsuario) return overrideUsuario.habilitado;

  const overrideRol = await repo.obtenerCapacidadEspecialPorRol(
    solicitante.rolId,
    capacidad
  );
  if (overrideRol) return overrideRol.habilitado;

  return false;
}

// --- Alta de tenant (Modulo_01 seccion 3) ---------------------------------------------------------

export interface CrearTenantInput {
  nombreNegocio: string;
  ciudadBase?: string;
  monedaPrincipal: string;
  canalesVenta?: string[];
  planId?: string;
  fechaInicioSuscripcion: string;
  ownerEmail: string;
  ownerNombreCompleto: string;
}

/**
 * Solo CEOM Admin. Crea el usuario de Supabase Auth via invitacion (dispara
 * el email real) y recien con ese id arma la transaccion atomica de
 * tenant+sucursal+usuario Owner. Limitacion conocida: si la transaccion de
 * DB falla despues de creado el usuario de Auth, ese usuario queda
 * huerfano (Supabase Auth y Postgres no comparten una transaccion) — se
 * limpia manualmente via el admin API si llega a pasar.
 */
export async function crearTenant(
  solicitante: UsuarioConRol,
  input: CrearTenantInput
): Promise<
  Resultado<{ tenantId: string; sucursalId: string; usuarioOwnerId: string }>
> {
  if (solicitante.rolId !== ROL_CEOM_ADMIN_ID) {
    return { ok: false, error: "Solo CEOM Admin puede dar de alta un tenant." };
  }

  // Modulo_01 seccion 12: "Básico" es el plan de arranque por defecto. Si
  // se especifica otro, se valida contra Suscripcion (nunca contra su
  // repository directo — regla de caja negra) que exista y este activo.
  const planId = input.planId ?? PLAN_BASICO_ID;
  const plan = await obtenerPlanPorId(planId);
  if (!plan || !plan.activo) {
    return { ok: false, error: "El plan indicado no existe o no está activo." };
  }

  const admin = crearClienteAdmin();
  const { data: authData, error: authError } =
    await admin.auth.admin.inviteUserByEmail(input.ownerEmail);
  if (authError || !authData.user) {
    return {
      ok: false,
      error: authError?.message ?? "No se pudo crear el usuario de Auth.",
    };
  }

  const { tenant, sucursal, usuarioOwner } = await repo.crearTenantConOwner({
    tenant: {
      nombreNegocio: input.nombreNegocio,
      ciudadBase: input.ciudadBase,
      monedaPrincipal: input.monedaPrincipal,
      canalesVenta: input.canalesVenta ?? [],
      planId,
      estadoSuscripcion: "activa",
      fechaInicioSuscripcion: input.fechaInicioSuscripcion,
      creadoPor: solicitante.id,
    },
    ownerId: authData.user.id,
    ownerNombreCompleto: input.ownerNombreCompleto,
    ownerEmail: input.ownerEmail,
    rolOwnerId: ROL_OWNER_ID,
    creadoPor: solicitante.id,
  });

  return {
    ok: true,
    data: {
      tenantId: tenant.id,
      sucursalId: sucursal.id,
      usuarioOwnerId: usuarioOwner.id,
    },
  };
}

// --- Colaboradores (Modulo_01 seccion 8) ---------------------------------------------------------

async function requireEscrituraHabilitada(
  tenantId: string
): Promise<Resultado<true>> {
  const tenant = await repo.obtenerTenantPorId(tenantId);
  if (!tenant) return { ok: false, error: "Tenant no encontrado." };
  const estado = calcularEstadoAcceso(tenant);
  if (estado !== "activo") {
    return {
      ok: false,
      error: `El tenant esta en estado "${estado}", no se permite esta accion.`,
    };
  }
  return { ok: true, data: true };
}

export async function invitarUsuario(
  solicitante: UsuarioConRol,
  input: { email: string; nombreCompleto: string; rolId: string }
): Promise<Resultado<{ usuarioId: string }>> {
  // "cualquier usuario con permiso crear en este modulo" (Modulo_01 seccion
  // 8.1) no es representable con la matriz generica (identidad no es un
  // modulo del enum "modulo_permiso") — se acota a Owner, ver ANCLA.md.
  if (!solicitante.esOwner) {
    return { ok: false, error: "Solo el Owner puede invitar colaboradores." };
  }

  const escritura = await requireEscrituraHabilitada(solicitante.tenantId);
  if (!escritura.ok) return escritura;

  const admin = crearClienteAdmin();
  const { data: authData, error: authError } =
    await admin.auth.admin.inviteUserByEmail(input.email);
  if (authError || !authData.user) {
    return {
      ok: false,
      error: authError?.message ?? "No se pudo crear el usuario de Auth.",
    };
  }

  const usuario = await repo.insertarUsuario({
    id: authData.user.id,
    tenantId: solicitante.tenantId,
    nombreCompleto: input.nombreCompleto,
    email: input.email,
    rolId: input.rolId,
    esOwner: false,
    activo: true,
    creadoPor: solicitante.id,
  });

  return { ok: true, data: { usuarioId: usuario.id } };
}

export async function cambiarRolUsuario(
  solicitante: UsuarioConRol,
  usuarioId: string,
  nuevoRolId: string
): Promise<Resultado<true>> {
  if (!solicitante.esOwner) {
    return { ok: false, error: "Solo el Owner puede cambiar roles." };
  }
  const escritura = await requireEscrituraHabilitada(solicitante.tenantId);
  if (!escritura.ok) return escritura;

  await repo.actualizarRolUsuario(usuarioId, nuevoRolId, solicitante.id);
  return { ok: true, data: true };
}

export async function suspenderUsuario(
  solicitante: UsuarioConRol,
  usuarioId: string
): Promise<Resultado<true>> {
  if (!solicitante.esOwner) {
    return { ok: false, error: "Solo el Owner puede suspender usuarios." };
  }
  const escritura = await requireEscrituraHabilitada(solicitante.tenantId);
  if (!escritura.ok) return escritura;

  const objetivo = await repo.obtenerUsuarioConRolPorId(usuarioId);
  if (!objetivo) return { ok: false, error: "Usuario no encontrado." };

  // Caso borde 9.1: nunca dejar al tenant sin ningun Owner activo.
  if (objetivo.esOwner) {
    const owners = await repo.contarOwnersActivos(objetivo.tenantId);
    if (owners <= 1) {
      return {
        ok: false,
        error: "No se puede suspender al unico Owner del tenant.",
      };
    }
  }

  await repo.actualizarActivoUsuario(usuarioId, false, solicitante.id);
  return { ok: true, data: true };
}

export async function reactivarUsuario(
  solicitante: UsuarioConRol,
  usuarioId: string
): Promise<Resultado<true>> {
  if (!solicitante.esOwner) {
    return { ok: false, error: "Solo el Owner puede reactivar usuarios." };
  }
  const escritura = await requireEscrituraHabilitada(solicitante.tenantId);
  if (!escritura.ok) return escritura;

  await repo.actualizarActivoUsuario(usuarioId, true, solicitante.id);
  return { ok: true, data: true };
}

// --- Roles y permisos (Modulo_01 seccion 6.3) ---------------------------------------------------------

export async function crearRolPersonalizado(
  solicitante: UsuarioConRol,
  input: {
    nombre: string;
    permisos: { modulo: Modulo; accion: Accion; permitido: boolean }[];
  }
): Promise<Resultado<{ rolId: string }>> {
  if (!solicitante.esOwner) {
    return { ok: false, error: "Solo el Owner puede crear roles." };
  }
  const escritura = await requireEscrituraHabilitada(solicitante.tenantId);
  if (!escritura.ok) return escritura;

  const rol = await repo.crearRol({
    tenantId: solicitante.tenantId,
    nombre: input.nombre,
    esRolSistema: false,
  });
  if (input.permisos.length > 0) {
    await repo.reemplazarPermisosRol(rol.id, input.permisos);
  }
  return { ok: true, data: { rolId: rol.id } };
}

export async function actualizarPermisosRol(
  solicitante: UsuarioConRol,
  rolId: string,
  permisos: { modulo: Modulo; accion: Accion; permitido: boolean }[]
): Promise<Resultado<true>> {
  if (!solicitante.esOwner) {
    return { ok: false, error: "Solo el Owner puede editar permisos." };
  }
  const escritura = await requireEscrituraHabilitada(solicitante.tenantId);
  if (!escritura.ok) return escritura;

  const rol = await repo.obtenerRolPorId(rolId);
  if (!rol || rol.esRolSistema) {
    return { ok: false, error: "Rol no encontrado o no editable." };
  }

  await repo.reemplazarPermisosRol(rolId, permisos);
  return { ok: true, data: true };
}

export async function eliminarRol(
  solicitante: UsuarioConRol,
  rolId: string
): Promise<Resultado<true>> {
  if (!solicitante.esOwner) {
    return { ok: false, error: "Solo el Owner puede eliminar roles." };
  }
  const escritura = await requireEscrituraHabilitada(solicitante.tenantId);
  if (!escritura.ok) return escritura;

  const rol = await repo.obtenerRolPorId(rolId);
  if (!rol || rol.esRolSistema) {
    return { ok: false, error: "Rol no encontrado o no eliminable." };
  }

  // Caso borde 9.3: bloqueado hasta reasignar los usuarios de ese rol.
  const usuariosActivos = await repo.contarUsuariosActivosPorRol(rolId);
  if (usuariosActivos > 0) {
    return {
      ok: false,
      error: `Hay ${usuariosActivos} usuario(s) con este rol; reasignalos antes de eliminarlo.`,
    };
  }

  await repo.eliminarRolSoft(rolId);
  return { ok: true, data: true };
}

export { CEOM_OPS_TENANT_ID, ROL_CEOM_ADMIN_ID, ROL_OWNER_ID };
// Parte del contrato publico: cualquier modulo que llame a tienePermiso()
// necesita tipar su parametro "solicitante" sin importar el repository de
// Identidad directamente.
export type { UsuarioConRol } from "./repository";
