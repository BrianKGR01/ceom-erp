CREATE TYPE "public"."estado_evento" AS ENUM('abierto', 'cerrado');--> statement-breakpoint
CREATE TYPE "public"."estado_pago_venta" AS ENUM('pendiente', 'parcial', 'pagado');--> statement-breakpoint
CREATE TYPE "public"."origen_registro_venta" AS ENUM('en_vivo', 'offline_sincronizado', 'importacion_historica');--> statement-breakpoint
CREATE TYPE "public"."tipo_ajuste_venta" AS ENUM('correccion', 'devolucion', 'descuento_posterior', 'anulacion_total');--> statement-breakpoint
CREATE TABLE "ajustes_venta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venta_id" uuid NOT NULL,
	"tipo" "tipo_ajuste_venta" NOT NULL,
	"monto_ajuste" numeric(12, 2) NOT NULL,
	"producto_id" uuid,
	"cantidad_producto_ajustada" numeric(12, 2),
	"motivo" text NOT NULL,
	"creado_por" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ajustes_venta" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "canales_venta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"porcentaje_comision_default" numeric(5, 2),
	"activo" boolean DEFAULT true NOT NULL,
	"eliminado_en" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "canales_venta" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"telefono" text,
	"email" text,
	"primera_compra_en" timestamp with time zone,
	"ultima_compra_en" timestamp with time zone,
	"eliminado_en" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "clientes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "detalles_venta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venta_id" uuid NOT NULL,
	"producto_id" uuid NOT NULL,
	"cantidad" numeric(12, 2) NOT NULL,
	"precio_venta_snapshot" numeric(12, 2) NOT NULL,
	"costo_unitario_snapshot" numeric(12, 4) NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "detalles_venta" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "eventos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"canal_venta_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"porcentaje_comision" numeric(5, 2),
	"fecha_inicio" timestamp with time zone NOT NULL,
	"fecha_fin" timestamp with time zone NOT NULL,
	"estado" "estado_evento" DEFAULT 'abierto' NOT NULL,
	"creado_por" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"cerrado_por" uuid,
	"cerrado_en" timestamp with time zone,
	"eliminado_en" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "eventos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "metodos_pago" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "metodos_pago" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pagos_venta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venta_id" uuid NOT NULL,
	"monto" numeric(12, 2) NOT NULL,
	"metodo_pago_id" uuid NOT NULL,
	"fecha_pago" timestamp with time zone NOT NULL,
	"creado_por" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pagos_venta" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ventas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"cliente_id" uuid,
	"fecha_venta" timestamp with time zone NOT NULL,
	"canal_venta_id" uuid NOT NULL,
	"evento_id" uuid,
	"origen_registro" "origen_registro_venta" DEFAULT 'en_vivo' NOT NULL,
	"estado_pago" "estado_pago_venta" DEFAULT 'pendiente' NOT NULL,
	"comision_porcentaje_aplicado" numeric(5, 2),
	"comision_monto_calculado" numeric(12, 2),
	"creado_por" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"modificado_por" uuid,
	"modificado_en" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "ventas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ajustes_venta" ADD CONSTRAINT "ajustes_venta_venta_id_ventas_id_fk" FOREIGN KEY ("venta_id") REFERENCES "public"."ventas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ajustes_venta" ADD CONSTRAINT "ajustes_venta_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canales_venta" ADD CONSTRAINT "canales_venta_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detalles_venta" ADD CONSTRAINT "detalles_venta_venta_id_ventas_id_fk" FOREIGN KEY ("venta_id") REFERENCES "public"."ventas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detalles_venta" ADD CONSTRAINT "detalles_venta_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_canal_venta_id_canales_venta_id_fk" FOREIGN KEY ("canal_venta_id") REFERENCES "public"."canales_venta"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metodos_pago" ADD CONSTRAINT "metodos_pago_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos_venta" ADD CONSTRAINT "pagos_venta_venta_id_ventas_id_fk" FOREIGN KEY ("venta_id") REFERENCES "public"."ventas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos_venta" ADD CONSTRAINT "pagos_venta_metodo_pago_id_metodos_pago_id_fk" FOREIGN KEY ("metodo_pago_id") REFERENCES "public"."metodos_pago"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_canal_venta_id_canales_venta_id_fk" FOREIGN KEY ("canal_venta_id") REFERENCES "public"."canales_venta"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_evento_id_eventos_id_fk" FOREIGN KEY ("evento_id") REFERENCES "public"."eventos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "ajustes_venta_tenant_select" ON "ajustes_venta" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("ajustes_venta"."venta_id" in (select id from ventas where tenant_id = (select current_tenant_id())));--> statement-breakpoint
