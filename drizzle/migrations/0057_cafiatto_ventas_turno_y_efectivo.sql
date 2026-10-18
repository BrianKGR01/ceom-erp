ALTER TABLE "metodos_pago" ADD COLUMN "es_efectivo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pagos_venta" ADD COLUMN "turno_id" uuid;--> statement-breakpoint
ALTER TABLE "ventas" ADD COLUMN "turno_id" uuid;--> statement-breakpoint
-- Los metodos de pago que ya se llaman Efectivo pasan a contar como efectivo (el resto queda en false).
UPDATE "metodos_pago" SET "es_efectivo" = true WHERE lower(trim("nombre")) IN ('efectivo', 'cash');
