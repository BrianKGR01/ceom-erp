-- Custom SQL migration file, put your code below! --

-- Etapa 2 del backstop de RLS (docs/security/PLAN-RLS-BACKSTOP.md §7,
-- decisión 4): FORCE ROW LEVEL SECURITY en las 4 tablas de Proveedores,
-- al cierre de esta etapa (mismo criterio ya aplicado en el plan, ahora
-- por-módulo en vez de esperar a la Etapa 5 original).
--
-- Por qué hace falta explícitamente: "postgres" (el rol de DATABASE_URL)
-- es dueño de estas tablas, y Postgres ignora RLS por completo para el
-- dueño salvo que la tabla tenga FORCE (§2.4 del plan). Con el mecanismo de
-- comoUsuario() ya activo (SET LOCAL ROLE authenticated dentro de la
-- transacción), el rol efectivo deja de ser "postgres" durante esas
-- queries, así que FORCE no cambia nada para el tráfico real de la app hoy
-- — es hardening barato: cierra la puerta a que alguien vuelva a correr una
-- query de negocio directamente como "postgres" (ej. un script nuevo mal
-- escrito, o un cliente de administración) y la app "se olvide" de todo el
-- mecanismo por accidente.
alter table "proveedores" force row level security;
alter table "compras" force row level security;
alter table "pagos_compra" force row level security;
alter table "compras_ajuste" force row level security;
