CREATE TYPE "public"."motivo_bonificacion" AS ENUM('consumo_personal', 'cortesia');--> statement-breakpoint
CREATE TABLE "bonificaciones_venta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venta_id" uuid NOT NULL,
	"motivo" "motivo_bonificacion" NOT NULL,
	"porcentaje" numeric(5, 2) NOT NULL,
	"monto_bonificado" numeric(12, 2) NOT NULL,
	"beneficiario" text,
	"nota" text,
	"autorizado_por" uuid NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bonificaciones_venta_porcentaje_chk" CHECK ("bonificaciones_venta"."porcentaje" > 0 and "bonificaciones_venta"."porcentaje" <= 100),
	CONSTRAINT "bonificaciones_venta_personal_chk" CHECK ("bonificaciones_venta"."motivo" <> 'consumo_personal' or ("bonificaciones_venta"."porcentaje" = 100 and "bonificaciones_venta"."beneficiario" is not null))
);
--> statement-breakpoint
ALTER TABLE "bonificaciones_venta" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "detalles_venta" ADD COLUMN "descuento_monto" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "bonificaciones_venta" ADD CONSTRAINT "bonificaciones_venta_venta_id_ventas_id_fk" FOREIGN KEY ("venta_id") REFERENCES "public"."ventas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bonificaciones_venta_una_por_venta_uq" ON "bonificaciones_venta" USING btree ("venta_id");--> statement-breakpoint
CREATE POLICY "bonificaciones_venta_tenant_select" ON "bonificaciones_venta" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("bonificaciones_venta"."venta_id" in (select id from ventas where tenant_id = (select current_tenant_id())));--> statement-breakpoint
CREATE POLICY "bonificaciones_venta_tenant_modify" ON "bonificaciones_venta" AS PERMISSIVE FOR ALL TO "authenticated" USING ("bonificaciones_venta"."venta_id" in (select id from ventas where tenant_id = (select current_tenant_id()))) WITH CHECK ("bonificaciones_venta"."venta_id" in (select id from ventas where tenant_id = (select current_tenant_id())));