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

-- Columnas reales de Supabase Auth (verificado en vivo contra el proyecto
-- Cloud real, riertvgnjaujstwyqoom, vía information_schema.columns —
-- 2026-07-22, Etapa 4.a del backstop de RLS). Antes este stub solo tenía
-- "id uuid primary key" -- alcanzaba mientras ninguna migración insertara
-- en auth.users directo (todas las anteriores solo llamaban a auth.uid()).
-- 0034_gateway_sistema_seed.sql fue la primera en insertar una fila real
-- (aud/role/email/encrypted_password/banned_until/etc.) y reventó en CI
-- con "column aud does not exist" -- este stub no reflejaba ese
-- requisito nuevo. Se agregan las 33 columnas reales (no solo las que esa
-- migración usa) para no repetir este mismo modo de falla con la próxima
-- migración que también necesite insertar en auth.users -- misma nullability
-- que la real: todas NULL salvo id/is_sso_user/is_anonymous.
create table if not exists auth.users (
  instance_id uuid,
  id uuid primary key,
  aud text,
  role text,
  email text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  invited_at timestamptz,
  confirmation_token text,
  confirmation_sent_at timestamptz,
  recovery_token text,
  recovery_sent_at timestamptz,
  email_change_token_new text,
  email_change text,
  email_change_sent_at timestamptz,
  last_sign_in_at timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  is_super_admin boolean,
  created_at timestamptz,
  updated_at timestamptz,
  phone text,
  phone_confirmed_at timestamptz,
  phone_change text,
  phone_change_token text,
  phone_change_sent_at timestamptz,
  confirmed_at timestamptz,
  email_change_token_current text,
  email_change_confirm_status smallint,
  banned_until timestamptz,
  reauthentication_token text,
  reauthentication_sent_at timestamptz,
  is_sso_user boolean not null default false,
  deleted_at timestamptz,
  is_anonymous boolean not null default false
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
