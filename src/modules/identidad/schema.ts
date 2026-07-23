import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  pgEnum,
  pgSchema,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
// Import relativo (no "@/*"): drizzle-kit carga este archivo con su propio
// resolvedor esbuild, que no resuelve el alias de tsconfig.
import { crudPolicy } from "../../db/rls";
// Relativo por el mismo motivo que la linea de arriba. constants.ts no
// importa nada, asi que no arrastra nada al resolvedor de drizzle-kit.
import { GATEWAY_SISTEMA_USUARIO_ID, ROL_GATEWAY_SISTEMA_ID } from "./constants";
// Unica excepcion documentada al principio de "modulo = caja negra": se
// importa la tabla de otro modulo (no su repository ni actions) solo para
// declarar la FK real de plan_id. Ver ANCLA.md de Identidad y de
// Suscripcion. Si Suscripcion llega a necesitar tenant_id en el futuro
// (Cartera Institucional), esa tabla va en un modulo aparte para no cerrar
// un ciclo real entre schemas.
import { planes } from "../suscripcion/schema";

// Referencia de solo lectura a auth.users (Supabase Auth / GoTrue). Supabase
// ya crea y administra esta tabla — no es un modulo de este proyecto.
const authSchema = pgSchema("auth");
export const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
});

export const estadoSuscripcionEnum = pgEnum("estado_suscripcion", [
  "activa",
  "pausada",
  "vencida",
]);

// "Derivado, no editable a mano" (Modulo_01 seccion 1.1): se persiste para
// poder indexar/consultar, pero se recalcula con calcularEstadoAcceso() en
// actions.ts en vez de confiar en que algo externo lo mantenga al dia — el
// scheduler real que lo actualizaria solo por tiempo es trabajo de Modulo 11,
// fuera de alcance de este modulo.
export const estadoAccesoEnum = pgEnum("estado_acceso", [
  "activo",
  "solo_lectura",
  "bloqueado",
]);

export const moduloPermisoEnum = pgEnum("modulo_permiso", [
  "productos",
  "inventario",
  "ventas",
  "costos_gastos",
  "patrimonio",
  "operativo",
  "financiero",
  "simulaciones",
  "reportes",
  // Agregado en Modulo 8 (Proveedores/Compras) — no estaba en la lista
  // original de Modulo_01 seccion 1.5. Extension aditiva del enum, misma
  // logica que "patrimonio".
  "proveedores",
  // Agregado en la Etapa 3 del backstop de RLS (docs/security/
  // PLAN-RLS-BACKSTOP.md §10.5/§10.11 decision 6) — EXCLUSIVAMENTE para
  // logs_acceso_admin_ceom.modulo_consultado (consentimiento/schema.ts, que
  // reutiliza este enum completo a proposito). "identidad" sigue sin
  // participar en la matriz de permisos real: ningun rol tiene una fila en
  // "permisos" con modulo="identidad", y tienePermiso() nunca se llama con
  // ese valor (identidad/ANCLA.md) — las escrituras de Identidad se gatean
  // directo por rolId, no por tienePermiso(). Este valor solo existe para
  // que consultarTenantDetalle/saludAgregadaPlataforma (Panel Admin CEOM)
  // puedan auditar sus lecturas, que antes no tenian ninguna categoria de
  // log posible.
  "identidad",
]);

export const accionPermisoEnum = pgEnum("accion_permiso", [
  "ver",
  "crear",
  "editar",
  "anular_ajustar",
]);

// Catalogo ampliable a medida que aparezcan mas casos puntuales en otros
// modulos (Modulo_01 seccion 13).
export const capacidadEspecialEnum = pgEnum("capacidad_especial", [
  "vender_sin_stock",
  "gestionar_eventos",
  "importar_historico",
  "producir_sin_stock_insumo",
]);

