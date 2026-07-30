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
  (roadmap ítem #11, ver abajo). **Identidad de Institución (magic link,
  nueva):** `obtenerInstitucionActual`, `vincularInstitucionAutenticada`,
  `solicitarMagicLinkInstitucion` — ver sección propia abajo y
  `CEOM_Arquitectura.md` sección 8.3 para la decisión completa.

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
- [x] **Identidad de Institución vía magic link (Supabase Auth)** — cierra
      el gap señalado al terminar la UI del módulo: una Institución no tenía
      forma de volver a `/portal` después del primer canje. Decisión de
      arquitectura completa en `CEOM_Arquitectura.md` sección 8.3 (por qué
      `instituciones.id` NO se unifica con `auth.users.id` como sí pasa con
      `usuarios.id`, y por qué `tienePermiso()` no se toca). Resumen de lo
      construido:
      - `instituciones` gana `email` y `auth_user_id` (ambas nullable,
        índices únicos parciales) — migración `0027`, puramente aditiva.
      - `obtenerInstitucionActual()` — análogo de `obtenerUsuarioActual()`
        para esta identidad, resuelve por `auth_user_id`.
      - `vincularInstitucionAutenticada(email, authUserId)` — vínculo
        perezoso (lazy link), llamado únicamente desde el Route Handler de
        callback.
      - `solicitarMagicLinkInstitucion(email, emailRedirectTo)` — nunca
        crea un `auth.users` huérfano para un email sin Institución
        asociada; siempre devuelve éxito genérico (anti-enumeración).
      - `src/app/portal/auth/callback/route.ts` — **primer Route Handler
        del proyecto** (justificado: el link del correo lo visita el
        navegador directo por GET, una Server Action no puede ser destino
        de un email).
      - `DatosInstitucion` gana `email?` — se captura en el alta mínima del
        wizard de canje existente (no es un paso nuevo) y en el CRUD de
        `/admin`.
      - Nueva env var `NEXT_PUBLIC_SITE_URL` (`.env.example`) para
        construir `emailRedirectTo` sin depender de headers de la request.
      - **Verificado:** vínculo perezoso + idempotencia (3 tests nuevos en
        `consentimiento.test.ts`, contra Supabase Cloud real), anti-
        enumeración (confirmado que no se crea `auth.users` para un email
        sin Institución), rutas de error del callback en navegador
        (`?error=enlace_invalido` sin `code`, mensaje mostrado correctamente
        en `/portal` — bug real encontrado y corregido: la página
        redirigía con el query param pero nunca lo leía). `pnpm typecheck`/
        `lint`/`test` completos en verde (153 tests).
      - **✅ Validado end-to-end con un click real de email (2026-07-18).**
        `admin.auth.admin.generateLink()` (usado antes para simular el
        flujo sin bandeja real) devuelve formato *implicit* — no
        representativo del flujo real, ver decisión abajo. El ciclo
        completo se probó con una bandeja de correo real (Gmail): canje
        con email → pedir reingreso desde `/portal` → click real en el
        enlace recibido → `/portal` mostró "Hola, {nombre}" (el estado
        logueado). Confirmado además contra la base:
        `instituciones.auth_user_id` quedó vinculado a un usuario real de
        Supabase Auth con `email_confirmed_at` y `last_sign_in_at`
        poblados, ~1 minuto después de `created_at` — coincide exacto con
        el timing real del click. `crearClienteServidor()` (`@supabase/ssr`)
        generó correctamente un link `?code=` (PKCE) para el flujo real;
        el Route Handler de callback lo procesó sin necesitar ningún
        cambio de código.

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
  decisiones abajo), `0027` (agrega `instituciones.email`/`auth_user_id` +
  2 índices únicos parciales, puramente aditiva).
- UI `/app`: `src/app/app/(shell)/consentimiento/` (route actions.ts +
  `page.tsx`/`generar-cliente.tsx` con `NavConsentimiento`/
  `MODULOS_VEEDOR_INFO` compartidos, `codigos/`, `aprobaciones/`,
  `solicitudes/`).
