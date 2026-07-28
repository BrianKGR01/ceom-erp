# Arranque desde cero — ¿se puede levantar el sistema entero desde una base vacía?

> Auditoría, **sin arreglos**. Generada el 2026-07-27 sobre `dev`, antes de la tanda 3.3.
> Disparador: el arranque real no va a ser sobre la base de desarrollo actual — se va a crear un
> proyecto de Supabase nuevo (o resetear éste) dejando solo los administradores del equipo CEOM, y
> desde ahí empieza el piloto. **Ese día se aplican todas las migraciones sobre una base limpia y se
> siembra desde cero.** Esto responde qué tan confiable es eso hoy.
>
> **Lo que esta auditoría NO hizo:** ejecutar el arranque completo contra un proyecto de Supabase
> nuevo. Todo lo de abajo está verificado leyendo el código y contra la base actual; los dos puntos
> marcados **`⚠ no ejecutado`** son afirmaciones sobre lo que va a pasar, no observaciones.

## Respuesta corta

**Sí se puede, y el camino existe entero — pero no es desatendido, y el grueso del trabajo no está en
los comandos: está en 13 piezas de configuración del proyecto de Supabase que no viven en ningún
archivo del repo.**

Los comandos son la parte fácil y ya son confiables. Lo que puede frenar un arranque son 2 pasos que
dependen de una bandeja de correo real ([§2](#2-los-dos-pasos-que-dependen-de-una-bandeja-de-correo))
y, sobre todo, **el inventario de [§3.1](#31-inventario-la-configuración-que-no-viaja-a-un-proyecto-nuevo)**:
`clone` + `migrate` + `seed` **no lo reproduce**, y cada ítem que falte rompe algo con el síntoma
lejos de la causa. Uno de ellos —las plantillas de correo— deja al primer negocio real congelado
desde el alta sin que nada falle del lado de la app.

| # | Paso | Estado | Depende de |
|---|---|---|---|
| 0 | Proyecto de Supabase + 6 variables de entorno | ✅ Documentado (`.env.example`) | — |
| 0.5 | **Configuración del proyecto que no vive en el repo** (13 ítems) | 🔴 **No versionada, no reproducible** | Ver [§3.1](#31-inventario-la-configuración-que-no-viaja-a-un-proyecto-nuevo) |
| 1 | `pnpm drizzle-kit migrate` (49 migraciones) | ✅ Confiable **desde la tanda 3.3** | — |
| 2 | `pnpm seed:admin <email>` | 🟡 **Requiere bandeja real** | Correo del admin |
| 3 | `pnpm storage:setup` | 🔴 **No está en ninguna lista de orden** | — |
| 4 | `pnpm seed:tenant …` | 🟡 **Requiere bandeja real** | Correo del Owner |
| 5 | `pnpm seed:demo [owner]` | ✅ Desatendido | Paso 4 |
| 6 | `pnpm seed:instituciones <admin>` | ✅ Desatendido | Paso 2 |

---

## 1. Migraciones — confiable, pero recién desde ahora

Las 49 migraciones aplican de cero. Hay evidencia real, no supuesta: el commit `33625b5` (H-49) las
ensayó contra un `postgres:16` vacío usando `scripts/ci/apply-stub.mjs` +
`stub-supabase-schemas.sql`, que crea los esquemas `auth`/`storage` que las migraciones referencian
y que en un Postgres pelado no existen. Ese andamio **está en el repo y funciona**, y es el mismo
que usa CI.

**Lo que cambió esta semana.** Hasta la tanda 3.3, `drizzle-kit migrate` podía **saltear una
migración e imprimir `applied successfully`** si su `when` del journal era menor que el de la
anterior — pasó con la `0047`, casi vuelve a pasar con la `0048`, y la causa raíz (`0043` sellada a
mano con un `when` 16 horas en el futuro) llevaba armada desde el 23 de julio. Contra una base
**vacía** el orden por `when` no importa tanto como contra una que ya tiene estado, pero el riesgo
era real y silencioso. Ahora `journal-migraciones.test.ts` lo cierra con tres chequeos: ningún
`when` en el futuro, orden por `when` == orden de prefijos, e `idx` consecutivos.

**Verificado contra la base actual, objeto por objeto y no por mensaje de éxito:** el esquema vivo
coincide **exacto** con el snapshot `0048` — 50 tablas, todas sus columnas, ninguna de más.

**Un detalle que conviene saber y que no es un problema:** `0021_simulaciones` figura en el journal
y **no** tiene fila en `drizzle.__drizzle_migrations` (48 filas contra 49 entradas). Sus objetos
existen todos —enum, 2 tablas, 4 policies, RLS en ambas, 3 FKs—, así que está aplicada, solo no
registrada. Es un artefacto histórico de **esta** base; un arranque desde cero la aplica normal.

## 2. Los dos pasos que dependen de una bandeja de correo

> **Corrección (2026-07-27).** La primera versión de esta sección afirmaba que el límite de envíos
> del **SMTP por defecto de Supabase** se agota con varios tenants. **Esa premisa es vieja y no
> aplica**: el proyecto usa **SMTP propio con Resend y el dominio `ceom.lat` verificado** desde el
> 2026-07-23, precisamente para levantar esa restricción.
>
> Registrado con evidencia en
> [`docs/decisiones/recuperacion-de-acceso.md` §11.1](../decisiones/recuperacion-de-acceso.md), que
> anota las dos restricciones del servicio incorporado —destinatarios limitados al equipo de
> Supabase, y cupo horario— como **ya no vigentes**, con una observación de los logs de Auth:
> invitación a una dirección de Gmail a las `15:33:20`, clic a las `15:34:27`.
>
> **Lo que pude verificar yo y lo que no:** confirmé el registro en el repo y su fecha. **No** pude
> confirmarlo contra los logs de Auth en vivo — solo devuelven las últimas 24 h y ahí no hay ningún
> envío, únicamente altas de usuarios de la suite de tests. Lo tomo del registro, no de observación
> propia.

Lo que sí sigue siendo cierto, y es el punto de esta sección:

- **`seed:admin`** usa `inviteUserByEmail` (`scripts/seed-admin.ts`). El primer `ceom_admin` recibe
  un correo real y **tiene que abrirlo para fijar su contraseña**. Sin eso existe la fila en
  `usuarios` pero nadie puede entrar a `/admin`.
- **`seed:tenant`** llama a `crearTenant()`, que también invita al Owner por correo
  (`identidad/actions.ts:400-407`). Mismo efecto: el negocio existe y su dueño no puede entrar.

Son **dos esperas humanas** en medio de una secuencia que parece automatizada. No son un límite
técnico: es el diseño correcto —el Owner real fija su propia contraseña, CEOM nunca la ve— y hay que
tenerlo previsto en el guion del arranque, no descubrirlo ese día.

`seed:instituciones` **no** tiene este problema: crea sus usuarios de Auth con
`createUser({ email_confirm: true })` y contraseña conocida, precisamente porque un seed no puede
depender de una bandeja.

> **✅ Decidido (2026-07-27) — alta uno por uno, asistida por el equipo CEOM.** Para 3-10 negocios es
> el **modelo de go-to-market**, no una limitación, y ya está escrito así en
> [04-camino-al-lanzamiento.md](04-camino-al-lanzamiento.md). **No se construye ningún camino de alta
> masiva.**

**Y la consecuencia que esto destapa, que es más grande que la sección entera:** si el SMTP vive en
la configuración de Supabase Auth, **no viaja a un proyecto nuevo**. Es un caso de una categoría
completa — ver [§3.1](#31-inventario-la-configuración-que-no-viaja-a-un-proyecto-nuevo).

## 3. El paso que no está en ninguna lista

**`pnpm storage:setup` crea el bucket `tenant-uploads`, y no figura en el orden de bootstrap.**

Drizzle no modela buckets —viven en el sistema de Storage de Supabase, no en tablas—, así que
**ninguna migración lo crea**. Las policies de `storage.objects` sí son una migración real
(`0024_storage_tenant_uploads_rls.sql`), lo cual empeora la trampa: **el día del arranque las
policies del bucket van a existir y el bucket no.** Todo lo que suba una imagen (logo del negocio,
foto de producto) falla, y el síntoma va a estar lejos de la causa.

Es el mismo modo de falla que esta auditoría persigue: un paso que existe, que nadie lista, y cuya
ausencia no falla hasta mucho después.

> **✅ Arreglado el 2026-07-27**, en commit aparte y antes de seguir: está en el orden de bootstrap
> de `dev-practices` §7.1 (que ahora son 5 pasos) **y** en el chequeo ejecutable de
> `scripts/_estado-entorno.ts`. Los dos lugares, no uno: el documento se puede olvidar, el chequeo
> no.

### 3.1 Inventario: la configuración que NO viaja a un proyecto nuevo

`storage:setup` no era un paso faltante suelto. Es un caso de **una categoría entera**: configuración
del proyecto de Supabase que no vive ni en `drizzle/migrations/` ni en el repo, y que por lo tanto
**un `clone` + `migrate` + `seed` no reproduce**. Cada ítem de esta lista va a fallar el día del
arranque con el síntoma lejos de la causa.

> **Método (2026-07-27).** Barrido de 6 ángulos independientes (Auth por código, Auth por
> documentación, Storage, base de datos, API/Realtime, plataforma) + **verificación adversarial de
> cada ítem por separado**, con la instrucción de refutarlo. 40 candidatos → **27 confirmados, 7
> refutados con motivo, 6 sin verificar**. Los refutados están abajo con su razón: sirven para que
> nadie los vuelva a agregar. Cada ítem tiene evidencia `archivo:línea` o una consulta real.

### 🔴 Auth — acá está todo lo que rompe de verdad

| # | Qué configurar | Dónde | Si falta |
|---|---|---|---|
| **A1** | **Las dos plantillas de correo, al patrón `token_hash`**<br>`Invite user` → `{{ .SiteURL }}/app/auth/callback?token_hash={{ .TokenHash }}&type=invite`<br>`Reset password` → ídem con `type=recovery` | Authentication → Emails | **El paso bloqueante.** Las plantillas de fábrica usan `{{ .ConfirmationURL }}`, que resuelve por flujo implícito y devuelve los tokens en el fragmento `#access_token=…`, **que nunca llega al servidor**. `app/auth/callback/route.ts:48-51` no encuentra `token_hash` ni `type` y redirige a `/login?error=enlace_invalido`. **El Owner de un negocio recién creado nunca puede fijar contraseña y el negocio queda congelado desde el alta**, sin que nada falle del lado de la app |
| **A2** | **Site URL** = el origen público de la app, sin barra final (el mismo valor que `NEXT_PUBLIC_SITE_URL`) | Authentication → URL Configuration | Un proyecto nuevo trae **`http://localhost:3000` de fábrica**. Es doblemente load-bearing: es la base literal de todo enlace de correo (las plantillas lo interpolan) **y** es lo que vuelve válido por *same-origin* el `redirect_to` del magic link del portal. El cliente recibe una invitación que apunta a su propia máquina |
| **A3** | **SMTP propio** (Resend, dominio `ceom.lat` verificado) | Authentication → SMTP Settings | Con el SMTP incorporado, GoTrue **se niega a entregar** a direcciones que no sean del equipo de la organización de Supabase (`Email address not authorized`). No falla ruidosamente: el correo simplemente no llega |
| **A4** | **"Allow new users to sign up" habilitado** | Authentication → Sign In / Providers → Email | Lo asume el magic link institucional: GoTrue trata el primer `signInWithOtp()` de un correo nunca visto como un signup implícito (ya documentado en `consentimiento/ANCLA.md`). Deshabilitado, ninguna institución nueva puede entrar |
| **A5** | **Leaked password protection** (HaveIBeenPwned) | Authentication → Password Security | Nada funcional. Deja fijar contraseñas ya filtradas en `/app/definir-contrasena`, el único lugar donde el sistema fija contraseñas. Ya marcado como previo a cualquier despliegue en `03-seguridad.md` |
| **A6** | **Rate limits** de login, recuperación, magic link y **cupo de correos por hora** | Authentication → Rate Limits | El cupo de fábrica es el que se consume dando de alta los primeros negocios. Ya pasó en esta base: `email rate limit exceeded` a mitad de una tanda, y el límite es **por proyecto**, así que frena también la recuperación de quien ya estaba adentro |

> ⚠️ **A1 tiene una trampa que hay que leer antes de tocar nada: cambiar SOLO esas dos plantillas.**
> **NO** aplicar el patrón `token_hash` a `Confirm signup` ni a `Magic Link` — esas dos quedan como
> vienen. Los correos de `/app` salen de `inviteUserByEmail()`/`resetPasswordForEmail()` (flujo
> implícito) y por eso necesitan `token_hash`; en cambio **el magic link institucional sale de
> `signInWithOtp()` sobre `crearClienteServidor()`, que es `@supabase/ssr` y fuerza PKCE**
> (`src/lib/supabase/server.ts`), así que llega como `?code=` y se canjea con
> `exchangeCodeForSession` (`portal/auth/callback/route.ts:11,18`). **Reescribirlas "por coherencia"
> rompe el login de `/portal` entero**, y el síntoma queda lejísimos de la causa: la institución hace
> clic y cae en `/portal?error=enlace_invalido`, sin ningún error en los logs de Auth, porque GoTrue
> sí emitió un token válido.

### 🟠 Storage

| # | Qué configurar | Si falta |
|---|---|---|
| **S1** | **El bucket `tenant-uploads`** — `pnpm storage:setup` | Ninguna migración lo crea, pero las policies de `storage.objects` **sí** son migración real (`0024`). Ver §3. **Ya cubierto**: está en el orden de bootstrap y en el chequeo ejecutable |
| **S2** | **Los binarios ya subidos no viajan**, y las URLs guardadas llevan el project-ref viejo embebido | Un proyecto nuevo arranca con el bucket vacío. Toda `logo_url`/`imagen_url` que apunte al proyecto viejo queda rota. Para el piloto es irrelevante (no hay datos que migrar) — **importa el día que se migren datos reales, no éste** |

### 🟡 Base de datos y API

| # | Qué configurar | Si falta |
|---|---|---|
| **D1** | **Enforce SSL** en las conexiones a Postgres | Hoy las conexiones viajan sin TLS forzado. Es un toggle por proyecto, no viaja, y no rompe nada visible — por eso es fácil que nunca se active |
| **D2** | **Data API: qué esquemas expone PostgREST** | El backstop de RLS asume que `authenticated` puede llegar a `public` vía PostgREST (es contra lo que protege). Si el proyecto nuevo expone otro conjunto de esquemas, las verificaciones de RLS dejan de significar lo mismo |

### 🟡 Plataforma

| # | Qué configurar | Si falta |
|---|---|---|
| **P1** | **Reapuntar las 6 variables de entorno de Vercel al Supabase nuevo** | **Corrección de un dato viejo de esta auditoría**: `02-arquitectura-y-calidad.md:50` dice "Build de Vercel — no existe: cero proyectos conectados". **Ya no es cierto**: el proyecto `ceom-erp` existe, con Git conectado, preview por PR y producción desde `main`, 20 deploys READY. Lo que falta no es crearlo: es que **hoy sus 6 variables de Production apuntan al Supabase de desarrollo** — el mismo contra el que corre la suite y el seed. Sin reapuntarlas, producción escribe en la base de pruebas |
| **P2** | **`NEXT_PUBLIC_SITE_URL`** | Si no se setea **no falla nada**: cae a `http://localhost:3000` en silencio (`src/lib/site-url.ts`), y de ahí salen los `redirectTo` de todos los correos |
| **P3** | **Nada de la configuración de Auth está versionada** | No existe `supabase/config.toml` ni carpeta `supabase/` (verificado). No hay ningún archivo contra el cual diffear el proyecto nuevo, ni un `db push` que arrastre config de Auth. **Es el meta-hallazgo**: por eso esta lista tiene que existir y mantenerse a mano — y por eso el ensayo de §5 es la única verificación real |

### Lo que se refutó, y por qué no vuelve a la lista

La verificación adversarial tumbó 7 candidatos. Se dejan escritos para que nadie los re-agregue:

- **La allowlist de Redirect URLs no es lo que falta.** Verificado **en vivo** contra el proyecto con
  `admin/generate_link`: GoTrue honra cualquier URL del **mismo origen** que el Site URL sin entrada
  en la allowlist (`…/a/b/c?x=1` ✅, otro puerto ❌, otro esquema ❌, subdominio ❌). Como el Site URL
  tiene que ser el origen público de la app sí o sí, ambas rutas de callback quedan válidas por
  same-origin. Agregar `${SITE_URL}/**` es una precaución barata, **no un ítem faltante** — y
  listarlo desvía la atención de A1 y A2, que son las que de verdad rompen.
- **Los GRANTs a `authenticated`/`anon`/`service_role` vienen de fábrica.** El `ALTER DEFAULT
  PRIVILEGES` es parte de la plantilla que Supabase aplica al crear el proyecto: existe en el minuto
  cero, antes de la primera migración. `grep "default privileges"` sobre el repo da 4 hits, los 4 en
  `scripts/ci/stub-supabase-schemas.sql` (que existe justamente porque un Postgres pelado **no** los
  trae).
- **La región del pooler y el project-ref en las connection strings** están parametrizados en
  `.env.example` (el único `.env` versionado) y fallan en el `connect` del paso 2, con el síntoma
  pegado a la causa — que es lo contrario del criterio de esta categoría.
- **Network Restrictions** es decisión de *hardening*, no ítem de arranque: no hay estado que no
  viaje y no rompe nada el día del arranque. Va a `04-camino-al-lanzamiento.md`, colgado de la tarea
  de conectar Vercel, que es cuando recién existe un egress que allowlistear.
- **`Confirm signup` y `Magic Link` en default** no es config faltante: **el estado correcto ES el de
  fábrica**. Queda como la advertencia pegada a A1.

### ⚠️ Seis candidatos sin verificar

La corrida se quedó sin presupuesto antes de terminar la verificación de estos, así que **no están
confirmados ni refutados** — se listan como pistas, no como hallazgos:

`6543 vs 5432` como diferencia funcional · el runtime de producción (Node 24) nunca corrió la suite
(CI usa Node 20) · las `NEXT_PUBLIC_*` se resuelven en build (cambiarlas sin redesplegar no tiene
efecto) · CI en verde no valida nada del proyecto nuevo (no tiene credenciales y los tests que las
necesitan se saltan solos) · plan del proyecto y política de backups · endurecimiento de Auth por
proyecto.




## 4. Lo que sí está resuelto y conviene no re-descubrir

- **El orden de bootstrap ya es ejecutable, no recordable.** Cada seed termina midiendo el estado
  real de la base y diciendo qué falta (`scripts/_estado-entorno.ts`). Alguien que corra solo
  `seed:demo` ve en pantalla que no hay ninguna institución.
- **El escenario de instituciones se puede sembrar desde cero** (`--reset`), y se corrió completo,
  con todas las ramas ejecutadas.
- **Las variables de entorno están completas y documentadas** en `.env.example`: `DATABASE_URL`,
  `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
  `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SITE_URL`.

## 5. El ensayo — requisito de cierre de la Etapa 3

> **✅ Decidido (2026-07-27) — proyecto de Supabase NUEVO, no reset del actual.**
>
> El motivo principal **no** es el que había recomendado yo (evitar la pregunta de `auth.users`, que
> es el menor): **si se resetea el único proyecto, el equipo se queda sin entorno de desarrollo y
> pasa a desarrollar contra la base que sirve a negocios reales.** El proyecto actual tiene que
> sobrevivir como `dev`, con sus datos de prueba y su escenario de instituciones sembrado.
>
> Y el argumento que cierra la discusión: **crear un proyecto nuevo es reversible; resetear no.**

**El ensayo se registra ahora y se ejecuta al cierre de la Etapa 3**, cuando el set de migraciones
esté quieto. Hacerlo antes obliga a repetirlo con cada migración nueva.

> ### Requisito de cierre de la Etapa 3
>
> **Ensayar el arranque completo contra un proyecto de Supabase nuevo, de punta a punta**, siguiendo
> el orden de bootstrap de `dev-practices` §7.1 y el inventario de [§3.1](#31-inventario-la-configuración-que-no-viaja-a-un-proyecto-nuevo).
>
> **El objetivo NO es probar una vez que funciona.** Es que **el arranque real sea la repetición de
> algo que ya salió bien, no un estreno.** La diferencia importa: un estreno con un negocio real
> esperando es el peor momento posible para descubrir cualquiera de los ítems del inventario.
>
> Cubre además las dos cosas que esta auditoría dejó marcadas `⚠ no ejecutado` y que **no se pueden
> cerrar leyendo código**:
>
> 1. **Si falta algo que hoy funciona solo porque la base actual ya tiene estado previo.** El ensayo
>    con contenedor limpio (§1) cubre las migraciones, pero **no** cubre nada que dependa de Supabase
>    Auth ni de Storage — que es justo donde están todos los puntos flojos.
> 2. **Que el inventario de §3.1 esté completo.** La única prueba de que no falta un ítem es que el
>    sistema levante entero sin tocar nada a mano fuera de esa lista.