// Solo 2 nichos reales en el MVP (Modulo_01 seccion 5, CEOM_Arquitectura.md
// seccion 2) — enum fijo en vez de tabla catalogo, mismo criterio que
// capacidadEspecialEnum. null en tenants.nicho_id = Modo Basico. Ampliable
// (ALTER TYPE ... ADD VALUE, ver identidad/ANCLA.md) si algun dia se suma un
// nicho nuevo, pero no antes de una revision de roadmap.
export const nichoEnum = pgEnum("nicho", ["nicho_1", "nicho_4"]);

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  nombreNegocio: text("nombre_negocio").notNull(),
  ciudadBase: text("ciudad_base"),
  monedaPrincipal: text("moneda_principal").notNull(),
  logoUrl: text("logo_url"),
  canalesVenta: text("canales_venta")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  // null = Modo Basico (Modulo_01 seccion 5)
  nichoId: nichoEnum("nicho_id"),
  nichoAsignadoEn: timestamp("nicho_asignado_en", { withTimezone: true }),
  // Senal real de "termino el asistente de Onboarding" — independiente de
  // nicho_id, que se queda en null tanto si nunca paso por onboarding como
  // si eligio explicitamente Modo Basico (Modulo_01 seccion 5). Sin este
  // campo no hay forma de distinguir esos dos casos para forzar el redirect
  // solo la primera vez.
  onboardingCompletadoEn: timestamp("onboarding_completado_en", { withTimezone: true }),
  planId: uuid("plan_id").references(() => planes.id),
  estadoSuscripcion: estadoSuscripcionEnum("estado_suscripcion")
    .notNull()
    .default("activa"),
  estadoAcceso: estadoAccesoEnum("estado_acceso").notNull().default("activo"),
  fechaInicioSuscripcion: date("fecha_inicio_suscripcion").notNull(),
  fechaProximoPago: date("fecha_proximo_pago"),
  creadoPor: uuid("creado_por"),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  modificadoPor: uuid("modificado_por"),
  modificadoEn: timestamp("modificado_en", { withTimezone: true }),
  eliminadoEn: timestamp("eliminado_en", { withTimezone: true }),
},
  (table) => [
    ...crudPolicy("tenants", sql`${table.id} = (select current_tenant_id())`),
  ]
).enableRLS();

