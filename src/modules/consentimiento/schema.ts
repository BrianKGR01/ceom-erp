import { sql } from "drizzle-orm";
import {
  date,
  index,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
// Imports relativos (no "@/*"): drizzle-kit carga schema.ts con su propio
// resolvedor esbuild, que no resuelve el alias de tsconfig.
import { crudPolicy } from "../../db/rls";
import { authUsers, moduloPermisoEnum, tenants, usuarios } from "../identidad/schema";
// Reutiliza el enum ya existente de Suscripcion (financiero/operativo/
// inventario_operativo) en vez de crear un catalogo nuevo de "funciones
// expuestas" — decision del plan: es el modelo de datos concreto que
// Modulo_11 seccion 3.1 ya cerro, y el que planes.modulos_veedor_permitidos
// ya asume.
import { moduloVeedorEnum } from "../suscripcion/schema";

export const tipoInstitucionEnum = pgEnum("tipo_institucion", [
  "universidad",
  "incubadora",
  "organizacion",
]);

export const estadoSolicitudSeguimientoEnum = pgEnum("estado_solicitud_seguimiento", [
  "pendiente",
  "aprobada",
  "rechazada",
]);

export const estadoCodigoAccesoEnum = pgEnum("estado_codigo_acceso", [
  "activo",
  "canjeado",
  "revocado",
]);

// Catalogo global (sin tenant_id) gestionado desde el Panel Administrativo
// CEOM (Modulo_11 seccion 3.1) — mismo patron que "planes" en Suscripcion:
// lectura abierta a authenticated, escritura gateada a ROL_CEOM_ADMIN_ID en
// actions.ts (sin policy de escritura en RLS).
export const instituciones = pgTable(
  "instituciones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nombre: text("nombre").notNull(),
    tipo: tipoInstitucionEnum("tipo").notNull(),
    contacto: text("contacto"),
    // Identidad de Supabase Auth de la propia Institucion (magic link,
    // CEOM_Arquitectura.md seccion 8.3) — deliberadamente NO es el mismo id
    // que la PK de esta tabla (a diferencia de usuarios.id, que si coincide
    // con auth.users.id): una Institucion puede existir mucho antes de tener
    // identidad de Auth (alta por ceom_admin sin email, o canje sin
    // completar nunca el magic link). Nullable hasta el primer login
    // exitoso, que la vincula de forma perezosa (ver
    // vincularAuthUserAInstitucion en repository.ts).
    email: text("email"),
    authUserId: uuid("auth_user_id").references(() => authUsers.id),
    // Nullable: una Institucion tambien puede crearse en el acto al
    // canjear un Codigo de Acceso (seccion 3.4), sin que haya un
    // ceom_admin dandola de alta.
    creadoPor: uuid("creado_por"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
    eliminadoEn: timestamp("eliminado_en", { withTimezone: true }),
  },
  (table) => [
    pgPolicy("instituciones_select_authenticated", {
      for: "select",
      to: authenticatedRole,
      using: sql`true`,
    }),
    // Parciales (WHERE ... IS NOT NULL): filas antiguas o recien creadas sin
    // email/auth_user_id todavia no compiten por unicidad entre si.
    uniqueIndex("instituciones_email_unique")
      .on(table.email)
      .where(sql`${table.email} is not null`),
    uniqueIndex("instituciones_auth_user_id_unique")
      .on(table.authUserId)
      .where(sql`${table.authUserId} is not null`),
  ]
).enableRLS();

// Que tenants sigue una institucion, y en que cohorte (Modulo_11 seccion 3.1).
export const carteraInstitucional = pgTable(
  "cartera_institucional",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institucionId: uuid("institucion_id")
      .notNull()
      .references(() => instituciones.id),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    cohorte: text("cohorte"),
    fechaInicio: date("fecha_inicio").notNull(),
    fechaFin: date("fecha_fin"),
    eliminadoEn: timestamp("eliminado_en", { withTimezone: true }),
  },
  (table) => [
    ...crudPolicy(
      "cartera_institucional",
      sql`${table.tenantId} = (select current_tenant_id())`
    ),
  ]
).enableRLS();