- UI `/portal`: `src/app/portal/` (`page.tsx` ahora chequea
  `obtenerInstitucionActual()` primero, `canjear-cliente.tsx` con el
  toggle de reingreso, `actions.ts` con
  `solicitarMagicLinkInstitucionAction`/`cerrarSesionInstitucionAction`,
  `auth/callback/route.ts` — primer Route Handler del proyecto).
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
- **Etapa 4.b.0 del backstop de RLS (docs/security/PLAN-RLS-BACKSTOP.md
  §16.9.3) agregó una invariante de esquema sobre lo de arriba, sin
  reemplazarlo:** `aprobaciones_tenant_vigente_unica` (índice único parcial
  sobre `(institucion_id, tenant_id) WHERE revocado_en IS NULL`) — a lo
  sumo UNA fila no revocada por par en todo momento.
  `repository.ts:crearAprobacionTenant()` revoca atómicamente cualquier
  fila previa del mismo par ANTES de insertar (dentro de una transacción)
  — sin eso, el `INSERT` violaría la constraint. Esto NO vuelve innecesario
  el `ORDER BY fecha_aprobacion DESC` de `obtenerAprobacionVigente()` (sigue
  haciendo falta para encontrar la única fila no-revocada, o la más
  reciente de las revocadas si nunca hubo una vigente) — lo que sí elimina
  es la AMBIGÜEDAD que motivaba el comentario original: ya no puede existir
  una fila vieja no-revocada "tapada" por una nueva revocada, porque la
  vieja se revoca sola al nacer la nueva. Backstop de RLS que depende de
  esta invariante: `public.tenant_tiene_consentimiento_vigente()`
  (`0038_tenant_tiene_consentimiento_vigente_function.sql`) — un simple
  `EXISTS ... WHERE revocado_en IS NULL`, sin `ORDER BY`, correcto
  únicamente porque esta invariante garantiza que esa fila (si existe) es
  la vigente. Ver `docs/security/PLAN-RLS-BACKSTOP.md` §16 para el
  diagnóstico completo y §16.9.1 para el diseño de la función.
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
- **`admin.auth.admin.generateLink()` NO sirve para simular un magic link
  real en tests/QA** — descubierto al intentar verificar el flujo
  end-to-end sin bandeja de entrada real. Devuelve un link de formato
  *implicit* (tokens en el fragmento `#access_token=...`, nunca llega al
  servidor), mientras que `crearClienteServidor()` (`@supabase/ssr`) fuerza
  `flowType: "pkce"` internamente (confirmado en
  `node_modules/@supabase/ssr/dist/main/createServerClient.js`) — son dos
  caminos de Supabase distintos. `exchangeCodeForSession()` en el Route
  Handler de callback espera el formato PKCE (`?code=`), que es el que
  realmente genera `signInWithOtp()` llamado desde `crearClienteServidor()`
  en producción — no confundir un fallo de `generateLink()` con un bug del
  Route Handler. Si un agente futuro necesita probar el flujo real sin
  bandeja de entrada, no hay atajo conocido: hace falta un email real.
  **Confirmado con un click real (2026-07-18):** el email que recibe una
  Institución la primera vez dice "Confirm your email address" / "Follow
  the link below to confirm this email address and finish signing up" —
  no "magic link" — porque GoTrue trata el primer `signInWithOtp()` de un
  email nunca visto como un signup implícito (crea el `auth.users` sin
  confirmar y manda la plantilla de confirmación de cuenta). No es un bug:
  el link funciona igual y completa el login. Reingresos posteriores del
  mismo email (con `auth.users` ya confirmado) deberían usar la plantilla
  real de "magic link" — no verificado en esta tanda por no ser necesario
  para cerrar el gap, pero queda anotado por si un agente futuro lo ve y
  se pregunta por la inconsistencia de copy entre el primer y segundo
  ingreso.

## Última actualización: 2026-07-14 — roadmap ítem #11 agregó `listarCarteraPropia` y cerró el caller real de `registrarAccesoAdminCeom` (acotado a panel-admin-ceom)

## Última actualización: 2026-07-17 — gap de seguridad cerrado: `listarInstituciones()` ahora exige `SolicitanteCeomAdmin`, antes de empezar la UI de este módulo

