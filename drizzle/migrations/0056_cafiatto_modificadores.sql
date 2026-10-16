CREATE TYPE "public"."seleccion_modificador" AS ENUM('una', 'varias');--> statement-breakpoint
CREATE TYPE "public"."tipo_modificador" AS ENUM('agrega', 'reemplaza', 'indicacion');--> statement-breakpoint
CREATE TABLE "grupos_modificadores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"seleccion" "seleccion_modificador" DEFAULT 'varias' NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"eliminado_en" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "grupos_modificadores" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "modificadores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"grupo_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"tipo" "tipo_modificador" NOT NULL,
	"es_base" boolean DEFAULT false NOT NULL,
	"precio_extra" numeric(12, 2) DEFAULT '0' NOT NULL,
	"insumo_id" uuid,
	"cantidad" numeric(14, 4),
	"insumo_reemplazado_id" uuid,
	"orden" integer DEFAULT 0 NOT NULL,
	"eliminado_en" timestamp with time zone,
	CONSTRAINT "modificadores_forma_chk" CHECK (("modificadores"."tipo" = 'agrega' and "modificadores"."insumo_id" is not null and "modificadores"."cantidad" > 0 and "modificadores"."insumo_reemplazado_id" is null and not "modificadores"."es_base")
        or ("modificadores"."tipo" = 'reemplaza' and "modificadores"."insumo_reemplazado_id" is not null and not "modificadores"."es_base")
        or ("modificadores"."tipo" = 'indicacion' and "modificadores"."insumo_id" is null and "modificadores"."cantidad" is null and "modificadores"."insumo_reemplazado_id" is null and "modificadores"."precio_extra" = 0)),
	CONSTRAINT "modificadores_base_chk" CHECK (not "modificadores"."es_base" or "modificadores"."tipo" = 'indicacion'),
	CONSTRAINT "modificadores_precio_chk" CHECK ("modificadores"."precio_extra" >= 0)
);
--> statement-breakpoint
ALTER TABLE "modificadores" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "productos_grupos_modificadores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"producto_id" uuid NOT NULL,
	"grupo_id" uuid NOT NULL,
	"eliminado_en" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "productos_grupos_modificadores" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "detalles_venta_modificadores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"detalle_venta_id" uuid NOT NULL,
	"modificador_id" uuid,
	"grupo_nombre" text NOT NULL,
	"nombre" text NOT NULL,
	"tipo" text NOT NULL,
	"precio_extra" numeric(12, 2) DEFAULT '0' NOT NULL,
	"efecto_receta" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "detalles_venta_modificadores" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "detalles_venta" ADD COLUMN "observacion" text;--> statement-breakpoint
ALTER TABLE "grupos_modificadores" ADD CONSTRAINT "grupos_modificadores_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modificadores" ADD CONSTRAINT "modificadores_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modificadores" ADD CONSTRAINT "modificadores_grupo_id_grupos_modificadores_id_fk" FOREIGN KEY ("grupo_id") REFERENCES "public"."grupos_modificadores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modificadores" ADD CONSTRAINT "modificadores_insumo_id_insumos_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modificadores" ADD CONSTRAINT "modificadores_insumo_reemplazado_id_insumos_id_fk" FOREIGN KEY ("insumo_reemplazado_id") REFERENCES "public"."insumos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos_grupos_modificadores" ADD CONSTRAINT "productos_grupos_modificadores_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos_grupos_modificadores" ADD CONSTRAINT "productos_grupos_modificadores_grupo_id_grupos_modificadores_id_fk" FOREIGN KEY ("grupo_id") REFERENCES "public"."grupos_modificadores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detalles_venta_modificadores" ADD CONSTRAINT "detalles_venta_modificadores_detalle_venta_id_detalles_venta_id_fk" FOREIGN KEY ("detalle_venta_id") REFERENCES "public"."detalles_venta"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "modificadores_una_base_por_grupo_uq" ON "modificadores" USING btree ("grupo_id") WHERE "modificadores"."es_base" and "modificadores"."eliminado_en" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "productos_grupos_modificadores_uq" ON "productos_grupos_modificadores" USING btree ("producto_id","grupo_id") WHERE "productos_grupos_modificadores"."eliminado_en" is null;--> statement-breakpoint
CREATE POLICY "grupos_modificadores_tenant_select" ON "grupos_modificadores" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("grupos_modificadores"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "grupos_modificadores_tenant_modify" ON "grupos_modificadores" AS PERMISSIVE FOR ALL TO "authenticated" USING ("grupos_modificadores"."tenant_id" = (select current_tenant_id())) WITH CHECK ("grupos_modificadores"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "modificadores_tenant_select" ON "modificadores" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("modificadores"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "modificadores_tenant_modify" ON "modificadores" AS PERMISSIVE FOR ALL TO "authenticated" USING ("modificadores"."tenant_id" = (select current_tenant_id())) WITH CHECK ("modificadores"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "productos_grupos_modificadores_tenant_select" ON "productos_grupos_modificadores" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("productos_grupos_modificadores"."grupo_id" in (select id from grupos_modificadores where tenant_id = (select current_tenant_id())));--> statement-breakpoint
CREATE POLICY "productos_grupos_modificadores_tenant_modify" ON "productos_grupos_modificadores" AS PERMISSIVE FOR ALL TO "authenticated" USING ("productos_grupos_modificadores"."grupo_id" in (select id from grupos_modificadores where tenant_id = (select current_tenant_id()))) WITH CHECK ("productos_grupos_modificadores"."grupo_id" in (select id from grupos_modificadores where tenant_id = (select current_tenant_id())));--> statement-breakpoint
CREATE POLICY "detalles_venta_modificadores_tenant_select" ON "detalles_venta_modificadores" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("detalles_venta_modificadores"."detalle_venta_id" in (select dv.id from detalles_venta dv join ventas v on v.id = dv.venta_id where v.tenant_id = (select current_tenant_id())));--> statement-breakpoint
CREATE POLICY "detalles_venta_modificadores_tenant_modify" ON "detalles_venta_modificadores" AS PERMISSIVE FOR ALL TO "authenticated" USING ("detalles_venta_modificadores"."detalle_venta_id" in (select dv.id from detalles_venta dv join ventas v on v.id = dv.venta_id where v.tenant_id = (select current_tenant_id()))) WITH CHECK ("detalles_venta_modificadores"."detalle_venta_id" in (select dv.id from detalles_venta dv join ventas v on v.id = dv.venta_id where v.tenant_id = (select current_tenant_id())));