import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  date,
  integer,
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
// negra documentada para plan_id (esa va en sentido inverso, Identidad
// importando de un modulo periferico).
import { sucursales, tenants } from "../identidad/schema";

export const tipoActivoEnum = pgEnum("tipo_activo", [
  "equipo_productivo",
  "mobiliario",
  "vehiculo",
  "otro",
]);

// "Dado de baja" es un estado de negocio, nunca un soft-delete (Modulo_05
// seccion 3, regla 2). eliminado_en queda reservado para errores de carga.
export const estadoActivoEnum = pgEnum("estado_activo", [
  "activo",
  "en_mantenimiento",
  "dado_de_baja",
]);

// "Mismo catalogo que GastoRecurrente" (Modulo_05 seccion 1.2), pero ese
// catalogo vive en Costos y Gastos (Modulo 4), que no existe todavia — se
// define local aca. Revisar cuando se construya el Modulo 4 si conviene
// compartir un enum en vez de duplicarlo.
export const frecuenciaCuotaEnum = pgEnum("frecuencia_cuota", [
  "mensual",
  "semanal",
  "quincenal",
  "anual",
]);

export const estadoPasivoEnum = pgEnum("estado_pasivo", [
  "activo",
  "pagado",
  "refinanciado",
]);

export const origenPagoPasivoEnum = pgEnum("origen_pago_pasivo", [
  "automatico",
  "manual",
]);

export const activos = pgTable(
  "activos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    // null = aplica a todo el negocio (ej. vehiculo compartido).
    sucursalId: uuid("sucursal_id").references(() => sucursales.id),
    nombre: text("nombre").notNull(),
    tipo: tipoActivoEnum("tipo").notNull(),
    capacidadProduccionCantidad: numeric("capacidad_produccion_cantidad", {
      precision: 12,
      scale: 2,
    }),
    capacidadProduccionUnidad: text("capacidad_produccion_unidad"),
    capacidadAlmacenamientoCantidad: numeric(
      "capacidad_almacenamiento_cantidad",
      { precision: 12, scale: 2 }
    ),
    capacidadAlmacenamientoUnidad: text("capacidad_almacenamiento_unidad"),
    disponibilidadHorariaSemanal: numeric("disponibilidad_horaria_semanal", {
      precision: 6,
      scale: 2,
    }),
    requiereDescansoEntreCiclos: boolean("requiere_descanso_entre_ciclos")
      .notNull()
      .default(false),
    tiempoDescansoMinutos: numeric("tiempo_descanso_minutos", {
      precision: 8,
      scale: 2,
    }),
    tiempoEstimadoPorCicloMinutos: numeric(
      "tiempo_estimado_por_ciclo_minutos",
      { precision: 8, scale: 2 }
    ),
    estado: estadoActivoEnum("estado").notNull().default("activo"),
    valorCompra: numeric("valor_compra", { precision: 12, scale: 2 }).notNull(),
    fechaAdquisicion: date("fecha_adquisicion").notNull(),
    // null = el activo no deprecia (ej. un terreno).
    vidaUtilMeses: numeric("vida_util_meses", { precision: 6, scale: 2 }),
    // Sin FK todavia: Proveedores (Modulo 8) no existe aun.
    proveedorId: uuid("proveedor_id"),
    numeroSerie: text("numero_serie"),
    vencimientoGarantia: date("vencimiento_garantia"),
    creadoPor: uuid("creado_por"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
    modificadoPor: uuid("modificado_por"),
    modificadoEn: timestamp("modificado_en", { withTimezone: true }),
    // Soft delete real, solo para errores de carga — no para "dar de baja"
    // un equipo que existio de verdad (eso es estado=dado_de_baja).
    eliminadoEn: timestamp("eliminado_en", { withTimezone: true }),
  },
  (table) => [
    ...crudPolicy("activos", sql`${table.tenantId} = (select current_tenant_id())`),
  ]
).enableRLS();

export const pasivos = pgTable(
  "pasivos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    // Opcional: un pasivo puede no estar atado a ningun activo (ej.
    // prestamo de capital de trabajo).
    activoId: uuid("activo_id").references(() => activos.id),
    montoTotal: numeric("monto_total", { precision: 12, scale: 2 }).notNull(),
    cuotaPeriodica: numeric("cuota_periodica", {
      precision: 12,
      scale: 2,
    }).notNull(),
    frecuenciaCuota: frecuenciaCuotaEnum("frecuencia_cuota").notNull(),
    plazoCuotas: integer("plazo_cuotas").notNull(),
    fechaInicio: date("fecha_inicio").notNull(),
    estado: estadoPasivoEnum("estado").notNull().default("activo"),
    // Si este Pasivo reemplaza a uno anterior refinanciado (Modulo_05
    // seccion 3, regla 4) — nunca se edita el original. Auto-referencia via
    // thunk perezoso (patron estandar de Drizzle para FKs a la misma tabla).
    refinanciadoDesdeId: uuid("refinanciado_desde_id").references(
      (): AnyPgColumn => pasivos.id
    ),
    creadoPor: uuid("creado_por"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
    eliminadoEn: timestamp("eliminado_en", { withTimezone: true }),
  },
  (table) => [
    ...crudPolicy("pasivos", sql`${table.tenantId} = (select current_tenant_id())`),
  ]
).enableRLS();

export const pagosPasivo = pgTable(
  "pagos_pasivo",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pasivoId: uuid("pasivo_id")
      .notNull()
      .references(() => pasivos.id),
    monto: numeric("monto", { precision: 12, scale: 2 }).notNull(),
    fechaPago: date("fecha_pago").notNull(),
    origen: origenPagoPasivoEnum("origen").notNull(),
    creadoPor: uuid("creado_por"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    ...crudPolicy(
      "pagos_pasivo",
      sql`${table.pasivoId} in (select id from pasivos where tenant_id = (select current_tenant_id()))`
    ),
  ]
).enableRLS();
