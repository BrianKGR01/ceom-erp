CREATE TYPE "public"."estado_activo" AS ENUM('activo', 'en_mantenimiento', 'dado_de_baja');--> statement-breakpoint
CREATE TYPE "public"."estado_pasivo" AS ENUM('activo', 'pagado', 'refinanciado');--> statement-breakpoint
CREATE TYPE "public"."frecuencia_cuota" AS ENUM('mensual', 'semanal', 'quincenal', 'anual');--> statement-breakpoint
CREATE TYPE "public"."origen_pago_pasivo" AS ENUM('automatico', 'manual');--> statement-breakpoint
CREATE TYPE "public"."tipo_activo" AS ENUM('equipo_productivo', 'mobiliario', 'vehiculo', 'otro');--> statement-breakpoint
CREATE TABLE "activos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sucursal_id" uuid,
	"nombre" text NOT NULL,
	"tipo" "tipo_activo" NOT NULL,
	"capacidad_produccion_cantidad" numeric(12, 2),
	"capacidad_produccion_unidad" text,
	"capacidad_almacenamiento_cantidad" numeric(12, 2),
	"capacidad_almacenamiento_unidad" text,
	"disponibilidad_horaria_semanal" numeric(6, 2),
	"requiere_descanso_entre_ciclos" boolean DEFAULT false NOT NULL,
	"tiempo_descanso_minutos" numeric(8, 2),
	"tiempo_estimado_por_ciclo_minutos" numeric(8, 2),
	"estado" "estado_activo" DEFAULT 'activo' NOT NULL,
	"valor_compra" numeric(12, 2) NOT NULL,
	"fecha_adquisicion" date NOT NULL,
	"vida_util_meses" numeric(6, 2),
	"proveedor_id" uuid,
	"numero_serie" text,
	"vencimiento_garantia" date,
	"creado_por" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"modificado_por" uuid,
	"modificado_en" timestamp with time zone,
	"eliminado_en" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "activos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pagos_pasivo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pasivo_id" uuid NOT NULL,
	"monto" numeric(12, 2) NOT NULL,
	"fecha_pago" date NOT NULL,
	"origen" "origen_pago_pasivo" NOT NULL,
	"creado_por" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pagos_pasivo" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pasivos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"activo_id" uuid,
	"monto_total" numeric(12, 2) NOT NULL,
	"cuota_periodica" numeric(12, 2) NOT NULL,
	"frecuencia_cuota" "frecuencia_cuota" NOT NULL,
	"plazo_cuotas" integer NOT NULL,
	"fecha_inicio" date NOT NULL,
	"estado" "estado_pasivo" DEFAULT 'activo' NOT NULL,
	"refinanciado_desde_id" uuid,
	"creado_por" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"eliminado_en" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "pasivos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "activos" ADD CONSTRAINT "activos_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activos" ADD CONSTRAINT "activos_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos_pasivo" ADD CONSTRAINT "pagos_pasivo_pasivo_id_pasivos_id_fk" FOREIGN KEY ("pasivo_id") REFERENCES "public"."pasivos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pasivos" ADD CONSTRAINT "pasivos_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pasivos" ADD CONSTRAINT "pasivos_activo_id_activos_id_fk" FOREIGN KEY ("activo_id") REFERENCES "public"."activos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pasivos" ADD CONSTRAINT "pasivos_refinanciado_desde_id_pasivos_id_fk" FOREIGN KEY ("refinanciado_desde_id") REFERENCES "public"."pasivos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "activos_tenant_select" ON "activos" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("activos"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "activos_tenant_modify" ON "activos" AS PERMISSIVE FOR ALL TO "authenticated" USING ("activos"."tenant_id" = (select current_tenant_id())) WITH CHECK ("activos"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "pagos_pasivo_tenant_select" ON "pagos_pasivo" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("pagos_pasivo"."pasivo_id" in (select id from pasivos where tenant_id = (select current_tenant_id())));--> statement-breakpoint
CREATE POLICY "pagos_pasivo_tenant_modify" ON "pagos_pasivo" AS PERMISSIVE FOR ALL TO "authenticated" USING ("pagos_pasivo"."pasivo_id" in (select id from pasivos where tenant_id = (select current_tenant_id()))) WITH CHECK ("pagos_pasivo"."pasivo_id" in (select id from pasivos where tenant_id = (select current_tenant_id())));--> statement-breakpoint
CREATE POLICY "pasivos_tenant_select" ON "pasivos" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("pasivos"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "pasivos_tenant_modify" ON "pasivos" AS PERMISSIVE FOR ALL TO "authenticated" USING ("pasivos"."tenant_id" = (select current_tenant_id())) WITH CHECK ("pasivos"."tenant_id" = (select current_tenant_id()));