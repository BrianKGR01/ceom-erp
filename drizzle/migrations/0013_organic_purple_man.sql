CREATE TYPE "public"."tipo_movimiento_insumo" AS ENUM('entrada_compra', 'salida_produccion', 'entrada_ajuste_manual', 'salida_ajuste_manual', 'salida_merma_almacenamiento');--> statement-breakpoint
CREATE TYPE "public"."unidad_medida_insumo" AS ENUM('litros', 'ml', 'kg', 'g', 'unidad', 'metros');--> statement-breakpoint
CREATE TABLE "insumos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"unidad_medida" "unidad_medida_insumo" NOT NULL,
	"vida_util_dias" integer,
	"costo_unitario_vigente" numeric(12, 4),
	"stock_minimo" numeric(12, 2),
	"eliminado_en" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "insumos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "movimientos_insumo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"insumo_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"tipo" "tipo_movimiento_insumo" NOT NULL,
	"cantidad" numeric(12, 2) NOT NULL,
	"costo_unitario_en_movimiento" numeric(12, 4) NOT NULL,
	"fecha_vencimiento" date,
	"motivo" text,
	"referencia_id" uuid,
	"creado_por" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "movimientos_insumo" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "producciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"producto_id" uuid NOT NULL,
	"activo_id" uuid NOT NULL,
	"fecha_produccion" timestamp with time zone NOT NULL,
	"cantidad_lotes_producidos" numeric(12, 4) NOT NULL,
	"cantidad_real_obtenida" numeric(12, 2) NOT NULL,
	"fecha_vencimiento_lote" date,
	"costo_operativo_calculado" numeric(12, 4) NOT NULL,
	"merma_cantidad" numeric(12, 2) DEFAULT '0' NOT NULL,
	"merma_costo" numeric(12, 4) DEFAULT '0' NOT NULL,
	"creado_por" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"eliminado_en" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "producciones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "producciones_ajuste" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"produccion_id" uuid NOT NULL,
	"costo_operativo_corregido" numeric(12, 4),
	"cantidad_real_obtenida_corregida" numeric(12, 2),
	"motivo" text NOT NULL,
	"creado_por" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "producciones_ajuste" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "receta_insumos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receta_id" uuid NOT NULL,
	"insumo_id" uuid NOT NULL,
	"cantidad_por_lote" numeric(12, 4) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "receta_insumos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "recetas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"rendimiento_por_lote" numeric(12, 4) NOT NULL,
	"unidad_rendimiento" text NOT NULL,
	"eliminado_en" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "recetas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stock_insumo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"insumo_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"cantidad_actual" numeric(12, 2) DEFAULT '0' NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stock_insumo" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vinculaciones_producto_receta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"producto_id" uuid NOT NULL,
	"receta_id" uuid NOT NULL,
	"cantidad_base_consumida_por_unidad" numeric(12, 4) NOT NULL,
	"eliminado_en" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "vinculaciones_producto_receta" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "insumos" ADD CONSTRAINT "insumos_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_insumo" ADD CONSTRAINT "movimientos_insumo_insumo_id_insumos_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_insumo" ADD CONSTRAINT "movimientos_insumo_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "producciones" ADD CONSTRAINT "producciones_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "producciones" ADD CONSTRAINT "producciones_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "producciones" ADD CONSTRAINT "producciones_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "producciones" ADD CONSTRAINT "producciones_activo_id_activos_id_fk" FOREIGN KEY ("activo_id") REFERENCES "public"."activos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "producciones_ajuste" ADD CONSTRAINT "producciones_ajuste_produccion_id_producciones_id_fk" FOREIGN KEY ("produccion_id") REFERENCES "public"."producciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receta_insumos" ADD CONSTRAINT "receta_insumos_receta_id_recetas_id_fk" FOREIGN KEY ("receta_id") REFERENCES "public"."recetas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receta_insumos" ADD CONSTRAINT "receta_insumos_insumo_id_insumos_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recetas" ADD CONSTRAINT "recetas_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_insumo" ADD CONSTRAINT "stock_insumo_insumo_id_insumos_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_insumo" ADD CONSTRAINT "stock_insumo_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vinculaciones_producto_receta" ADD CONSTRAINT "vinculaciones_producto_receta_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vinculaciones_producto_receta" ADD CONSTRAINT "vinculaciones_producto_receta_receta_id_recetas_id_fk" FOREIGN KEY ("receta_id") REFERENCES "public"."recetas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "stock_insumo_insumo_sucursal_unique" ON "stock_insumo" USING btree ("insumo_id","sucursal_id");--> statement-breakpoint
