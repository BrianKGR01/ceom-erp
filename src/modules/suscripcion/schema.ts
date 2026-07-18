import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  numeric,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";

// Catalogo separado del "modulo_permiso" de Identidad — son los modulos que
// un tenant puede optar por compartir con una entidad veedora externa via
// Codigo de Acceso (Modulo_11 seccion 3.4). No se usa todavia (ese flujo es
// un modulo aparte, roadmap item #10), pero el campo ya forma parte del
// contrato de Plan segun Modulo_01 seccion 1.6.
export const moduloVeedorEnum = pgEnum("modulo_veedor", [
  "financiero",
  "operativo",
  "inventario_operativo",
]);

export const planes = pgTable(
  "planes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nombre: text("nombre").notNull(),
    // Sin FK: el modulo de Nicho no existe todavia (mismo criterio que
    // tenants.nicho_id en Identidad).
    nichoId: uuid("nicho_id"),
    incluyeSucursales: boolean("incluye_sucursales").notNull().default(false),
    permiteMultiplesOwners: boolean("permite_multiples_owners")
      .notNull()
      .default(false),
    permiteDowngradeAutogestionado: boolean("permite_downgrade_autogestionado")
      .notNull()
      .default(false),
    duracionInvitacionDias: integer("duracion_invitacion_dias")
      .notNull()
      .default(7),
    duracionEtapaSoloLecturaDias: integer("duracion_etapa_solo_lectura_dias")
      .notNull()
      .default(3),
    modulosVeedorPermitidos: moduloVeedorEnum("modulos_veedor_permitidos")
      .array()
      .notNull()
      .default(sql`'{}'::modulo_veedor[]`),
    precioMensual: numeric("precio_mensual", { precision: 10, scale: 2 }).notNull(),
    moneda: text("moneda").notNull(),
    // Dar de baja un plan sin borrar el historico de quien lo tuvo — no
    // lleva eliminado_en, la baja ES este booleano (Modulo_01 seccion 1.6).
    activo: boolean("activo").notNull().default(true),
  },
  () => [
    // planes es catalogo global, no tenant-scoped: no usa el helper
    // crudPolicy() (asume tenantScope). Cualquier usuario autenticado puede
    // leer el catalogo; sin policy de insert/update/delete (deniega por
    // default). Segunda capa de defensa nomas — las escrituras reales pasan
    // por el rol "postgres", que bypassea RLS (ver src/db/rls.ts).
    pgPolicy("planes_select_authenticated", {
      for: "select",
      to: authenticatedRole,
      using: sql`true`,
    }),
  ]
).enableRLS();
