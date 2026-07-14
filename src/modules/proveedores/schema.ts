import { sql } from "drizzle-orm";
import {
  date,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
// Imports relativos (no "@/*"): drizzle-kit carga schema.ts con su propio
// resolvedor esbuild, que no resuelve el alias de tsconfig.
import { crudPolicy } from "../../db/rls";
// Referenciar tenants/sucursales de Identidad es el patron esperado (todo
// modulo de negocio le pertenece a un tenant) — no es la excepcion de caja
// negra documentada para plan_id.
import { sucursales, tenants } from "../identidad/schema";

export const tipoCompraEnum = pgEnum("tipo_compra", ["insumo", "reventa"]);

// "Mismo patron que Ventas y Gastos" (Modulo_08 seccion 1.2), ninguno
// existe todavia — se define local aca.
export const estadoPagoCompraEnum = pgEnum("estado_pago_compra", [
  "pendiente",
  "parcial",
  "pagado",
]);

export const tipoAjusteCompraEnum = pgEnum("tipo_ajuste_compra", [
  "correccion",
  "devolucion_a_proveedor",
  "anulacion_total",
]);

export const proveedores = pgTable(
  "proveedores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    nombre: text("nombre").notNull(),
    contacto: text("contacto"),
    notas: text("notas"),
    creadoPor: uuid("creado_por"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
    eliminadoEn: timestamp("eliminado_en", { withTimezone: true }),
  },
  (table) => [
    ...crudPolicy(
      "proveedores",
      sql`${table.tenantId} = (select current_tenant_id())`
    ),
  ]
).enableRLS();

export const compras = pgTable(
  "compras",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    sucursalId: uuid("sucursal_id")
      .notNull()
      .references(() => sucursales.id),
    // Nullable: permite compras informales sin proveedor fijo (seccion 3.4).
    proveedorId: uuid("proveedor_id").references(() => proveedores.id),
    tipo: tipoCompraEnum("tipo").notNull(),
    // Sin FK: referencia a Insumo (Modulo 6) o Producto (Modulo 2), ninguno
    // existe todavia.
    itemId: uuid("item_id").notNull(),
    cantidad: numeric("cantidad", { precision: 12, scale: 2 }).notNull(),
    // Derivado (monto_total / cantidad), calculado una sola vez al crear —
    // no cambia con el tiempo como valor_actual/saldo_pendiente, asi que se
    // persiste en vez de recalcularse bajo demanda.
    costoUnitario: numeric("costo_unitario", { precision: 12, scale: 4 }).notNull(),
    montoTotal: numeric("monto_total", { precision: 12, scale: 2 }).notNull(),
    fechaCompra: date("fecha_compra").notNull(),
    fechaVencimiento: date("fecha_vencimiento"),
    estadoPago: estadoPagoCompraEnum("estado_pago").notNull().default("pendiente"),
    creadoPor: uuid("creado_por"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
    // Soft delete real, solo para errores de carga — una compra ya recibida
    // y consumida se corrige con una Compra de Ajuste, no se borra.
    eliminadoEn: timestamp("eliminado_en", { withTimezone: true }),
  },
  (table) => [
    ...crudPolicy("compras", sql`${table.tenantId} = (select current_tenant_id())`),
  ]
).enableRLS();

export const pagosCompra = pgTable(
  "pagos_compra",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    compraId: uuid("compra_id")
      .notNull()
      .references(() => compras.id),
    monto: numeric("monto", { precision: 12, scale: 2 }).notNull(),
    fechaPago: date("fecha_pago").notNull(),
    creadoPor: uuid("creado_por"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    ...crudPolicy(
      "pagos_compra",
      sql`${table.compraId} in (select id from compras where tenant_id = (select current_tenant_id()))`
    ),
  ]
).enableRLS();

export const comprasAjuste = pgTable(
  "compras_ajuste",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    compraId: uuid("compra_id")
      .notNull()
      .references(() => compras.id),
    tipo: tipoAjusteCompraEnum("tipo").notNull(),
    montoAjuste: numeric("monto_ajuste", { precision: 12, scale: 2 }).notNull(),
    motivo: text("motivo").notNull(),
    creadoPor: uuid("creado_por"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    ...crudPolicy(
      "compras_ajuste",
      sql`${table.compraId} in (select id from compras where tenant_id = (select current_tenant_id()))`
    ),
  ]
).enableRLS();
