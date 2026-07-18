import { sql } from "drizzle-orm";
import {
  boolean,
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
// Referenciar tenants/sucursales de Identidad y productos de Productos e
// Inventario es la direccion de dependencia esperada por la arquitectura
// (CEOM_Arquitectura.md seccion 7: Ventas depende de Productos e
// Inventario) — no es la excepcion de caja negra documentada para plan_id.
import { sucursales, tenants } from "../identidad/schema";
import { productos } from "../productos/schema";

export const origenRegistroEnum = pgEnum("origen_registro_venta", [
  "en_vivo",
  "offline_sincronizado",
  "importacion_historica",
]);

export const estadoPagoVentaEnum = pgEnum("estado_pago_venta", [
  "pendiente",
  "parcial",
  "pagado",
]);

export const tipoAjusteVentaEnum = pgEnum("tipo_ajuste_venta", [
  "correccion",
  "devolucion",
  "descuento_posterior",
  "anulacion_total",
]);

export const estadoEventoEnum = pgEnum("estado_evento", ["abierto", "cerrado"]);

// Ficha minima, alta implicita al vender (Modulo_03 seccion 1.8) — Clientes
// vive dentro de este modulo, no es un modulo aparte.
export const clientes = pgTable(
  "clientes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    nombre: text("nombre").notNull(),
    telefono: text("telefono"),
    email: text("email"),
    // Derivados, actualizados en cada Venta — nunca editados a mano.
    primeraCompraEn: timestamp("primera_compra_en", { withTimezone: true }),
    ultimaCompraEn: timestamp("ultima_compra_en", { withTimezone: true }),
    eliminadoEn: timestamp("eliminado_en", { withTimezone: true }),
  },
  (table) => [
    ...crudPolicy("clientes", sql`${table.tenantId} = (select current_tenant_id())`),
  ]
).enableRLS();

export const canalesVenta = pgTable(
  "canales_venta",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    nombre: text("nombre").notNull(),
    // Valor SUGERIDO al crear un Evento sobre este canal, no fijo
    // (Modulo_03 seccion 1.5) — la comision real por ocasion vive en Evento.
    porcentajeComisionDefault: numeric("porcentaje_comision_default", {
      precision: 5,
      scale: 2,
    }),
    activo: boolean("activo").notNull().default(true),
    eliminadoEn: timestamp("eliminado_en", { withTimezone: true }),
  },
  (table) => [
    ...crudPolicy(
      "canales_venta",
      sql`${table.tenantId} = (select current_tenant_id())`
    ),
  ]
).enableRLS();

// Sin eliminado_en a proposito (Modulo_03 seccion 1.7 no lo lista) — la
// baja es el booleano activo, mismo criterio que "planes" en Suscripcion.
export const metodosPago = pgTable(
  "metodos_pago",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    nombre: text("nombre").notNull(),
    activo: boolean("activo").notNull().default(true),
  },
  (table) => [
    ...crudPolicy(
      "metodos_pago",
      sql`${table.tenantId} = (select current_tenant_id())`
    ),
  ]
).enableRLS();

// Sesion acotada de feria/pop-up (Modulo_03 seccion 1.6) — fija la comision
// puntual de esa ocasion, distinta del default del canal.
export const eventos = pgTable(
  "eventos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    sucursalId: uuid("sucursal_id")
      .notNull()
      .references(() => sucursales.id),
    canalVentaId: uuid("canal_venta_id")
      .notNull()
      .references(() => canalesVenta.id),
    nombre: text("nombre").notNull(),
    porcentajeComision: numeric("porcentaje_comision", { precision: 5, scale: 2 }),
    fechaInicio: timestamp("fecha_inicio", { withTimezone: true }).notNull(),
    fechaFin: timestamp("fecha_fin", { withTimezone: true }).notNull(),
    estado: estadoEventoEnum("estado").notNull().default("abierto"),
    creadoPor: uuid("creado_por"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
    cerradoPor: uuid("cerrado_por"),
    cerradoEn: timestamp("cerrado_en", { withTimezone: true }),
    eliminadoEn: timestamp("eliminado_en", { withTimezone: true }),
  },
  (table) => [
    ...crudPolicy("eventos", sql`${table.tenantId} = (select current_tenant_id())`),
  ]
).enableRLS();

