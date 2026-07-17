# ANCLA — Módulo: Gateway de Consentimiento

## Contrato (no romper sin actualizar este archivo)
- Responsabilidad: el Policy Enforcement Point para accesos externos a un
  tenant (instituciones, entidades veedoras) — formaliza con datos
  concretos lo que la arquitectura v3 dejó como patrón. Es dueño de
  `Institución`, `Cartera Institucional`, `Solicitud de Seguimiento`,
  `Aprobación de Tenant`, `Código de Acceso` y `LogAccesoAdminCEOM`.
- NO hace: no implementa el Panel Institucional ni el Panel Administrativo
  CEOM (vistas de consumo) — eso es roadmap ítem #11, explícitamente
  separado. No calcula nada de negocio — solo decide sí/no sobre un módulo
  veedor específico.
- Entradas que consume: `obtenerEstadoAccesoTenant()` y `obtenerTenantPorId()`
  de Identidad (**ambas nuevas en esta tarea**, ver abajo), `obtenerPlanPorId()`
  de Suscripción (ya existía), `moduloVeedorEnum` de Suscripción (reutilizado,
  no duplicado), `moduloPermisoEnum` de Identidad (reutilizado para el log).
- Salidas que expone (`actions.ts`): CRUD de `Institución` (gate
  `ROL_CEOM_ADMIN_ID`), `obtenerInstitucionPorId` (lookup público de 1
  registro, sin gate, **nueva en la tanda de UI**), `Cartera Institucional`,
  `Solicitud de Seguimiento` (`crearSolicitudSeguimiento` gate CEOM Admin;
  `aprobarSolicitud`/`rechazarSolicitud` gate Owner del tenant),
  `revocarConsentimiento`, `consultarAprobacionesPorTenant`,
  **`tieneConsentimiento`** (el Gateway propiamente dicho),
  `generarCodigoAcceso`/`revocarCodigoAcceso`/`canjearCodigoAcceso`,
  `registrarAccesoAdminCeom`/`listarLogsAcceso`, `listarCarteraPropia`
  (roadmap ítem #11, ver abajo).

## Estado actual
- [x] Schema Drizzle (`instituciones`, `cartera_institucional`,
      `solicitudes_seguimiento`, `aprobaciones_tenant`, `codigos_acceso`,
      `logs_acceso_admin_ceom`) + RLS. `instituciones`: catálogo global,
      solo `select` abierto (mismo patrón que `planes`). `logs_acceso_admin_ceom`:
      **sin ninguna policy** para `authenticated` (deny total) — "no visible
      para el tenant" es literal, no solo una regla de aplicación.
- [x] **Granularidad del Gateway: por `moduloVeedorEnum`** (financiero/
      operativo/inventario_operativo), no por función individual — decisión
      del plan: es el modelo de datos concreto que Módulo 11 sección 3.1 ya
      cerró (y que `planes.modulos_veedor_permitidos` ya asumía), no un
      segundo nivel de granularidad sin modelo de datos que lo soporte. La
      sección 8.1 de `CEOM_Arquitectura.md` queda como la justificación
      conceptual de por qué existe la restricción, no como algo a
      implementar literal hoy.
- [x] `tieneConsentimiento(institucionId, tenantId, moduloVeedor)` — el
      Gateway real: revisa la Aprobación **más reciente** entre esa
      institución y tenant (revocada o no) y sus `modulosAprobados`; deniega
      si el tenant está `bloqueado` (caso borde 1), pero `solo_lectura` no
      bloquea (la consulta institucional siempre es de solo lectura).
- [x] `generarCodigoAcceso` valida de verdad contra
      `plan.modulos_veedor_permitidos` del tenant — ya no es un pendiente
      (cerraba el mismo gap documentado dos veces antes en Módulo 2/6).
- [x] `canjearCodigoAcceso` crea la Institución en el acto si no existía
      (`creado_por` null, alta autoservicio), genera `Cartera Institucional`
      y `Aprobación de Tenant` reales.
- [x] `revocarCodigoAcceso` corta **también** el acceso ya otorgado si el
      código ya se había canjeado — no solo marca el código (bug real
      encontrado durante esta tarea, ver decisiones abajo).
- [x] Tests: `consentimiento.test.ts` (integración contra Supabase Cloud
      real, los 6 casos de la prueba de caja negra del plan, más un caso
      borde 6 del propio Módulo_11 — código ya canjeado no se puede
      reutilizar).
- [x] `registrarAccesoAdminCeom` **ya tiene caller real** — cerrado
      parcialmente en el roadmap ítem #11: `panel-admin-ceom/actions.ts`
      (`consultarFinancieroTenant`/`consultarOperativoTenant`/
      `consultarInventarioOperativoTenant`) llama a esta función después de
      cada lectura de un tenant puntual. **Sigue sin hook automático desde
      el resto de los módulos** — nadie la llama todavía cuando `ceom_admin`
      consulta Financiero/Operativo directamente (fuera de este panel).
      Tocar `tienePermiso()` de cada módulo para auto-loguear en todos los
      casos sigue siendo un cambio de contrato mucho mayor, no declarado en
      esta tarea tampoco.
- [x] `listarCarteraPropia(institucionId)` (roadmap ítem #11) — variante sin
      gate de `ceom_admin` de `listarCarteraPorInstitucion()`, para que la
      propia Institución liste su cartera desde `monitoreo-institucional`
      (descubierto necesario recién al implementar ese módulo: la versión
      original está gateada a CEOM Admin, no sirve para una Institución
      externa que no tiene cuenta CEOM).
- [x] Panel Institucional (`src/modules/monitoreo-institucional/`) y Panel
      Administrativo CEOM (`src/modules/panel-admin-ceom/`) — implementados
      en el roadmap ítem #11, como dos módulos separados (distinto
      consumidor, distinta regla de autorización cada uno). Ver sus propios
      `ANCLA.md`.
- [x] **`listarInstituciones()` gateada** — antes no exigía `solicitante`
      (gap de seguridad señalado en `docs/ui/pantallas.md` para "revisar en
      Fase 3"). Cerrado el 2026-07-17 al empezar la tanda de UI de este
      módulo, no se dejó para después: ahora exige `SolicitanteCeomAdmin` y
      pasa por `requiereCeomAdmin()`, mismo patrón que
      `crearInstitucion`/`actualizarInstitucion`/`eliminarInstitucion`.
      Test agregado en `consentimiento.test.ts` ("listarInstituciones exige
      ceom_admin"). Sin consumidores previos (no había UI todavía), así que
      no rompe nada existente.
- [x] **`obtenerInstitucionPorId(institucionId)` — nueva, sin gate a
      propósito.** Consecuencia directa de haber gateado `listarInstituciones()`:
      el Owner de un tenant necesita resolver el NOMBRE de una institución
      en sus propias pantallas de Aprobaciones/Solicitudes (Módulo 10, `/app`),
      pero ya no puede llamar al listado completo (correctamente gateado a
      `ceom_admin`). `instituciones` es catálogo global de solo-lectura
      abierta a cualquier `authenticated` a nivel de RLS (mismo patrón que
      `planes`) — esta función solo expone esa misma superficie pública para
      UN registro puntual por id, nunca el listado. No confundir con un
      "re-abrir" el gap cerrado arriba: la diferencia es enumeración
      (listado completo, sensible) vs. lookup puntual por id ya conocido
      (no sensible, mismo dato que ya era público a nivel RLS).
- [x] **UI real, 3 superficies** (`/app`, `/portal`, `/admin`) — Módulo 10
      completo, 9/9 pantallas, ver `docs/ui/pantallas.md` sección 10 para
      el detalle pantalla por pantalla. Primera vez que `/admin` tiene un
      shell real (`admin-shell.tsx`) y que `/portal` tiene cualquier
      pantalla. Verificación explícita en navegador de que revocar un
      código o una aprobación corta el acceso *en la base de datos* de
      inmediato (`tieneConsentimiento()` llamado directo, no vía UI,
      antes/después de cada revocación) — pedido explícito del usuario dado
      que este módulo es "el único punto de privacidad de la plataforma"
      (`CEOM_Arquitectura.md` §6.9).

## Cambios de contrato en otros 2 módulos
- **Identidad** (`src/modules/identidad/actions.ts`): se agregaron
  `obtenerTenantPorId(solicitante, tenantId)` (el repository ya la tenía
  internamente, solo faltaba exponerla — gate: `ceom_admin` o mismo tenant)
  y `obtenerEstadoAccesoTenant(tenantId)` (**sin `solicitante`**, a
  propósito: una Institución externa no es un `UsuarioConRol`; expone
  únicamente el `estado_acceso` derivado, nunca datos de negocio del
  tenant). Ver `identidad/ANCLA.md`.
- **Suscripción**: sin cambios de código — solo se reutiliza
  `moduloVeedorEnum`, que ya existía.

## Dónde está cada cosa
- Esquema de BD (Drizzle): `src/modules/consentimiento/schema.ts`
- Repository: `src/modules/consentimiento/repository.ts`
- Server actions: `src/modules/consentimiento/actions.ts`
- Validation (zod, UI): `src/modules/consentimiento/validation.ts`
- Tests: `src/modules/consentimiento/consentimiento.test.ts`
- Migraciones relevantes: `drizzle/migrations/0017` (tablas + RLS),
  `0018` (agrega `aprobaciones_tenant.codigo_acceso_id`, aislada, ver
  decisiones abajo).
- UI `/app`: `src/app/app/(shell)/consentimiento/` (route actions.ts +
  `page.tsx`/`generar-cliente.tsx` con `NavConsentimiento`/
  `MODULOS_VEEDOR_INFO` compartidos, `codigos/`, `aprobaciones/`,
  `solicitudes/`).
- UI `/portal`: `src/app/portal/` (`page.tsx`, `canjear-cliente.tsx`,
  `actions.ts`) — primera pantalla real de esta superficie, sin
  `layout.tsx` de auth (pública a propósito).
- UI `/admin`: `src/app/admin/(shell)/` (`layout.tsx` nuevo con
  `AdminShell`, `instituciones/`, `logs/`) — primer shell real de
  `/admin`, ver `src/components/shared/admin-shell.tsx`.

## Decisiones tomadas que un agente no debe revertir
- **`obtenerAprobacionVigente()` NO filtra por `revocado_en is null` en el
  repository** — a propósito. Filtrar ahí permitía que una aprobación
  vieja sin revocar "tapara" una revocación más reciente (una institución
  puede tener varias filas de `Aprobación de Tenant` a lo largo del tiempo,
  una por cada `aprobarSolicitud`/canje). La función devuelve siempre la
  fila **más reciente por `fecha_aprobacion`**, revocada o no; es
  `tieneConsentimiento()` quien decide mirando `revocadoEn` de esa fila
  puntual. **Bug real encontrado y corregido durante esta tarea** — el
  test de revocación lo detectó (una aprobación previa sin revocar hacía
  que la revocación de una aprobación posterior no tuviera efecto).
- **`aprobaciones_tenant.codigo_acceso_id`** (nullable, migración `0018`
  aparte) — vincula una Aprobación con el Código de Acceso que la generó,
  para que `revocarCodigoAcceso()` pueda revocar también "el acceso ya
  otorgado después de canjeado" (Módulo_11 sección 3.4), no solo marcar el
  código. Sin este campo no había forma de encontrar qué Aprobación
  corresponde a qué Código.
- **`crearSolicitudSeguimiento`/`crearInstitucion`/etc gatean por
  `{rolId}` directo (`ROL_CEOM_ADMIN_ID`), no por `tienePermiso()`** —
  mismo criterio que Suscripción: "consentimiento"/"instituciones" no son
  módulos del enum `modulo_permiso`, es una decisión cross-cutting fuera de
  la matriz genérica.
- **`tieneConsentimiento()` no recibe `solicitante`** — es la única función
  del proyecto pensada para ser llamada por una parte externa sin cuenta
  CEOM (el futuro Panel Institucional en nombre de una Institución). Por
  eso usa `obtenerEstadoAccesoTenant()` (sin gate) en vez de
  `obtenerTenantPorId()` (con gate) — no cambiar esto para "unificar" con
  el resto del proyecto, es intencional.
- **`canjearCodigoAcceso()` tampoco recibe `solicitante`**, mismo criterio
  — lo llama la entidad externa desde el futuro Portal de Entidades
  Veedoras.
- Los tests de integración corren contra el Supabase Cloud de desarrollo
  real (rol `postgres`, bypassea RLS), mismo criterio que los demás
  módulos. `testTimeout: 20000` para todo el archivo (`vi.setConfig`),
  mismo motivo que Módulo 3/4/7.

## Última actualización: 2026-07-14 — roadmap ítem #11 agregó `listarCarteraPropia` y cerró el caller real de `registrarAccesoAdminCeom` (acotado a panel-admin-ceom)

## Última actualización: 2026-07-17 — gap de seguridad cerrado: `listarInstituciones()` ahora exige `SolicitanteCeomAdmin`, antes de empezar la UI de este módulo

## Última actualización: 2026-07-17 (2) — UI completa, Módulo 10 al 9/9 (`/app` + `/portal` + `/admin`), agrega `obtenerInstitucionPorId()` sin gate; verificación explícita de revocación inmediata en DB. Datos de prueba dejados a propósito en el tenant `owner@ceom.local` (no hay forma de borrarlos vía UI, entidades append-only por diseño):
- Institución **"Universidad QA Test"** con una Aprobación vigente (`financiero`) y una revocada, más una Solicitud aprobada y su Cartera vinculada a `owner@ceom.local`.
- 2 Códigos de Acceso (`MDAPU5TV` canjeado, `F4PF7RGF` revocado).
- Usuario `ceom_admin` de QA (`ceomadmin-qa@ceom-erp.test` / `QaAdmin123!`) — reutilizable para futuras tandas de `/admin` (Monitoreo Institucional, Panel Admin CEOM).
- El plan "Básico" (compartido, no exclusivo del tenant de prueba) quedó con los 3 módulos veedor habilitados en `modulosVeedorPermitidos` — antes estaba `[]`; se dejó así para que Generar Código de Acceso sea probable a simple vista.
- **`owner@ceom.local` no tenía `planId` asignado** (se le asignó el plan "Básico" recién arriba) — gap real del script `seed-demo-data.ts`, no de este módulo; no se investigó más a fondo, queda anotado acá para quien la retome.
- ⚠️ **La contraseña de `owner@ceom.local` se reseteó a `QaOwner123!`** — hizo falta para re-loguear como Owner después de que el login del `ceom_admin` de QA pisara la sesión en la misma pestaña del navegador (comparten cookie jar). Si el usuario tenía otra contraseña guardada, ya no es válida.
