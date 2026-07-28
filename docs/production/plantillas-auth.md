# Las cuatro plantillas de correo de Supabase Auth

> **Qué es esto.** Las plantillas de correo son la pieza de configuración **más cara de perder** del
> proyecto: viven únicamente en el dashboard de Supabase (Authentication → Emails), no las toca
> ninguna migración ni ningún script, y si faltan **el Owner de un negocio recién creado no puede
> fijar contraseña nunca** — el negocio queda congelado desde el alta sin que nada falle del lado de
> la app.
>
> Este documento es el artefacto: qué tiene que decir cada una, cuáles se tocan, cuáles **no**, y por
> qué. El estado real del proyecto se captura con `pnpm auth:config`.

## La regla, en una tabla

| Plantilla | ¿Se personaliza? | Enlace |
|---|---|---|
| **Invite user** | ✅ **Sí** | `{{ .SiteURL }}/app/auth/callback?token_hash={{ .TokenHash }}&type=invite` |
| **Reset password** | ✅ **Sí** | `{{ .SiteURL }}/app/auth/callback?token_hash={{ .TokenHash }}&type=recovery` |
| **Confirm signup** | ❌ **No — queda de fábrica** | (la que viene, con `{{ .ConfirmationURL }}`) |
| **Magic Link** | ❌ **No — queda de fábrica** | (la que viene, con `{{ .ConfirmationURL }}`) |

**Las dos de abajo no son un olvido: es la configuración correcta.** Cambiarlas "por coherencia"
rompe el portal institucional entero. El porqué está abajo, y está acá justamente para que nadie
"mejore" la instrucción.

## Por qué la asimetría

Son **dos flujos de OAuth distintos** conviviendo en la misma app, y cada uno necesita lo contrario
del otro.

### `/app` — flujo **implícito**, necesita `token_hash`

Los correos de la aplicación de negocio salen de dos llamadas del **cliente admin** (service-role):

- `inviteUserByEmail()` — alta del primer `ceom_admin` (`scripts/seed-admin.ts`), alta de un negocio
  (`crearTenant`) e invitación de colaborador (`invitarUsuario`).
- `resetPasswordForEmail()` — "olvidé mi contraseña" y el cambio de contraseña desde `/app/mi-cuenta`.

GoTrue resuelve esos por **flujo implícito**: el `{{ .ConfirmationURL }}` de la plantilla de fábrica
redirige a un destino con los tokens **en el fragmento** (`#access_token=…`). Y el fragmento
**nunca se envía al servidor** — es una regla de HTTP, no una limitación de Next.js. Un Route Handler
no puede leerlo jamás.

Por eso `src/app/app/auth/callback/route.ts` lee `token_hash` y `type` de los **query params** y
llama a `verifyOtp()`. Si esos dos parámetros no están, corta con `/login?error=enlace_invalido`.

**Con la plantilla de fábrica, ese handler nunca recibe nada.** El síntoma es cruel: la persona hace
clic en el correo que le acabás de mandar y la app le dice que el enlace está roto. Y las dos filas
(`auth.users` y `usuarios`) existen y se ven perfectas, así que desde la base el alta parece exitosa.

### `/portal` — flujo **PKCE**, necesita quedarse como está

El magic link de las instituciones sale de otro lado: `signInWithOtp()` sobre
`crearClienteServidor()` (`src/modules/consentimiento/actions.ts`), que es `@supabase/ssr` y
**fuerza `flowType: "pkce"` internamente**. Ese flujo entrega un `?code=` en el query, que
`src/app/portal/auth/callback/route.ts` canjea con `exchangeCodeForSession()`.

PKCE funciona con la plantilla de fábrica. **Reescribirla al patrón `token_hash` la rompe**: el
handler del portal no encuentra `code`, sale por su rama de error, y la institución cae en
`/portal?error=enlace_invalido` — **sin ningún error en los logs de Auth**, porque GoTrue emitió un
token perfectamente válido. Es el síntoma más lejano de su causa de todo el sistema.

### Y `Confirm signup` es del mismo flujo que Magic Link

GoTrue trata el primer `signInWithOtp()` de un correo nunca visto como un signup implícito y manda la
plantilla de confirmación. O sea: **`Confirm signup` es parte del camino de una institución nueva**,
no del de `/app`. Ya estaba anotado en `src/modules/consentimiento/ANCLA.md` como una rareza de copy
("Confirm your email address" en vez de "magic link") — es la misma pieza.

## Una pista vieja que era esto mismo, sin conectar

`consentimiento/ANCLA.md` registró el 2026-07-18 que **`admin.auth.admin.generateLink()` no sirve
para simular el flujo real**, porque devuelve formato *implicit* (tokens en el fragmento) mientras
que `crearClienteServidor()` fuerza PKCE. Se leyó, con razón, como una molestia de testing: "no hay
atajo para probar el magic link sin bandeja real".

