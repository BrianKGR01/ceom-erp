-- Resuelve el tenant_id del usuario autenticado actual. El JWT de Supabase
-- solo trae auth.uid(); tenant_id vive en la fila de usuarios. Drizzle no
-- tiene builder declarativo para funciones SQL (0.45.2), por eso esta
-- migracion es SQL crudo en vez de venir de schema.ts.
--
-- security invoker (no definer): no hace falta bypass de RLS porque la
-- policy de select sobre "usuarios" ya permite que cada usuario lea su
-- propia fila (id = auth.uid()), asi que esta funcion no necesita permisos
-- elevados para resolver su propio tenant_id.
create function public.current_tenant_id() returns uuid
language sql stable security invoker as
$$ select tenant_id from public.usuarios where id = auth.uid() and eliminado_en is null $$;
