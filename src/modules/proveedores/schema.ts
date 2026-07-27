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
import { ceomAdminBypassPolicy, crudPolicy, gatewayVigenciaBypassPolicy } from "../../db/rls";
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
    // Etapa 3 del backstop de RLS (docs/security/PLAN-RLS-BACKSTOP.md
    // §10.3/§10.8, sub-etapa 3.b).
    ceomAdminBypassPolicy("proveedores"),
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
    ceomAdminBypassPolicy("compras"),
    // Etapa 4.a del backstop de RLS (docs/security/PLAN-RLS-BACKSTOP.md
    // §13.11/§15.3): Financiero.flujoCaja() enruta acá vía
    // consultarPagosCompraEnPeriodo() — el único camino real hoy alcanzado
    // por el Gateway de Consentimiento sobre una tabla ya migrada a
    // comoUsuario(). Tiene que aterrizar en el MISMO commit que la
    // identidad real de solicitanteGateway() (4.a.3) — separarlas reabre
    // la fuga silenciosa documentada en §13.11 (coalesce(sum(...),0)
    // enmascara "RLS filtró todo" como "el tenant no tuvo pagos").
    //
    // Etapa 4.b.0 (§16.9.1/§16.10, 4.b.0.c): reemplaza a
    // gatewaySistemaBypassPolicy("compras") — esa policy no tenía NINGUNA
    // restricción de tenant (el gap real de §16.1.2, ya en producción desde
    // 4.a.3). Nunca conviven las dos: la vieja, sin restricción, anularía a
    // la nueva por semántica OR de policies permisivas múltiples.
    gatewayVigenciaBypassPolicy("compras", "financiero"),
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
    ceomAdminBypassPolicy("pagos_compra"),
    // Ver comentario junto a gatewayVigenciaBypassPolicy("compras", ...)
    // arriba — sumarPagosCompraPeriodo() hace JOIN contra esta tabla,
    // necesita el bypass acá también. "pagos_compra" no tiene tenant_id
    // propio (tabla hija) — el tercer argumento reemplaza el default de
    // gatewayVigenciaBypassPolicy() con el mismo camino que ya usa
    // crudPolicy() arriba (compra_id → compras.tenant_id).
    gatewayVigenciaBypassPolicy(
      "pagos_compra",
      "financiero",
      sql`(select compras.tenant_id from compras where compras.id = pagos_compra.compra_id)`
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
    // Cuantas unidades volvieron del stock por este ajuste (H-31). Nullable:
    // un ajuste puede corregir solo la plata sin mover mercaderia (una
    // "correccion" nunca la mueve). Adenda de este cambio, mismo patron y
    // misma razon que `ajustes_venta.cantidad_producto_ajustada`: sin
    // persistirla no hay forma de saber cuanto ya se devolvio de una compra,
    // y un segundo ajuste devolveria stock de nuevo.
    //
    // Puede ser MENOR que las unidades que el ajuste cubre en plata: si parte
    // de la mercaderia ya se habia vendido, solo vuelve lo que quedaba (la
    // alternativa era dejar el stock en negativo, que mueve el error de lugar
    // en vez de resolverlo).
    cantidadDevuelta: numeric("cantidad_devuelta", { precision: 12, scale: 2 }),
    motivo: text("motivo").notNull(),
    creadoPor: uuid("creado_por"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    ...crudPolicy(
      "compras_ajuste",
      sql`${table.compraId} in (select id from compras where tenant_id = (select current_tenant_id()))`
    ),
    ceomAdminBypassPolicy("compras_ajuste"),
    // H-31: desde que el ajuste de compra llega al estado de resultados
    // (`consultarCostoExtraAjustesCompraEnPeriodo`), esta tabla quedó en el
    // camino del Gateway igual que `compras`/`pagos_compra` —
    // `financiero.estadoResultados()` la lee para Monitoreo Institucional.
    // Sin esta policy el camino Gateway leería 0 ajustes y devolvería un
    // resultado MAYOR que el real, indistinguible de "este negocio no tuvo
    // ajustes": exactamente la fuga silenciosa que documenta §13.11 del
    // backstop de RLS (coalesce(sum(...),0) enmascarando "RLS filtró todo").
    //
    // Tercer argumento como en `pagos_compra`: `compras_ajuste` no tiene
    // `tenant_id` propio, el tenant sale por `compra_id → compras.tenant_id`,
    // el mismo camino que ya usa `crudPolicy()` arriba.
    //
    // Checklist de costo (§16.10): la query real del Gateway sobre esta tabla
    // (`sumarCostoExtraAjustesCompraPeriodo`) SÍ trae su propio filtro de
    // tenant explícito — hace `innerJoin(compras)` con
    // `compras.tenant_id = ?`, así que el SubPlan correlacionado queda
    // acotado a las filas de ese tenant.
    gatewayVigenciaBypassPolicy(
      "compras_ajuste",
      "financiero",
      sql`(select compras.tenant_id from compras where compras.id = compras_ajuste.compra_id)`
    ),
  ]
).enableRLS();
