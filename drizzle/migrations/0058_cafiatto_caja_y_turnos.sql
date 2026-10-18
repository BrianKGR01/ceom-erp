CREATE TYPE "public"."estado_turno_caja" AS ENUM('abierto', 'cerrado');--> statement-breakpoint
CREATE TYPE "public"."tipo_movimiento_caja" AS ENUM('entrada', 'salida');--> statement-breakpoint
CREATE TABLE "cajas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"eliminado_en" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "cajas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "configuracion_caja" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"habilitada" boolean DEFAULT false NOT NULL,
	"exigir_turno" boolean DEFAULT true NOT NULL,
	"modificado_por" uuid,
	"modificado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "configuracion_caja" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "movimientos_caja" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"turno_id" uuid NOT NULL,
	"tipo" "tipo_movimiento_caja" NOT NULL,
	"monto" numeric(12, 2) NOT NULL,
	"motivo" text NOT NULL,
	"creado_por" uuid NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "movimientos_caja_monto_chk" CHECK ("movimientos_caja"."monto" > 0)
);
--> statement-breakpoint
ALTER TABLE "movimientos_caja" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "turnos_caja" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"caja_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	"estado" "estado_turno_caja" DEFAULT 'abierto' NOT NULL,
	"abierto_por" uuid NOT NULL,
	"abierto_en" timestamp with time zone DEFAULT now() NOT NULL,
	"fondo_inicial" numeric(12, 2) NOT NULL,
	"cerrado_por" uuid,
	"cerrado_en" timestamp with time zone,
	"ventas_cantidad" integer,
	"ventas_total" numeric(12, 2),
	"totales_por_medio" jsonb,
	"efectivo_esperado" numeric(12, 2),
	"efectivo_contado" numeric(12, 2),
	"diferencia" numeric(12, 2),
	"observaciones" text,
	CONSTRAINT "turnos_caja_fondo_chk" CHECK ("turnos_caja"."fondo_inicial" >= 0),
	CONSTRAINT "turnos_caja_cierre_chk" CHECK (("turnos_caja"."estado" = 'abierto' and "turnos_caja"."cerrado_en" is null)
        or ("turnos_caja"."estado" = 'cerrado' and "turnos_caja"."cerrado_en" is not null and "turnos_caja"."efectivo_contado" is not null))
);
--> statement-breakpoint
ALTER TABLE "turnos_caja" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cajas" ADD CONSTRAINT "cajas_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cajas" ADD CONSTRAINT "cajas_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "configuracion_caja" ADD CONSTRAINT "configuracion_caja_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_turno_id_turnos_caja_id_fk" FOREIGN KEY ("turno_id") REFERENCES "public"."turnos_caja"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turnos_caja" ADD CONSTRAINT "turnos_caja_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turnos_caja" ADD CONSTRAINT "turnos_caja_caja_id_cajas_id_fk" FOREIGN KEY ("caja_id") REFERENCES "public"."cajas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "configuracion_caja_tenant_uq" ON "configuracion_caja" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "turnos_caja_un_abierto_por_caja_uq" ON "turnos_caja" USING btree ("caja_id") WHERE "turnos_caja"."estado" = 'abierto';--> statement-breakpoint
CREATE UNIQUE INDEX "turnos_caja_numero_uq" ON "turnos_caja" USING btree ("tenant_id","numero");--> statement-breakpoint
CREATE POLICY "cajas_tenant_select" ON "cajas" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("cajas"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "cajas_tenant_modify" ON "cajas" AS PERMISSIVE FOR ALL TO "authenticated" USING ("cajas"."tenant_id" = (select current_tenant_id())) WITH CHECK ("cajas"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "configuracion_caja_tenant_select" ON "configuracion_caja" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("configuracion_caja"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "configuracion_caja_tenant_modify" ON "configuracion_caja" AS PERMISSIVE FOR ALL TO "authenticated" USING ("configuracion_caja"."tenant_id" = (select current_tenant_id())) WITH CHECK ("configuracion_caja"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "movimientos_caja_tenant_select" ON "movimientos_caja" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("movimientos_caja"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "movimientos_caja_tenant_modify" ON "movimientos_caja" AS PERMISSIVE FOR ALL TO "authenticated" USING ("movimientos_caja"."tenant_id" = (select current_tenant_id())) WITH CHECK ("movimientos_caja"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "turnos_caja_tenant_select" ON "turnos_caja" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("turnos_caja"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "turnos_caja_tenant_modify" ON "turnos_caja" AS PERMISSIVE FOR ALL TO "authenticated" USING ("turnos_caja"."tenant_id" = (select current_tenant_id())) WITH CHECK ("turnos_caja"."tenant_id" = (select current_tenant_id()));