CREATE TYPE "public"."accion_permiso" AS ENUM('ver', 'crear', 'editar', 'anular_ajustar');--> statement-breakpoint
CREATE TYPE "public"."capacidad_especial" AS ENUM('vender_sin_stock', 'gestionar_eventos', 'importar_historico', 'producir_sin_stock_insumo');--> statement-breakpoint
CREATE TYPE "public"."estado_acceso" AS ENUM('activo', 'solo_lectura', 'bloqueado');--> statement-breakpoint
CREATE TYPE "public"."estado_suscripcion" AS ENUM('activa', 'pausada', 'vencida');--> statement-breakpoint
CREATE TYPE "public"."modulo_permiso" AS ENUM('productos', 'inventario', 'ventas', 'costos_gastos', 'patrimonio', 'operativo', 'financiero', 'simulaciones', 'reportes');--> statement-breakpoint
-- auth.users ya existe (lo administra Supabase Auth/GoTrue) — no se crea
-- acá, solo se referencia via FK mas abajo (usuarios_id_users_id_fk).
CREATE TABLE "permisos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rol_id" uuid NOT NULL,
	"modulo" "modulo_permiso" NOT NULL,
	"accion" "accion_permiso" NOT NULL,
	"permitido" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permisos_especiales_por_rol" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rol_id" uuid NOT NULL,
	"capacidad" "capacidad_especial" NOT NULL,
	"habilitado" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permisos_especiales_por_usuario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"capacidad" "capacidad_especial" NOT NULL,
	"habilitado" boolean DEFAULT false NOT NULL,
	"creado_por" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"eliminado_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"nombre" text NOT NULL,
	"es_rol_sistema" boolean DEFAULT false NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"eliminado_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sucursales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"direccion" text,
	"es_principal" boolean DEFAULT false NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"eliminado_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre_negocio" text NOT NULL,
	"ciudad_base" text,
	"moneda_principal" text NOT NULL,
	"logo_url" text,
	"canales_venta" text[] DEFAULT '{}'::text[] NOT NULL,
	"nicho_id" uuid,
	"nicho_asignado_en" timestamp with time zone,
	"plan_id" uuid,
	"estado_suscripcion" "estado_suscripcion" DEFAULT 'activa' NOT NULL,
	"estado_acceso" "estado_acceso" DEFAULT 'activo' NOT NULL,
	"fecha_inicio_suscripcion" date NOT NULL,
	"fecha_proximo_pago" date,
	"creado_por" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"modificado_por" uuid,
	"modificado_en" timestamp with time zone,
	"eliminado_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nombre_completo" text NOT NULL,
	"email" text NOT NULL,
	"telefono" text,
	"rol_id" uuid NOT NULL,
	"es_owner" boolean DEFAULT false NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"ultimo_acceso_en" timestamp with time zone,
	"creado_por" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"modificado_por" uuid,
	"modificado_en" timestamp with time zone,
	"eliminado_en" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "permisos" ADD CONSTRAINT "permisos_rol_id_roles_id_fk" FOREIGN KEY ("rol_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permisos_especiales_por_rol" ADD CONSTRAINT "permisos_especiales_por_rol_rol_id_roles_id_fk" FOREIGN KEY ("rol_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permisos_especiales_por_usuario" ADD CONSTRAINT "permisos_especiales_por_usuario_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sucursales" ADD CONSTRAINT "sucursales_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_rol_id_roles_id_fk" FOREIGN KEY ("rol_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "permisos_rol_modulo_accion_unique" ON "permisos" USING btree ("rol_id","modulo","accion");--> statement-breakpoint
CREATE UNIQUE INDEX "permisos_especiales_rol_capacidad_unique" ON "permisos_especiales_por_rol" USING btree ("rol_id","capacidad");--> statement-breakpoint
CREATE UNIQUE INDEX "permisos_especiales_usuario_capacidad_unique" ON "permisos_especiales_por_usuario" USING btree ("usuario_id","capacidad") WHERE "permisos_especiales_por_usuario"."eliminado_en" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "roles_tenant_nombre_unique" ON "roles" USING btree ("tenant_id","nombre") WHERE "roles"."tenant_id" is not null and "roles"."eliminado_en" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "roles_sistema_nombre_unique" ON "roles" USING btree ("nombre") WHERE "roles"."tenant_id" is null and "roles"."eliminado_en" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "sucursales_tenant_principal_unique" ON "sucursales" USING btree ("tenant_id") WHERE "sucursales"."es_principal" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "usuarios_tenant_email_unique" ON "usuarios" USING btree ("tenant_id","email") WHERE "usuarios"."eliminado_en" is null;