CREATE POLICY "ajustes_venta_tenant_modify" ON "ajustes_venta" AS PERMISSIVE FOR ALL TO "authenticated" USING ("ajustes_venta"."venta_id" in (select id from ventas where tenant_id = (select current_tenant_id()))) WITH CHECK ("ajustes_venta"."venta_id" in (select id from ventas where tenant_id = (select current_tenant_id())));--> statement-breakpoint
CREATE POLICY "canales_venta_tenant_select" ON "canales_venta" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("canales_venta"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "canales_venta_tenant_modify" ON "canales_venta" AS PERMISSIVE FOR ALL TO "authenticated" USING ("canales_venta"."tenant_id" = (select current_tenant_id())) WITH CHECK ("canales_venta"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "clientes_tenant_select" ON "clientes" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("clientes"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "clientes_tenant_modify" ON "clientes" AS PERMISSIVE FOR ALL TO "authenticated" USING ("clientes"."tenant_id" = (select current_tenant_id())) WITH CHECK ("clientes"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "detalles_venta_tenant_select" ON "detalles_venta" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("detalles_venta"."venta_id" in (select id from ventas where tenant_id = (select current_tenant_id())));--> statement-breakpoint
CREATE POLICY "detalles_venta_tenant_modify" ON "detalles_venta" AS PERMISSIVE FOR ALL TO "authenticated" USING ("detalles_venta"."venta_id" in (select id from ventas where tenant_id = (select current_tenant_id()))) WITH CHECK ("detalles_venta"."venta_id" in (select id from ventas where tenant_id = (select current_tenant_id())));--> statement-breakpoint
CREATE POLICY "eventos_tenant_select" ON "eventos" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("eventos"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "eventos_tenant_modify" ON "eventos" AS PERMISSIVE FOR ALL TO "authenticated" USING ("eventos"."tenant_id" = (select current_tenant_id())) WITH CHECK ("eventos"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "metodos_pago_tenant_select" ON "metodos_pago" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("metodos_pago"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "metodos_pago_tenant_modify" ON "metodos_pago" AS PERMISSIVE FOR ALL TO "authenticated" USING ("metodos_pago"."tenant_id" = (select current_tenant_id())) WITH CHECK ("metodos_pago"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "pagos_venta_tenant_select" ON "pagos_venta" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("pagos_venta"."venta_id" in (select id from ventas where tenant_id = (select current_tenant_id())));--> statement-breakpoint
CREATE POLICY "pagos_venta_tenant_modify" ON "pagos_venta" AS PERMISSIVE FOR ALL TO "authenticated" USING ("pagos_venta"."venta_id" in (select id from ventas where tenant_id = (select current_tenant_id()))) WITH CHECK ("pagos_venta"."venta_id" in (select id from ventas where tenant_id = (select current_tenant_id())));--> statement-breakpoint
CREATE POLICY "ventas_tenant_select" ON "ventas" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("ventas"."tenant_id" = (select current_tenant_id()));--> statement-breakpoint
CREATE POLICY "ventas_tenant_modify" ON "ventas" AS PERMISSIVE FOR ALL TO "authenticated" USING ("ventas"."tenant_id" = (select current_tenant_id())) WITH CHECK ("ventas"."tenant_id" = (select current_tenant_id()));