-- H-49 — reancla al dia local los pagos de venta y las producciones que se
-- guardaron a medianoche UTC.
--
-- Por que existe: hasta el commit anterior, `registrarPagoVenta` y
-- `registrarProduccion` convertian la fecha elegida en el formulario con
-- `new Date("YYYY-MM-DD")`, que da medianoche UTC. En Bolivia (UTC-4) eso son
-- las 20:00 del dia ANTERIOR, asi que la fila quedaba guardada un dia antes
-- del que el usuario eligio. Hoy no se nota porque el filtro de los reportes
-- esta roto en la misma direccion y los dos errores se tapan; en cuanto se
-- corrija el filtro (etapa siguiente), estas filas se contarian un dia antes.
--
-- Que NO es esto: no corrige un monto ni edita un saldo — la regla de ledger
-- append-only de CLAUDE.md no aplica. Corrige una zona horaria mal aplicada a
-- un dato de entrada, o sea repara un error de registro en vez de falsificarlo.
-- Decision de producto tomada el 2026-07-27, ver
-- docs/auditoria-prelanzamiento/05-dia-local-y-reportes.md seccion 8, decision 3.
--
-- Alcance medido ANTES de escribir esto, contra la base de desarrollo:
--   pagos_venta   30 filas totales,  8 a corregir (16/22/23/25 de julio 2026)
--   producciones   2 filas totales,  2 a corregir (17 y 23 de julio 2026)
-- Las 10 pertenecen al tenant "Mi Negocio de Prueba". Ningun negocio real.
--
-- El WHERE es deliberadamente estrecho: solo las filas cuya hora UTC es
-- exactamente 00:00:00, que son las que salieron de esa ruta. Las ventas en
-- vivo llevan la hora real y las importadas llevaban mediodia UTC, asi que
-- ninguna entra. Una fila legitima podria caer en 00:00:00 exacto (una venta a
-- las 20:00:00.000 en punto), pero ese caso no existe en los datos medidos.
--
-- La conversion no cablea el -4: toma el dia UTC que el usuario habia elegido y
-- lo reancla al comienzo de ese dia en America/La_Paz, delegandole a Postgres
-- la base de husos. Es la misma semantica que `instanteDeDiaLocal()` en
-- src/lib/periodo.ts.

UPDATE "pagos_venta"
SET "fecha_pago" = (("fecha_pago" AT TIME ZONE 'UTC')::date::timestamp AT TIME ZONE 'America/La_Paz')
WHERE ("fecha_pago" AT TIME ZONE 'UTC')::time = '00:00:00';
--> statement-breakpoint
UPDATE "producciones"
SET "fecha_produccion" = (("fecha_produccion" AT TIME ZONE 'UTC')::date::timestamp AT TIME ZONE 'America/La_Paz')
WHERE ("fecha_produccion" AT TIME ZONE 'UTC')::time = '00:00:00';
