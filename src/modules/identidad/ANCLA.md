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
  `eliminarRol`, `obtenerTenantPorId`, `obtenerEstadoAccesoTenant` (las dos
  últimas agregadas en Módulo 10 — Gateway de Consentimiento),
  `obtenerTenantParaVeedor`, `listarTenants`, `solicitanteGateway` (las tres
  agregadas en el roadmap ítem #11 — Monitoreo Institucional/Panel Admin
  CEOM, ver detalle abajo), `otorgarCapacidadEspecialPorRol`,
  `otorgarCapacidadEspecialPorUsuario` (agregadas en auditoría de Fase 1 —
  cerraban un gap real: `tieneCapacidadEspecial()` ya sabía leer el override
  usuario→rol→false de la sección 13.1, pero no existía ninguna Server
  Action para escribirlo; las únicas escrituras eran `db.insert()` directo
  dentro de los propios tests). También re-exporta el **tipo**
  `UsuarioConRol` (desde Módulo 5/Patrimonio) — cualquier módulo que llame a
  `tienePermiso()` necesita tipar su `solicitante` sin importar
  `identidad/repository.ts` directamente. `actualizarTenant`, `asignarNicho`
  (agregadas al construir la UI de Onboarding, Fase 1 fase de UI — cerraban
  el gap de backend documentado desde `docs/ui/pantallas.md`).
  `listarSucursalesPorTenant` (agregada al construir Catálogo/Ficha de
  Producto — ningún módulo tenía forma de listar sucursales de un tenant
  hasta ahora; la necesitan los modales de ajuste/transferencia de stock).
  `completarOnboarding` (agregada al construir el shell de `/app` — hacía
  falta forzar el redirect a Onboarding en el primer ingreso del Owner, y
  `nicho_id` solo no alcanza para saber si ya terminó, ver decisión abajo).

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
- [x] `modulo_permiso` (enum) ahora incluye `"proveedores"` (Módulo 8,
      `src/modules/proveedores/`) además de `"patrimonio"` (Módulo 5).
