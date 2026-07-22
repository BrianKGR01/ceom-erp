-- Custom SQL migration file, put your code below! --

-- Etapa 4.b.0 del backstop de RLS (docs/security/PLAN-RLS-BACKSTOP.md §16.9.1):
-- backstop GRUESO por tenant+modulo, sin institucion -- no re-deriva "la mas
-- reciente manda" (esa complejidad ya la absorbe la invariante de esquema de
-- la migracion anterior, 0037_aprobaciones_tenant_vigente_unica: a lo sumo
-- UNA fila no revocada por par institucion+tenant en todo momento, asi que
-- "existe una fila no revocada" ya equivale a "el par tiene consentimiento
-- vigente"). Protege que el Gateway (bajo su identidad de sistema compartida,
-- es_gateway_sistema()) lea un tenant SIN ninguna relacion de consentimiento
-- vigente para el modulo de esa tabla -- el gap real encontrado en §16.1.2:
-- gatewaySistemaBypassPolicy() (Etapa 4.a) no tenia NINGUNA restriccion de
-- tenant.
--
-- Deliberadamente NO distingue QUE institucion pregunta (backstop grueso,
-- §16.9.1 vs §16.9.2) -- bajo la arquitectura real de 4.a (comoGatewaySistema(),
-- identidad de sistema compartida) no existe hoy ningun canal por el que la
-- identidad de la institucion llegue a la sesion de base de datos. Distinguir
-- por institucion es 4.b.1, diferido (§16.9.2/§16.11 decision 2).
--
-- SECURITY DEFINER, misma forma que current_tenant_id()/es_ceom_admin()/
-- es_gateway_sistema() -- corre como dueño (postgres), ignora RLS de
-- aprobaciones_tenant mientras esa tabla no tenga FORCE. REGLA DURA (ver
-- consentimiento/schema.ts, tabla aprobacionesTenant): esta funcion lee
-- aprobaciones_tenant -- esa tabla NUNCA debe recibir una policy que llame a
-- esta funcion sobre si misma, o el dia que reciba FORCE ROW LEVEL SECURITY
-- se crea recursion real (mismo riesgo ya documentado para es_ceom_admin()
-- contra usuarios/roles).
--
-- Costo medido con EXPLAIN ANALYZE real, transaccion con rollback, volumen
-- sintetico de 40k filas (§16.5): a diferencia de current_tenant_id()/
-- es_ceom_admin()/es_gateway_sistema() (sin argumentos, constantes por
-- consulta, hoistean a un InitPlan con el patron "(select ...)"), esta
-- funcion toma tenant_objetivo como argumento -- varia por fila. Envolverla
-- en "(select ...)" NO la hoistea: Postgres la ejecuta como un SubPlan
-- CORRELACIONADO, una vez por fila candidata. Con el filtro de tenant
-- explicito que la app ya trae siempre: ~4ms. Sin filtro (agregado de toda
-- la plataforma, hoy sin ningun caso real en el camino del Gateway): ~450ms
-- a 40k filas. No es un bug corregible con el patron de hoisting de
-- es_ceom_admin() -- es una propiedad estructural de tomar un argumento por
-- fila. Ver el comentario de gatewayVigenciaBypassPolicy() en src/db/rls.ts.
create function public.tenant_tiene_consentimiento_vigente(
  tenant_objetivo uuid, modulo public.modulo_veedor
) returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.aprobaciones_tenant a
    where a.tenant_id = tenant_objetivo
      and a.revocado_en is null
      and modulo = any(a.modulos_aprobados)
  )
$$;

-- Mismo patron de superficie que current_tenant_id()/es_ceom_admin()/
-- es_gateway_sistema() (docs/security/PLAN-RLS-BACKSTOP.md §10.3): nace sin
-- EXECUTE para anon/public desde el dia uno, nunca revocado despues.
revoke all on function public.tenant_tiene_consentimiento_vigente(uuid, public.modulo_veedor) from public, anon;
grant execute on function public.tenant_tiene_consentimiento_vigente(uuid, public.modulo_veedor) to authenticated;