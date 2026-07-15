import { sql } from "drizzle-orm";
import {
  check,
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
// Cross-modulo, mismo patron ya usado por patrimonio/schema.ts importando
// "proveedores" para declarar activos.proveedorId (migracion 0016) — no es
// una excepcion nueva. Cierra el pendiente de compras.item_id sin FK real
// (roadmap item #12, Nicho 4): ya existen Insumo (Modulo 6) y Producto
// (Modulo 2) para tipar la referencia segun compras.tipo.
import { insumos } from "../operativo/nichos/nicho-1/schema";
import { productos } from "../productos/schema";

export const tipoCompraEnum = pgEnum("tipo_compra", ["insumo", "reventa"]);

// "Orden de Compra" como un estado mas de la misma Compra, no una entidad
// separada (Modulo_08 seccion 6, decision confirmada en el roadmap item
// #12): pedido = todavia no llego la mercaderia, recibido = ya entro a
// inventario. Default "recibido" preserva el comportamiento de quien no usa
// el flujo de Orden de Compra (Nicho 1, Modo Basico).
export const estadoCompraEnum = pgEnum("estado_compra", ["pedido", "recibido"]);

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
    // Reemplaza el antiguo "item_id" sin FK (roadmap item #12) — exactamente
    // uno de los dos segun "tipo", forzado por el CHECK constraint abajo.
    insumoId: uuid("insumo_id").references(() => insumos.id),
    productoId: uuid("producto_id").references(() => productos.id),
    cantidad: numeric("cantidad", { precision: 12, scale: 2 }).notNull(),
    // Derivado ((monto_total + costo_adicional_traslado) / cantidad),
    // calculado una sola vez al crear — no cambia con el tiempo como
    // valor_actual/saldo_pendiente, asi que se persiste en vez de
    // recalcularse bajo demanda.
    costoUnitario: numeric("costo_unitario", { precision: 12, scale: 4 }).notNull(),
    montoTotal: numeric("monto_total", { precision: 12, scale: 2 }).notNull(),
    // Landed cost simple (Modulo_08 seccion 6, roadmap item #12): costo
    // opcional de flete/transporte, prorrateado por unidad en
    // costo_unitario junto con monto_total. Nunca se expone como concepto
    // contable al usuario, solo como "costo extra de traslado".
    costoAdicionalTraslado: numeric("costo_adicional_traslado", {
      precision: 12,
      scale: 2,
    }),
    fechaCompra: date("fecha_compra").notNull(),
    fechaVencimiento: date("fecha_vencimiento"),
    estado: estadoCompraEnum("estado").notNull().default("recibido"),
    // Se completa al pasar a "recibido" — igual a fecha_compra si la Compra
    // ya nace recibida (comportamiento historico, sin flujo de Orden de
    // Compra).
    fechaRecepcion: date("fecha_recepcion"),
    estadoPago: estadoPagoCompraEnum("estado_pago").notNull().default("pendiente"),
    creadoPor: uuid("creado_por"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
    // Soft delete real, solo para errores de carga — una compra ya recibida
    // y consumida se corrige con una Compra de Ajuste, no se borra.
    eliminadoEn: timestamp("eliminado_en", { withTimezone: true }),
  },
  (table) => [
    check(
      "compras_item_segun_tipo",
      sql`(${table.tipo} = 'insumo' and ${table.insumoId} is not null and ${table.productoId} is null)
          or (${table.tipo} = 'reventa' and ${table.productoId} is not null and ${table.insumoId} is null)`
    ),
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