- [x] `obtenerTenantParaVeedor(tenantId)` (roadmap ítem #11) — sin
      `solicitante`, mismo criterio que `obtenerEstadoAccesoTenant()`: para
      que `monitoreo-institucional` (una Institución externa, no un
      `UsuarioConRol`) lea nombre/nicho/plan/estado_acceso mínimos de un
      tenant que ya tiene en su Cartera Institucional.
- [x] `listarTenants(solicitante)` (roadmap ítem #11) — listado cross-tenant
      completo, gateado a `ceom_admin` directo (mismo bypass que ya usa
      `tienePermiso()` para ese rol). Consumido por `panel-admin-ceom` para
      calcular salud agregada de la plataforma.
- [x] `solicitanteGateway()` (roadmap ítem #11) — arma un `UsuarioConRol`
      SINTÉTICO (`rolId=ROL_CEOM_ADMIN_ID`, sin fila de usuario real
      detrás) para que `monitoreo-institucional` pueda "prestar" el bypass
      cross-tenant de `ceom_admin` y llamar a los `actions.ts` de solo
      lectura de Financiero/Ventas/Operativo en nombre de una Institución
      externa ya autorizada por `tieneConsentimiento()`. Decisión de diseño
      confirmada explícitamente con el usuario antes de implementar — ver
      "Decisiones" abajo.
- [x] `otorgarCapacidadEspecialPorRol`/`otorgarCapacidadEspecialPorUsuario`
      (auditoría de Fase 1) — gateadas a `esOwner` + `requireEscrituraHabilitada`,
      hacen upsert real sobre `permisos_especiales_por_rol`/`_por_usuario`.
      La de rol rechaza roles de sistema (`esRolSistema`) — Owner/CEOM Admin
      son globales, compartidos entre tenants; habilitar ahí afectaría a
      todos los tenants a la vez. Cubierto por
      `identidad.test.ts` ("otorgarCapacidadEspecialPorRol/PorUsuario...").
- [x] `actualizarTenant`/`asignarNicho` (Onboarding, sección 4/5 del módulo)
      — "Configurar negocio" + "Elegir rubro" ya tienen backend real y
      pantalla en `/app/onboarding`. Gate igual que
      `invitarUsuario`/`cambiarRolUsuario`: `solicitante.esOwner` directo.
      `asignarNicho` es de un solo uso — rechaza siempre si el tenant ya
      tiene `nicho_id` (sección 5: la migración Modo Básico → Nicho es de un
      solo sentido, sin excepciones). Cubierto por `identidad.test.ts`.
- [ ] Checklist de bienvenida progresivo (sección 4, paso 3) — sin tracking
      persistido todavía, fuera de alcance de esta tarea (ya documentado
      como gap aparte en `docs/ui/pantallas.md`).
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
- **`tenants.onboarding_completado_en` es independiente de `nicho_id`** —
  no reusar `nicho_id IS NOT NULL` como señal de "onboarding terminado".
  Modo Básico deja `nicho_id = null` a propósito y para siempre (Modulo_01
  sección 5), así que ese campo solo no distingue "nunca pasó por
  onboarding" de "pasó y eligió Modo Básico". `completarOnboarding()` se
  llama una sola vez al final del asistente sin importar qué se haya
  elegido en el paso 2, y es idempotente (no pisa la fecha si ya está
  seteada).
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
- **`modulo_permiso` es un enum ampliable** — Módulo 5 agregó
  `"patrimonio"` y Módulo 8 agregó `"proveedores"` (ninguno de los dos
  estaba en la lista original de Módulo 1 sección 1.5). Patrón para
  agregar un valor nuevo: la migración `ALTER TYPE ... ADD VALUE` va
  **sola**, sin ninguna otra sentencia DDL en el mismo archivo — Postgres
  no permite usar un valor recién agregado en la misma transacción en que
  se agregó. Ver `src/modules/proveedores/ANCLA.md` para el ejemplo real.
- **`obtenerTenantPorId` y `obtenerEstadoAccesoTenant` (Módulo 10)**: la
  primera exige un `solicitante: UsuarioConRol` real (gate: `ceom_admin` o
  mismo tenant) y devuelve el registro completo del Tenant. La segunda **no
  recibe `solicitante`** — a propósito, pensada para el Gateway de
  Consentimiento, donde el llamador (una Institución externa) no es un
  usuario de CEOM — expone únicamente `estado_acceso` derivado, nunca el
  resto de los datos del Tenant. No fusionar ambas ni agregarle
  `solicitante` a la segunda "por consistencia" — perdería su único
  propósito.

- **`solicitanteGateway()` es un objeto SINTÉTICO, no una fila de usuario
  real** — no crear un usuario de sistema real en la base para "arreglar"
  esto. Reutiliza el mismo bypass cross-tenant que `tienePermiso()` ya le
  da a `ceom_admin` (líneas 83-88, no valida `tenantId` ni la existencia
  real de la fila de usuario en esa rama) — por eso alcanza con un objeto
  en memoria con `rolId=ROL_CEOM_ADMIN_ID` y el `rol` real (traído de
  `repo.obtenerRolPorId`). **Uso exclusivo**: solo lo invoca
  `monitoreo-institucional/actions.ts`, y solo para lecturas, solo después
  de que `tieneConsentimiento()` ya devolvió `true`. Nunca usar para
  escrituras (los campos de auditoría `creadoPor`/`modificadoPor` quedarían
  apuntando a un UUID sin fila real, violando la FK) ni exponer a ningún
  input externo.
- **`listarTenants()` no pagina** — a diferencia de la advertencia de
  rendimiento del Módulo_11 sección 6.2 (cartera institucional grande), acá
  se aceptó sin paginación para "nivel básico": el volumen esperado de
  tenants en este MVP es bajo. Revisar si se vuelve un problema real de
  performance antes de escalar el número de tenants.
- **El candado circular ya está resuelto**: antes no había forma de entrar
  como `ceom_admin` ni de crear el primer tenant (la migración `0005` solo
  siembra el ROL, nunca una fila de usuario real, y `crearTenant()` exige
  un solicitante ya logueado como `ceom_admin`). `scripts/seed-admin.ts`
  (`pnpm seed:admin <email>`) crea ese primer usuario real vía el Admin API
  de Supabase Auth + una fila en `usuarios` con `rolId=ROL_CEOM_ADMIN_ID` en
  el tenant `CEOM Ops`. Ver `docs/dev-practices/dev-practices.md` sección
  7.1.

- **`tenants.nicho_id` es un enum fijo (`nicho_1`/`nicho_4`), no un `uuid`
  con tabla catálogo.** Antes de esta tarea la columna era un `uuid` suelto
  sin FK y **ningún código del repo la leía ni la escribía** (cero
  referencias en `src/modules/operativo/**`, cero en tests) — un gap más
  profundo que el documentado en `docs/ui/pantallas.md`. Se decidió
  explícitamente con el usuario no crear una tabla `nichos` (solo hay 2
  nichos reales en el MVP, sin previsión de crecer sin revisar el roadmap
  primero — mismo criterio que `capacidadEspecialEnum`). Si algún día se
  suma un nicho nuevo: `ALTER TYPE nicho ADD VALUE` en su propia migración,
  sola, sin otro DDL en el mismo archivo (mismo patrón ya documentado abajo
  para `modulo_permiso`). `planes.nicho_id` (Suscripción) sigue siendo un
  `uuid` suelto — no se tocó, queda fuera de alcance de este cambio.
- **Bug real encontrado en `drizzle-kit generate` para un `ALTER COLUMN` de
  `uuid` a enum**: el SQL que genera (`USING "col"::"tipo_enum"`) falla en
  Postgres — no se puede castear `uuid` directo a un enum arbitrario, hace
  falta pasar por texto (`USING "col"::text::"tipo_enum"`). Ver
  `drizzle/migrations/0022_public_lady_bullseye.sql`, ya corregido a mano.
  Si se genera otra migración que cambie el tipo de una columna `uuid` a un
  enum, revisar el `USING` generado antes de aplicar — no asumir que
  `drizzle-kit generate` lo resuelve bien.
- **`drizzle.__drizzle_migrations` puede quedar inconsistente si una
  migración falla a mitad de camino** (visto en la 0022: `CREATE TYPE`
  llegó a persistir pero el `ALTER COLUMN` falló, y aun así quedó una fila
  de tracking con un `hash`/`created_at` que no correspondían al archivo
  real — la lógica de `drizzle-orm` para decidir qué migración ya se aplicó
  compara por `created_at` contra el `when` de `_journal.json`, **no por
  hash**, aunque la tabla también guarda un hash). Se corrigió esa fila a
  mano, con autorización explícita del usuario (acción que el modo
  automático de la sesión bloquea por defecto, correctamente, al ser una
  escritura directa sobre infraestructura compartida). Si vuelve a pasar:
  comparar `_journal.json` (`when` de la migración) contra
  `select id, hash, created_at from drizzle.__drizzle_migrations order by
  created_at desc limit 1` antes de asumir que "no aparece error" significa
  "se aplicó bien" — `drizzle-kit migrate` puede terminar en exit code 1
  sin imprimir el error real de Postgres.

## Última actualización: 2026-07-16 — Shell de `/app` (Fase 1 UI): agregó `onboardingCompletadoEn`/`completarOnboarding` para forzar el redirect a Onboarding en el primer ingreso
