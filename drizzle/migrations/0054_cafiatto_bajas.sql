CREATE TYPE "public"."motivo_baja" AS ENUM('error_preparacion', 'derrame_desperdicio', 'queja_reposicion', 'vencimiento', 'danio', 'otro');--> statement-breakpoint
CREATE TYPE "public"."tipo_baja" AS ENUM('insumo', 'producto');--> statement-breakpoint
CREATE TABLE "bajas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"tipo" "tipo_baja" NOT NULL,
	"insumo_id" uuid,
	"producto_id" uuid,
	"cantidad" numeric(14, 4) NOT NULL,
	"motivo" "motivo_baja" NOT NULL,
	"nota" text,
	"costo_total" numeric(14, 4),
	"costo_desconocido" boolean DEFAULT false NOT NULL,
	"creado_por" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bajas_objeto_chk" CHECK (("bajas"."tipo" = 'insumo' and "bajas"."insumo_id" is not null and "bajas"."producto_id" is null)
        or ("bajas"."tipo" = 'producto' and "bajas"."producto_id" is not null and "bajas"."insumo_id" is null)),
	CONSTRAINT "bajas_cantidad_chk" CHECK ("bajas"."cantidad" > 0)
);
--> statement-breakpoint
ALTER TABLE "bajas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bajas" ADD CONSTRAINT "bajas_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bajas" ADD CONSTRAINT "bajas_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bajas" ADD CONSTRAINT "bajas_insumo_id_insumos_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bajas" ADD CONSTRAINT "bajas_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "bajas_tenant_select" ON "bajas" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("bajas"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "bajas_tenant_modify" ON "bajas" AS PERMISSIVE FOR ALL TO "authenticated" USING ("bajas"."tenant_id" = (select current_tenant_id())) WITH CHECK ("bajas"."tenant_id" = (select current_tenant_id()));