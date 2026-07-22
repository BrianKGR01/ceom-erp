-- Fix de dato previo a la constraint (docs/security/PLAN-RLS-BACKSTOP.md SS16,
-- decision explicita, no limpieza masiva): verificado contra la base real
-- que existe EXACTAMENTE 1 par institucion+tenant con 2 filas no revocadas
-- simultaneas -- fixture de test abandonado de una corrida anterior de
-- consentimiento.test.ts cuyo afterAll no llego a limpiar (nombres
-- "Incubadora Test 1784062124461"/"Consentimiento Test 1784062124461",
-- creado 2026-07-14, mas de una semana antes de esta migracion). Se revoca
-- por id exacto (no por un heuristico "revocar duplicados en masa"), la fila
-- mas vieja de las dos, aplicando retroactivamente la misma regla "la mas
-- reciente manda" que esta migracion vuelve invariante de esquema. Ningun
-- otro par en la base viola la constraint (verificado con GROUP BY/HAVING
-- antes de generar esta migracion).
UPDATE "aprobaciones_tenant"
  SET "revocado_en" = '2026-07-14 20:48:53.814447+00'
  WHERE "id" = '37de58f7-cca8-4cae-b690-0e91c84543ef'
    AND "institucion_id" = '208be342-f2b6-487e-b2c9-05910104089e'
    AND "tenant_id" = 'c80ae512-57f2-4caa-9b98-48dd74a65420'
    AND "revocado_en" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "aprobaciones_tenant_vigente_unica" ON "aprobaciones_tenant" USING btree ("institucion_id","tenant_id") WHERE "aprobaciones_tenant"."revocado_en" is null;