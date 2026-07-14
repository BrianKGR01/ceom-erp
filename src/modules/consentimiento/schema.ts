import { sql } from "drizzle-orm";
import {
  date,
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
import { moduloPermisoEnum, tenants, usuarios } from "../identidad/schema";
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
    // Nullable: una Institucion tambien puede crearse en el acto al
    // canjear un Codigo de Acceso (seccion 3.4), sin que haya un
    // ceom_admin dandola de alta.
    creadoPor: uuid("creado_por"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
    eliminadoEn: timestamp("eliminado_en", { withTimezone: true }),
  },
  () => [
    pgPolicy("instituciones_select_authenticated", {
      for: "select",
      to: authenticatedRole,
      using: sql`true`,
    }),
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
  },
  (table) => [
    uniqueIndex("codigos_acceso_codigo_unique").on(table.codigo),
    ...crudPolicy(
      "codigos_acceso",
      sql`${table.tenantId} = (select current_tenant_id())`
    ),
  ]
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
