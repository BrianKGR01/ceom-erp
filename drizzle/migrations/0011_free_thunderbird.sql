CREATE TYPE "public"."estado_pago_compra" AS ENUM('pendiente', 'parcial', 'pagado');--> statement-breakpoint
CREATE TYPE "public"."tipo_ajuste_compra" AS ENUM('correccion', 'devolucion_a_proveedor', 'anulacion_total');--> statement-breakpoint
CREATE TYPE "public"."tipo_compra" AS ENUM('insumo', 'reventa');--> statement-breakpoint
CREATE TABLE "compras" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"proveedor_id" uuid,
	"tipo" "tipo_compra" NOT NULL,
	"item_id" uuid NOT NULL,
	"cantidad" numeric(12, 2) NOT NULL,
	"costo_unitario" numeric(12, 4) NOT NULL,
	"monto_total" numeric(12, 2) NOT NULL,
	"fecha_compra" date NOT NULL,
	"fecha_vencimiento" date,
	"estado_pago" "estado_pago_compra" DEFAULT 'pendiente' NOT NULL,
	"creado_por" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"eliminado_en" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "compras" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "compras_ajuste" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"compra_id" uuid NOT NULL,
	"tipo" "tipo_ajuste_compra" NOT NULL,
	"monto_ajuste" numeric(12, 2) NOT NULL,
	"motivo" text NOT NULL,
	"creado_por" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "compras_ajuste" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pagos_compra" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"compra_id" uuid NOT NULL,
	"monto" numeric(12, 2) NOT NULL,
	"fecha_pago" date NOT NULL,
	"creado_por" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pagos_compra" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "proveedores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"contacto" text,
	"notas" text,
	"creado_por" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"eliminado_en" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "proveedores" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "compras" ADD CONSTRAINT "compras_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras" ADD CONSTRAINT "compras_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras" ADD CONSTRAINT "compras_proveedor_id_proveedores_id_fk" FOREIGN KEY ("proveedor_id") REFERENCES "public"."proveedores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras_ajuste" ADD CONSTRAINT "compras_ajuste_compra_id_compras_id_fk" FOREIGN KEY ("compra_id") REFERENCES "public"."compras"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos_compra" ADD CONSTRAINT "pagos_compra_compra_id_compras_id_fk" FOREIGN KEY ("compra_id") REFERENCES "public"."compras"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proveedores" ADD CONSTRAINT "proveedores_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "compras_tenant_select" ON "compras" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("compras"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "compras_tenant_modify" ON "compras" AS PERMISSIVE FOR ALL TO "authenticated" USING ("compras"."tenant_id" = (select current_tenant_id())) WITH CHECK ("compras"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "compras_ajuste_tenant_select" ON "compras_ajuste" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("compras_ajuste"."compra_id" in (select id from compras where tenant_id = (select current_tenant_id())));--> statement-breakpoint
CREATE POLICY "compras_ajuste_tenant_modify" ON "compras_ajuste" AS PERMISSIVE FOR ALL TO "authenticated" USING ("compras_ajuste"."compra_id" in (select id from compras where tenant_id = (select current_tenant_id()))) WITH CHECK ("compras_ajuste"."compra_id" in (select id from compras where tenant_id = (select current_tenant_id())));--> statement-breakpoint
CREATE POLICY "pagos_compra_tenant_select" ON "pagos_compra" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("pagos_compra"."compra_id" in (select id from compras where tenant_id = (select current_tenant_id())));--> statement-breakpoint
CREATE POLICY "pagos_compra_tenant_modify" ON "pagos_compra" AS PERMISSIVE FOR ALL TO "authenticated" USING ("pagos_compra"."compra_id" in (select id from compras where tenant_id = (select current_tenant_id()))) WITH CHECK ("pagos_compra"."compra_id" in (select id from compras where tenant_id = (select current_tenant_id())));--> statement-breakpoint
CREATE POLICY "proveedores_tenant_select" ON "proveedores" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("proveedores"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "proveedores_tenant_modify" ON "proveedores" AS PERMISSIVE FOR ALL TO "authenticated" USING ("proveedores"."tenant_id" = (select current_tenant_id())) WITH CHECK ("proveedores"."tenant_id" = (select current_tenant_id()));