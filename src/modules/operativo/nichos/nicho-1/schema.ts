import { sql } from "drizzle-orm";
import {
  date,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
// Imports relativos (no "@/*"): drizzle-kit carga schema.ts con su propio
// resolvedor esbuild, que no resuelve el alias de tsconfig.
import { crudPolicy } from "../../../../db/rls";
// Referenciar tenants/sucursales de Identidad, productos de Productos e
// Inventario, y activos de Patrimonio es la direccion de dependencia
// esperada por la arquitectura (CEOM_Arquitectura.md seccion 7: Operaciones
// depende de Productos e Inventario y de Patrimonio) — no es la excepcion
// de caja negra documentada para plan_id en Identidad.
import { sucursales, tenants } from "../../../identidad/schema";
import { activos } from "../../../patrimonio/schema";
import { productos } from "../../../productos/schema";

export const unidadMedidaInsumoEnum = pgEnum("unidad_medida_insumo", [
  "litros",
  "ml",
  "kg",
  "g",
  "unidad",
  "metros",
]);

export const tipoMovimientoInsumoEnum = pgEnum("tipo_movimiento_insumo", [
  "entrada_compra",
  "salida_produccion",
  "entrada_ajuste_manual",
  "salida_ajuste_manual",
  "salida_merma_almacenamiento",
]);

export const insumos = pgTable(
  "insumos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    nombre: text("nombre").notNull(),
    unidadMedida: unidadMedidaInsumoEnum("unidad_medida").notNull(),
    vidaUtilDias: integer("vida_util_dias"),
    // Derivado (costo promedio ponderado, Modulo_06 seccion 3.1) — nunca se
    // edita a mano, se recalcula en cada entrada_compra.
    costoUnitarioVigente: numeric("costo_unitario_vigente", {
      precision: 12,
      scale: 4,
    }),
    stockMinimo: numeric("stock_minimo", { precision: 12, scale: 2 }),
    eliminadoEn: timestamp("eliminado_en", { withTimezone: true }),
  },
  (table) => [
    ...crudPolicy("insumos", sql`${table.tenantId} = (select current_tenant_id())`),
  ]
).enableRLS();

// Ledger append-only (mismo patron que movimientos_stock, Modulo_02).
export const movimientosInsumo = pgTable(
  "movimientos_insumo",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    insumoId: uuid("insumo_id")
      .notNull()
      .references(() => insumos.id),
    sucursalId: uuid("sucursal_id")
      .notNull()
      .references(() => sucursales.id),
    tipo: tipoMovimientoInsumoEnum("tipo").notNull(),
    cantidad: numeric("cantidad", { precision: 12, scale: 2 }).notNull(),
    // El costo al que entro o salio ESTA unidad especifica (snapshot), no
    // el promedio recalculado despues (Modulo_06 seccion 1.2).
    costoUnitarioEnMovimiento: numeric("costo_unitario_en_movimiento", {
      precision: 12,
      scale: 4,
    }).notNull(),
    // Solo en entrada_compra; se auto-calcula desde vida_util_dias del
    // Insumo si no se ingresa manualmente (seccion 3.6).
    fechaVencimiento: date("fecha_vencimiento"),
    // Obligatorio si tipo es *ajuste_manual o *merma* — validado en
    // actions.ts, no como constraint de DB (mismo criterio que Modulo 2).
    motivo: text("motivo"),
    referenciaId: uuid("referencia_id"),
    creadoPor: uuid("creado_por"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    ...crudPolicy(
      "movimientos_insumo",
      sql`${table.insumoId} in (select id from insumos where tenant_id = (select current_tenant_id()))`
    ),
  ]
).enableRLS();

// Saldo por Insumo x Sucursal, cacheado y recalculado desde
// movimientos_insumo dentro de la misma transaccion (mismo patron que
// "stock" en Modulo_02).
export const stockInsumo = pgTable(
  "stock_insumo",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    insumoId: uuid("insumo_id")
      .notNull()
      .references(() => insumos.id),
    sucursalId: uuid("sucursal_id")
      .notNull()
      .references(() => sucursales.id),
    cantidadActual: numeric("cantidad_actual", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    actualizadoEn: timestamp("actualizado_en", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("stock_insumo_insumo_sucursal_unique").on(
      table.insumoId,
      table.sucursalId
    ),
    ...crudPolicy(
      "stock_insumo",
      sql`${table.insumoId} in (select id from insumos where tenant_id = (select current_tenant_id()))`
    ),
  ]
).enableRLS();

// Preparacion base (Modulo_06 seccion 1.4) — varias presentaciones de venta
// pueden compartir la misma receta via vinculaciones_producto_receta.
export const recetas = pgTable(
  "recetas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    nombre: text("nombre").notNull(),
    rendimientoPorLote: numeric("rendimiento_por_lote", {
      precision: 12,
      scale: 4,
    }).notNull(),
    unidadRendimiento: text("unidad_rendimiento").notNull(),
    eliminadoEn: timestamp("eliminado_en", { withTimezone: true }),
  },
  (table) => [
    ...crudPolicy("recetas", sql`${table.tenantId} = (select current_tenant_id())`),
  ]
).enableRLS();

