-- H-02: sucursales multiples — columnas nuevas (expand), backfill, y recien
-- despues NOT NULL (contract). Ver docs/auditoria-prelanzamiento/
-- 07-sucursales-multiples.md seccion 7.2 y identidad/ANCLA.md.

-- sucursales: auditoria (Modulo_01 seccion 2.2, la tabla no la tenia) + freeze
-- de plan (congelada_en/congelada_motivo, sin uso de escritura todavia salvo
-- cambiarPlanTenant()/desbloquearSucursal()/consolidarSucursal()).
ALTER TABLE "sucursales" ADD COLUMN "congelada_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sucursales" ADD COLUMN "congelada_motivo" text;--> statement-breakpoint
ALTER TABLE "sucursales" ADD COLUMN "creado_por" uuid;--> statement-breakpoint
ALTER TABLE "sucursales" ADD COLUMN "creado_en" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "sucursales" ADD COLUMN "modificado_por" uuid;--> statement-breakpoint
ALTER TABLE "sucursales" ADD COLUMN "modificado_en" timestamp with time zone;--> statement-breakpoint

-- usuarios: a que sucursal pertenece el colaborador — estructura para la
-- Etapa 5 (roles), sin filtrado real todavia (ver identidad/schema.ts).
ALTER TABLE "usuarios" ADD COLUMN "sucursal_id" uuid;--> statement-breakpoint

-- planes: tope estructurado de sucursales, reemplaza a incluye_sucursales
-- (todavia presente en esta migracion — se elimina en la 0046, una vez que
-- el codigo de aplicacion ya no lo lee).
ALTER TABLE "planes" ADD COLUMN "max_sucursales" integer;--> statement-breakpoint

ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "public"."sucursales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planes" ADD CONSTRAINT "planes_max_sucursales_check" CHECK ("planes"."max_sucursales" is null or "planes"."max_sucursales" >= 1);--> statement-breakpoint

-- --- Backfill -------------------------------------------------------------

-- sucursales.creado_en: crearTenantConOwner() inserta tenant + sucursal
-- Principal + Owner en la MISMA transaccion (identidad/repository.ts:202-239),
-- asi que tenants.creado_en es exacto como fecha de creacion real de la
-- sucursal Principal de cada tenant existente (hoy la unica sucursal por
-- tenant, confirmado: no existe ningun camino de aplicacion para una 2da
-- antes de esta migracion).
UPDATE "sucursales" s
SET "creado_en" = t."creado_en"
FROM "tenants" t
WHERE s."tenant_id" = t."id" AND s."creado_en" IS NULL;--> statement-breakpoint

-- sucursales.creado_por: mejor aproximacion disponible es el Owner ACTUAL del
-- tenant (es_owner=true) — no hay otra columna que registre "quien creo la
-- sucursal" para las filas historicas. Caveat aceptado y documentado en
-- identidad/ANCLA.md: si el tenant paso por transferirOwner(), esto apunta al
-- Owner vigente, no al fundador original.
UPDATE "sucursales" s
SET "creado_por" = u.id
FROM "tenants" t
LEFT JOIN LATERAL (
  SELECT id FROM "usuarios"
  WHERE "usuarios"."tenant_id" = t."id" AND "usuarios"."es_owner" = true
  LIMIT 1
) u ON true
WHERE s."tenant_id" = t."id" AND s."creado_por" IS NULL;--> statement-breakpoint

-- planes.max_sucursales: incluye_sucursales=false -> 1 (equivalente exacto:
-- toda cuenta ya tiene su Principal, "no incluye multi-sucursal" es
-- matematicamente "tope = 1"). incluye_sucursales=true -> se deja NULL
-- (ilimitado) a proposito — no hay forma de que el codigo decida un numero
-- real, y NULL es el default seguro que no le resta capacidad a un plan que
-- ya prometia "si incluye". Producto/ops corrige el tope real de cada plan
-- activo despues, a mano, desde /admin/planes.
UPDATE "planes" SET "max_sucursales" = 1 WHERE "incluye_sucursales" = false;--> statement-breakpoint

-- --- Contract: recien ahora NOT NULL, con todas las filas ya backfilleadas -
ALTER TABLE "sucursales" ALTER COLUMN "creado_en" SET NOT NULL;