## Última actualización: 2026-07-17 (2) — UI completa, Módulo 10 al 9/9 (`/app` + `/portal` + `/admin`), agrega `obtenerInstitucionPorId()` sin gate; verificación explícita de revocación inmediata en DB. Datos de prueba dejados a propósito en el tenant `owner@ceom.local` (no hay forma de borrarlos vía UI, entidades append-only por diseño):
- Institución **"Universidad QA Test"** con una Aprobación vigente (`financiero`) y una revocada, más una Solicitud aprobada y su Cartera vinculada a `owner@ceom.local`.
- 2 Códigos de Acceso (`MDAPU5TV` canjeado, `F4PF7RGF` revocado).
- Usuario `ceom_admin` de QA (`ceomadmin-qa@ceom-erp.test` / `QaAdmin123!`) — reutilizable para futuras tandas de `/admin` (Monitoreo Institucional, Panel Admin CEOM).
- El plan "Básico" (compartido, no exclusivo del tenant de prueba) quedó con los 3 módulos veedor habilitados en `modulosVeedorPermitidos` — antes estaba `[]`; se dejó así para que Generar Código de Acceso sea probable a simple vista.
- **`owner@ceom.local` no tenía `planId` asignado** (se le asignó el plan "Básico" recién arriba) — gap real del script `seed-demo-data.ts`, no de este módulo; no se investigó más a fondo, queda anotado acá para quien la retome.
- La sesión de `owner@ceom.local` se perdió a mitad de la verificación porque el login del
  `ceom_admin` de QA en otra pestaña del navegador pisó la cookie (mismo cookie jar) — se
  restauró la contraseña original documentada en `reference_tenant_prueba_owner` (memoria del
  agente) para volver a entrar. Password final: la de siempre, sin cambios netos.

## Última actualización: 2026-07-22 — Etapa 4.b.0 del backstop de RLS: índice único parcial en `aprobaciones_tenant` + `crearAprobacionTenant()` revoca la fila previa
`aprobaciones_tenant_vigente_unica` (índice único parcial, migración `0037`) — ver la decisión nueva
arriba. `crearAprobacionTenant()` ahora corre dentro de una transacción propia que revoca cualquier
fila no-revocada previa del mismo par institución-tenant antes de insertar la nueva — comportamiento
nuevo, sin cambio de firma. No es parte de este módulo pero lo alcanza: `gatewayVigenciaBypassPolicy()`
(`src/db/rls.ts`) + `tenant_tiene_consentimiento_vigente()` (función SQL, `0038`) son el backstop de
RLS del Gateway sobre tablas de OTROS módulos (`compras`/`pagos_compra` de Proveedores, hoy) — leen
`aprobaciones_tenant` pero no la modifican ni le agregan policy propia (ver la REGLA DURA de
no-recursión en `schema.ts`). Detalle completo: `docs/security/PLAN-RLS-BACKSTOP.md` §16.

## Última actualización: 2026-07-18 — magic link de Instituciones (Supabase Auth), cierra el gap de reingreso a `/portal`
Decisión de arquitectura completa en `CEOM_Arquitectura.md` sección 8.3 (por qué `instituciones.id`
NO se unifica con `auth.users.id`, y por qué `tienePermiso()` no se toca). Resumen técnico y estado
de verificación: ver el bullet nuevo en "Estado actual" arriba. La institución/usuario de Auth
usados para probar el vínculo perezoso vía Vitest se crearon y eliminaron en el mismo ciclo, sin
residuo. Dos artefactos de prueba quedaron en `owner@ceom.local` (mismo criterio ya aplicado antes
en este módulo: entidades append-only, sin acción de borrado expuesta en la UI, y en este caso con
FKs desde 3 tablas que hacen inviable un cascade manual sin tocar auditoría real):
- **Smoke test del canje con email** (código `XEEBPSZS`, institución "Incubadora Smoke Test",
  email `smoke-test@ceom-erp.test`) — hecho por el agente para probar la UI.
- **Validación end-to-end real** (institución "institucion prueva", email real del usuario) — hecha
  por el usuario mismo, con una bandeja de correo real (Gmail), confirmando que el click real
  completa el login. Ver el bullet "✅ Validado end-to-end" arriba para el detalle.


## Última actualización: 2026-07-28 — Etapa 3 / tanda 3.3b: D-1, registro de acceso institucional

**Tabla nueva `logs_acceso_institucion`** (migración `0049`) + 3 funciones públicas
(`registrarAccesoInstitucion`, `listarAccesosInstitucion`, `resumenAccesosPropios`) + pantalla
`/app/consentimiento/accesos`.