export const recetaInsumos = pgTable(
  "receta_insumos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recetaId: uuid("receta_id")
      .notNull()
      .references(() => recetas.id),
    insumoId: uuid("insumo_id")
      .notNull()
      .references(() => insumos.id),
    cantidadPorLote: numeric("cantidad_por_lote", {
      precision: 12,
      scale: 4,
    }).notNull(),
  },
  (table) => [
    ...crudPolicy(
      "receta_insumos",
      sql`${table.recetaId} in (select id from recetas where tenant_id = (select current_tenant_id()))`
    ),
  ]
).enableRLS();

// Vinculacion producto-receta explicita (Modulo_01 seccion 5, Modulo_02
// seccion 4.3, Modulo_06 seccion 1.6) — producto_id debe tener
// tipo_origen_producto = produccion_nicho, validado en actions.ts via el
// contrato publico de Productos e Inventario (fichaProducto), nunca leyendo
// su tabla directo.
export const vinculacionesProductoReceta = pgTable(
  "vinculaciones_producto_receta",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productoId: uuid("producto_id")
      .notNull()
      .references(() => productos.id),
    recetaId: uuid("receta_id")
      .notNull()
      .references(() => recetas.id),
    cantidadBaseConsumidaPorUnidad: numeric(
      "cantidad_base_consumida_por_unidad",
      { precision: 12, scale: 4 }
    ).notNull(),
    eliminadoEn: timestamp("eliminado_en", { withTimezone: true }),
  },
  (table) => [
    ...crudPolicy(
      "vinculaciones_producto_receta",
      sql`${table.recetaId} in (select id from recetas where tenant_id = (select current_tenant_id()))`
    ),
  ]
).enableRLS();

// Registro de lote/tanda (Modulo_06 seccion 1.7). costo_operativo_calculado/
// merma_* son derivados pero persistidos (igual criterio que costo_unitario
// en Compras, Modulo_08): no cambian con el tiempo, se fijan al momento de
// producir.
export const producciones = pgTable(
  "producciones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    sucursalId: uuid("sucursal_id")
      .notNull()
      .references(() => sucursales.id),
    productoId: uuid("producto_id")
      .notNull()
      .references(() => productos.id),
    activoId: uuid("activo_id")
      .notNull()
      .references(() => activos.id),
    fechaProduccion: timestamp("fecha_produccion", { withTimezone: true }).notNull(),
    cantidadLotesProducidos: numeric("cantidad_lotes_producidos", {
      precision: 12,
      scale: 4,
    }).notNull(),
    cantidadRealObtenida: numeric("cantidad_real_obtenida", {
      precision: 12,
      scale: 2,
    }).notNull(),
    // Se auto-calcula como fecha_produccion + vida_util_dias del Producto
    // si no se ingresa manualmente (seccion 3.6).
    fechaVencimientoLote: date("fecha_vencimiento_lote"),
    costoOperativoCalculado: numeric("costo_operativo_calculado", {
      precision: 12,
      scale: 4,
    }).notNull(),
    mermaCantidad: numeric("merma_cantidad", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    mermaCosto: numeric("merma_costo", { precision: 12, scale: 4 })
      .notNull()
      .default("0"),
    creadoPor: uuid("creado_por"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
    // Soft delete real, solo para errores de carga — una produccion real ya
    // consumida se corrige con Produccion de Ajuste, no se borra ni edita.
    eliminadoEn: timestamp("eliminado_en", { withTimezone: true }),
  },
  (table) => [
    ...crudPolicy(
      "producciones",
      sql`${table.tenantId} = (select current_tenant_id())`
    ),
  ]
).enableRLS();

// Correccion de una Produccion ya registrada (caso borde 5) — nunca se edita
// el original. No revierte movimientos de stock/insumo: es correccion
// contable/de trazabilidad, coherente con que puede haber ventas
// posteriores sobre ese stock (mismo espiritu que AjusteVenta).
export const produccionesAjuste = pgTable(
  "producciones_ajuste",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    produccionId: uuid("produccion_id")
      .notNull()
      .references(() => producciones.id),
    costoOperativoCorregido: numeric("costo_operativo_corregido", {
      precision: 12,
      scale: 4,
    }),
    cantidadRealObtenidaCorregida: numeric("cantidad_real_obtenida_corregida", {
      precision: 12,
      scale: 2,
    }),
    motivo: text("motivo").notNull(),
    creadoPor: uuid("creado_por"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    ...crudPolicy(
      "producciones_ajuste",
      sql`${table.produccionId} in (select id from producciones where tenant_id = (select current_tenant_id()))`
    ),
  ]
).enableRLS();
