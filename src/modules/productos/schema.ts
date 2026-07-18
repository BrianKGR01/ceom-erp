import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  numeric,
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
// Referenciar tenants/sucursales de Identidad es el patron esperado (todo
// modulo de negocio le pertenece a un tenant) — no es la excepcion de caja
// negra documentada para plan_id (Identidad) / item_id (Proveedores).
import { sucursales, tenants } from "../identidad/schema";

export const unidadVentaEnum = pgEnum("unidad_venta", [
  "unidad",
  "kg",
  "g",
  "l",
  "ml",
  "docena",
]);

export const origenCostoEnum = pgEnum("origen_costo", [
  "manual",
  "nicho_sugerido",
  "proveedor_reventa",
]);

// Resuelve el caso de reventa simple dentro de un tenant con Nicho de
// produccion (Modulo_02 seccion 6) — un tenant sigue teniendo un solo Nicho,
// pero cada producto individual puede marcarse distinto.
export const tipoOrigenProductoEnum = pgEnum("tipo_origen_producto", [
  "produccion_nicho",
  "reventa_simple",
  "manual",
]);

export const tipoMovimientoStockEnum = pgEnum("tipo_movimiento_stock", [
  "entrada_produccion",
  "entrada_compra_reventa",
  "entrada_ajuste_manual",
  "salida_venta",
  "salida_merma",
  "salida_ajuste_manual",
  "salida_transferencia",
  "entrada_transferencia",
]);

// Catalogo global gestionado desde el Panel Administrativo CEOM (Modulo_02
// seccion 2.2) — mismo patron que "planes" en Suscripcion: sin tenant_id,
// solo policy de select para authenticated, escrituras gateadas a mano por
// ROL_CEOM_ADMIN_ID en actions.ts (ver ANCLA.md de Suscripcion).
export const categoriasSugeridas = pgTable(
  "categorias_sugeridas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Sin FK: el modulo de Nicho no existe todavia (mismo criterio que
    // tenants.nicho_id en Identidad y planes.nicho_id en Suscripcion).
    // null = sugerencia generica, valida para cualquier Nicho.
    nichoId: uuid("nicho_id"),
    nombre: text("nombre").notNull(),
    activa: boolean("activa").notNull().default(true),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    pgPolicy("categorias_sugeridas_select_authenticated", {
      for: "select",
      to: authenticatedRole,
      using: sql`true`,
    }),
  ]
).enableRLS();

export const categoriasProducto = pgTable(
  "categorias_producto",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    nombre: text("nombre").notNull(),
    // Puramente informativo (Modulo_02 seccion 2.1): el usuario puede
    // editar el nombre despues sin romper nada.
    categoriaSugeridaId: uuid("categoria_sugerida_id").references(
      () => categoriasSugeridas.id
    ),
    eliminadoEn: timestamp("eliminado_en", { withTimezone: true }),
  },
  (table) => [
    ...crudPolicy(
      "categorias_producto",
      sql`${table.tenantId} = (select current_tenant_id())`
    ),
  ]
).enableRLS();

export const productos = pgTable(
  "productos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    categoriaId: uuid("categoria_id").references(() => categoriasProducto.id),
    nombre: text("nombre").notNull(),
    imagenUrl: text("imagen_url"),
    unidadVenta: unidadVentaEnum("unidad_venta").notNull(),
    // Siempre lo carga el usuario en este modulo — el sistema nunca lo
    // calcula (Modulo_02 seccion 4, regla 1).
    precioVenta: numeric("precio_venta", { precision: 12, scale: 2 }).notNull(),
    // Valor VIGENTE para mostrar margen en pantalla, no historico — cada
    // venta futura congela su propio costo_unitario_snapshot (Modulo_02
    // seccion 2.3, Modulo de Ventas).
    costoOperativoVigente: numeric("costo_operativo_vigente", {
      precision: 12,
      scale: 4,
    }),
    origenCosto: origenCostoEnum("origen_costo").notNull().default("manual"),
    tipoOrigenProducto: tipoOrigenProductoEnum("tipo_origen_producto")
      .notNull()
      .default("manual"),
    fechaVencimientoReferencia: date("fecha_vencimiento_referencia"),
    vidaUtilDias: integer("vida_util_dias"),
    activo: boolean("activo").notNull().default(true),
    creadoPor: uuid("creado_por"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
    modificadoPor: uuid("modificado_por"),
    modificadoEn: timestamp("modificado_en", { withTimezone: true }),
    eliminadoEn: timestamp("eliminado_en", { withTimezone: true }),
  },
  (table) => [
    ...crudPolicy("productos", sql`${table.tenantId} = (select current_tenant_id())`),
  ]
).enableRLS();

// Stock por Producto x Sucursal (Modulo_02 seccion 1 y 2.4). cantidad_actual
// es un campo cacheado — la fuente de verdad es movimientos_stock, se
// recalcula dentro de la misma transaccion que crea cada movimiento (ver
// repository.ts), nunca se edita directo.
export const stock = pgTable(
  "stock",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productoId: uuid("producto_id")
      .notNull()
      .references(() => productos.id),
    sucursalId: uuid("sucursal_id")
      .notNull()
      .references(() => sucursales.id),
    cantidadActual: numeric("cantidad_actual", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    stockMinimo: numeric("stock_minimo", { precision: 12, scale: 2 }),
    actualizadoEn: timestamp("actualizado_en", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("stock_producto_sucursal_unique").on(
      table.productoId,
      table.sucursalId
    ),
    // Sin tenant_id propio — mismo patron que pagos_compra/compras_ajuste en
    // Proveedores: policy via subquery a productos.tenant_id.
    ...crudPolicy(
      "stock",
      sql`${table.productoId} in (select id from productos where tenant_id = (select current_tenant_id()))`
    ),
  ]
).enableRLS();

// Ledger append-only (Modulo_02 seccion 2.5): nunca se edita cantidad_actual
// a mano, se inserta un movimiento y el saldo se recalcula.
export const movimientosStock = pgTable(
  "movimientos_stock",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productoId: uuid("producto_id")
      .notNull()
      .references(() => productos.id),
    sucursalId: uuid("sucursal_id")
      .notNull()
      .references(() => sucursales.id),
    tipo: tipoMovimientoStockEnum("tipo").notNull(),
    // Siempre positiva; el signo lo determina "tipo" (Modulo_02 seccion 2.5).
    cantidad: numeric("cantidad", { precision: 12, scale: 2 }).notNull(),
    // Obligatorio si "tipo" contiene "ajuste_manual" — validado en
    // actions.ts (no como constraint de DB), mismo criterio que el motivo
    // de Compra de Ajuste en Proveedores.
    motivo: text("motivo"),
    // Apunta a la Venta, Produccion, Compra o al otro movimiento del par de
    // una Transferencia, si aplica.
    referenciaId: uuid("referencia_id"),
    creadoPor: uuid("creado_por"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    ...crudPolicy(
      "movimientos_stock",
      sql`${table.productoId} in (select id from productos where tenant_id = (select current_tenant_id()))`
    ),
  ]
).enableRLS();
