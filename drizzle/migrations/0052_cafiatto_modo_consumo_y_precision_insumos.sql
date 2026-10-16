CREATE TYPE "public"."modo_consumo_receta" AS ENUM('al_producir', 'al_vender');--> statement-breakpoint
ALTER TABLE "movimientos_insumo" ALTER COLUMN "cantidad" SET DATA TYPE numeric(14, 4);--> statement-breakpoint
ALTER TABLE "stock_insumo" ALTER COLUMN "cantidad_actual" SET DATA TYPE numeric(14, 4);--> statement-breakpoint
ALTER TABLE "stock_insumo" ALTER COLUMN "cantidad_actual" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "vinculaciones_producto_receta" ADD COLUMN "modo_consumo" "modo_consumo_receta" DEFAULT 'al_producir' NOT NULL;