// La institucion pide ver un tenant (Modulo_11 seccion 3.1).
export const solicitudesSeguimiento = pgTable(
  "solicitudes_seguimiento",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institucionId: uuid("institucion_id")
      .notNull()
      .references(() => instituciones.id),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    modulosSolicitados: moduloVeedorEnum("modulos_solicitados")
      .array()
      .notNull()
      .default(sql`'{}'::modulo_veedor[]`),
    estado: estadoSolicitudSeguimientoEnum("estado").notNull().default("pendiente"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    ...crudPolicy(
      "solicitudes_seguimiento",
      sql`${table.tenantId} = (select current_tenant_id())`
    ),
  ]
).enableRLS();

// El consentimiento vigente — lo que consulta el Gateway (Modulo_11
// seccion 3.1/3.2). revocado_en no nulo = ya no cuenta, sin excepcion.
export const aprobacionesTenant = pgTable(
  "aprobaciones_tenant",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    institucionId: uuid("institucion_id")
      .notNull()
      .references(() => instituciones.id),
    modulosAprobados: moduloVeedorEnum("modulos_aprobados")
      .array()
      .notNull()
      .default(sql`'{}'::modulo_veedor[]`),
    aprobadoPor: uuid("aprobado_por")
      .notNull()
      .references(() => usuarios.id),
    fechaAprobacion: timestamp("fecha_aprobacion", { withTimezone: true })
      .notNull()
      .defaultNow(),
    revocadoEn: timestamp("revocado_en", { withTimezone: true }),
    // Nullable: solo se completa cuando esta Aprobacion nacio de canjear un
    // Codigo de Acceso (seccion 3.4) — permite que revocarCodigoAcceso()
    // tambien revoque "el acceso ya otorgado despues de canjeado" (doc,
    // seccion 3.4), no solo el propio Codigo. Las aprobaciones nacidas de
    // una Solicitud de Seguimiento formal (seccion 3.1) quedan null aca.
    codigoAccesoId: uuid("codigo_acceso_id").references(() => codigosAcceso.id),
  },
  (table) => [
    ...crudPolicy(
      "aprobaciones_tenant",
      sql`${table.tenantId} = (select current_tenant_id())`
    ),
    // "La mas reciente manda" (docs/security/PLAN-RLS-BACKSTOP.md SS16.9.3):
    // a lo sumo UNA fila no revocada por par institucion+tenant en todo
    // momento -- invariante de esquema, no una convencion que cada consulta
    // (TS o, eventualmente, SQL) tiene que replicar con su propio ORDER
    // BY/desempate. repository.ts:crearAprobacionTenant() revoca
    // atomicamente cualquier fila previa antes de insertar -- sin eso, esta
    // constraint rechazaria la insercion.
    uniqueIndex("aprobaciones_tenant_vigente_unica")
      .on(table.institucionId, table.tenantId)
      .where(sql`${table.revocadoEn} is null`),
    // REGLA DURA (mismo criterio que identidad/schema.ts contra
    // usuarios/roles, docs/security/PLAN-RLS-BACKSTOP.md SS10.3/SS16.6):
    // esta tabla NUNCA debe recibir una policy que llame a una funcion de
    // vigencia (tenant_tiene_consentimiento_vigente()/una futura version
    // por institucion) que a su vez LEA esta misma tabla -- el dia que
    // Consentimiento migre a comoUsuario() y esta tabla reciba FORCE ROW
    // LEVEL SECURITY, agregarle ese bypass crearia recursion real: evaluar
    // la policy llamaria a la funcion, que vuelve a leer aprobaciones_tenant,
    // que vuelve a evaluar la policy. Hoy no hay ningun caso que necesite
    // que el Gateway lea aprobaciones_tenant bajo RLS directamente (solo
    // consume el booleano derivado) -- si eso cambia, resolverlo distinto,
    // no extendiendo este patron sin pensarlo.
  ]
).enableRLS();

