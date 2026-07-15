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
import { tenants } from "../identidad/schema";
import { productos } from "../productos/schema";

export const tipoSimulacionEnum = pgEnum("tipo_simulacion", [
  "simular_precio",
  "punto_equilibrio",
]);

// Una fila por tenant (Modulo_09 seccion 1.5) — tenant_id ES la PK, tal
// como lo especifica el doc, no un uuid separado.
export const configuracionSimulaciones = pgTable(
  "configuracion_simulaciones",
  {
    tenantId: uuid("tenant_id")
      .primaryKey()
      .references(() => tenants.id),
    umbralMargenAlertaPct: numeric("umbral_margen_alerta_pct", {
      precision: 5,
      scale: 2,
    })
      .notNull()
      .default("15"),
    modificadoPor: uuid("modificado_por"),
    modificadoEn: timestamp("modificado_en", { withTimezone: true }),
  },
  (table) => [
    ...crudPolicy("configuracion_simulaciones", sql`${table.tenantId} = (select current_tenant_id())`),
  ]
).enableRLS();

// Historial de simulaciones (Modulo_09 seccion 1.5) — SIN eliminado_en a
// proposito: "no es un dato operativo que se corrija, se acumulan mas
// simulaciones" (doc, nota explicita).
export const simulaciones = pgTable(
  "simulaciones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    productoId: uuid("producto_id")
      .notNull()
      .references(() => productos.id),
    tipo: tipoSimulacionEnum("tipo").notNull(),
    frecuencia: text("frecuencia").notNull(),
    periodo: text("periodo").notNull(),
    margenDeseadoPct: numeric("margen_deseado_pct", { precision: 5, scale: 2 }),
    costoUsado: numeric("costo_usado", { precision: 12, scale: 4 }).notNull(),
    costoEsManual: boolean("costo_es_manual").notNull().default(false),
    precioSugerido: numeric("precio_sugerido", { precision: 12, scale: 2 }),
    impactoProyectadoBs: numeric("impacto_proyectado_bs", { precision: 12, scale: 2 }),
    puntoEquilibrioUnidades: numeric("punto_equilibrio_unidades", {
      precision: 12,
      scale: 2,
    }),
    creadoPor: uuid("creado_por"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    ...crudPolicy("simulaciones", sql`${table.tenantId} = (select current_tenant_id())`),
  ]
).enableRLS();