export const sucursales = pgTable(
  "sucursales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    nombre: text("nombre").notNull(),
    direccion: text("direccion"),
    esPrincipal: boolean("es_principal").notNull().default(false),
    activa: boolean("activa").notNull().default(true),
    eliminadoEn: timestamp("eliminado_en", { withTimezone: true }),
  },
  (table) => [
    // Exactamente una sucursal principal por tenant (Modulo_01 seccion 1.2).
    uniqueIndex("sucursales_tenant_principal_unique")
      .on(table.tenantId)
      .where(sql`${table.esPrincipal} = true`),
    ...crudPolicy(
      "sucursales",
      sql`${table.tenantId} = (select current_tenant_id())`
    ),
  ]
).enableRLS();

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // null = rol de sistema (Owner, CEOM Admin)
    tenantId: uuid("tenant_id").references(() => tenants.id),
    nombre: text("nombre").notNull(),
    esRolSistema: boolean("es_rol_sistema").notNull().default(false),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
    eliminadoEn: timestamp("eliminado_en", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("roles_tenant_nombre_unique")
      .on(table.tenantId, table.nombre)
      .where(sql`${table.tenantId} is not null and ${table.eliminadoEn} is null`),
    uniqueIndex("roles_sistema_nombre_unique")
      .on(table.nombre)
      .where(sql`${table.tenantId} is null and ${table.eliminadoEn} is null`),
    // Los roles de sistema (tenant_id null) son datos de referencia
    // compartidos — visibles para cualquier tenant autenticado. Hoy son
    // TRES: Owner y CEOM Admin (sembrados en 0005) y el rol del Gateway de
    // Consentimiento (0034, Etapa 4.a del backstop de RLS).
    //
    // Ese tercero NO es un rol del negocio y no se muestra en la pantalla de
    // Roles: listarRoles() (identidad/actions.ts) lo excluye por UUID, del
    // lado de la presentación. La policy sigue trayéndolo a propósito — el
    // Gateway necesita resolver su propia fila. Si mañana se agrega un cuarto
    // rol de sistema interno, acordarse de excluirlo también ahí.
    //
    // REGLA DURA — nunca agregar "OR es_ceom_admin()" a esta policy (ni a la
    // de usuarios/permisos/permisos_especiales_por_rol/
    // permisos_especiales_por_usuario, mismo motivo): es_ceom_admin() es
    // SECURITY DEFINER y lee justamente usuarios+roles para resolverse. Hoy
    // no recursiona porque estas tablas no tienen FORCE ROW LEVEL SECURITY
    // (el dueño de la tabla, postgres, bypassea RLS al ejecutar la función
    // "como dueño" — confirmado en vivo, ver docs/security/
    // PLAN-RLS-BACKSTOP.md §10.3). El día que esta tabla reciba FORCE
    // (parte natural de cerrar el plan, Etapa de Identidad), agregarle este
    // OR crea recursión real: evaluar la policy llamaría a es_ceom_admin(),
    // que vuelve a leer esta misma tabla, que vuelve a evaluar la policy.
    // Si ceom_admin necesita cruzar identidad de otro tenant, resolverlo
    // distinto (función separada sin esta dependencia circular), no
    // extendiendo este patrón sin pensarlo.
    ...crudPolicy(
      "roles",
      sql`${table.tenantId} = (select current_tenant_id()) or ${table.tenantId} is null`
    ),
  ]
).enableRLS();

