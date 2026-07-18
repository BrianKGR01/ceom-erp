CREATE TYPE "public"."modulo_veedor" AS ENUM('financiero', 'operativo', 'inventario_operativo');--> statement-breakpoint
CREATE TABLE "planes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"nicho_id" uuid,
	"incluye_sucursales" boolean DEFAULT false NOT NULL,
	"permite_multiples_owners" boolean DEFAULT false NOT NULL,
	"permite_downgrade_autogestionado" boolean DEFAULT false NOT NULL,
	"duracion_invitacion_dias" integer DEFAULT 7 NOT NULL,
	"duracion_etapa_solo_lectura_dias" integer DEFAULT 3 NOT NULL,
	"modulos_veedor_permitidos" "modulo_veedor"[] DEFAULT '{}'::modulo_veedor[] NOT NULL,
	"precio_mensual" numeric(10, 2) NOT NULL,
	"moneda" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "planes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "planes_select_authenticated" ON "planes" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);