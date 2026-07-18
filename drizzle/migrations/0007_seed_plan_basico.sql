-- Plan de arranque (Modulo_01 seccion 12) — el que usara SanttiCampo.
-- precio_mensual queda en 0 como PLACEHOLDER explicito hasta que se defina
-- el precio real; actualizar con un UPDATE simple cuando se confirme, no
-- hace falta una migracion nueva para ese cambio puntual.
insert into public.planes (
  id, nombre, incluye_sucursales, permite_multiples_owners,
  permite_downgrade_autogestionado, duracion_invitacion_dias,
  duracion_etapa_solo_lectura_dias, precio_mensual, moneda, activo
) values (
  '7089dbcc-3eb7-479e-8176-eef3bbfdae68', 'Básico', false, false, false, 7, 3,
  0, 'BOB', true
);
