CREATE TYPE "public"."tipo_simulacion" AS ENUM('simular_precio', 'punto_equilibrio');--> statement-breakpoint
CREATE TABLE "configuracion_simulaciones" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"umbral_margen_alerta_pct" numeric(5, 2) DEFAULT '15' NOT NULL,
	"modificado_por" uuid,
	"modificado_en" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "configuracion_simulaciones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "simulaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"producto_id" uuid NOT NULL,
	"tipo" "tipo_simulacion" NOT NULL,
	"frecuencia" text NOT NULL,
	"periodo" text NOT NULL,
	"margen_deseado_pct" numeric(5, 2),
	"costo_usado" numeric(12, 4) NOT NULL,
	"costo_es_manual" boolean DEFAULT false NOT NULL,
	"precio_sugerido" numeric(12, 2),
	"impacto_proyectado_bs" numeric(12, 2),
	"punto_equilibrio_unidades" numeric(12, 2),
	"creado_por" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "simulaciones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "configuracion_simulaciones" ADD CONSTRAINT "configuracion_simulaciones_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulaciones" ADD CONSTRAINT "simulaciones_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulaciones" ADD CONSTRAINT "simulaciones_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "configuracion_simulaciones_tenant_select" ON "configuracion_simulaciones" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("configuracion_simulaciones"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "configuracion_simulaciones_tenant_modify" ON "configuracion_simulaciones" AS PERMISSIVE FOR ALL TO "authenticated" USING ("configuracion_simulaciones"."tenant_id" = (select current_tenant_id())) WITH CHECK ("configuracion_simulaciones"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "simulaciones_tenant_select" ON "simulaciones" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("simulaciones"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "simulaciones_tenant_modify" ON "simulaciones" AS PERMISSIVE FOR ALL TO "authenticated" USING ("simulaciones"."tenant_id" = (select current_tenant_id())) WITH CHECK ("simulaciones"."tenant_id" = (select current_tenant_id()));