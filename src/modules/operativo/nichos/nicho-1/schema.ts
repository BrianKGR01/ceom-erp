import { sql } from "drizzle-orm";
import {
  boolean,
  check,
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
  // Fase 1 Cafiatto: consumo de insumos al vender (modo_consumo = al_vender).
  "salida_venta",
  // Fase 2 Cafiatto: baja de insumo (derrame, vencimiento, error de preparacion...).
  "salida_baja",
]);

// Fase 1 Cafiatto: cuando se descuentan los insumos de la receta.
// - al_producir: al registrar una Produccion (comportamiento historico).
// - al_vender: al registrar la Venta, por unidad vendida, sin Produccion.
export const modoConsumoRecetaEnum = pgEnum("modo_consumo_receta", ["al_producir", "al_vender"]);

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
    // 4 decimales: una receta por unidad consume fracciones (0,0150 kg); con 2
    // decimales cada venta redondeaba el consumo y el error se acumulaba.
    cantidad: numeric("cantidad", { precision: 14, scale: 4 }).notNull(),
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
    cantidadActual: numeric("cantidad_actual", { precision: 14, scale: 4 })
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
    modoConsumo: modoConsumoRecetaEnum("modo_consumo").notNull().default("al_producir"),
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

// --- Bajas (Roadmap Cafiatto, Fase 2) ---------------------------------------
// Perdidas que no son una venta: leche derramada, un latte que se descarta, un
// insumo vencido. Registro append-only (regla 3): una baja no se edita ni se
// borra; si se cargo mal, se corrige con un ajuste de stock con motivo. El
// movimiento que descuenta el inventario es el de siempre (`movimientos_insumo`
// con tipo `salida_baja`, o `movimientos_stock` `salida_merma`); esta tabla es
// el "por que" y el costo congelado de esa perdida.
//
// El "consumo del personal" NO es un motivo de baja: se modela como bonificacion
// de venta (decision 1 del roadmap, Fase 5).
export const tipoBajaEnum = pgEnum("tipo_baja", ["insumo", "producto"]);

export const motivoBajaEnum = pgEnum("motivo_baja", [
  "error_preparacion",
  "derrame_desperdicio",
  "queja_reposicion",
  "vencimiento",
  "danio",
  "otro",
]);

export const bajas = pgTable(
  "bajas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    sucursalId: uuid("sucursal_id")
      .notNull()
      .references(() => sucursales.id),
    tipo: tipoBajaEnum("tipo").notNull(),
    insumoId: uuid("insumo_id").references(() => insumos.id),
    productoId: uuid("producto_id").references(() => productos.id),
    cantidad: numeric("cantidad", { precision: 14, scale: 4 }).notNull(),
    motivo: motivoBajaEnum("motivo").notNull(),
    nota: text("nota"),
    // Costo de lo perdido AL MOMENTO de la baja (regla 4): no se recalcula si el
    // costo del insumo cambia despues. Null cuando falta algun costo (se marca,
    // no se estima en cero: reglas 9 y 10).
    costoTotal: numeric("costo_total", { precision: 14, scale: 4 }),
    costoDesconocido: boolean("costo_desconocido").notNull().default(false),
    creadoPor: uuid("creado_por"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "bajas_objeto_chk",
      sql`(${table.tipo} = 'insumo' and ${table.insumoId} is not null and ${table.productoId} is null)
        or (${table.tipo} = 'producto' and ${table.productoId} is not null and ${table.insumoId} is null)`
    ),
    check("bajas_cantidad_chk", sql`${table.cantidad} > 0`),
    ...crudPolicy("bajas", sql`${table.tenantId} = (select current_tenant_id())`),
  ]
).enableRLS();

// --- Modificadores (Roadmap Cafiatto, Fase 3) ---------------------------------
// Lo que el cliente pide encima del producto base: leche de almendra, un shot
// extra, "extra caliente". Se organizan en grupos con regla de seleccion
// ("Leche - elige 1", "Extras - varios"). Cada modificador puede mover el
// precio, la receta o ninguno (una indicacion es solo texto).
//
// Viven en Operativo porque tocan la receta; Ventas guarda su propia copia
// congelada por linea (`detalles_venta_modificadores`) y NO referencia estas
// tablas: lo que se vendio no cambia si manana se edita el modificador.
export const seleccionModificadorEnum = pgEnum("seleccion_modificador", ["una", "varias"]);

