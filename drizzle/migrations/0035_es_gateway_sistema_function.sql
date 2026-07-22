-- Custom SQL migration file, put your code below! --

-- Etapa 4.a del backstop de RLS (docs/security/PLAN-RLS-BACKSTOP.md
-- §13/§14/§15, Opcion A'): bypass de RLS PROPIO del Gateway de
-- Consentimiento -- NUNCA reusar es_ceom_admin() para este caso (ver §13.3:
-- reusarlo haria que el Gateway heredara automaticamente cualquier bypass
-- de ceom_admin presente o futuro, exactamente la regresion de defensa en
-- profundidad que el usuario pidio evitar).
--
-- Filtra por ID PUNTUAL (u.id = GATEWAY_SISTEMA_USUARIO_ID), NUNCA por rol
-- -- a diferencia de es_ceom_admin(), que filtra por r.id/es_rol_sistema y
-- por eso autorizaria a CUALQUIER usuario con ese rol. Esta funcion
-- autoriza a UNA sola fila posible en toda la base, la sembrada en
-- 0034_gateway_sistema_seed.sql. Mismo patron STABLE SECURITY DEFINER que
-- current_tenant_id()/es_ceom_admin() -- corre "como postgres" (dueño de
-- usuarios), asi que no evalua RLS de esa tabla (no hay FORCE hoy, ver
-- comentario en identidad/schema.ts) -- no hay recursion.
create function public.es_gateway_sistema() returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.usuarios u
    where u.id = auth.uid()
      and u.id = 'b4e2d0a3-9c58-4f7b-8d4e-2a3b4c5d6e7f' -- GATEWAY_SISTEMA_USUARIO_ID
      and u.eliminado_en is null
      and u.activo
  )
$$;

-- Mismo criterio que current_tenant_id()/es_ceom_admin() desde el dia uno
-- (no revocar despues): "anon"/"public" no tienen ningun uso legitimo.
revoke all on function public.es_gateway_sistema() from public, anon;
grant execute on function public.es_gateway_sistema() to authenticated;