**Las tres decisiones, y por qué no revertirlas:**

- **Falla CERRADO.** Si el registro no se puede escribir, la lectura **no se sirve**. El daño es
  asimétrico: una lectura que falla es una molestia visible y reintentable para la institución; una
  fila que falta es un hueco **silencioso y permanente** en la respuesta que recibe el negocio — y el
  negocio *le cree* al registro. Un log de auditoría que sub-reporta induce "nunca miró" con la
  autoridad de un dato. Es el principio rector #7 y el precedente de `solicitanteGateway()`.
  **No convertirlo en best-effort "para que la ficha no falle nunca"**: hay un test que lo afirma
  (`rejects.toThrow()`), y romperlo lo detecta.
- **Una fila por (institución, tenant, módulo, DÍA), no por lectura.** Abrir una ficha dispara 4
  lecturas; recargarla, 4 más. `consultas` conserva el "cuántas veces" sin una fila por vez. Sostiene
  el UPSERT el índice único `logs_acceso_institucion_dia_unico` — sin esa constraint,
  `onConflictDoUpdate` no tiene sobre qué resolver y cada lectura re-inserta. Crecimiento acotado
  (~16k filas/año para una incubadora de 15 negocios): **a diferencia de `intentos_canje`, este no
  necesita purga urgente.** Retención decidida: 24 meses, sin job todavía.
- **RLS estándar por tenant, no deny total.** Es la diferencia deliberada con
  `logs_acceso_admin_ceom`: **el negocio la ve**. Un registro que el dueño no puede leer no informa
  ninguna decisión.
- **`primera_consulta_en` no se toca en el `set` del UPSERT** — es el único dato que un UPDATE ciego
  perdería, y el que contesta "¿desde cuándo?".
- **La institución ve su propio resumen** y la ficha se lo dice. No era obligatorio: es lo que hace
  que esto sea transparencia simétrica y no vigilancia, y tiene un efecto concreto de privacidad
  para el negocio — una institución que sabe que cada consulta queda a la vista consulta distinto.
  La disuasión es parte del mecanismo y **solo funciona si se dice**.

**Gap del seed corregido en el camino:** `seed-instituciones.ts` creaba tenants sin
`onboarding_completado_en`, así que el Owner caía en el wizard y **ninguna pantalla del negocio era
alcanzable** en una verificación de navegador. Descubierto al verificar esta misma pantalla.

## Última actualización: 2026-07-27 (3) — Etapa 3 / tanda 3.2: ciclo de vida del Código de Acceso (H-42, G-02, G-03, G-04, G-17, D-7)

**Cambio de contrato — dos funciones nuevas y una firma modificada:**

- **`canjearCodigoAccesoAutenticada(institucionId, codigo)`** — nueva. Cierra H-42. El
  `institucionId` que `canjearCodigoAcceso()` acepta desde el día uno **no lo llamaba nadie**:
  `/portal` era una bifurcación binaria y no existía ninguna ruta al canje con sesión. El caller
  (`canjearCodigoAutenticadaAction`, `app/portal/actions.ts`) resuelve la institución desde **su
  propia sesión**, nunca desde un id que venga del cliente.
- **`registrarIntentoCanjeYVerificarLimite(huella)`** — nueva (G-04). 10 intentos / 15 min. La
  huella la calcula la capa de ruta: un módulo de negocio no debe saber que existe una IP.
- **`generarCodigoAcceso()` ahora devuelve también `expiraEn`** (D-7). TTL de 30 días,
  **obligatorio**. `expira_en` null después de la migración `0047` se trata como **vencido**, nunca
  como "sin vencimiento".

**Decisiones que un agente no debe revertir:**

- **`canjearCodigoAccesoTx()` es una sola transacción, y el reclamo del código es un `UPDATE …
  WHERE id = ? AND estado = 'activo'`.** No volver a las tres escrituras sueltas: sin transacción,
  un fallo a mitad dejaba el código `canjeado` —irrecuperable, no hay acción que lo reactive— con la
  institución creada y sin acceso. Sin la condición, dos canjes simultáneos pasaban los dos.
- **La Institución nueva se crea DENTRO de esa transacción.** Si se saca afuera, un canje fallido
  deja una institución huérfana ocupando su correo para siempre (G-07 sigue abierto hasta la 3.4).
