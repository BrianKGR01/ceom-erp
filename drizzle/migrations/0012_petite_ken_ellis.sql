CREATE TYPE "public"."origen_costo" AS ENUM('manual', 'nicho_sugerido', 'proveedor_reventa');--> statement-breakpoint
CREATE TYPE "public"."tipo_movimiento_stock" AS ENUM('entrada_produccion', 'entrada_compra_reventa', 'entrada_ajuste_manual', 'salida_venta', 'salida_merma', 'salida_ajuste_manual', 'salida_transferencia', 'entrada_transferencia');--> statement-breakpoint
CREATE TYPE "public"."tipo_origen_producto" AS ENUM('produccion_nicho', 'reventa_simple', 'manual');--> statement-breakpoint
CREATE TYPE "public"."unidad_venta" AS ENUM('unidad', 'kg', 'g', 'l', 'ml', 'docena');--> statement-breakpoint
CREATE TABLE "categorias_producto" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"categoria_sugerida_id" uuid,
	"eliminado_en" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "categorias_producto" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "categorias_sugeridas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nicho_id" uuid,
	"nombre" text NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categorias_sugeridas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "movimientos_stock" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"producto_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"tipo" "tipo_movimiento_stock" NOT NULL,
	"cantidad" numeric(12, 2) NOT NULL,
	"motivo" text,
	"referencia_id" uuid,
	"creado_por" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "movimientos_stock" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "productos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"categoria_id" uuid,
	"nombre" text NOT NULL,
	"imagen_url" text,
	"unidad_venta" "unidad_venta" NOT NULL,
	"precio_venta" numeric(12, 2) NOT NULL,
	"costo_operativo_vigente" numeric(12, 4),
	"origen_costo" "origen_costo" DEFAULT 'manual' NOT NULL,
	"tipo_origen_producto" "tipo_origen_producto" DEFAULT 'manual' NOT NULL,
	"fecha_vencimiento_referencia" date,
	"vida_util_dias" integer,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_por" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"modificado_por" uuid,
	"modificado_en" timestamp with time zone,
	"eliminado_en" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "productos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stock" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"producto_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"cantidad_actual" numeric(12, 2) DEFAULT '0' NOT NULL,
	"stock_minimo" numeric(12, 2),
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stock" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "categorias_producto" ADD CONSTRAINT "categorias_producto_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorias_producto" ADD CONSTRAINT "categorias_producto_categoria_sugerida_id_categorias_sugeridas_id_fk" FOREIGN KEY ("categoria_sugerida_id") REFERENCES "public"."categorias_sugeridas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_categoria_id_categorias_producto_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias_producto"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock" ADD CONSTRAINT "stock_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock" ADD CONSTRAINT "stock_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "stock_producto_sucursal_unique" ON "stock" USING btree ("producto_id","sucursal_id");--> statement-breakpoint
CREATE POLICY "categorias_producto_tenant_select" ON "categorias_producto" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("categorias_producto"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "categorias_producto_tenant_modify" ON "categorias_producto" AS PERMISSIVE FOR ALL TO "authenticated" USING ("categorias_producto"."tenant_id" = (select current_tenant_id())) WITH CHECK ("categorias_producto"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "categorias_sugeridas_select_authenticated" ON "categorias_sugeridas" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "movimientos_stock_tenant_select" ON "movimientos_stock" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("movimientos_stock"."producto_id" in (select id from productos where tenant_id = (select current_tenant_id())));--> statement-breakpoint
CREATE POLICY "movimientos_stock_tenant_modify" ON "movimientos_stock" AS PERMISSIVE FOR ALL TO "authenticated" USING ("movimientos_stock"."producto_id" in (select id from productos where tenant_id = (select current_tenant_id()))) WITH CHECK ("movimientos_stock"."producto_id" in (select id from productos where tenant_id = (select current_tenant_id())));--> statement-breakpoint
CREATE POLICY "productos_tenant_select" ON "productos" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("productos"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "productos_tenant_modify" ON "productos" AS PERMISSIVE FOR ALL TO "authenticated" USING ("productos"."tenant_id" = (select current_tenant_id())) WITH CHECK ("productos"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "stock_tenant_select" ON "stock" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("stock"."producto_id" in (select id from productos where tenant_id = (select current_tenant_id())));--> statement-breakpoint
CREATE POLICY "stock_tenant_modify" ON "stock" AS PERMISSIVE FOR ALL TO "authenticated" USING ("stock"."producto_id" in (select id from productos where tenant_id = (select current_tenant_id()))) WITH CHECK ("stock"."producto_id" in (select id from productos where tenant_id = (select current_tenant_id())));