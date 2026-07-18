import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  numeric,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
// Imports relativos (no "@/*"): drizzle-kit carga schema.ts con su propio
// resolvedor esbuild, que no resuelve el alias de tsconfig.
import { crudPolicy } from "../../db/rls";
// Referenciar tenants/sucursales de Identidad y proveedores de Proveedores
// es la direccion de dependencia esperada por la arquitectura
// (CEOM_Arquitectura.md seccion 7) — no es la excepcion de caja negra
// documentada para plan_id.
import { sucursales, tenants } from "../identidad/schema";
// Reutiliza el enum de Patrimonio en vez de duplicar los mismos 4 valores
// (mensual/semanal/quincenal/anual) — decision invitada explicitamente por
// el ANCLA.md de Patrimonio ("decidir si reutiliza este enum... no asumir
// que ya esta resuelto"). Ya incluye "anual".
import { frecuenciaCuotaEnum } from "../patrimonio/schema";
import { proveedores } from "../proveedores/schema";

export const tipoGastoEnum = pgEnum("tipo_gasto", [
  "fijo",
  "variable_no_productivo",
  "unico",
]);

export const origenGastoEnum = pgEnum("origen_gasto", [
  "manual",
  "comision_venta_automatica",
  "cuota_pasivo_automatica",
]);

export const estadoPagoGastoEnum = pgEnum("estado_pago_gasto", [
  "pendiente",
  "parcial",
  "pagado",
]);

// Catalogo global gestionado desde el Panel Administrativo CEOM (Modulo_04
// seccion 1.3) — mismo patron que categorias_sugeridas en Modulo 2.
export const categoriasGastoSugeridas = pgTable(
  "categorias_gasto_sugeridas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Sin FK: el modulo de Nicho no existe todavia (mismo criterio que en
    // Modulo 2/Suscripcion). null = sugerencia global.
    nichoId: uuid("nicho_id"),
    nombre: text("nombre").notNull(),
    activa: boolean("activa").notNull().default(true),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    pgPolicy("categorias_gasto_sugeridas_select_authenticated", {
      for: "select",
      to: authenticatedRole,
      using: sql`true`,
    }),
  ]
).enableRLS();

export const categoriasGasto = pgTable(
  "categorias_gasto",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    nombre: text("nombre").notNull(),
    categoriaGastoSugeridaId: uuid("categoria_gasto_sugerida_id").references(
      () => categoriasGastoSugeridas.id
    ),
    eliminadoEn: timestamp("eliminado_en", { withTimezone: true }),
  },
  (table) => [
    ...crudPolicy(
      "categorias_gasto",
      sql`${table.tenantId} = (select current_tenant_id())`
    ),
  ]
).enableRLS();

// Plantilla de gasto fijo recurrente (Modulo_04 seccion 1.4).
export const gastosRecurrentes = pgTable(
  "gastos_recurrentes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    sucursalId: uuid("sucursal_id").references(() => sucursales.id),
    categoriaId: uuid("categoria_id")
      .notNull()
      .references(() => categoriasGasto.id),
    monto: numeric("monto", { precision: 12, scale: 2 }).notNull(),
    frecuencia: frecuenciaCuotaEnum("frecuencia").notNull(),
    fechaInicio: date("fecha_inicio").notNull(),
    fechaFin: date("fecha_fin"),
    // Desactivar detiene la generacion futura sin borrar el historico ya
    // generado (caso borde 3) — no lleva eliminado_en.
    activo: boolean("activo").notNull().default(true),
    creadoPor: uuid("creado_por"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    ...crudPolicy(
      "gastos_recurrentes",
      sql`${table.tenantId} = (select current_tenant_id())`
    ),
  ]
).enableRLS();

// Gasto (Modulo_04 seccion 1.1). Soft delete SOLO aplica en la practica a
// origen=manual (actions.ts lo impone) — un gasto automatico nunca se
// edita ni elimina directo (regla 2, caso borde 1).
export const gastos = pgTable(
  "gastos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    sucursalId: uuid("sucursal_id").references(() => sucursales.id),
    tipo: tipoGastoEnum("tipo").notNull(),
    categoriaId: uuid("categoria_id")
      .notNull()
      .references(() => categoriasGasto.id),
    monto: numeric("monto", { precision: 12, scale: 2 }).notNull(),
    fechaGasto: date("fecha_gasto").notNull(),
    // FK real: Proveedores (Modulo 8) ya existia cuando se construyo este
    // modulo, a diferencia de activo.proveedor_id en Patrimonio.
    proveedorId: uuid("proveedor_id").references(() => proveedores.id),
    origen: origenGastoEnum("origen").notNull().default("manual"),
    // Derivado desde pagos_gasto, nunca editado a mano (Modulo_04 seccion 1.5).
    estadoPago: estadoPagoGastoEnum("estado_pago").notNull().default("pendiente"),
    // Apunta a la Venta o al Pasivo/GastoRecurrente que origino el registro,
    // segun "origen" — sin FK porque puede referenciar tablas de otros
    // modulos o de este mismo (GastoRecurrente).
    referenciaId: uuid("referencia_id"),
    descripcion: text("descripcion"),
    creadoPor: uuid("creado_por"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
    modificadoPor: uuid("modificado_por"),
    modificadoEn: timestamp("modificado_en", { withTimezone: true }),
    eliminadoEn: timestamp("eliminado_en", { withTimezone: true }),
  },
  (table) => [
    ...crudPolicy("gastos", sql`${table.tenantId} = (select current_tenant_id())`),
  ]
).enableRLS();

// Ledger de pagos (Modulo_04 seccion 1.5) — mismo patron que Pago de Venta.
export const pagosGasto = pgTable(
  "pagos_gasto",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gastoId: uuid("gasto_id")
      .notNull()
      .references(() => gastos.id),
    monto: numeric("monto", { precision: 12, scale: 2 }).notNull(),
    fechaPago: date("fecha_pago").notNull(),
    creadoPor: uuid("creado_por"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    ...crudPolicy(
      "pagos_gasto",
      sql`${table.gastoId} in (select id from gastos where tenant_id = (select current_tenant_id()))`
    ),
  ]
).enableRLS();
