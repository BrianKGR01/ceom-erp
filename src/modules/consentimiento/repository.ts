import { and, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  aprobacionesTenant,
  carteraInstitucional,
  codigosAcceso,
  instituciones,
  intentosCanje,
  logsAccesoAdminCeom,
  logsAccesoInstitucion,
  solicitudesSeguimiento,
} from "./schema";

export type NuevaInstitucion = typeof instituciones.$inferInsert;
export type Institucion = typeof instituciones.$inferSelect;
export type NuevaCarteraInstitucional = typeof carteraInstitucional.$inferInsert;
export type NuevaSolicitudSeguimiento = typeof solicitudesSeguimiento.$inferInsert;
export type NuevaAprobacionTenant = typeof aprobacionesTenant.$inferInsert;
export type NuevoCodigoAcceso = typeof codigosAcceso.$inferInsert;
export type NuevoLogAccesoAdminCeom = typeof logsAccesoAdminCeom.$inferInsert;
export type NuevoLogAccesoInstitucion = typeof logsAccesoInstitucion.$inferInsert;
export type LogAccesoInstitucion = typeof logsAccesoInstitucion.$inferSelect;

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

// --- Identidad de Institucion (magic link, CEOM_Arquitectura.md 8.3) -------------------------------

export async function obtenerInstitucionPorAuthUserId(authUserId: string) {
  const filas = await db
    .select()
    .from(instituciones)
    .where(and(eq(instituciones.authUserId, authUserId), isNull(instituciones.eliminadoEn)))
    .limit(1);
  return filas[0] ?? null;
}

/** Solo instituciones SIN auth_user_id todavia — el vinculo es de una sola
 * vez (ver vincularAuthUserAInstitucion). */
export async function obtenerInstitucionPorEmailSinVincular(email: string) {
  const filas = await db
    .select()
    .from(instituciones)
    .where(
      and(
        eq(instituciones.email, email),
        isNull(instituciones.authUserId),
        isNull(instituciones.eliminadoEn)
      )
    )
    .limit(1);
  return filas[0] ?? null;
}

/** Para decidir si vale la pena llamar signInWithOtp() — no filtra por
 * auth_user_id, a diferencia de la funcion de arriba. */
export async function obtenerInstitucionPorEmail(email: string) {
  const filas = await db
    .select()
    .from(instituciones)
    .where(and(eq(instituciones.email, email), isNull(instituciones.eliminadoEn)))
    .limit(1);
  return filas[0] ?? null;
}

