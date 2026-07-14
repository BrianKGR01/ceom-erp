import { and, desc, eq, gte, isNull, lte } from "drizzle-orm";
import { db } from "@/db/client";
import {
  aprobacionesTenant,
  carteraInstitucional,
  codigosAcceso,
  instituciones,
  logsAccesoAdminCeom,
  solicitudesSeguimiento,
} from "./schema";

export type NuevaInstitucion = typeof instituciones.$inferInsert;
export type NuevaCarteraInstitucional = typeof carteraInstitucional.$inferInsert;
export type NuevaSolicitudSeguimiento = typeof solicitudesSeguimiento.$inferInsert;
export type NuevaAprobacionTenant = typeof aprobacionesTenant.$inferInsert;
export type NuevoCodigoAcceso = typeof codigosAcceso.$inferInsert;
export type NuevoLogAccesoAdminCeom = typeof logsAccesoAdminCeom.$inferInsert;

// --- Instituciones ---------------------------------------------------------

export async function crearInstitucion(data: NuevaInstitucion) {
  const [institucion] = await db.insert(instituciones).values(data).returning();
  return institucion;
}

export async function obtenerInstitucionPorId(institucionId: string) {
  const filas = await db
    .select()
    .from(instituciones)
    .where(and(eq(instituciones.id, institucionId), isNull(instituciones.eliminadoEn)))
    .limit(1);
  return filas[0] ?? null;
}

export async function actualizarInstitucion(
  institucionId: string,
  data: Partial<Omit<NuevaInstitucion, "id">>
) {
  const [institucion] = await db
    .update(instituciones)
    .set(data)
    .where(eq(instituciones.id, institucionId))
    .returning();
  return institucion;
}

export async function eliminarInstitucionSoft(institucionId: string) {
  const [institucion] = await db
    .update(instituciones)
    .set({ eliminadoEn: new Date() })
    .where(eq(instituciones.id, institucionId))
    .returning();
  return institucion;
}

export async function listarInstituciones() {
  return db.select().from(instituciones).where(isNull(instituciones.eliminadoEn));
}

// --- Cartera Institucional ---------------------------------------------------------

export async function agregarACartera(data: NuevaCarteraInstitucional) {
  const [fila] = await db.insert(carteraInstitucional).values(data).returning();
  return fila;
}

export async function quitarDeCarteraSoft(carteraId: string) {
  const [fila] = await db
    .update(carteraInstitucional)
    .set({ eliminadoEn: new Date() })
    .where(eq(carteraInstitucional.id, carteraId))
    .returning();
  return fila;
}

export async function listarCarteraPorInstitucion(institucionId: string) {
  return db
    .select()
    .from(carteraInstitucional)
    .where(
      and(
        eq(carteraInstitucional.institucionId, institucionId),
        isNull(carteraInstitucional.eliminadoEn)
      )
    );
}

// --- Solicitud de Seguimiento ---------------------------------------------------------

export async function crearSolicitudSeguimiento(data: NuevaSolicitudSeguimiento) {
  const [solicitud] = await db.insert(solicitudesSeguimiento).values(data).returning();
  return solicitud;
}

export async function obtenerSolicitudPorId(solicitudId: string) {
  const filas = await db
    .select()
    .from(solicitudesSeguimiento)
    .where(eq(solicitudesSeguimiento.id, solicitudId))
    .limit(1);
  return filas[0] ?? null;
}

export async function actualizarEstadoSolicitud(
  solicitudId: string,
  estado: (typeof solicitudesSeguimiento.$inferSelect)["estado"]
) {
  const [solicitud] = await db
    .update(solicitudesSeguimiento)
    .set({ estado })
    .where(eq(solicitudesSeguimiento.id, solicitudId))
    .returning();
  return solicitud;
}

export async function listarSolicitudesPorTenant(tenantId: string) {
  return db
    .select()
    .from(solicitudesSeguimiento)
    .where(eq(solicitudesSeguimiento.tenantId, tenantId));
}

// --- Aprobacion de Tenant ---------------------------------------------------------

export async function crearAprobacionTenant(data: NuevaAprobacionTenant) {
  const [aprobacion] = await db.insert(aprobacionesTenant).values(data).returning();
  return aprobacion;
}

export async function obtenerAprobacionPorId(aprobacionId: string) {
  const filas = await db
    .select()
    .from(aprobacionesTenant)
    .where(eq(aprobacionesTenant.id, aprobacionId))
    .limit(1);
  return filas[0] ?? null;
}

