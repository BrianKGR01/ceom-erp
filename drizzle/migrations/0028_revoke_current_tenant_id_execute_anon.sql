-- Custom SQL migration file, put your code below! --

-- Hallazgo del advisor de seguridad de Supabase (docs/security/
-- PLAN-RLS-BACKSTOP.md §1.5, diagnóstico 2026-07-21): current_tenant_id()
-- es SECURITY DEFINER (0025_fix_current_tenant_id_security_definer.sql) y
-- quedaba ejecutable via RPC directo (/rest/v1/rpc/current_tenant_id) por
-- "anon" ademas de "authenticated" — sin sesion, auth.uid() es null y la
-- funcion devuelve null, asi que no es explotable hoy, pero es superficie
-- de API sin uso legitimo: ningun cliente anonimo necesita invocarla. Se
-- revoca el EXECUTE de "anon" y de "public" (grant por defecto de Postgres
-- a toda funcion nueva); "authenticated" conserva el permiso porque
-- crudPolicy() (src/db/rls.ts) la necesita para evaluar sus propias
-- policies.
revoke execute on function public.current_tenant_id() from public;
revoke execute on function public.current_tenant_id() from anon;
grant execute on function public.current_tenant_id() to authenticated;
