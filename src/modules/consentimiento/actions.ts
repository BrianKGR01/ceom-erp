import { randomBytes } from "node:crypto";
import type { UsuarioConRol } from "@/modules/identidad/actions";
import { obtenerEstadoAccesoTenant, obtenerTenantPorId } from "@/modules/identidad/actions";
import { ROL_CEOM_ADMIN_ID } from "@/modules/identidad/constants";
import type { moduloPermisoEnum } from "@/modules/identidad/schema";
import { obtenerPlanPorId } from "@/modules/suscripcion/actions";
import * as repo from "./repository";
import type { tipoInstitucionEnum } from "./schema";

export type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

type TipoInstitucion = (typeof tipoInstitucionEnum.enumValues)[number];
type ModuloConsultado = (typeof moduloPermisoEnum.enumValues)[number];
// Reexportado desde Suscripcion — es el mismo catalogo que
// planes.modulos_veedor_permitidos ya usa (decision del plan: granularidad
// por modulo veedor, no por funcion individual).
export type ModuloVeedor = "financiero" | "operativo" | "inventario_operativo";

interface SolicitanteCeomAdmin {
  rolId: string;
}

function requiereCeomAdmin(
  solicitante: SolicitanteCeomAdmin
): { ok: false; error: string } | null {
  if (solicitante.rolId !== ROL_CEOM_ADMIN_ID) {
    return { ok: false, error: "Solo CEOM Admin puede gestionar esto." };
  }
  return null;
}

function requiereOwnerDelTenant(
  solicitante: UsuarioConRol,
  tenantId: string
): { ok: false; error: string } | null {
  if (!solicitante.esOwner || solicitante.tenantId !== tenantId) {
    return { ok: false, error: "Solo el Owner de este tenant puede hacer esto." };
  }
  return null;
}

// Alfabeto sin 0/O/1/I para evitar confusion al transcribir el codigo a mano.
const ALFABETO_CODIGO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generarCodigoAlfanumerico(longitud = 8): string {
  const bytes = randomBytes(longitud);
  let codigo = "";
  for (let i = 0; i < longitud; i++) {
    codigo += ALFABETO_CODIGO[bytes[i] % ALFABETO_CODIGO.length];
  }
  return codigo;
}

// --- Instituciones (gate ROL_CEOM_ADMIN_ID, catalogo global) ---------------------------------------------------------

export interface DatosInstitucion {
  nombre: string;
  tipo: TipoInstitucion;
  contacto?: string;
}

export async function crearInstitucion(
  solicitante: SolicitanteCeomAdmin & { id?: string },
  input: DatosInstitucion
): Promise<Resultado<{ institucionId: string }>> {
  const bloqueo = requiereCeomAdmin(solicitante);
  if (bloqueo) return bloqueo;
  const institucion = await repo.crearInstitucion({
    nombre: input.nombre,
    tipo: input.tipo,
    contacto: input.contacto,
    creadoPor: solicitante.id,
  });
  return { ok: true, data: { institucionId: institucion.id } };
}

export async function actualizarInstitucion(
  solicitante: SolicitanteCeomAdmin,
  institucionId: string,
  input: Partial<DatosInstitucion>
): Promise<Resultado<true>> {
  const bloqueo = requiereCeomAdmin(solicitante);
  if (bloqueo) return bloqueo;
  await repo.actualizarInstitucion(institucionId, input);
  return { ok: true, data: true };
}

export async function eliminarInstitucion(
  solicitante: SolicitanteCeomAdmin,
  institucionId: string
): Promise<Resultado<true>> {
  const bloqueo = requiereCeomAdmin(solicitante);
  if (bloqueo) return bloqueo;
  await repo.eliminarInstitucionSoft(institucionId);
  return { ok: true, data: true };
}

export async function listarInstituciones() {
  return repo.listarInstituciones();
}

// --- Cartera Institucional (gate ROL_CEOM_ADMIN_ID) ---------------------------------------------------------

export async function agregarTenantACartera(
  solicitante: SolicitanteCeomAdmin,
  input: { institucionId: string; tenantId: string; cohorte?: string; fechaInicio: string; fechaFin?: string }
): Promise<Resultado<{ carteraId: string }>> {
  const bloqueo = requiereCeomAdmin(solicitante);
  if (bloqueo) return bloqueo;
  const fila = await repo.agregarACartera({
    institucionId: input.institucionId,
    tenantId: input.tenantId,
    cohorte: input.cohorte,
    fechaInicio: input.fechaInicio,
    fechaFin: input.fechaFin,
  });
  return { ok: true, data: { carteraId: fila.id } };
}

