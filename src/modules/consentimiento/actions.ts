import { instanteDeDiaLocal, sumarDias, ZONA_HORARIA_NEGOCIO } from "@/lib/periodo";
import { randomBytes } from "node:crypto";
import type { UsuarioConRol } from "@/modules/identidad/actions";
import { obtenerEstadoAccesoTenant, obtenerTenantPorId } from "@/modules/identidad/actions";
import { ROL_CEOM_ADMIN_ID } from "@/modules/identidad/constants";
import type { moduloPermisoEnum } from "@/modules/identidad/schema";
import { crearClienteServidor } from "@/lib/supabase/server";
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

// `rol.esRolSistema` obligatorio (no solo rolId): chequeo doble unificado en
// la Etapa 3 del backstop de RLS (docs/security/PLAN-RLS-BACKSTOP.md
// §10.2/§10.11 decision 5), igual que identidad/tienePermiso().
interface SolicitanteCeomAdmin {
  rolId: string;
  rol: { esRolSistema: boolean };
}

function requiereCeomAdmin(
  solicitante: SolicitanteCeomAdmin
): { ok: false; error: string } | null {
  if (!(solicitante.rol.esRolSistema && solicitante.rolId === ROL_CEOM_ADMIN_ID)) {
    return { ok: false, error: "Solo el equipo CEOM puede gestionar esto." };
  }
  return null;
}

function requiereOwnerDelTenant(
  solicitante: UsuarioConRol,
  tenantId: string
): { ok: false; error: string } | null {
  if (!solicitante.esOwner || solicitante.tenantId !== tenantId) {
    return { ok: false, error: "Solo el dueño del negocio puede hacer esto." };
  }
  return null;
}

// Alfabeto sin 0/O/1/I para evitar confusion al transcribir el codigo a mano.
const ALFABETO_CODIGO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * TTL de un Codigo de Acceso (D-7, tanda 3.2). Obligatorio, no opcional: un
 * codigo circula FUERA del sistema y "vive para siempre" es la decision
 * equivocada para una credencial. Si se cambia este valor, las filas ya
 * emitidas conservan su `expira_en` — no se recalculan.
 */
export const TTL_CODIGO_ACCESO_DIAS = 30;

/**
 * `true` si el error de Postgres es una violacion del indice unico parcial de
 * `instituciones.email` (23505). Se detecta por codigo Y por nombre de
 * constraint: postgres.js expone el `code` en distintos lugares segun como
 * lo envuelva Drizzle, asi que mirar solo uno de los dos deja pasar el caso
 * que este chequeo existe para atrapar.
 */
function esCorreoDeInstitucionDuplicado(error: unknown): boolean {
  const texto = JSON.stringify(
    error,
    Object.getOwnPropertyNames(error ?? {})
  );
  return texto.includes("23505") && texto.includes("instituciones_email_unique");
}

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
  // Habilita el magic link de reingreso a /portal (CEOM_Arquitectura.md
  // 8.3) — opcional: una Institucion puede existir sin email todavia (alta
  // por ceom_admin sin dato de contacto), el vinculo con Supabase Auth se
  // completa recien en el primer login exitoso.
  email?: string;
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
    email: input.email,
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

export async function listarInstituciones(
  solicitante: SolicitanteCeomAdmin
): Promise<Resultado<Awaited<ReturnType<typeof repo.listarInstituciones>>>> {
  const bloqueo = requiereCeomAdmin(solicitante);
  if (bloqueo) return bloqueo;
  return { ok: true, data: await repo.listarInstituciones() };
}

/**
 * Lectura minima de UNA institucion por id — sin gate de rol, a proposito.
 * `instituciones` es catalogo global de solo-lectura abierta a cualquier
 * authenticated (mismo patron RLS que "planes", ver comentario en
 * schema.ts); esto solo expone los mismos 3 campos publicos ya devueltos
 * por listarInstituciones() pero para 1 registro puntual, sin dar acceso al
 * listado completo (eso sigue gateado a ceom_admin arriba). Lo usa el
 * Owner del tenant para mostrar el nombre de la institucion en sus propias
 * Aprobaciones/Solicitudes (Modulo 10) — no es un dato de negocio del
 * tenant, es metadato del catalogo de Instituciones.
 */
export async function obtenerInstitucionPorId(
  institucionId: string
): Promise<Resultado<{ id: string; nombre: string; tipo: TipoInstitucion; contacto: string | null }>> {
  const institucion = await repo.obtenerInstitucionPorId(institucionId);
  if (!institucion) return { ok: false, error: "Institución no encontrada." };
  return {
    ok: true,
    data: {
      id: institucion.id,
      nombre: institucion.nombre,
      tipo: institucion.tipo,
      contacto: institucion.contacto,
    },
  };
}

