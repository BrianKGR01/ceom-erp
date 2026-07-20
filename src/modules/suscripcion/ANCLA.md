# ANCLA — Módulo: Suscripción (versión mínima)

## Contrato (no romper sin actualizar este archivo)
- Responsabilidad: es dueño del catálogo de Planes (`planes`) — precio,
  moneda, funciones incluidas por plan (multi-owner, downgrade
  autogestionado, duración de invitación/gracia, módulos habilitables para
  veedores externos).
- NO hace (todavía — es la "versión mínima" que pide
  `docs/roadmap/roadmap.md` Fase 1 ítem 2, el resto es el roadmap ítem #10,
  Gateway de Consentimiento, más adelante): Panel Administrativo CEOM (UI de
  gestión de tenants, métricas agregadas de salud de la plataforma),
  Instituciones, Cartera Institucional, Solicitud de Seguimiento, Aprobación
  de Tenant, Código de Acceso, Portal de Entidades Veedoras,
  `LogAccesoAdminCEOM`. Todo esto está descrito en
  `docs/modules/Modulo_11_suscripcion_panel_administrativo.md` pero fuera de
  esta implementación.
- Entradas que consume: `ROL_CEOM_ADMIN_ID` de
  `src/modules/identidad/constants.ts` (para gatear las escrituras).
- Salidas que expone (`actions.ts`): `obtenerPlanPorId`, `listarPlanes`
  (lectura pública, sin gate — catálogo, no dato sensible de un tenant),
  `crearPlan`, `actualizarPlan`, `desactivarPlan`, `reactivarPlan` (gateadas
  a `ROL_CEOM_ADMIN_ID`). También re-exporta `PLAN_BASICO_ID`.

## Estado actual
- [x] Schema Drizzle (`planes`) + RLS (policy de solo `select` para
      `authenticated`, sin `crudPolicy()` porque no es tenant-scoped).
- [x] Plan "Básico" sembrado con ID fijo (`PLAN_BASICO_ID`), **precio_mensual
      en 0 como placeholder explícito** — el usuario todavía no definió el
      precio real. Actualizar con un `UPDATE` simple cuando se confirme, no
      hace falta una migración nueva para ese cambio puntual.
- [x] FK real `tenants.plan_id → planes.id` (resuelve el pendiente que
      había quedado documentado en el Módulo 1).
- [x] `crearTenant()` de Identidad ahora valida/defaultea el plan (ver
      ANCLA.md de Identidad).
- [x] Tests de integración contra Supabase Cloud real (`suscripcion.test.ts`).
- [x] UI del catálogo de Planes construida (2026-07-18): `/admin/planes`
      (`src/app/admin/(shell)/planes/`) — listado de cards + un solo Dialog
      reutilizado para crear/editar (no maestro-detalle, Plan es una
      entidad chica y plana), toggle Desactivar/Reactivar sobre el booleano
      `activo`. `nichoId` queda fuera del formulario (uuid sin FK real,
      nada contra qué resolverlo todavía). Nav item "Planes" agregado a
      `admin-shell.tsx`. **Pendiente de pulido visual** (verificación manual
      del usuario, 2026-07-18): el Dialog de alta/edición se ve con estilo
      mobile en viewport desktop — no corregido a propósito, ver
      `docs/ui/pantallas.md` sección "Pendientes de pulido visual".
- [ ] Panel Administrativo CEOM (salud agregada), Instituciones, Gateway,
      Código de Acceso — ya construidos en tandas posteriores (Módulo 10 y
      11), no en este módulo.
- [x] **UI de "Mi Plan" construida (2026-07-18):** `/app/mi-negocio/plan`
      (dentro de `src/app/app/(shell)/mi-negocio/`, sub-nav compartido con
      Colaboradores/Roles/Capacidades — no vive en este módulo, es una
      pantalla de Identidad que **consume** `obtenerPlanPorId()` de acá, sin
      exponer ninguna función nueva de este módulo). Vista de solo lectura
      del plan vigente del tenant para cualquier colaborador autenticado (no
      solo Owner) — cambiar de plan sigue siendo exclusivo de `ceom_admin`
      desde `/admin/tenants/[tenantId]`. Sin gap de backend: compone
      `obtenerTenantPorId`/`calcularEstadoAcceso` (Identidad, ya usadas por
      el shell de `/app`) con `obtenerPlanPorId` (acá, ya usada por
      `crearTenant`/`cambiarPlanTenant`). Detalle completo en
      `docs/ui/pantallas.md` sección 2 y en `identidad/ANCLA.md`.

## Dónde está cada cosa
- Esquema de BD (Drizzle): `src/modules/suscripcion/schema.ts`
- ID fijo del plan Básico: `src/modules/suscripcion/constants.ts`
- Repository: `src/modules/suscripcion/repository.ts`
- Server actions: `src/modules/suscripcion/actions.ts`
- Tests: `src/modules/suscripcion/suscripcion.test.ts`
- Migraciones relevantes: `drizzle/migrations/0006` (tabla+RLS), `0007`
  (seed plan Básico), `0008` (backfill + FK sobre `tenants.plan_id`).

## Decisiones tomadas que un agente no debe revertir
- **`identidad/schema.ts` importa la tabla `planes` de este módulo** (no su
  repository ni actions) para declarar la FK real de `tenants.plan_id`. Es
  la **única excepción documentada** al principio de "módulo = caja negra"
  en todo el proyecto — se hizo así a propósito porque Drizzle necesita la
  referencia de tabla en el mismo lado de la FK para generar el
  `ALTER TABLE ... ADD CONSTRAINT` automáticamente (evita drift entre
  `schema.ts` y SQL crudo). **Si en el futuro este módulo necesita
  `tenant_id`** (ej. al construir Cartera Institucional), esa tabla nueva
  debe ir en otro módulo (o resolverse de otra forma) para no cerrar un
  ciclo real de imports entre `schema.ts` de dos módulos.
- `planes.nicho_id` queda **sin FK**, igual que `tenants.nicho_id` en
  Identidad — el módulo de Nicho no existe todavía. Cuando se construya,
  hay que revisar ambos pendientes juntos.
- `modulos_veedor_permitidos` es un `pgEnum[]` (`financiero`, `operativo`,
  `inventario_operativo`) que hoy nadie consume — está en el schema porque
  Módulo 1 sección 1.6 ya lo especifica como parte de `Plan`, pero el
  Código de Acceso que lo usaría es trabajo futuro. Ojo: agregar valores a
  este enum más adelante requiere `ALTER TYPE ... ADD VALUE`, que en
  Postgres **no puede ir en la misma transacción** que otro DDL — separar
  esa migración cuando llegue el momento.
- Los tests de este módulo (y los de Identidad) corren contra el rol
  `postgres` (bypassea RLS por completo, vía `DATABASE_URL`/`DIRECT_URL`) —
  no validan la policy de `authenticated` de verdad. Es una limitación ya
  conocida y aceptada, documentada también en el ANCLA.md de Identidad.
- La matriz de dependencias de `CEOM_Arquitectura.md` sección 7 **no tiene
  una fila para "Suscripción/Módulo 11"** — es un gap del documento de
  arquitectura, no se corrigió en esta tarea (avisado explícitamente, no
  silencioso).

## Última actualización: 2026-07-18 — UI de "Mi Plan" construida (`/app/mi-negocio/plan`), cierra el último ítem pendiente de este módulo. Actualización previa el mismo día: UI del catálogo de Planes construida (`/admin/planes`)