export async function quitarDeCartera(
  solicitante: SolicitanteCeomAdmin,
  carteraId: string
): Promise<Resultado<true>> {
  const bloqueo = requiereCeomAdmin(solicitante);
  if (bloqueo) return bloqueo;
  await repo.quitarDeCarteraSoft(carteraId);
  return { ok: true, data: true };
}

export async function listarCarteraPorInstitucion(
  solicitante: SolicitanteCeomAdmin,
  institucionId: string
): Promise<Resultado<Awaited<ReturnType<typeof repo.listarCarteraPorInstitucion>>>> {
  const bloqueo = requiereCeomAdmin(solicitante);
  if (bloqueo) return bloqueo;
  return { ok: true, data: await repo.listarCarteraPorInstitucion(institucionId) };
}

/**
 * Variante SIN gate de ceom_admin — a proposito, para que la propia
 * Institucion (Modulo 11, Monitoreo Institucional) liste su cartera desde el
 * futuro Portal de Entidades Veedoras, donde no existe un SolicitanteCeomAdmin
 * (mismo criterio que tieneConsentimiento()/canjearCodigoAcceso(): quien
 * llama ya conoce su propio institucionId, no hay nada que gatear acá salvo
 * el filtro por ese id que el repository ya aplica).
 */
export async function listarCarteraPropia(
  institucionId: string
): Promise<Resultado<Awaited<ReturnType<typeof repo.listarCarteraPorInstitucion>>>> {
  return { ok: true, data: await repo.listarCarteraPorInstitucion(institucionId) };
}

// --- Solicitud de Seguimiento ---------------------------------------------------------

/** La institucion no tiene login propio en el alcance de este modulo — CEOM
 * la registra en su nombre (Modulo_11 seccion 3.1). */
export async function crearSolicitudSeguimiento(
  solicitante: SolicitanteCeomAdmin,
  input: { institucionId: string; tenantId: string; modulosSolicitados: ModuloVeedor[] }
): Promise<Resultado<{ solicitudId: string }>> {
  const bloqueo = requiereCeomAdmin(solicitante);
  if (bloqueo) return bloqueo;
  const solicitud = await repo.crearSolicitudSeguimiento({
    institucionId: input.institucionId,
    tenantId: input.tenantId,
    modulosSolicitados: input.modulosSolicitados,
  });
  return { ok: true, data: { solicitudId: solicitud.id } };
}

/** Solo el Owner del tenant destino decide que se aprueba — puede ser un
 * subconjunto de lo solicitado (Modulo_11 seccion 3.1). */
export async function aprobarSolicitud(
  solicitante: UsuarioConRol,
  solicitudId: string,
  input: { modulosAprobados: ModuloVeedor[] }
): Promise<Resultado<{ aprobacionId: string }>> {
  const solicitud = await repo.obtenerSolicitudPorId(solicitudId);
  if (!solicitud) return { ok: false, error: "Solicitud no encontrada." };
  const bloqueo = requiereOwnerDelTenant(solicitante, solicitud.tenantId);
  if (bloqueo) return bloqueo;

  const aprobacion = await repo.crearAprobacionTenant({
    tenantId: solicitud.tenantId,
    institucionId: solicitud.institucionId,
    modulosAprobados: input.modulosAprobados,
    aprobadoPor: solicitante.id,
  });
  await repo.actualizarEstadoSolicitud(solicitudId, "aprobada");

  return { ok: true, data: { aprobacionId: aprobacion.id } };
}

export async function rechazarSolicitud(
  solicitante: UsuarioConRol,
  solicitudId: string
): Promise<Resultado<true>> {
  const solicitud = await repo.obtenerSolicitudPorId(solicitudId);
  if (!solicitud) return { ok: false, error: "Solicitud no encontrada." };
  const bloqueo = requiereOwnerDelTenant(solicitante, solicitud.tenantId);
  if (bloqueo) return bloqueo;

  await repo.actualizarEstadoSolicitud(solicitudId, "rechazada");
  return { ok: true, data: true };
}

export async function listarSolicitudesPorTenant(
  solicitante: UsuarioConRol,
  tenantId: string
): Promise<Resultado<Awaited<ReturnType<typeof repo.listarSolicitudesPorTenant>>>> {
  const esCeomAdmin = solicitante.rolId === ROL_CEOM_ADMIN_ID;
  if (!esCeomAdmin && solicitante.tenantId !== tenantId) {
    return { ok: false, error: "No tenés permiso para ver las solicitudes de este tenant." };
  }
  return { ok: true, data: await repo.listarSolicitudesPorTenant(tenantId) };
}

// --- Aprobacion de Tenant / Gateway propiamente dicho ---------------------------------------------------------

/** Revocacion inmediata (caso borde 3): la proxima consulta a
 * tieneConsentimiento() ya deniega, sin "sesiones" persistentes. */