// --- Identidad de Institucion (magic link, CEOM_Arquitectura.md 8.3) -------------------------------
//
// Institucion NO es un Usuario de tenant: no tiene tenant_id, nunca pasa
// por tienePermiso(), y su sesion de Supabase Auth es un concepto separado
// de la de Usuario (Modulo 1). obtenerInstitucionActual() es el analogo
// exacto de obtenerUsuarioActual() (Identidad) para esta otra identidad —
// vive aca, no en Identidad, porque Institucion es una tabla propia de este
// modulo. Si la sesion actual de Supabase Auth pertenece a un Usuario en
// vez de una Institucion, esta funcion devuelve null (no hay fila en
// instituciones con ese auth_user_id) — no hace falta ningun chequeo
// especial para evitar que una Institucion se cuele como Usuario de un
// tenant: obtenerUsuarioActual() ya devuelve null por el mismo motivo en el
// sentido inverso (nunca hay fila en `usuarios` con id = auth.uid() de una
// Institucion), y cada layout protegido de /app y /admin ya redirige a
// /login cuando eso pasa.

/**
 * Sin gate: establecer "quien esta pidiendo esto" es siempre el primer
 * paso, antes de poder gatear nada (mismo criterio que obtenerUsuarioActual()).
 */
export async function obtenerInstitucionActual(): Promise<repo.Institucion | null> {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return repo.obtenerInstitucionPorAuthUserId(user.id);
}

/**
 * Vinculo perezoso (lazy link) — se llama desde el Route Handler de
 * callback del magic link (/portal/auth/callback), nunca antes. Busca una
 * Institucion con ese email que TODAVIA no tenga auth_user_id (una
 * Institucion solo se vincula una vez) y completa el vinculo. Devuelve
 * `null` si no hay ninguna fila que vincular (email desconocido, o ya
 * vinculada a otro auth_user_id — caso borde raro, tratado como error por
 * el caller).
 */
export async function vincularInstitucionAutenticada(
  email: string,
  authUserId: string
): Promise<repo.Institucion | null> {
  const existente = await repo.obtenerInstitucionPorAuthUserId(authUserId);
  if (existente) return existente;

  const institucion = await repo.obtenerInstitucionPorEmailSinVincular(email);
  if (!institucion) return null;
  return repo.vincularAuthUserAInstitucion(institucion.id, authUserId);
}

/**
 * Sin `solicitante`, a proposito (mismo criterio que canjearCodigoAcceso()):
 * lo llama la Institucion desde /portal, que no tiene cuenta CEOM. Nunca
 * crea un usuario de Supabase Auth para un email sin Institucion asociada
 * — evita auth.users huerfanos y de paso evita filtrar (via el efecto
 * secundario de "se envio o no se envio el correo") que direcciones estan
 * registradas. El caller siempre debe mostrar el mismo mensaje generico sin
 * importar el resultado real.
 */
