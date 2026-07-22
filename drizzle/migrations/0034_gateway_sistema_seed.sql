-- Custom SQL migration file, put your code below! --

-- Etapa 4.a del backstop de RLS (docs/security/PLAN-RLS-BACKSTOP.md
-- §13/§14, Opcion A' -- confirmada por el usuario, no A literal): identidad
-- real y acotada para el Gateway de Consentimiento. Reemplaza el "solicitante
-- sintetico" (UUID de ceros, sin fila real -- ver identidad/actions.ts,
-- solicitanteGateway()) que hacia reventar comoUsuario() en cuanto un modulo
-- alcanzado por el Gateway migraba a RLS real (§9.6/§10.4).
--
-- Rol PROPIO, NUNCA ROL_CEOM_ADMIN_ID -- es lo que separa el bypass de RLS
-- del Gateway (es_gateway_sistema(), migracion siguiente) del de un
-- ceom_admin humano (es_ceom_admin()): el primero filtra por id puntual, el
-- segundo por rol. Reusar ROL_CEOM_ADMIN_ID aca haria que este usuario
-- heredara automaticamente CUALQUIER bypass de ceom_admin presente o futuro
-- -- exactamente la regresion de defensa en profundidad que §13.3 identifico
-- y que el usuario pidio explicitamente evitar.
insert into public.roles (id, tenant_id, nombre, es_rol_sistema, creado_en)
values (
  'a3f1c9d2-8b47-4e6a-9c3d-1f2e3a4b5c6d',
  null,
  'Gateway de Consentimiento (sistema)',
  true,
  now()
);

-- auth.users -- unico caso en todo el repo que inserta directo en el schema
-- "auth" en vez de via el Admin API (scripts/seed-*.ts,
-- identidad/actions.ts:crearTenant() usan siempre inviteUserByEmail()).
-- Deliberado: no hay ningun humano a quien invitarle un email real acá.
--
-- encrypted_password = null + banned_until muy en el futuro: verificado
-- activamente (no asumido) que esta combinacion bloquea los 3 flujos de
-- login de Supabase Auth (password, magic link, OTP) -- GoTrue chequea
-- banned_until antes de emitir cualquier sesion, sin importar el metodo de
-- credencial. Ver docs/security/PLAN-RLS-BACKSTOP.md §13/§14 para el
-- detalle de la verificacion.
insert into auth.users (
  id, aud, role, email, encrypted_password, banned_until,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  is_sso_user, is_anonymous
) values (
  'b4e2d0a3-9c58-4f7b-8d4e-2a3b4c5d6e7f',
  'authenticated', 'authenticated',
  'gateway-sistema@ceom.internal',
  null,
  '294276-01-01',
  now(), now(),
  '{}'::jsonb, '{}'::jsonb,
  false, false
);

insert into public.usuarios (
  id, tenant_id, rol_id, nombre_completo, email, es_owner, activo, creado_en
) values (
  'b4e2d0a3-9c58-4f7b-8d4e-2a3b4c5d6e7f',
  '4ee580bc-14d8-49a4-b8c9-468569467f2f',
  'a3f1c9d2-8b47-4e6a-9c3d-1f2e3a4b5c6d',
  'Gateway de Consentimiento (sistema)',
  'gateway-sistema@ceom.internal',
  false,
  true,
  now()
);