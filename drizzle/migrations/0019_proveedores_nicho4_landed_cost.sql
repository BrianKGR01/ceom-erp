CREATE TYPE "public"."estado_compra" AS ENUM('pedido', 'recibido');--> statement-breakpoint
ALTER TABLE "compras" ALTER COLUMN "item_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "compras" ADD COLUMN "insumo_id" uuid;--> statement-breakpoint
ALTER TABLE "compras" ADD COLUMN "producto_id" uuid;--> statement-breakpoint
ALTER TABLE "compras" ADD COLUMN "costo_adicional_traslado" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "compras" ADD COLUMN "estado" "estado_compra" DEFAULT 'recibido' NOT NULL;--> statement-breakpoint
ALTER TABLE "compras" ADD COLUMN "fecha_recepcion" date;--> statement-breakpoint
ALTER TABLE "compras" ADD CONSTRAINT "compras_insumo_id_insumos_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras" ADD CONSTRAINT "compras_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras" ADD CONSTRAINT "compras_item_segun_tipo" CHECK (("compras"."tipo" = 'insumo' and "compras"."insumo_id" is not null and "compras"."producto_id" is null)
          or ("compras"."tipo" = 'reventa' and "compras"."producto_id" is not null and "compras"."insumo_id" is null));