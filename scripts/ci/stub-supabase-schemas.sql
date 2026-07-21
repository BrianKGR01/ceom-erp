-- Stub minimo de lo que Supabase Cloud ya provee y que las migraciones de
-- drizzle/migrations/ dan por hecho (docs/security/PLAN-RLS-BACKSTOP.md §4.2):
-- roles anon/authenticated/service_role, auth.users + auth.uid(), y
-- storage.objects + storage.foldername() (usados solo por la migracion
-- 0024_storage_tenant_uploads_rls.sql). Se aplica UNA VEZ contra el
-- contenedor postgres:16 de CI antes de `drizzle-kit migrate` — nunca
-- contra Supabase Cloud, donde todo esto ya existe de fabrica.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$$;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key
);

-- Misma expresion que auth.uid() real de Supabase (drizzle-orm/supabase/rls
-- exporta el helper "authUid" que genera exactamente esto).
create or replace function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid $$;

create schema if not exists storage;

create table if not exists storage.objects (
  id uuid primary key,
  bucket_id text,
  name text,
  owner uuid
);

create or replace function storage.foldername(name text) returns text[]
language sql immutable
as $$ select string_to_array(name, '/') $$;

grant usage on schema auth, storage to anon, authenticated, service_role;
grant select on auth.users to anon, authenticated, service_role;

-- Lo que Supabase Cloud otorga de fabrica y que este stub tiene que igualar:
-- GRANT de tabla en "public" a authenticated/anon/service_role. Sin esto,
-- cualquier query de authenticated falla con "permission denied for table"
-- ANTES de que la policy de RLS llegue a evaluarse siquiera -- RLS filtra
-- FILAS, no reemplaza el permiso de tabla que Postgres exige primero.
-- Bug real encontrado y corregido: este script corre ANTES de
-- `drizzle-kit migrate` (ver ci.yml), así que las tablas de las
-- migraciones reales TODAVÍA NO EXISTEN acá — un `grant ... on all tables
-- in schema public` en este punto no habría otorgado nada (0 tablas). Por
-- eso `alter default privileges`: fija el permiso por adelantado para
-- CUALQUIER tabla que el rol actual (postgres, el mismo que corre
-- drizzle-kit migrate) cree de ahora en más, sin importar que todavía no
-- exista ninguna.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;
