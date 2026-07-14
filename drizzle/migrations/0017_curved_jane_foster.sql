CREATE TYPE "public"."estado_codigo_acceso" AS ENUM('activo', 'canjeado', 'revocado');--> statement-breakpoint
CREATE TYPE "public"."estado_solicitud_seguimiento" AS ENUM('pendiente', 'aprobada', 'rechazada');--> statement-breakpoint
CREATE TYPE "public"."tipo_institucion" AS ENUM('universidad', 'incubadora', 'organizacion');--> statement-breakpoint
CREATE TABLE "aprobaciones_tenant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"institucion_id" uuid NOT NULL,
	"modulos_aprobados" "modulo_veedor"[] DEFAULT '{}'::modulo_veedor[] NOT NULL,
	"aprobado_por" uuid NOT NULL,
	"fecha_aprobacion" timestamp with time zone DEFAULT now() NOT NULL,
	"revocado_en" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "aprobaciones_tenant" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cartera_institucional" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institucion_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"cohorte" text,
	"fecha_inicio" date NOT NULL,
	"fecha_fin" date,
	"eliminado_en" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "cartera_institucional" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "codigos_acceso" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"modulos_habilitados" "modulo_veedor"[] DEFAULT '{}'::modulo_veedor[] NOT NULL,
	"codigo" text NOT NULL,
	"estado" "estado_codigo_acceso" DEFAULT 'activo' NOT NULL,
	"creado_por" uuid NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"institucion_id" uuid,
	"canjeado_en" timestamp with time zone,
	"revocado_en" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "codigos_acceso" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "instituciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"tipo" "tipo_institucion" NOT NULL,
	"contacto" text,
	"creado_por" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"eliminado_en" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "instituciones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "logs_acceso_admin_ceom" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_ceom_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"modulo_consultado" "modulo_permiso" NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "logs_acceso_admin_ceom" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "solicitudes_seguimiento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institucion_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"modulos_solicitados" "modulo_veedor"[] DEFAULT '{}'::modulo_veedor[] NOT NULL,
	"estado" "estado_solicitud_seguimiento" DEFAULT 'pendiente' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "solicitudes_seguimiento" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "aprobaciones_tenant" ADD CONSTRAINT "aprobaciones_tenant_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aprobaciones_tenant" ADD CONSTRAINT "aprobaciones_tenant_institucion_id_instituciones_id_fk" FOREIGN KEY ("institucion_id") REFERENCES "public"."instituciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aprobaciones_tenant" ADD CONSTRAINT "aprobaciones_tenant_aprobado_por_usuarios_id_fk" FOREIGN KEY ("aprobado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cartera_institucional" ADD CONSTRAINT "cartera_institucional_institucion_id_instituciones_id_fk" FOREIGN KEY ("institucion_id") REFERENCES "public"."instituciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cartera_institucional" ADD CONSTRAINT "cartera_institucional_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "codigos_acceso" ADD CONSTRAINT "codigos_acceso_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "codigos_acceso" ADD CONSTRAINT "codigos_acceso_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "codigos_acceso" ADD CONSTRAINT "codigos_acceso_institucion_id_instituciones_id_fk" FOREIGN KEY ("institucion_id") REFERENCES "public"."instituciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logs_acceso_admin_ceom" ADD CONSTRAINT "logs_acceso_admin_ceom_usuario_ceom_id_usuarios_id_fk" FOREIGN KEY ("usuario_ceom_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logs_acceso_admin_ceom" ADD CONSTRAINT "logs_acceso_admin_ceom_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitudes_seguimiento" ADD CONSTRAINT "solicitudes_seguimiento_institucion_id_instituciones_id_fk" FOREIGN KEY ("institucion_id") REFERENCES "public"."instituciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitudes_seguimiento" ADD CONSTRAINT "solicitudes_seguimiento_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "codigos_acceso_codigo_unique" ON "codigos_acceso" USING btree ("codigo");--> statement-breakpoint
CREATE POLICY "aprobaciones_tenant_tenant_select" ON "aprobaciones_tenant" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("aprobaciones_tenant"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "aprobaciones_tenant_tenant_modify" ON "aprobaciones_tenant" AS PERMISSIVE FOR ALL TO "authenticated" USING ("aprobaciones_tenant"."tenant_id" = (select current_tenant_id())) WITH CHECK ("aprobaciones_tenant"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "cartera_institucional_tenant_select" ON "cartera_institucional" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("cartera_institucional"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "cartera_institucional_tenant_modify" ON "cartera_institucional" AS PERMISSIVE FOR ALL TO "authenticated" USING ("cartera_institucional"."tenant_id" = (select current_tenant_id())) WITH CHECK ("cartera_institucional"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "codigos_acceso_tenant_select" ON "codigos_acceso" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("codigos_acceso"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "codigos_acceso_tenant_modify" ON "codigos_acceso" AS PERMISSIVE FOR ALL TO "authenticated" USING ("codigos_acceso"."tenant_id" = (select current_tenant_id())) WITH CHECK ("codigos_acceso"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "instituciones_select_authenticated" ON "instituciones" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "solicitudes_seguimiento_tenant_select" ON "solicitudes_seguimiento" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("solicitudes_seguimiento"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "solicitudes_seguimiento_tenant_modify" ON "solicitudes_seguimiento" AS PERMISSIVE FOR ALL TO "authenticated" USING ("solicitudes_seguimiento"."tenant_id" = (select current_tenant_id())) WITH CHECK ("solicitudes_seguimiento"."tenant_id" = (select current_tenant_id()));