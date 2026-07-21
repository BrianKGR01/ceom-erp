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