export async function revocarConsentimiento(
  solicitante: UsuarioConRol,
  aprobacionId: string
): Promise<Resultado<true>> {
  const aprobacion = await repo.obtenerAprobacionPorId(aprobacionId);
  if (!aprobacion) return { ok: false, error: "Aprobación no encontrada." };
  const bloqueo = requiereOwnerDelTenant(solicitante, aprobacion.tenantId);
  if (bloqueo) return bloqueo;

  await repo.revocarAprobacion(aprobacionId);
  return { ok: true, data: true };
}

export async function consultarAprobacionesPorTenant(
  solicitante: UsuarioConRol,
  tenantId: string
): Promise<Resultado<Awaited<ReturnType<typeof repo.listarAprobacionesPorTenant>>>> {
  const esCeomAdmin = solicitante.rolId === ROL_CEOM_ADMIN_ID;
  if (!esCeomAdmin && solicitante.tenantId !== tenantId) {
    return { ok: false, error: "No tenés permiso para ver las aprobaciones de este tenant." };
  }
  return { ok: true, data: await repo.listarAprobacionesPorTenant(tenantId) };
}

/**
 * El Gateway propiamente dicho (Modulo_11 seccion 3.2). Sin `solicitante`:
 * lo llama el futuro Panel Institucional en nombre de una Institucion, que
 * no es un UsuarioConRol — por eso usa obtenerEstadoAccesoTenant() (lectura
 * minima, sin gate) en vez de obtenerTenantPorId(). Caso borde 1: un tenant
 * bloqueado deniega igual, aunque haya aprobacion vigente; solo_lectura NO
 * bloquea (la consulta institucional siempre es de solo lectura, mismo
 * criterio que "ver" en tienePermiso()).
 */
export async function tieneConsentimiento(
  institucionId: string,
  tenantId: string,
  moduloVeedor: ModuloVeedor
): Promise<boolean> {
  const estado = await obtenerEstadoAccesoTenant(tenantId);
  if (!estado.ok || estado.data.estadoAcceso === "bloqueado") return false;

  // La mas reciente manda: si esa fila esta revocada, no hay consentimiento
  // aunque exista una aprobacion mas vieja sin revocar (repo no filtra por
  // revocado_en a proposito, ver su comentario).
  const aprobacion = await repo.obtenerAprobacionVigente(tenantId, institucionId);
  if (!aprobacion || aprobacion.revocadoEn) return false;
  return aprobacion.modulosAprobados.includes(moduloVeedor);
}

// --- Codigo de Acceso ---------------------------------------------------------

/** Valida contra planes.modulos_veedor_permitidos del tenant (Modulo_11
 * seccion 3.4, adenda ya implementada en Suscripcion) — cierra el gap que
 * antes bloqueaba esta validacion (Identidad no exponia obtenerTenantPorId). */
export async function generarCodigoAcceso(
  solicitante: UsuarioConRol,
  tenantId: string,
  input: { modulosHabilitados: ModuloVeedor[] }
): Promise<Resultado<{ codigoAccesoId: string; codigo: string }>> {
  const bloqueo = requiereOwnerDelTenant(solicitante, tenantId);
  if (bloqueo) return bloqueo;

  const tenantRes = await obtenerTenantPorId(solicitante, tenantId);
  if (!tenantRes.ok) return tenantRes;
  if (!tenantRes.data.planId) {
    return { ok: false, error: "Este tenant no tiene un plan asignado." };
  }

  const plan = await obtenerPlanPorId(tenantRes.data.planId);
  if (!plan) return { ok: false, error: "Plan no encontrado." };

  const modulosPermitidos = new Set(plan.modulosVeedorPermitidos);
  const modulosNoPermitidos = input.modulosHabilitados.filter(
    (m) => !modulosPermitidos.has(m)
  );
  if (modulosNoPermitidos.length > 0) {
    return {
      ok: false,
      error: `El plan actual no permite compartir: ${modulosNoPermitidos.join(", ")}.`,
    };
  }

  const codigo = generarCodigoAlfanumerico();
  const fila = await repo.crearCodigoAcceso({
    tenantId,
    modulosHabilitados: input.modulosHabilitados,
    codigo,
    estado: "activo",
    creadoPor: solicitante.id,
  });

  return { ok: true, data: { codigoAccesoId: fila.id, codigo: fila.codigo } };
}

/** Funciona tanto sobre un codigo "activo" (antes de canjearse) como
 * "canjeado" (revoca el acceso ya otorgado) — Modulo_11 seccion 3.4. */
