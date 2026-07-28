ALTER TABLE "codigos_acceso" ADD COLUMN "expira_en" timestamp with time zone;
--> statement-breakpoint
-- D-7 (Etapa 3, tanda 3.2): los Codigos de Acceso vencen, con TTL por
-- defecto, no opcional.
--
-- El backfill NO es cosmetico y no se puede omitir: sin el, toda fila
-- anterior a esta migracion queda con expira_en NULL, y una credencial que
-- circula fuera del sistema (WhatsApp, correo, papel) sin fecha de
-- vencimiento es exactamente el defecto que D-7 cierra. Se les aplica el
-- mismo TTL que a las nuevas, contado desde su propia creacion — asi un
-- codigo generado hace ocho meses queda vencido de entrada, que es el
-- comportamiento correcto, no un efecto colateral.
--
-- 30 dias: mismo valor que TTL_CODIGO_ACCESO_DIAS en
-- src/modules/consentimiento/actions.ts. Si se cambia alla, esta migracion
-- NO se toca (ya se aplico) — el valor viejo queda como historia de las
-- filas que existian ese dia.
UPDATE "codigos_acceso"
SET "expira_en" = "creado_en" + interval '30 days'
WHERE "expira_en" IS NULL;