**Era el mismo desajuste, visto desde adentro, cinco días antes de que se entendiera desde afuera.**
La misma frontera implícito/PKCE que hace que `generateLink()` no sirva para simular el portal es la
que obliga a personalizar dos plantillas y a no tocar las otras dos. Lo que faltó fue conectar "esta
herramienta devuelve implicit" con "entonces los correos de `/app`, que también son implicit,
necesitan otra plantilla".

Vale registrarlo porque el patrón se repite: **una observación correcta archivada bajo la categoría
equivocada** ("molestia de testing" en vez de "propiedad del flujo de Auth") deja de estar disponible
para el problema que sí resuelve.

## Cómo verificar el estado real, y cómo capturarlo

```bash
SUPABASE_ACCESS_TOKEN=sbp_xxx pnpm auth:config
```

Escribe `docs/production/auth-config.snapshot.json` — versionable y diffeable — e imprime un
✅/❌ por plantilla contra la regla de arriba. Con `--check` compara sin escribir, para detectar que
alguien tocó el dashboard sin actualizar el snapshot.

El token es un **Personal Access Token de la cuenta**
(https://supabase.com/dashboard/account/tokens), no la service-role ni la publishable: la Management
API es otra superficie. Deliberadamente no se lee de `.env.local` — es credencial de cuenta, no de
proyecto.

## Estado al 2026-07-28: **mixto y desconocido** — que es peor que cualquiera de los dos extremos

**No pude leer las plantillas**: no hay token de Management API en este entorno ni CLI de Supabase
instalada. Lo que sigue es lo que se puede afirmar desde el registro y desde la base, y **no
alcanza**.

**Evidencia de que al menos una parte está aplicada:**

- `/portal` figura como *"magic link de reingreso, verificado con **click real de email**"*
  (`consentimiento/ANCLA.md`, 2026-07-18) — con el detalle del `auth_user_id` vinculado y
  `last_sign_in_at` poblado ~1 minuto después del `created_at`.
- La institución *"institucion prueva"* tiene un `auth.users` real con `last_sign_in_at` del
  **2026-07-25**. **Un `last_sign_in_at` no se produce si el enlace no aterrizó.**
- **H-05** (recuperación de contraseña) figura cerrado como completo el **2026-07-23**.

**Evidencia de que al menos una parte está pendiente:**

- `docs/decisiones/recuperacion-de-acceso.md` §11.5 (2026-07-23) lista las dos plantillas de `/app`
  como **"el único paso bloqueante"**, y lista como pendiente *"el clic real desde una bandeja de
  entrada… **después del paso 1**"*.
- **Nada posterior en el repo dice que se hayan aplicado.**

**Y una lectura fácil que hay que evitar:** §11.1 del mismo documento dice *"el correo ya
funciona"*, pero eso es sobre **entrega** (hay SMTP propio con Resend; la evidencia citada es
"invitación a las 15:33:20, clic a las 15:34:27"). Entrega y clic **no** son lo mismo que "el clic
aterrizó bien en la app".

### Por qué "mixto y desconocido" es el peor estado

Las dos evidencias conviven sin contradecirse, porque **son de flujos distintos**: `/portal` (PKCE,
plantillas de fábrica) puede estar sano mientras `/app` (implícito, plantillas custom) no lo está —
es exactamente la asimetría de este documento.

Lo que **nadie sabe hoy** es cuál de los cuatro flujos está sano:

| Flujo | Plantilla | ¿Hay evidencia de que funcione? |
|---|---|---|
| Institución entra a `/portal` | Magic Link / Confirm signup (fábrica) | ✅ `last_sign_in_at` real del 2026-07-25 |
| Recuperar contraseña en `/app` | Reset password (custom) | 🟡 H-05 cerrado el 23/07, pero §11.5 lo lista pendiente el mismo día |
| Invitación de Owner / colaborador | Invite user (custom) | ❌ Ninguna |
| Alta del primer `ceom_admin` | Invite user (custom) | ❌ Ninguna |

Un estado mixto y no medido es peor que "todo pendiente" (que se resuelve aplicando la lista) y peor
que "todo hecho" (que se resuelve no tocando nada): **invita a asumir que lo que anda para uno anda
para todos**, que es justo la conclusión que la asimetría de este documento desmiente.

> **`pnpm auth:config` es lo que cierra la pregunta**, y su salida se commitea como
> `docs/production/auth-config.snapshot.json`. Hasta entonces, **el runbook de
> [`09-arranque-desde-cero.md`](../auditoria-prelanzamiento/09-arranque-desde-cero.md) §3.2 describe
> valores que nadie puede verificar** — y eso, no la redacción de las plantillas, es el hallazgo.
