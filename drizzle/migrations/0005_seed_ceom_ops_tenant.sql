-- Seed de datos de sistema para el motor de autorizacion (Modulo_01 secciones
-- 1.4, 6.2, 6.5). IDs fijos para que la app pueda referenciarlos por
-- constante (ver src/modules/identidad/constants.ts) en vez de buscarlos por
-- nombre.
--
-- "Owner" y "CEOM Admin" son roles de sistema GLOBALES (tenant_id null,
-- Modulo_01 seccion 1.4): existe una unica fila de cada uno en todo el
-- sistema, y cada tenant nuevo simplemente referencia el mismo rol_id de
-- Owner al crear su primer usuario — no se crea una fila de rol nueva por
-- tenant.
--
-- "CEOM Ops" es un tenant reservado (no es un cliente real) que aloja las
-- filas de Usuario del personal interno de CEOM con rol CEOM Admin, porque
-- usuarios.tenant_id es NOT NULL incluso para ellos.
insert into public.tenants (
  id, nombre_negocio, moneda_principal, estado_suscripcion,
  fecha_inicio_suscripcion, creado_en
) values (
  '4ee580bc-14d8-49a4-b8c9-468569467f2f', 'CEOM Ops', 'BOB', 'activa',
  current_date, now()
);

insert into public.roles (id, tenant_id, nombre, es_rol_sistema, creado_en)
values
  ('17eb761e-9cd1-43bd-9590-b5e9d8657b43', null, 'Owner', true, now()),
  ('c1027307-fc75-4517-b2af-9687234c694d', null, 'CEOM Admin', true, now());
