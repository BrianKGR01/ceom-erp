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

**Sí se puede, y el camino existe entero — pero no es desatendido: tiene 2 pasos que dependen de una
bandeja de correo real y 1 que no está en ninguna lista.** Ninguno es un agujero; los tres son
sorpresas si nadie los anticipó, y el día del arranque es el peor momento para descubrirlos.

| # | Paso | Estado | Depende de |
|---|---|---|---|
| 0 | Proyecto de Supabase + 6 variables de entorno | ✅ Documentado (`.env.example`) | — |
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

**Este es el hallazgo principal de la auditoría**, porque es el que puede frenar un arranque a mitad.

- **`seed:admin`** usa `inviteUserByEmail` (`scripts/seed-admin.ts`). El primer `ceom_admin` recibe
  un correo real y **tiene que abrirlo para fijar su contraseña**. Sin eso existe la fila en
  `usuarios` pero nadie puede entrar a `/admin`.
- **`seed:tenant`** llama a `crearTenant()`, que también invita al Owner por correo
  (`identidad/actions.ts:400-407`). Mismo efecto: el negocio existe y su dueño no puede entrar.

**Por qué está bien que sea así en producción** (el Owner real debe fijar su propia contraseña, CEOM
nunca la ve) **y por qué es un problema el día del arranque**: son dos esperas humanas en medio de
una secuencia que parece automatizada, y con el SMTP por defecto de Supabase hay un límite de envíos
por hora que con varios tenants se agota.

`seed:instituciones` **no** tiene este problema: crea sus usuarios de Auth con
`createUser({ email_confirm: true })` y contraseña conocida, precisamente porque un seed no puede
depender de una bandeja.

> **Qué decidir antes del arranque:** si el equipo CEOM va a dar de alta los primeros negocios reales
> uno por uno (invitación por correo, camino correcto) o si hace falta un camino de alta masiva. No
> es una decisión técnica: es de operación del piloto.

## 3. El paso que no está en ninguna lista

**`pnpm storage:setup` crea el bucket `tenant-uploads`, y no figura en el orden de bootstrap.**

Drizzle no modela buckets —viven en el sistema de Storage de Supabase, no en tablas—, así que
**ninguna migración lo crea**. Las policies de `storage.objects` sí son una migración real
(`0024_storage_tenant_uploads_rls.sql`), lo cual empeora la trampa: **el día del arranque las
policies del bucket van a existir y el bucket no.** Todo lo que suba una imagen (logo del negocio,
foto de producto) falla, y el síntoma va a estar lejos de la causa.

Es el mismo modo de falla que esta auditoría persigue: un paso que existe, que nadie lista, y cuya
ausencia no falla hasta mucho después.

**Arreglo:** agregarlo al orden de bootstrap de `dev-practices` §7.1 y al chequeo ejecutable de
`scripts/_estado-entorno.ts` (que hoy verifica admin/negocios/productos/instituciones y **no** el
bucket). No se hizo en esta auditoría porque el pedido fue medir, no arreglar.

## 4. Lo que sí está resuelto y conviene no re-descubrir

- **El orden de bootstrap ya es ejecutable, no recordable.** Cada seed termina midiendo el estado
  real de la base y diciendo qué falta (`scripts/_estado-entorno.ts`). Alguien que corra solo
  `seed:demo` ve en pantalla que no hay ninguna institución.
- **El escenario de instituciones se puede sembrar desde cero** (`--reset`), y se corrió completo,
  con todas las ramas ejecutadas.
- **Las variables de entorno están completas y documentadas** en `.env.example`: `DATABASE_URL`,
  `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
  `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SITE_URL`.

## 5. Lo que falta medir antes del arranque

Dos cosas que esta auditoría **no** pudo cerrar leyendo código:

1. **`⚠ no ejecutado` — el arranque completo contra un proyecto de Supabase nuevo.** Es la única
   forma de saber si falta algo que hoy funciona porque la base actual ya tiene estado previo. El
   ensayo con contenedor limpio cubre las migraciones, pero **no** cubre nada que dependa de
   Supabase Auth o Storage, que es justo donde están los tres puntos flojos de arriba.
2. **`⚠ no ejecutado` — qué queda del `auth.users` viejo al resetear.** Si el plan es "resetear éste
   dejando solo los administradores", hay que confirmar qué pasa con las ~30 identidades de prueba y
   con las FKs de `usuarios.id` / `instituciones.auth_user_id` que las referencian. Crear un
   proyecto nuevo evita la pregunta entera; resetear el actual no.

**Recomendación:** proyecto nuevo, no reset. El reset deja que la pregunta 2 exista, y el beneficio
—conservar unas cuentas de admin que `seed:admin` recrea en un minuto— no lo justifica.