export async function solicitarMagicLinkInstitucion(
  email: string,
  emailRedirectTo: string
): Promise<Resultado<true>> {
  const institucion = await repo.obtenerInstitucionPorEmail(email);
  if (!institucion) return { ok: true, data: true };

  const supabase = await crearClienteServidor();
  await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo } });
  return { ok: true, data: true };
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
    return { ok: false, error: "No tenés permiso para ver las solicitudes." };
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
    return { ok: false, error: "No tenés permiso para ver las aprobaciones." };
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
): Promise<Resultado<{ codigoAccesoId: string; codigo: string; expiraEn: Date | null }>> {
  const bloqueo = requiereOwnerDelTenant(solicitante, tenantId);
  if (bloqueo) return bloqueo;

  const tenantRes = await obtenerTenantPorId(solicitante, tenantId);
  if (!tenantRes.ok) return tenantRes;
  if (!tenantRes.data.planId) {
    return { ok: false, error: "Este negocio no tiene un plan asignado." };
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
  const expiraEn = new Date(Date.now() + TTL_CODIGO_ACCESO_DIAS * 24 * 60 * 60 * 1000);
  const fila = await repo.crearCodigoAcceso({
    tenantId,
    modulosHabilitados: input.modulosHabilitados,
    codigo,
    estado: "activo",
    creadoPor: solicitante.id,
    expiraEn,
  });

  return {
    ok: true,
    data: { codigoAccesoId: fila.id, codigo: fila.codigo, expiraEn: fila.expiraEn },
  };
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
  const codigoRow = await repo.obtenerCodigoAccesoPorCodigo(input.codigo.trim().toUpperCase());
  if (!codigoRow || codigoRow.estado !== "activo") {
    return { ok: false, error: "Código inválido, ya utilizado o revocado." };
  }
  // D-7: `expira_en` null solo puede venir de una fila anterior a la
  // migracion 0047 que el backfill no alcanzo — se trata como vencida, nunca
  // como "sin vencimiento".
  if (!codigoRow.expiraEn || codigoRow.expiraEn.getTime() <= Date.now()) {
    return {
      ok: false,
      error: "Este código venció. Pedile al negocio que te genere uno nuevo.",
    };
  }

  if (!input.institucionId && !input.institucionNueva) {
    return { ok: false, error: "Falta indicar la institución (existente o nueva)." };
  }

  const modulosAprobados = codigoRow.modulosHabilitados as ModuloVeedor[];

  let resultado: Awaited<ReturnType<typeof repo.canjearCodigoAccesoTx>>;
  try {
    resultado = await repo.canjearCodigoAccesoTx({
      codigoAccesoId: codigoRow.id,
      tenantId: codigoRow.tenantId,
      modulosAprobados,
      aprobadoPor: codigoRow.creadoPor,
      fechaInicioCartera: new Date().toISOString().slice(0, 10),
      institucionExistenteId: input.institucionId,
      institucionNueva: input.institucionId
        ? undefined
        : {
            nombre: input.institucionNueva!.nombre,
            tipo: input.institucionNueva!.tipo,
            contacto: input.institucionNueva!.contacto,
            email: input.institucionNueva!.email,
            creadoPor: null,
          },
    });
  } catch (error) {
    // H-42: el correo ya pertenece a otra Institucion. Hasta la tanda 3.2
    // esto no estaba capturado en ningun punto de la cadena: la Server Action
    // lanzaba y el usuario —alguien sin cuenta, sin soporte dentro del
    // producto— veia un error generico de Next.js, o directamente un boton
    // colgado en "Confirmando...".
    //
    // El mensaje NO confirma que ese correo este registrado (seria un oraculo
    // de enumeracion, aunque acotado a quien ya tiene un codigo valido):
    // habla del intento, no del correo, y ofrece el camino correcto. Es el
    // mismo criterio anti-enumeracion que solicitarMagicLinkInstitucion() y
    // la recuperacion de contraseña. La transaccion garantiza que no quedo
    // nada a medias, y el codigo sigue `activo` para el segundo intento.
    if (esCorreoDeInstitucionDuplicado(error)) {
      return {
        ok: false,
        error:
          "No pudimos completar el registro con esos datos. Si tu institución ya tiene acceso a " +
          "CEOM, entrá con tu correo desde «¿Ya tenés acceso?» y canjeá el código desde tu cartera.",
      };
    }
    throw error;
  }

  // G-03: perdio la carrera — otro canje reclamo el codigo entre el SELECT de
  // arriba y el UPDATE condicional de la transaccion.
  if (!resultado) {
    return { ok: false, error: "Código inválido, ya utilizado o revocado." };
  }

  return {
    ok: true,
    data: { institucionId: resultado.institucionId, tenantId: codigoRow.tenantId, modulosAprobados },
  };
}

/**
 * Canje estando ya autenticada como Institucion — **el cierre de H-42**
 * (tanda 3.2).
 *
 * `canjearCodigoAcceso()` acepta `institucionId` desde el dia uno y hasta
 * esta tanda no lo llamaba nadie: `/portal` era una bifurcacion binaria (con
 * sesion, cartera; sin sesion, canje) y no habia ninguna ruta, boton ni rama
 * que llegara al canje con sesion. Una institucion con un segundo codigo solo
 * podia romper la Server Action (mismo correo) o crear una segunda
 * institucion con cartera de un solo negocio (correo distinto).
 *
 * Sin `solicitante`, mismo criterio que el resto del modulo: la identidad de
 * Institucion no es un `UsuarioConRol`. Quien llama ya resolvio su propia
 * sesion via `obtenerInstitucionActual()` — esta funcion no la puede resolver
 * porque vive fuera del runtime de Next.js en los tests.
 */
export async function canjearCodigoAccesoAutenticada(
  institucionId: string,
  codigo: string
): Promise<Resultado<{ tenantId: string; modulosAprobados: ModuloVeedor[] }>> {
  const institucion = await repo.obtenerInstitucionPorId(institucionId);
  if (!institucion) return { ok: false, error: "Institución no encontrada." };

  const resultado = await canjearCodigoAcceso({ codigo, institucionId });
  if (!resultado.ok) return resultado;
  return {
    ok: true,
    data: { tenantId: resultado.data.tenantId, modulosAprobados: resultado.data.modulosAprobados },
  };
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

  // Este registro es la auditoria de la PLATAFORMA, no el reporte de un
  // negocio: el admin puede filtrar sin elegir tenant, asi que el marco es uno
  // solo y fijo. Cuando `zonaHorariaTenant` pase a ser por negocio, esta
  // pantalla debe seguir usando una zona unica — si no, dos filas del mismo
  // listado se cortarian con dias distintos.
  const zona = ZONA_HORARIA_NEGOCIO;
  const filas = await repo.listarLogsAccesoAdminCeom({
    tenantId: opts.tenantId,
    inicio: opts.desde ? instanteDeDiaLocal(opts.desde, zona) : undefined,
    // Semiabierto: el comienzo del dia SIGUIENTE a `hasta`, para que el ultimo
    // dia del rango entre completo.
    fin: opts.hasta ? instanteDeDiaLocal(sumarDias(opts.hasta, 1), zona) : undefined,
  });
  return { ok: true, data: filas };
}