export const usuarios = pgTable(
  "usuarios",
  {
    // Coincide con el id de Supabase Auth (Modulo_01 seccion 1.3 y 10).
    id: uuid("id")
      .primaryKey()
      .references(() => authUsers.id),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    nombreCompleto: text("nombre_completo").notNull(),
    email: text("email").notNull(),
    telefono: text("telefono"),
    rolId: uuid("rol_id")
      .notNull()
      .references(() => roles.id),
    esOwner: boolean("es_owner").notNull().default(false),
    activo: boolean("activo").notNull().default(true),
    ultimoAccesoEn: timestamp("ultimo_acceso_en", { withTimezone: true }),
    creadoPor: uuid("creado_por"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
    modificadoPor: uuid("modificado_por"),
    modificadoEn: timestamp("modificado_en", { withTimezone: true }),
    eliminadoEn: timestamp("eliminado_en", { withTimezone: true }),
  },
  (table) => [
    // Email unico por tenant, no global (Modulo_01 seccion 1.3).
    uniqueIndex("usuarios_tenant_email_unique")
      .on(table.tenantId, table.email)
      .where(sql`${table.eliminadoEn} is null`),
    // La fila del Gateway de Consentimiento es inmutable en las tres
    // columnas de las que depende su bypass de RLS. Ver OBS-10 en
    // docs/ui/observaciones-de-uso.md.
    //
    // Por qué un CHECK y no solo la guarda de identidad/actions.ts: este
    // módulo escribe con `db` crudo, con el rol `postgres` dueño de la tabla
    // (ver el comentario de recursoPerteneceAlTenant), así que RLS está
    // bypasseada y ninguna policy puede frenar un UPDATE. El vector real no
    // es la interfaz —que ya tiene su guarda— sino un UPDATE a mano, Supabase
    // Studio, o una pantalla de administración futura que nazca sin acordarse
    // de esto. Un CHECK es la única capa que evalúan TODOS los roles de
    // Postgres, incluido el dueño de la tabla.
    //
    // Qué protege exactamente: `es_gateway_sistema()` (migración 0035) exige
    // `activo` y `eliminado_en is null`. Si alguno de los dos se rompiera, el
    // portal institucional perdería el bypass **sin fallar** —
    // `current_tenant_id()` no mira `activo`, así que el contexto resuelve
    // igual y los números salen mal en silencio. El `rol_id` va también
    // porque la separación de rol es lo que impide que el Gateway herede el
    // bypass de un ceom_admin (migración 0034).
    //
    // Si alguna vez hay que dar de baja al Gateway de verdad, se hace con un
    // DROP CONSTRAINT explícito. Que cueste una decisión deliberada es el
    // punto.
    // sql.raw para los dos UUID: interpolarlos como valores los emitiria
    // como parametros ($1), y un CHECK es DDL — no admite parametros.
    check(
      "usuarios_gateway_sistema_inmutable",
      sql`${table.id} <> ${sql.raw(`'${GATEWAY_SISTEMA_USUARIO_ID}'::uuid`)} or (${table.activo} and ${table.eliminadoEn} is null and ${table.rolId} = ${sql.raw(`'${ROL_GATEWAY_SISTEMA_ID}'::uuid`)})`
    ),
    // REGLA DURA — nunca "OR es_ceom_admin()" acá, mismo motivo que en la
    // policy de "roles" arriba (riesgo de recursión real una vez que esta
    // tabla tenga FORCE ROW LEVEL SECURITY — hoy no la tiene).
    ...crudPolicy(
      "usuarios",
      sql`${table.tenantId} = (select current_tenant_id())`
    ),
  ]
).enableRLS();

export const permisos = pgTable(
  "permisos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rolId: uuid("rol_id")
      .notNull()
      .references(() => roles.id),
    modulo: moduloPermisoEnum("modulo").notNull(),
    accion: accionPermisoEnum("accion").notNull(),
    permitido: boolean("permitido").notNull().default(false),
  },
  (table) => [
    uniqueIndex("permisos_rol_modulo_accion_unique").on(
      table.rolId,
      table.modulo,
      table.accion
    ),
    // REGLA DURA — nunca "OR es_ceom_admin()" acá, mismo motivo que "roles".
    ...crudPolicy(
      "permisos",
      sql`${table.rolId} in (select id from roles where tenant_id = (select current_tenant_id()) or tenant_id is null)`
    ),
  ]
).enableRLS();

export const permisosEspecialesPorRol = pgTable(
  "permisos_especiales_por_rol",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rolId: uuid("rol_id")
      .notNull()
      .references(() => roles.id),
    capacidad: capacidadEspecialEnum("capacidad").notNull(),
    habilitado: boolean("habilitado").notNull().default(false),
  },
  (table) => [
    uniqueIndex("permisos_especiales_rol_capacidad_unique").on(
      table.rolId,
      table.capacidad
    ),
    // REGLA DURA — nunca "OR es_ceom_admin()" acá, mismo motivo que "roles".
    ...crudPolicy(
      "permisos_especiales_por_rol",
      sql`${table.rolId} in (select id from roles where tenant_id = (select current_tenant_id()) or tenant_id is null)`
    ),
  ]
).enableRLS();

export const permisosEspecialesPorUsuario = pgTable(
  "permisos_especiales_por_usuario",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuarios.id),
    capacidad: capacidadEspecialEnum("capacidad").notNull(),
    habilitado: boolean("habilitado").notNull().default(false),
    creadoPor: uuid("creado_por"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
    eliminadoEn: timestamp("eliminado_en", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("permisos_especiales_usuario_capacidad_unique")
      .on(table.usuarioId, table.capacidad)
      .where(sql`${table.eliminadoEn} is null`),
    // REGLA DURA — nunca "OR es_ceom_admin()" acá, mismo motivo que "roles".
    ...crudPolicy(
      "permisos_especiales_por_usuario",
      sql`${table.usuarioId} in (select id from usuarios where tenant_id = (select current_tenant_id()))`
    ),
  ]
).enableRLS();