export async function vincularAuthUserAInstitucion(institucionId: string, authUserId: string) {
  const [institucion] = await db
    .update(instituciones)
    .set({ authUserId })
    .where(eq(instituciones.id, institucionId))
    .returning();
  return institucion;
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

/**
 * "La mas reciente manda" (docs/security/PLAN-RLS-BACKSTOP.md SS16.9.3): una
 * aprobacion nueva SIEMPRE revoca atomicamente cualquier aprobacion previa
 * NO revocada del mismo par institucion+tenant antes de insertarse -- nunca
 * coexisten dos filas vigentes para el mismo par. Sostiene la invariante que
 * exige aprobaciones_tenant_vigente_unica (indice unico parcial, schema.ts):
 * sin este revoke previo, el INSERT violaria esa constraint. Antes de este
 * cambio, obtenerAprobacionVigente() necesitaba "la mas reciente" via ORDER
 * BY porque el esquema permitia varias filas no revocadas simultaneas -- con
 * la invariante ya sostenida acá, esa funcion queda simplificable (no se
 * simplifica en este commit para no mezclar el cambio de invariante con un
 * cambio de query separado; ver ANCLA.md).
 */
export async function crearAprobacionTenant(data: NuevaAprobacionTenant) {
  return db.transaction((tx) => crearAprobacionTenantEnTx(tx, data));
}

/** El cuerpo de crearAprobacionTenant(), reutilizable desde una transaccion
 * ya abierta (canjearCodigoAccesoTx). Extraido en la tanda 3.2 sin cambiar
 * su comportamiento: el canje necesita insertar la Aprobacion DENTRO de su
 * propia transaccion, y anidar `db.transaction()` adentro de otra abriria un
 * savepoint por cada canje sin ninguna necesidad. */
async function crearAprobacionTenantEnTx(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  data: NuevaAprobacionTenant
) {
  await tx
    .update(aprobacionesTenant)
    .set({ revocadoEn: new Date() })
    .where(
      and(
        eq(aprobacionesTenant.institucionId, data.institucionId),
        eq(aprobacionesTenant.tenantId, data.tenantId),
        isNull(aprobacionesTenant.revocadoEn)
      )
    );
  const [aprobacion] = await tx.insert(aprobacionesTenant).values(data).returning();
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

/**
 * El canje completo, en UNA transaccion (G-02) y con reclamo condicional del
 * codigo (G-03) — tanda 3.2.
 *
 * Antes eran tres escrituras sueltas fuera de toda transaccion (marcar el
 * codigo, crear la cartera, crear la aprobacion) mas la creacion de la
 * Institucion antes que todas. Dos defectos reales:
 *
 * - **G-02:** si fallaba la segunda o la tercera, el codigo ya habia quedado
 *   `canjeado` —irrecuperable, no hay accion que lo vuelva a `activo`— y la
 *   Institucion quedaba creada sin cartera o sin aprobacion. El actor que lo
 *   sufre no tiene cuenta, ni soporte dentro del producto, ni pantalla que le
 *   explique su situacion.
 * - **G-03:** el chequeo de `estado === "activo"` era un SELECT y la escritura
 *   un `UPDATE ... WHERE id = ?` sin condicion, asi que dos canjes simultaneos
 *   del mismo codigo pasaban los dos y quedaban dos instituciones con acceso
 *   al mismo negocio.
 *
 * El `UPDATE ... WHERE id = ? AND estado = 'activo'` de abajo es el reclamo:
 * Postgres serializa las dos transacciones sobre esa fila, la segunda ve
 * `estado = 'canjeado'`, no matchea, y `returning()` vuelve vacio. Devolver
 * `null` ahi (en vez de seguir) es lo que hace que exactamente uno gane.
 *
 * La Institucion nueva se crea DENTRO de la misma transaccion a proposito: si
 * el canje falla despues, no queda una Institucion huerfana ocupando su correo
 * —que hoy seria para siempre, porque el indice unico parcial no excluye
 * `eliminado_en` (G-07)—.
 */
export async function canjearCodigoAccesoTx(input: {
  codigoAccesoId: string;
  tenantId: string;
  modulosAprobados: NuevaAprobacionTenant["modulosAprobados"];
  aprobadoPor: string;
  fechaInicioCartera: string;
  /** Excluyente con `institucionNueva`. */
  institucionExistenteId?: string;
  institucionNueva?: Omit<NuevaInstitucion, "id">;
}) {
  return db.transaction(async (tx) => {
    // 1. Reclamar el codigo. Si no matchea, alguien lo canjeo primero.
    const [codigo] = await tx
      .update(codigosAcceso)
      .set({ estado: "canjeado", canjeadoEn: new Date() })
      .where(and(eq(codigosAcceso.id, input.codigoAccesoId), eq(codigosAcceso.estado, "activo")))
      .returning();
    if (!codigo) return null;

    // 2. La Institucion: existente, o creada aca adentro.
    let institucionId = input.institucionExistenteId;
    if (!institucionId) {
      if (!input.institucionNueva) {
        throw new Error("canjearCodigoAccesoTx: falta institucionExistenteId o institucionNueva.");
      }
      const [institucion] = await tx
        .insert(instituciones)
        .values(input.institucionNueva)
        .returning();
      institucionId = institucion.id;
    }

    // 3. Completar el codigo con la institucion ya resuelta.
    await tx
      .update(codigosAcceso)
      .set({ institucionId })
      .where(eq(codigosAcceso.id, input.codigoAccesoId));

    // 4. Cartera — solo si no la sigue ya. El canje autenticado (H-42) puede
    // traer un codigo de un negocio que la institucion YA tiene en cartera:
    // el caso G-17, donde el Owner revoco y genero un codigo nuevo para
    // volver a otorgar. Sin este chequeo, re-otorgar duplicaria la fila y el
    // negocio apareceria dos veces en la cartera.
    const [carteraExistente] = await tx
      .select({ id: carteraInstitucional.id })
      .from(carteraInstitucional)
      .where(
        and(
          eq(carteraInstitucional.institucionId, institucionId),
          eq(carteraInstitucional.tenantId, input.tenantId),
          isNull(carteraInstitucional.eliminadoEn)
        )
      )
      .limit(1);
    if (!carteraExistente) {
      await tx.insert(carteraInstitucional).values({
        institucionId,
        tenantId: input.tenantId,
        fechaInicio: input.fechaInicioCartera,
      });
    }

    // 5. Aprobacion (revoca la previa del mismo par, si la habia).
    const aprobacion = await crearAprobacionTenantEnTx(tx, {
      tenantId: input.tenantId,
      institucionId,
      modulosAprobados: input.modulosAprobados,
      aprobadoPor: input.aprobadoPor,
      codigoAccesoId: input.codigoAccesoId,
    });

    return { institucionId, aprobacionId: aprobacion.id };
  });
}


// --- Limite de intentos de canje (tanda 3.2) ---------------------------------------------------------

export async function registrarIntentoCanje(huella: string) {
  await db.insert(intentosCanje).values({ huella });
}

export async function contarIntentosCanjeDesde(huella: string, desde: Date) {
  const [fila] = await db
    .select({ total: sql<string>`count(*)` })
    .from(intentosCanje)
    .where(and(eq(intentosCanje.huella, huella), gte(intentosCanje.creadoEn, desde)));
  return Number(fila.total);
}

// --- Registro de acceso institucional (D-1, tanda 3.3b) ---------------------------------------------------------

/**
 * UPSERT por (institucion, tenant, modulo, dia): la primera consulta del dia
 * inserta, las siguientes incrementan `consultas` y mueven
 * `ultima_consulta_en`.
 *
 * `primera_consulta_en` NO se toca en el update — es el unico dato que se
 * perderia con un UPDATE ciego, y es el que contesta "¿desde cuando?".
 */
export async function registrarAccesoInstitucion(data: {
  institucionId: string;
  tenantId: string;
  modulo: NuevoLogAccesoInstitucion["modulo"];
  dia: string;
}) {
  const [fila] = await db
    .insert(logsAccesoInstitucion)
    .values(data)
    .onConflictDoUpdate({
      target: [
        logsAccesoInstitucion.institucionId,
        logsAccesoInstitucion.tenantId,
        logsAccesoInstitucion.modulo,
        logsAccesoInstitucion.dia,
      ],
      set: {
        consultas: sql`${logsAccesoInstitucion.consultas} + 1`,
        ultimaConsultaEn: new Date(),
      },
    })
    .returning();
  return fila;
}

/** Lo que ve el Owner: quien consulto su negocio, que y cuando. */
export async function listarAccesosInstitucionPorTenant(tenantId: string) {
  return db
    .select()
    .from(logsAccesoInstitucion)
    .where(eq(logsAccesoInstitucion.tenantId, tenantId))
    .orderBy(desc(logsAccesoInstitucion.ultimaConsultaEn));
}

/** Lo que ve la propia Institucion sobre un negocio de su cartera — la mitad
 * simetrica de la transparencia (ver la decision en actions.ts). */
export async function resumenAccesosDeInstitucion(institucionId: string, tenantId: string) {
  const [fila] = await db
    .select({
      total: sql<string>`coalesce(sum(${logsAccesoInstitucion.consultas}), 0)`,
      dias: sql<string>`count(distinct ${logsAccesoInstitucion.dia})`,
    })
    .from(logsAccesoInstitucion)
    .where(
      and(
        eq(logsAccesoInstitucion.institucionId, institucionId),
        eq(logsAccesoInstitucion.tenantId, tenantId)
      )
    );
  return { consultas: Number(fila.total), dias: Number(fila.dias) };
}

// --- Log de Acceso Admin CEOM ---------------------------------------------------------

export async function crearLogAccesoAdminCeom(data: NuevoLogAccesoAdminCeom) {
  const [log] = await db.insert(logsAccesoAdminCeom).values(data).returning();
  return log;
}

/**
 * `inicio`/`fin` son el intervalo SEMIABIERTO `[inicio, fin)` ya traducido desde
 * dias locales en la capa de acciones (H-49). Los dos son opcionales: el
 * filtro de fechas de /admin/logs no es obligatorio.
 *
 * `creado_en` es un timestamp, asi que con `<= fin` el filtro dejaba afuera
 * todos los accesos del ultimo dia del rango — filtrar "hasta hoy" no mostraba
 * ni uno de los de hoy.
 */
export async function listarLogsAccesoAdminCeom(opts: {
  tenantId?: string;
  inicio?: Date;
  fin?: Date;
}) {
  const condiciones = [];
  if (opts.tenantId) condiciones.push(eq(logsAccesoAdminCeom.tenantId, opts.tenantId));
  if (opts.inicio) condiciones.push(gte(logsAccesoAdminCeom.creadoEn, opts.inicio));
  if (opts.fin) condiciones.push(lt(logsAccesoAdminCeom.creadoEn, opts.fin));

  return db
    .select()
    .from(logsAccesoAdminCeom)
    .where(condiciones.length ? and(...condiciones) : undefined)
    .orderBy(desc(logsAccesoAdminCeom.creadoEn));
}