- **La cartera solo se inserta si no existía.** Es lo que permite re-otorgar (G-17) sin duplicar la
  fila.
- **`esCorreoDeInstitucionDuplicado()` camina la cadena de `cause`.** drizzle-orm 0.45.2 envuelve el
  `PostgresError` en `DrizzleQueryError`; mirar solo el error externo compila, parece razonable y no
  atrapa nada. Pasó en el primer intento de esta tanda y lo detectó el test.
- **El mensaje del correo duplicado no confirma que ese correo esté registrado.** Es deliberado
  (anti-enumeración, mismo criterio que `solicitarMagicLinkInstitucion`). Hay un test que afirma que
  el mensaje **no contiene** el correo — no relajarlo "para que sea más claro".

**Lo que sigue abierto y NO se tocó en esta tanda:** G-05/G-06/G-07/G-17-de-cartera (tanda 3.4),
X-01/X-02/X-03/G-14/G-15 (tanda 3.3), G-13/G-16/D-1 (tanda 3.5).

## Última actualización: 2026-07-27 (2) — Etapa 3 / tanda 3.1: seed propio del subsistema y limpieza de la institución del operador

**`pnpm seed:instituciones <emailCeomAdmin>`** (`scripts/seed-instituciones.ts`) — el subsistema no
tenía **ningún** dato de prueba reproducible: `seed:demo` puebla un tenant de negocio y no toca
consentimiento, así que todo lo que existía eran residuos manuales de tandas anteriores (los que este
mismo archivo documenta más arriba). Consecuencia medida antes de escribirlo: 0 instituciones con
`auth_user_id` (nadie podía entrar al portal autenticado) y ninguna con más de 1 negocio en cartera.

Siembra 4 negocios y 3 instituciones, e incluye a propósito los **estados degenerados** —institución
sin correo, institución sin vincular, negocio sin consentir a nadie, negocio de otro nicho con
`operativo` consentido, negocio con sucursal congelada, negocio con ingresos sin costo, códigos en los
3 estados—. Detalle completo y números exactos:
`docs/auditoria-prelanzamiento/antiguo/08-instituciones-punta-a-punta.md` §6.

**Dos cosas que un agente futuro debe saber:**

- **El escenario NO incluye un canje autenticado, y no es un olvido: es H-42.** Una institución ya
  registrada no puede canjear un segundo código, así que la Incubadora entra a su cartera de 3
  negocios por el camino 2 (CEOM vincula + solicitud + aprobación). El bloque de instituciones del
  script está gateado por existencia justamente por eso — un segundo canje con el mismo correo
  revienta con la violación de unicidad, sin capturar. Cuando la tanda 3.2 cierre H-42, esa guarda se
  puede relajar y los negocios B/C se pueden sembrar por el camino 1.
- **Se limpió la institución con el correo del operador de CEOM** (`admin@ceom.lat`, el caso G-16 que
  el diagnóstico había encontrado sembrado por accidente, con una aprobación vigente). El orden
  importa y está en el código: revocar la aprobación → dar de baja la cartera → **liberar el correo**
  → soft delete. Lo del correo es obligatorio hoy porque `instituciones_email_unique` es parcial sobre
  `email is not null` y **no** excluye `eliminado_en` (G-07): sin limpiarlo, la dirección quedaría
  bloqueada para siempre. Cuando la tanda 3.4 arregle G-07, ese paso se puede sacar.

## Última actualización: 2026-07-27 — H-49: el registro de accesos muestra los del día en curso

`listarLogsAcceso` sigue recibiendo `{desde, hasta}` en días locales; `listarLogsAccesoAdminCeom`
pasa a recibir `{inicio, fin}` con el borde superior exclusivo. Antes, filtrar "hasta hoy" no
mostraba ni un acceso de hoy: `creado_en` es timestamp y el `<= hasta` cortaba a las 20:00 del día
anterior.

**Decisión de alcance:** esta pantalla usa una zona **única y fija** (`ZONA_HORARIA_NEGOCIO`), no
`zonaHorariaTenant()`. Es la auditoría de la plataforma, no el reporte de un negocio: el admin puede
filtrar sin elegir tenant, y si la zona fuera por negocio dos filas del mismo listado se cortarían
con días distintos.

Contexto completo: `docs/auditoria-prelanzamiento/antiguo/05-dia-local-y-reportes.md`.
