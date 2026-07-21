-- Custom SQL migration file, put your code below! --

-- Etapa 3 del backstop de RLS (docs/security/PLAN-RLS-BACKSTOP.md §10.3,
-- sub-etapa 3.a): funcion de bypass para el rol ceom_admin. Mismo patron
-- exacto que current_tenant_id() (0025_fix_current_tenant_id_security_definer.sql):
-- STABLE SECURITY DEFINER, sin argumentos, search_path fijo -- corre "como
-- postgres" (dueño de usuarios/roles), asi que su lectura interna de esas
-- tablas no evalua RLS (ninguna de las dos tiene FORCE ROW LEVEL SECURITY
-- hoy, verificado en vivo) -- no hay recursion. Ver el comentario "REGLA
-- DURA" en identidad/schema.ts (roles/usuarios/permisos*): esta funcion
-- nunca debe aparecer en un OR dentro de la propia policy de esas tablas,
-- o el dia que reciban FORCE la recursion se vuelve real.
--
-- Replica exactamente el chequeo doble que ya usa tienePermiso() (identidad/
-- actions.ts) y que la Etapa 3 unifico en los 4 requiereCeomAdmin() locales
-- que todavia no lo tenian (Suscripcion/Consentimiento/Gastos/Productos):
-- esRolSistema && rolId = ROL_CEOM_ADMIN_ID -- un chequeo mas laxo
-- introduciria una asimetria real entre lo que la app ya permite y lo que
-- la policy permitiria.
--
-- Filtro nuevo respecto al diseño original propuesto en §2.3 del plan
-- (gap encontrado en el diagnostico de Etapa 3, §10.0/§10.3): exige ademas
-- que el usuario no este soft-eliminado y este activo -- sin esto, un
-- ceom_admin desactivado conservaria el bypass total indefinidamente.
-- current_tenant_id() ya filtra eliminado_en; activo es defensa en
-- profundidad adicional que current_tenant_id() no necesita (un usuario
-- inactivo en su propio tenant sigue viendo su propio tenant igual, ese no
-- es el problema; un ceom_admin inactivo con bypass cross-tenant si lo es).
create function public.es_ceom_admin() returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.usuarios u
    join public.roles r on r.id = u.rol_id
    where u.id = auth.uid()
      and u.eliminado_en is null
      and u.activo
      and r.id = 'c1027307-fc75-4517-b2af-9687234c694d' -- ROL_CEOM_ADMIN_ID
      and r.es_rol_sistema
  )
$$;

-- Mismo criterio ya aplicado a current_tenant_id() (0028_revoke_current_tenant_id_execute_anon.sql),
-- desde el dia uno en vez de revocarlo despues: "anon"/"public" no tienen
-- ningun uso legitimo de este chequeo (sin sesion, auth.uid() es null y la
-- funcion devuelve false igual, pero es superficie de API sin uso real).
revoke all on function public.es_ceom_admin() from public, anon;
grant execute on function public.es_ceom_admin() to authenticated;
