import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  jsonb,
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
import { crudPolicy } from "../../db/rls";
import { sucursales, tenants } from "../identidad/schema";

/**
 * Caja y turnos (Roadmap Cafiatto, Fase 4). Modulo del Core, agnostico al rubro:
 * controla el efectivo del dia a dia y lo compara con lo contado.
 *
 * - Caja = punto de cobro. Turno = periodo en que alguien responde por ella.
 *   Venta = transaccion dentro del turno.
 * - Apagado por defecto: sin fila en `configuracion_caja` el negocio no usa caja
 *   y nada de esto se exige.
 * - Dependencia en un solo sentido: Caja lee de Ventas (cobros por turno). Ventas
 *   guarda `turno_id` sin FK y nunca importa Caja.
 */

export const estadoTurnoEnum = pgEnum("estado_turno_caja", ["abierto", "cerrado"]);
export const tipoMovimientoCajaEnum = pgEnum("tipo_movimiento_caja", ["entrada", "salida"]);

export const configuracionCaja = pgTable(
  "configuracion_caja",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    habilitada: boolean("habilitada").notNull().default(false),
    // Con la caja habilitada, no se vende ni se cobra sin un turno abierto.
    exigirTurno: boolean("exigir_turno").notNull().default(true),
    modificadoPor: uuid("modificado_por"),
    modificadoEn: timestamp("modificado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("configuracion_caja_tenant_uq").on(table.tenantId),
    ...crudPolicy("configuracion_caja", sql`${table.tenantId} = (select current_tenant_id())`),
  ]
).enableRLS();

export const cajas = pgTable(
  "cajas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    sucursalId: uuid("sucursal_id")
      .notNull()
      .references(() => sucursales.id),
    nombre: text("nombre").notNull(),
    eliminadoEn: timestamp("eliminado_en", { withTimezone: true }),
  },
  (table) => [
    ...crudPolicy("cajas", sql`${table.tenantId} = (select current_tenant_id())`),
  ]
).enableRLS();

export const turnosCaja = pgTable(
  "turnos_caja",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    cajaId: uuid("caja_id")
      .notNull()
      .references(() => cajas.id),
    // Correlativo por negocio ("Turno #31").
    numero: integer("numero").notNull(),
    estado: estadoTurnoEnum("estado").notNull().default("abierto"),
    abiertoPor: uuid("abierto_por").notNull(),
    abiertoEn: timestamp("abierto_en", { withTimezone: true }).notNull().defaultNow(),
    fondoInicial: numeric("fondo_inicial", { precision: 12, scale: 2 }).notNull(),
    // --- Se completan UNA vez, al cerrar (el turno cerrado no se vuelve a tocar). ---
    cerradoPor: uuid("cerrado_por"),
    cerradoEn: timestamp("cerrado_en", { withTimezone: true }),
    ventasCantidad: integer("ventas_cantidad"),
    ventasTotal: numeric("ventas_total", { precision: 12, scale: 2 }),
    // [{metodoPagoId, nombre, esEfectivo, monto, cantidad}] tal como estaba al cerrar.
    totalesPorMedio: jsonb("totales_por_medio"),
    efectivoEsperado: numeric("efectivo_esperado", { precision: 12, scale: 2 }),
    efectivoContado: numeric("efectivo_contado", { precision: 12, scale: 2 }),
    // contado - esperado. Una diferencia NO toca las ventas: queda aca para revision.
    diferencia: numeric("diferencia", { precision: 12, scale: 2 }),
    observaciones: text("observaciones"),
  },
  (table) => [
    check("turnos_caja_fondo_chk", sql`${table.fondoInicial} >= 0`),
    check(
      "turnos_caja_cierre_chk",
      sql`(${table.estado} = 'abierto' and ${table.cerradoEn} is null)
        or (${table.estado} = 'cerrado' and ${table.cerradoEn} is not null and ${table.efectivoContado} is not null)`
    ),
    // Una sola caja abierta a la vez por caja.
    uniqueIndex("turnos_caja_un_abierto_por_caja_uq")
      .on(table.cajaId)
      .where(sql`${table.estado} = 'abierto'`),
    uniqueIndex("turnos_caja_numero_uq").on(table.tenantId, table.numero),
    ...crudPolicy("turnos_caja", sql`${table.tenantId} = (select current_tenant_id())`),
  ]
).enableRLS();

// Entradas y salidas de efectivo que no son ventas (retiros, pagos menores, ajustes
// autorizados). Append-only (regla 3): un movimiento mal cargado se corrige con otro
// en sentido contrario y su motivo, no se edita.
export const movimientosCaja = pgTable(
  "movimientos_caja",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    turnoId: uuid("turno_id")
      .notNull()
      .references(() => turnosCaja.id),
    tipo: tipoMovimientoCajaEnum("tipo").notNull(),
    monto: numeric("monto", { precision: 12, scale: 2 }).notNull(),
    motivo: text("motivo").notNull(),
    creadoPor: uuid("creado_por").notNull(),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("movimientos_caja_monto_chk", sql`${table.monto} > 0`),
    ...crudPolicy("movimientos_caja", sql`${table.tenantId} = (select current_tenant_id())`),
  ]
).enableRLS();
