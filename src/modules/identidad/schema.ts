import { sql } from "drizzle-orm";
import {
  boolean,
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
  nichoId: uuid("nicho_id"),
  nichoAsignadoEn: timestamp("nicho_asignado_en", { withTimezone: true }),
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
    // Los roles de sistema (tenant_id null: Owner, CEOM Admin) son datos de
    // referencia compartidos — visibles para cualquier tenant autenticado.
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
    ...crudPolicy(
      "permisos_especiales_por_usuario",
      sql`${table.usuarioId} in (select id from usuarios where tenant_id = (select current_tenant_id()))`
    ),
  ]
).enableRLS();