// Entidades veedoras por codigo (Modulo_11 seccion 3.4) — flujo distinto al
// de Instituciones pre-registradas: el tenant elige que modulos habilita
// (dentro de lo que su plan permite) y comparte un codigo fuera del sistema.
export const codigosAcceso = pgTable(
  "codigos_acceso",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    modulosHabilitados: moduloVeedorEnum("modulos_habilitados")
      .array()
      .notNull()
      .default(sql`'{}'::modulo_veedor[]`),
    codigo: text("codigo").notNull(),
    estado: estadoCodigoAccesoEnum("estado").notNull().default("activo"),
    creadoPor: uuid("creado_por")
      .notNull()
      .references(() => usuarios.id),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
    // Nullable: se completa recien al canjearse.
    institucionId: uuid("institucion_id").references(() => instituciones.id),
    canjeadoEn: timestamp("canjeado_en", { withTimezone: true }),
    revocadoEn: timestamp("revocado_en", { withTimezone: true }),
    // TTL obligatorio (D-7, tanda 3.2). NO es una fecha opcional que el Owner
    // puede dejar vacia: generarCodigoAcceso() siempre la completa
    // (creado_en + TTL_CODIGO_ACCESO_DIAS). Un Codigo de Acceso es una
    // credencial que circula FUERA del sistema (WhatsApp, correo, papel), y
    // "vive para siempre" es la decision equivocada para una credencial: hasta
    // esta tanda, un codigo compartido hace ocho meses seguia otorgando acceso
    // completo, y el manual de instituciones ya le prometia al usuario que los
    // codigos vencen.
    //
    // Nullable en el esquema por una sola razon: las filas anteriores a la
    // migracion 0047, que la propia migracion rellena (creado_en + TTL) en vez
    // de dejarlas inmortales. Una fila con expira_en NULL despues de eso es un
    // bug, no un caso valido — canjearCodigoAcceso() la trata como vencida.
    expiraEn: timestamp("expira_en", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("codigos_acceso_codigo_unique").on(table.codigo),
    ...crudPolicy(
      "codigos_acceso",
      sql`${table.tenantId} = (select current_tenant_id())`
    ),
  ]
).enableRLS();

// Intentos de canje, para poder limitarlos (tanda 3.2). `canjearCodigoAcceso`
// es la UNICA escritura sin autenticar de todo el producto —correctamente:
// una institucion no tiene cuenta cuando llega con su primer codigo— y hasta
// esta tanda no tenia ningun limite.
//
// Por que una tabla y no un contador en memoria: la app corre en Vercel
// (serverless, multi-instancia, procesos efimeros). Un Map en memoria se
// resetea en cada deploy y no se comparte entre instancias, asi que seria un
// limite decorativo. Esto es la version honesta.
//
// Que NO es esto: proteccion contra fuerza bruta del codigo en si. El espacio
// de claves es 32^8 (~1,1x10^12); a 10 intentos/segundo son ~3500 años, la
// fuerza bruta no es la amenaza. Lo que cubre es abuso del endpoint y que
// probar sea gratis y sin dejar rastro.
//
// `huella` es un HASH de la IP con un secreto del servidor, nunca la IP: no
// hace falta saber de donde vino, solo si es el mismo origen. Sin policy para
// `authenticated` (deny total), mismo criterio que logs_acceso_admin_ceom.
//
// PENDIENTE conocido, no silencioso: la tabla **crece sin limite** — se
// inserta una fila por intento y nada las borra. A escala de piloto es
// irrelevante (unos cientos de filas), pero antes de produccion hace falta
// una purga de las filas mas viejas que la ventana (un cron, o un DELETE
// oportunista en el mismo insert). No se hizo en la tanda 3.2 para no meter
// scheduling en una tanda que no lo tenia en alcance.
export const intentosCanje = pgTable(
  "intentos_canje",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    huella: text("huella").notNull(),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("intentos_canje_huella_creado_en").on(table.huella, table.creadoEn)]
).enableRLS();

// Traza interna de acceso del equipo CEOM (Modulo_11 seccion 4, regla 5) —
// "no visible para el tenant, solo para el propio equipo CEOM". Reutiliza
// moduloPermisoEnum de Identidad (catalogo completo, no solo los 3
// modulo_veedor) porque ceom_admin puede consultar cualquier modulo, no
// solo los compartibles con instituciones externas.
export const logsAccesoAdminCeom = pgTable(
  "logs_acceso_admin_ceom",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    usuarioCeomId: uuid("usuario_ceom_id")
      .notNull()
      .references(() => usuarios.id),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    moduloConsultado: moduloPermisoEnum("modulo_consultado").notNull(),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  // Sin ninguna pgPolicy para "authenticated": deniega por defecto — esta
  // tabla nunca debe ser legible via el rol authenticated de Supabase,
  // solo via el camino privilegiado que ya usan todas las Server Actions
  // del proyecto (rol "postgres", ver src/db/rls.ts).
  () => []
).enableRLS();
