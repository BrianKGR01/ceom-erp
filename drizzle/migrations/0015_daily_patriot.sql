CREATE TYPE "public"."estado_pago_gasto" AS ENUM('pendiente', 'parcial', 'pagado');--> statement-breakpoint
CREATE TYPE "public"."origen_gasto" AS ENUM('manual', 'comision_venta_automatica', 'cuota_pasivo_automatica');--> statement-breakpoint
CREATE TYPE "public"."tipo_gasto" AS ENUM('fijo', 'variable_no_productivo', 'unico');--> statement-breakpoint
CREATE TABLE "categorias_gasto" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"categoria_gasto_sugerida_id" uuid,
	"eliminado_en" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "categorias_gasto" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "categorias_gasto_sugeridas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nicho_id" uuid,
	"nombre" text NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categorias_gasto_sugeridas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gastos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sucursal_id" uuid,
	"tipo" "tipo_gasto" NOT NULL,
	"categoria_id" uuid NOT NULL,
	"monto" numeric(12, 2) NOT NULL,
	"fecha_gasto" date NOT NULL,
	"proveedor_id" uuid,
	"origen" "origen_gasto" DEFAULT 'manual' NOT NULL,
	"estado_pago" "estado_pago_gasto" DEFAULT 'pendiente' NOT NULL,
	"referencia_id" uuid,
	"descripcion" text,
	"creado_por" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"modificado_por" uuid,
	"modificado_en" timestamp with time zone,
	"eliminado_en" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "gastos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gastos_recurrentes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sucursal_id" uuid,
	"categoria_id" uuid NOT NULL,
	"monto" numeric(12, 2) NOT NULL,
	"frecuencia" "frecuencia_cuota" NOT NULL,
	"fecha_inicio" date NOT NULL,
	"fecha_fin" date,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_por" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gastos_recurrentes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pagos_gasto" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gasto_id" uuid NOT NULL,
	"monto" numeric(12, 2) NOT NULL,
	"fecha_pago" date NOT NULL,
	"creado_por" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pagos_gasto" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "categorias_gasto" ADD CONSTRAINT "categorias_gasto_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorias_gasto" ADD CONSTRAINT "categorias_gasto_categoria_gasto_sugerida_id_categorias_gasto_sugeridas_id_fk" FOREIGN KEY ("categoria_gasto_sugerida_id") REFERENCES "public"."categorias_gasto_sugeridas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_categoria_id_categorias_gasto_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias_gasto"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_proveedor_id_proveedores_id_fk" FOREIGN KEY ("proveedor_id") REFERENCES "public"."proveedores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos_recurrentes" ADD CONSTRAINT "gastos_recurrentes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos_recurrentes" ADD CONSTRAINT "gastos_recurrentes_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos_recurrentes" ADD CONSTRAINT "gastos_recurrentes_categoria_id_categorias_gasto_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias_gasto"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos_gasto" ADD CONSTRAINT "pagos_gasto_gasto_id_gastos_id_fk" FOREIGN KEY ("gasto_id") REFERENCES "public"."gastos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "categorias_gasto_tenant_select" ON "categorias_gasto" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("categorias_gasto"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "categorias_gasto_tenant_modify" ON "categorias_gasto" AS PERMISSIVE FOR ALL TO "authenticated" USING ("categorias_gasto"."tenant_id" = (select current_tenant_id())) WITH CHECK ("categorias_gasto"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "categorias_gasto_sugeridas_select_authenticated" ON "categorias_gasto_sugeridas" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "gastos_tenant_select" ON "gastos" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("gastos"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "gastos_tenant_modify" ON "gastos" AS PERMISSIVE FOR ALL TO "authenticated" USING ("gastos"."tenant_id" = (select current_tenant_id())) WITH CHECK ("gastos"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "gastos_recurrentes_tenant_select" ON "gastos_recurrentes" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("gastos_recurrentes"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "gastos_recurrentes_tenant_modify" ON "gastos_recurrentes" AS PERMISSIVE FOR ALL TO "authenticated" USING ("gastos_recurrentes"."tenant_id" = (select current_tenant_id())) WITH CHECK ("gastos_recurrentes"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "pagos_gasto_tenant_select" ON "pagos_gasto" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("pagos_gasto"."gasto_id" in (select id from gastos where tenant_id = (select current_tenant_id())));--> statement-breakpoint
CREATE POLICY "pagos_gasto_tenant_modify" ON "pagos_gasto" AS PERMISSIVE FOR ALL TO "authenticated" USING ("pagos_gasto"."gasto_id" in (select id from gastos where tenant_id = (select current_tenant_id()))) WITH CHECK ("pagos_gasto"."gasto_id" in (select id from gastos where tenant_id = (select current_tenant_id())));