// Cabecera de Venta. SIN eliminado_en a proposito (Modulo_03 seccion 1.1,
// nota deliberada): una venta nunca se oculta con soft-delete, su unica via
// de correccion/anulacion es un AjusteVenta.
export const ventas = pgTable(
  "ventas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    sucursalId: uuid("sucursal_id")
      .notNull()
      .references(() => sucursales.id),
    clienteId: uuid("cliente_id").references(() => clientes.id),
    fechaVenta: timestamp("fecha_venta", { withTimezone: true }).notNull(),
    canalVentaId: uuid("canal_venta_id")
      .notNull()
      .references(() => canalesVenta.id),
    eventoId: uuid("evento_id").references(() => eventos.id),
    origenRegistro: origenRegistroEnum("origen_registro").notNull().default("en_vivo"),
    // Derivado desde pagos_venta, nunca editado a mano (Modulo_03 seccion 1.4).
    estadoPago: estadoPagoVentaEnum("estado_pago").notNull().default("pendiente"),
    // Calculada y persistida al confirmar la venta (regla 5) — Costos y
    // Gastos (Modulo 4) no existe todavia para consumir un Gasto real; el
    // dato queda listo aca para cuando ese modulo exista (decision del plan).
    comisionPorcentajeAplicado: numeric("comision_porcentaje_aplicado", {
      precision: 5,
      scale: 2,
    }),
    comisionMontoCalculado: numeric("comision_monto_calculado", {
      precision: 12,
      scale: 2,
    }),
    creadoPor: uuid("creado_por"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
    modificadoPor: uuid("modificado_por"),
    modificadoEn: timestamp("modificado_en", { withTimezone: true }),
  },
  (table) => [
    ...crudPolicy("ventas", sql`${table.tenantId} = (select current_tenant_id())`),
  ]
).enableRLS();

export const detallesVenta = pgTable(
  "detalles_venta",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ventaId: uuid("venta_id")
      .notNull()
      .references(() => ventas.id),
    productoId: uuid("producto_id")
      .notNull()
      .references(() => productos.id),
    cantidad: numeric("cantidad", { precision: 12, scale: 2 }).notNull(),
    // Doble snapshot (Modulo_03 seccion 3, regla 1) — cambios posteriores al
    // producto no tocan ventas ya registradas.
    precioVentaSnapshot: numeric("precio_venta_snapshot", {
      precision: 12,
      scale: 2,
    }).notNull(),
    costoUnitarioSnapshot: numeric("costo_unitario_snapshot", {
      precision: 12,
      scale: 4,
    }).notNull(),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  },
  (table) => [
    ...crudPolicy(
      "detalles_venta",
      sql`${table.ventaId} in (select id from ventas where tenant_id = (select current_tenant_id()))`
    ),
  ]
).enableRLS();

// Correccion/anulacion (Modulo_03 seccion 1.3) — la Venta original nunca se
// edita. producto_id es una adenda no explicita del doc: obligatoria solo
// si cantidad_producto_ajustada no es null, necesaria para saber que linea
// devolver stock cuando la venta tiene varias (caso borde 2).
export const ajustesVenta = pgTable(
  "ajustes_venta",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ventaId: uuid("venta_id")
      .notNull()
      .references(() => ventas.id),
    tipo: tipoAjusteVentaEnum("tipo").notNull(),
    montoAjuste: numeric("monto_ajuste", { precision: 12, scale: 2 }).notNull(),
    productoId: uuid("producto_id").references(() => productos.id),
    cantidadProductoAjustada: numeric("cantidad_producto_ajustada", {
      precision: 12,
      scale: 2,
    }),
    motivo: text("motivo").notNull(),
    creadoPor: uuid("creado_por"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    ...crudPolicy(
      "ajustes_venta",
      sql`${table.ventaId} in (select id from ventas where tenant_id = (select current_tenant_id()))`
    ),
  ]
).enableRLS();

// Ledger de cobros (Modulo_03 seccion 1.4) — monto puede ser negativo
// (regla 7: devolucion con dinero real).
export const pagosVenta = pgTable(
  "pagos_venta",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ventaId: uuid("venta_id")
      .notNull()
      .references(() => ventas.id),
    monto: numeric("monto", { precision: 12, scale: 2 }).notNull(),
    metodoPagoId: uuid("metodo_pago_id")
      .notNull()
      .references(() => metodosPago.id),
    fechaPago: timestamp("fecha_pago", { withTimezone: true }).notNull(),
    creadoPor: uuid("creado_por"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    ...crudPolicy(
      "pagos_venta",
      sql`${table.ventaId} in (select id from ventas where tenant_id = (select current_tenant_id()))`
    ),
  ]
).enableRLS();
