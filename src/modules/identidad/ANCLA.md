# ANCLA — Módulo: Identidad, Tenants, Sucursales, Roles, Autorización

## Contrato (no romper sin actualizar este archivo)
- Responsabilidad: es dueño de Tenant, Sucursal, Usuario, Rol, la matriz de
  permisos (módulo×acción) y las capacidades especiales — y resuelve las
  cuatro preguntas de `docs/modules/Modulo_01...md` sección 0 (a qué tenant
  pertenece un dato, quién es el usuario, qué puede hacer, está permitida
  esta acción ahora mismo).
- NO hace: no tiene pantallas de UI todavía (alcance de esta tarea: solo
  backend). No implementa el Panel Administrativo CEOM, Instituciones ni el
  Gateway de Consentimiento institucional (sección 7.2 del módulo — ver
  `src/modules/suscripcion/ANCLA.md`, es trabajo del roadmap ítem #10). No
  corre un scheduler real para transición de etapas de suscripción —
  `calcularEstadoAcceso()` es una función pura, algo externo tiene que
  invocarla periódicamente cuando exista esa infraestructura.
- Entradas que consume: `obtenerPlanPorId()` de `src/modules/suscripcion/actions.ts`
  (para validar/defaultear el plan al dar de alta un tenant — ver
  decisiones abajo). Fuera de eso, ninguna de otro módulo (es la base,
  `CEOM_Arquitectura.md` sección 7). Sí depende de Supabase Auth (GoTrue)
  para la sesión y para crear usuarios.
- Salidas que expone (`actions.ts`): `obtenerUsuarioActual`,
  `calcularEstadoAcceso`, `tienePermiso`, `tieneCapacidadEspecial`,
  `crearTenant`, `invitarUsuario`, `cambiarRolUsuario`, `suspenderUsuario`,
  `reactivarUsuario`, `crearRolPersonalizado`, `actualizarPermisosRol`,
  `eliminarRol`. También re-exporta el **tipo** `UsuarioConRol` (desde
  Módulo 5/Patrimonio) — cualquier módulo que llame a `tienePermiso()`
  necesita tipar su `solicitante` sin importar `identidad/repository.ts`
  directamente.

## Estado actual
- [x] Schema Drizzle (7 tablas) + RLS (`.enableRLS()` + policies) + función
      SQL `current_tenant_id()`.
- [x] Seed de datos de sistema: tenant reservado "CEOM Ops", roles globales
      "Owner" y "CEOM Admin" (IDs fijos en `constants.ts`).
- [x] `repository.ts` + `actions.ts` con las 11 funciones del contrato.
- [x] Tests: `estado-acceso.test.ts` (puro, siempre corre) +
      `identidad.test.ts` (integración contra Supabase Cloud real, se salta
      solo si faltan `DATABASE_URL`/`SUPABASE_SECRET_KEY`).
- [x] `tenants.plan_id` tiene FK real a `planes.id` (Módulo 11 mínimo,
      `src/modules/suscripcion/`); `crearTenant()` valida/defaultea el plan.
- [ ] Pantallas de onboarding (sección 4 del módulo) — fuera de alcance de
      esta tarea.
- [ ] Panel Administrativo CEOM, Instituciones, Gateway de Consentimiento
      (sección 7.2) — roadmap ítem #10, módulo aparte.
- [ ] Scheduler real que recalcula y persiste `estado_acceso` por tiempo.
- [ ] Chequeo de límite de sucursales contra plan (sección 9.6) — depende de
      que exista el catálogo Planes.
- [ ] Lógica de habilitación de cofundadores/multi-owner (el modelo de datos
      ya lo permite vía `es_owner` booleano, no hay función que lo active).
- [ ] `DATABASE_URL`/`SUPABASE_SECRET_KEY` como secrets de GitHub Actions —
      hasta que se configuren, `identidad.test.ts` se salta en CI (queda en
      verde pero sin cobertura real ahí; localmente sí corre).

## Dónde está cada cosa
- Esquema de BD (Drizzle): `src/modules/identidad/schema.ts`
- IDs de sistema (tenant CEOM Ops, roles Owner/CEOM Admin): `src/modules/identidad/constants.ts`
- Repository: `src/modules/identidad/repository.ts`
- Server actions (contrato público): `src/modules/identidad/actions.ts`
- Tests: `src/modules/identidad/estado-acceso.test.ts`, `src/modules/identidad/identidad.test.ts`
- Infra compartida (no es de este módulo, la usa cualquier módulo): cliente
  Drizzle en `src/db/client.ts`, helper `crudPolicy()` en `src/db/rls.ts`,
  clientes de sesión/admin de Supabase en `src/lib/supabase/server.ts`.
- Migraciones relevantes: `drizzle/migrations/0002` (tablas), `0003`
  (`current_tenant_id()`), `0004` (RLS), `0005` (seed CEOM Ops/roles).

## Decisiones tomadas que un agente no debe revertir
- `crudPolicy()` **no existe** en `drizzle-orm` para Supabase (solo para
  Neon) en la versión instalada — el de `src/db/rls.ts` es un helper propio.
  No asumir que viene de la librería.
- "Owner" y "CEOM Admin" son **roles de sistema globales** (una sola fila
  cada uno, `tenant_id = null`, IDs fijos en `constants.ts`), no una fila de
  rol nueva por tenant. `crearTenant` reutiliza el mismo `ROL_OWNER_ID`
  siempre — no crear un rol "Owner" por tenant.
- El Owner **no tiene filas en la matriz de permisos** — `tienePermiso()`
  resuelve `es_owner` en código, después del gate de `estado_acceso`.
- `tenants.estado_acceso` está persistido en el schema pero **no es la
  fuente de verdad** que usa `tienePermiso()` — se recalcula siempre con
  `calcularEstadoAcceso()` a partir de `estado_suscripcion` +
  `fecha_proximo_pago`, porque nada mantiene esa columna al día todavía
  (no hay scheduler).
- El catálogo del enum `modulo_permiso` (Modulo_01 sección 1.5) **no incluye
  "identidad"** como módulo gestionable — por eso las acciones de
  gestión de usuarios/roles (`invitarUsuario`, `cambiarRolUsuario`,
  `crearRolPersonalizado`, etc.) están gateadas por `solicitante.esOwner`
  directamente, no por `tienePermiso()`. Es una ambigüedad real del spec
  (sección 8.1 dice "cualquier usuario con permiso crear en este módulo",
  pero ese módulo no está en el enum) — si se decide resolver distinto, hay
  que tocar tanto el enum en `schema.ts` como cada gate en `actions.ts`.
- `crearTenant`/`invitarUsuario` crean el usuario de Supabase Auth **antes**
  de la transacción de Postgres (necesitan el `id` real para la FK
  `usuarios.id -> auth.users.id`). Si la transacción de Postgres falla
  después de creado el usuario de Auth, ese usuario queda huérfano —
  Supabase Auth y Postgres no comparten una transacción. No hay limpieza
  automática todavía; si pasa, se borra a mano con
  `admin.auth.admin.deleteUser()`.
- `drizzle.config.ts` apunta a `./src/modules/**/schema.ts` (glob) — todo
  módulo nuevo que agregue tablas solo necesita crear su `schema.ts` en esa
  ruta, no hay que tocar la config.
- Los tests de `identidad.test.ts` pegan contra el **Supabase Cloud de
  desarrollo real** (no hay DB de test separada) y limpian explícitamente lo
  que crean en `afterAll` (usuarios de Auth vía `admin.deleteUser`, filas de
  Postgres vía `DELETE`) — no dependen de rollback de transacción.
- `crearTenant()` valida el plan **antes** de invitar al usuario a Supabase
  Auth: si no viene `planId`, usa `PLAN_BASICO_ID` (de
  `src/modules/suscripcion/constants.ts`) por default; si viene, llama a
  `obtenerPlanPorId()` de `suscripcion/actions.ts` (nunca a su repository
  directo) y rechaza si el plan no existe o `activo=false`. Este chequeo
  corre antes del efecto secundario de invitación por email — un test
  puede ejercer el rechazo (`identidad.test.ts`, plan inexistente) sin
  disparar un email real.
- `identidad/schema.ts` importa la tabla `planes` de
  `suscripcion/schema.ts` (no su repository ni actions) para declarar la FK
  `tenants.plan_id → planes.id`. Es la **única excepción documentada** al
  principio de "módulo = caja negra" en todo el proyecto — ver el detalle
  completo (por qué, y qué hacer si algún día se vuelve un ciclo real) en
  `src/modules/suscripcion/ANCLA.md`.
- `UsuarioConRol` se re-exporta desde `actions.ts` (antes solo vivía en
  `repository.ts`) porque Módulo 5 (Patrimonio) lo necesita para tipar
  `solicitante` al llamar `tienePermiso()`. Cualquier módulo futuro que
  también llame `tienePermiso()` debe importar el tipo desde acá, no desde
  el repository.

## Última actualización: 2026-07-14 — Módulo 5 (Patrimonio) agregó UsuarioConRol al contrato publico (Fase 1)