export const tipoModificadorEnum = pgEnum("tipo_modificador", [
  // Suma un insumo a la receta (shot adicional: +9 g de cafe).
  "agrega",
  // Saca un insumo de la receta base y, si corresponde, pone otro (leche entera
  // -> leche de almendra). Sin insumo nuevo es un "sin jarabe".
  "reemplaza",
  // Solo texto para quien prepara. No mueve precio ni inventario.
  "indicacion",
]);

export const gruposModificadores = pgTable(
  "grupos_modificadores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    nombre: text("nombre").notNull(),
    seleccion: seleccionModificadorEnum("seleccion").notNull().default("varias"),
    orden: integer("orden").notNull().default(0),
    eliminadoEn: timestamp("eliminado_en", { withTimezone: true }),
  },
  (table) => [
    ...crudPolicy("grupos_modificadores", sql`${table.tenantId} = (select current_tenant_id())`),
  ]
).enableRLS();

export const modificadores = pgTable(
  "modificadores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    grupoId: uuid("grupo_id")
      .notNull()
      .references(() => gruposModificadores.id),
    nombre: text("nombre").notNull(),
    tipo: tipoModificadorEnum("tipo").notNull(),
    // La opcion por defecto de un grupo de "elige 1" (ej. "Entera"): no cambia
    // nada. Solo una por grupo.
    esBase: boolean("es_base").notNull().default(false),
    precioExtra: numeric("precio_extra", { precision: 12, scale: 2 }).notNull().default("0"),
    // agrega / reemplaza: el insumo que se suma y cuanto, POR UNIDAD vendida.
    insumoId: uuid("insumo_id").references(() => insumos.id),
    cantidad: numeric("cantidad", { precision: 14, scale: 4 }),
    // reemplaza: el insumo de la receta base que se saca (se saca toda su linea).
    // Si `insumoId` va sin `cantidad`, el nuevo insumo entra en la misma cantidad
    // que el que sale (cambio 1 a 1).
    insumoReemplazadoId: uuid("insumo_reemplazado_id").references(() => insumos.id),
    orden: integer("orden").notNull().default(0),
    eliminadoEn: timestamp("eliminado_en", { withTimezone: true }),
  },
  (table) => [
    check(
      "modificadores_forma_chk",
      sql`(${table.tipo} = 'agrega' and ${table.insumoId} is not null and ${table.cantidad} > 0 and ${table.insumoReemplazadoId} is null and not ${table.esBase})
        or (${table.tipo} = 'reemplaza' and ${table.insumoReemplazadoId} is not null and not ${table.esBase})
        or (${table.tipo} = 'indicacion' and ${table.insumoId} is null and ${table.cantidad} is null and ${table.insumoReemplazadoId} is null and ${table.precioExtra} = 0)`
    ),
    check("modificadores_base_chk", sql`not ${table.esBase} or ${table.tipo} = 'indicacion'`),
    check("modificadores_precio_chk", sql`${table.precioExtra} >= 0`),
    uniqueIndex("modificadores_una_base_por_grupo_uq")
      .on(table.grupoId)
      .where(sql`${table.esBase} and ${table.eliminadoEn} is null`),
    ...crudPolicy("modificadores", sql`${table.tenantId} = (select current_tenant_id())`),
  ]
).enableRLS();

// A que productos se les ofrece cada grupo.
export const productosGruposModificadores = pgTable(
  "productos_grupos_modificadores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productoId: uuid("producto_id")
      .notNull()
      .references(() => productos.id),
    grupoId: uuid("grupo_id")
      .notNull()
      .references(() => gruposModificadores.id),
    eliminadoEn: timestamp("eliminado_en", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("productos_grupos_modificadores_uq")
      .on(table.productoId, table.grupoId)
      .where(sql`${table.eliminadoEn} is null`),
    ...crudPolicy(
      "productos_grupos_modificadores",
      sql`${table.grupoId} in (select id from grupos_modificadores where tenant_id = (select current_tenant_id()))`
    ),
  ]
).enableRLS();