export async function revocarCodigoAcceso(
  solicitante: UsuarioConRol,
  codigoAccesoId: string
): Promise<Resultado<true>> {
  const fila = await repo.obtenerCodigoAccesoPorId(codigoAccesoId);
  if (!fila) return { ok: false, error: "Código no encontrado." };
  const bloqueo = requiereOwnerDelTenant(solicitante, fila.tenantId);
  if (bloqueo) return bloqueo;

  await repo.actualizarCodigoAcceso(codigoAccesoId, {
    estado: "revocado",
    revocadoEn: new Date(),
  });
  // Si ya se habia canjeado, tambien corta "el acceso ya otorgado" (seccion
  // 3.4) — no alcanza con marcar el codigo, la Aprobacion que nacio de el
  // sigue vigente hasta que se revoque explicitamente.
  await repo.revocarAprobacionPorCodigoAcceso(codigoAccesoId);
  return { ok: true, data: true };
}

/**
 * Sin `solicitante`: lo llama la entidad externa desde el futuro Portal de
 * Entidades Veedoras, que no tiene cuenta CEOM (Modulo_11 seccion 3.4). Si
 * la institucion no existia, se crea en el acto (creado_por queda null —
 * alta autoservicio, no via Panel Admin CEOM).
 */
export async function canjearCodigoAcceso(input: {
  codigo: string;
  institucionId?: string;
  institucionNueva?: DatosInstitucion;
}): Promise<Resultado<{ institucionId: string; tenantId: string; modulosAprobados: ModuloVeedor[] }>> {
  const codigoRow = await repo.obtenerCodigoAccesoPorCodigo(input.codigo);
  if (!codigoRow || codigoRow.estado !== "activo") {
    return { ok: false, error: "Código inválido, ya utilizado o revocado." };
  }

  let institucionId = input.institucionId;
  if (!institucionId) {
    if (!input.institucionNueva) {
      return { ok: false, error: "Falta indicar la institución (existente o nueva)." };
    }
    const institucion = await repo.crearInstitucion({
      nombre: input.institucionNueva.nombre,
      tipo: input.institucionNueva.tipo,
      contacto: input.institucionNueva.contacto,
      creadoPor: null,
    });
    institucionId = institucion.id;
  }

  const modulosAprobados = codigoRow.modulosHabilitados as ModuloVeedor[];

  await repo.actualizarCodigoAcceso(codigoRow.id, {
    estado: "canjeado",
    institucionId,
    canjeadoEn: new Date(),
  });
  await repo.agregarACartera({
    institucionId,
    tenantId: codigoRow.tenantId,
    fechaInicio: new Date().toISOString().slice(0, 10),
  });
  await repo.crearAprobacionTenant({
    tenantId: codigoRow.tenantId,
    institucionId,
    modulosAprobados,
    aprobadoPor: codigoRow.creadoPor,
    codigoAccesoId: codigoRow.id,
  });

  return { ok: true, data: { institucionId, tenantId: codigoRow.tenantId, modulosAprobados } };
}

export async function listarCodigosAcceso(
  solicitante: UsuarioConRol,
  tenantId: string
): Promise<Resultado<Awaited<ReturnType<typeof repo.listarCodigosAccesoPorTenant>>>> {
  const bloqueo = requiereOwnerDelTenant(solicitante, tenantId);
  if (bloqueo) return bloqueo;
  return { ok: true, data: await repo.listarCodigosAccesoPorTenant(tenantId) };
}

// --- Log de Acceso Admin CEOM (Modulo_11 seccion 4, regla 5) ---------------------------------------------------------
// Traza interna, no visible para el tenant. Expuesta y funcional, pero sin
// hook automatico que la dispare desde el resto de los modulos todavia
// (eso tocaria tienePermiso() en cada uno, cambio de contrato mucho mayor,
// no declarado en esta tarea).

export async function registrarAccesoAdminCeom(
  solicitante: SolicitanteCeomAdmin & { id: string },
  tenantId: string,
  moduloConsultado: ModuloConsultado
): Promise<Resultado<true>> {
  const bloqueo = requiereCeomAdmin(solicitante);
  if (bloqueo) return bloqueo;

  await repo.crearLogAccesoAdminCeom({
    usuarioCeomId: solicitante.id,
    tenantId,
    moduloConsultado,
  });
  return { ok: true, data: true };
}

export async function listarLogsAcceso(
  solicitante: SolicitanteCeomAdmin,
  opts: { tenantId?: string; desde?: string; hasta?: string } = {}
): Promise<Resultado<Awaited<ReturnType<typeof repo.listarLogsAccesoAdminCeom>>>> {
  const bloqueo = requiereCeomAdmin(solicitante);
  if (bloqueo) return bloqueo;

  const filas = await repo.listarLogsAccesoAdminCeom({
    tenantId: opts.tenantId,
    desde: opts.desde ? new Date(opts.desde) : undefined,
    hasta: opts.hasta ? new Date(opts.hasta) : undefined,
  });
  return { ok: true, data: filas };
}
