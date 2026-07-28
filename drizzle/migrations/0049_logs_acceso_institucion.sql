CREATE TABLE "logs_acceso_institucion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institucion_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"modulo" "modulo_veedor" NOT NULL,
	"dia" date NOT NULL,
	"consultas" integer DEFAULT 1 NOT NULL,
	"primera_consulta_en" timestamp with time zone DEFAULT now() NOT NULL,
	"ultima_consulta_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "logs_acceso_institucion" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "logs_acceso_institucion" ADD CONSTRAINT "logs_acceso_institucion_institucion_id_instituciones_id_fk" FOREIGN KEY ("institucion_id") REFERENCES "public"."instituciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logs_acceso_institucion" ADD CONSTRAINT "logs_acceso_institucion_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "logs_acceso_institucion_dia_unico" ON "logs_acceso_institucion" USING btree ("institucion_id","tenant_id","modulo","dia");--> statement-breakpoint
CREATE POLICY "logs_acceso_institucion_tenant_select" ON "logs_acceso_institucion" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("logs_acceso_institucion"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "logs_acceso_institucion_tenant_modify" ON "logs_acceso_institucion" AS PERMISSIVE FOR ALL TO "authenticated" USING ("logs_acceso_institucion"."tenant_id" = (select current_tenant_id())) WITH CHECK ("logs_acceso_institucion"."tenant_id" = (select current_tenant_id()));