/**
 * La aprobacion MAS RECIENTE entre un tenant y una institucion — es lo que
 * consulta el Gateway (tieneConsentimiento). Deliberadamente NO filtra por
 * revocado_en=null aca: si se filtrara, una aprobacion vieja sin revocar
 * podria "tapar" una revocacion mas reciente (una institucion puede tener
 * varias filas de aprobacion a lo largo del tiempo). El llamador decide si
 * la mas reciente cuenta revisando su propio revocado_en.
 */
export async function obtenerAprobacionVigente(tenantId: string, institucionId: string) {
  const filas = await db
    .select()
    .from(aprobacionesTenant)
    .where(
      and(
        eq(aprobacionesTenant.tenantId, tenantId),
        eq(aprobacionesTenant.institucionId, institucionId)
      )
    )
    .orderBy(desc(aprobacionesTenant.fechaAprobacion))
    .limit(1);
  return filas[0] ?? null;
}

export async function revocarAprobacion(aprobacionId: string) {
  const [aprobacion] = await db
    .update(aprobacionesTenant)
    .set({ revocadoEn: new Date() })
    .where(eq(aprobacionesTenant.id, aprobacionId))
    .returning();
  return aprobacion;
}

export async function listarAprobacionesPorTenant(tenantId: string) {
  return db.select().from(aprobacionesTenant).where(eq(aprobacionesTenant.tenantId, tenantId));
}

/** Revoca la Aprobacion de Tenant nacida de un Codigo de Acceso especifico
 * — usado por revocarCodigoAcceso() para tambien cortar "el acceso ya
 * otorgado despues de canjeado" (Modulo_11 seccion 3.4), no solo el codigo. */
export async function revocarAprobacionPorCodigoAcceso(codigoAccesoId: string) {
  return db
    .update(aprobacionesTenant)
    .set({ revocadoEn: new Date() })
    .where(
      and(
        eq(aprobacionesTenant.codigoAccesoId, codigoAccesoId),
        isNull(aprobacionesTenant.revocadoEn)
      )
    )
    .returning();
}

// --- Codigo de Acceso ---------------------------------------------------------

export async function crearCodigoAcceso(data: NuevoCodigoAcceso) {
  const [codigo] = await db.insert(codigosAcceso).values(data).returning();
  return codigo;
}

export async function obtenerCodigoAccesoPorId(codigoId: string) {
  const filas = await db
    .select()
    .from(codigosAcceso)
    .where(eq(codigosAcceso.id, codigoId))
    .limit(1);
  return filas[0] ?? null;
}

export async function obtenerCodigoAccesoPorCodigo(codigo: string) {
  const filas = await db
    .select()
    .from(codigosAcceso)
    .where(eq(codigosAcceso.codigo, codigo))
    .limit(1);
  return filas[0] ?? null;
}

export async function actualizarCodigoAcceso(
  codigoId: string,
  data: Partial<Omit<NuevoCodigoAcceso, "id" | "tenantId" | "codigo">>
) {
  const [codigo] = await db
    .update(codigosAcceso)
    .set(data)
    .where(eq(codigosAcceso.id, codigoId))
    .returning();
  return codigo;
}

export async function listarCodigosAccesoPorTenant(tenantId: string) {
  return db.select().from(codigosAcceso).where(eq(codigosAcceso.tenantId, tenantId));
}

// --- Log de Acceso Admin CEOM ---------------------------------------------------------

export async function crearLogAccesoAdminCeom(data: NuevoLogAccesoAdminCeom) {
  const [log] = await db.insert(logsAccesoAdminCeom).values(data).returning();
  return log;
}

export async function listarLogsAccesoAdminCeom(opts: {
  tenantId?: string;
  desde?: Date;
  hasta?: Date;
}) {
  const condiciones = [];
  if (opts.tenantId) condiciones.push(eq(logsAccesoAdminCeom.tenantId, opts.tenantId));
  if (opts.desde) condiciones.push(gte(logsAccesoAdminCeom.creadoEn, opts.desde));
  if (opts.hasta) condiciones.push(lte(logsAccesoAdminCeom.creadoEn, opts.hasta));

  return db
    .select()
    .from(logsAccesoAdminCeom)
    .where(condiciones.length ? and(...condiciones) : undefined)
    .orderBy(desc(logsAccesoAdminCeom.creadoEn));
}
