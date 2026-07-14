-- Backfill de seguridad antes de agregar la FK: hoy no afecta ninguna fila
-- real (el unico tenant existente es CEOM Ops, que se excluye a proposito
-- porque no es un cliente comercial), pero evita romper si hubiera datos
-- sin plan_id asignado.
UPDATE "tenants" SET "plan_id" = '7089dbcc-3eb7-479e-8176-eef3bbfdae68'
  WHERE "plan_id" IS NULL AND "id" <> '4ee580bc-14d8-49a4-b8c9-468569467f2f';
--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_plan_id_planes_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."planes"("id") ON DELETE no action ON UPDATE no action;