CREATE POLICY "insumos_tenant_select" ON "insumos" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("insumos"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "insumos_tenant_modify" ON "insumos" AS PERMISSIVE FOR ALL TO "authenticated" USING ("insumos"."tenant_id" = (select current_tenant_id())) WITH CHECK ("insumos"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "movimientos_insumo_tenant_select" ON "movimientos_insumo" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("movimientos_insumo"."insumo_id" in (select id from insumos where tenant_id = (select current_tenant_id())));--> statement-breakpoint
CREATE POLICY "movimientos_insumo_tenant_modify" ON "movimientos_insumo" AS PERMISSIVE FOR ALL TO "authenticated" USING ("movimientos_insumo"."insumo_id" in (select id from insumos where tenant_id = (select current_tenant_id()))) WITH CHECK ("movimientos_insumo"."insumo_id" in (select id from insumos where tenant_id = (select current_tenant_id())));--> statement-breakpoint
CREATE POLICY "producciones_tenant_select" ON "producciones" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("producciones"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "producciones_tenant_modify" ON "producciones" AS PERMISSIVE FOR ALL TO "authenticated" USING ("producciones"."tenant_id" = (select current_tenant_id())) WITH CHECK ("producciones"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "producciones_ajuste_tenant_select" ON "producciones_ajuste" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("producciones_ajuste"."produccion_id" in (select id from producciones where tenant_id = (select current_tenant_id())));--> statement-breakpoint
CREATE POLICY "producciones_ajuste_tenant_modify" ON "producciones_ajuste" AS PERMISSIVE FOR ALL TO "authenticated" USING ("producciones_ajuste"."produccion_id" in (select id from producciones where tenant_id = (select current_tenant_id()))) WITH CHECK ("producciones_ajuste"."produccion_id" in (select id from producciones where tenant_id = (select current_tenant_id())));--> statement-breakpoint
CREATE POLICY "receta_insumos_tenant_select" ON "receta_insumos" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("receta_insumos"."receta_id" in (select id from recetas where tenant_id = (select current_tenant_id())));--> statement-breakpoint
CREATE POLICY "receta_insumos_tenant_modify" ON "receta_insumos" AS PERMISSIVE FOR ALL TO "authenticated" USING ("receta_insumos"."receta_id" in (select id from recetas where tenant_id = (select current_tenant_id()))) WITH CHECK ("receta_insumos"."receta_id" in (select id from recetas where tenant_id = (select current_tenant_id())));--> statement-breakpoint
CREATE POLICY "recetas_tenant_select" ON "recetas" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("recetas"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "recetas_tenant_modify" ON "recetas" AS PERMISSIVE FOR ALL TO "authenticated" USING ("recetas"."tenant_id" = (select current_tenant_id())) WITH CHECK ("recetas"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "stock_insumo_tenant_select" ON "stock_insumo" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("stock_insumo"."insumo_id" in (select id from insumos where tenant_id = (select current_tenant_id())));--> statement-breakpoint
CREATE POLICY "stock_insumo_tenant_modify" ON "stock_insumo" AS PERMISSIVE FOR ALL TO "authenticated" USING ("stock_insumo"."insumo_id" in (select id from insumos where tenant_id = (select current_tenant_id()))) WITH CHECK ("stock_insumo"."insumo_id" in (select id from insumos where tenant_id = (select current_tenant_id())));--> statement-breakpoint
CREATE POLICY "vinculaciones_producto_receta_tenant_select" ON "vinculaciones_producto_receta" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("vinculaciones_producto_receta"."receta_id" in (select id from recetas where tenant_id = (select current_tenant_id())));--> statement-breakpoint
CREATE POLICY "vinculaciones_producto_receta_tenant_modify" ON "vinculaciones_producto_receta" AS PERMISSIVE FOR ALL TO "authenticated" USING ("vinculaciones_producto_receta"."receta_id" in (select id from recetas where tenant_id = (select current_tenant_id()))) WITH CHECK ("vinculaciones_producto_receta"."receta_id" in (select id from recetas where tenant_id = (select current_tenant_id())));