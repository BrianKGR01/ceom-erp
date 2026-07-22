# CEOM-ERP — Prácticas de Desarrollo con Agentes

> **Qué es este documento y cómo se relaciona con `AGENTS.md`:** `AGENTS.md` (en la raíz) es el resumen ejecutable — lo que un agente lee antes de cada tarea. Este documento es el detalle y el porqué detrás de ese resumen: el flujo de trabajo completo, las plantillas, y la configuración concreta de cada herramienta. Si algo de acá creciera y `AGENTS.md` empezara a superar las ~150 líneas recomendadas, la regla es mover el detalle aquí y dejar en `AGENTS.md` solo el enlace — nunca duplicar contenido entre los dos.

---

## 1. Flujo de trabajo por módulo (Research → Plan → Implement → Verify)

Este es el flujo que se sigue para **cada** módulo del roadmap, sea con Claude Code, Antigravity, o cualquier otro agente:

### 1.1 Research (el agente lee, no escribe código todavía)
El agente lee, en este orden:
1. `docs/modules/Modulo_XX.md` — qué hace el módulo, sus reglas de negocio, su prueba de caja negra.
2. `docs/architecture/CEOM_Arquitectura.md` — sobre todo la sección 7 (matriz de dependencias), para confirmar qué otros módulos ya deberían estar construidos antes de este.
3. `src/modules/<módulo>/ANCLA.md`, si ya existe (retomar trabajo en curso).
4. `src/modules/<módulo>/AGENTS.md`, si ya existe (reglas específicas de ese módulo).

### 1.2 Plan (el agente propone, la persona aprueba)
El agente redacta un plan concreto antes de tocar un archivo: qué tablas o cambios de esquema, qué funciones públicas va a exponer el módulo, qué casos cubren los tests. En Claude Code, esto es literalmente el "plan mode" — se usa siempre para un módulo nuevo o un cambio de contrato entre módulos; se puede saltear para una corrección chica y acotada (un typo, un ajuste de estilo).

**Quién aprueba el plan:** el dueño del proyecto revisa el plan antes de que el agente implemente, sobre todo si el módulo es de los marcados como "lógica de negocio densa" en la sección 4.

### 1.3 Implement (cambios acotados a un módulo por vez)
Una sesión no toca 5 módulos a la vez — así un error queda contenido a un módulo y es fácil de revisar en un solo Pull Request. Si una tarea genuinamente necesita tocar dos módulos (ej. cambiar un contrato de "salidas que expone"), se declara explícitamente al empezar, no se descubre a mitad de camino.

### 1.4 Verify (con evidencia, no con una afirmación)
- Correr la prueba de caja negra ya definida para ese módulo en `docs/modules/Modulo_XX.md`, traducida a un test de Vitest o Playwright (ver sección 6).
- Pedir siempre la salida real del comando (`pnpm test`), no una afirmación de "ya funciona".
- Typecheck y lint también deben pasar — no son opcionales.

### 1.5 Cerrar la tarea
- Actualizar `src/modules/<módulo>/ANCLA.md` (estado, qué se hizo, dónde vive cada cosa).
- Si se tocó el contrato de un módulo, revisar el impacto contra la matriz de dependencias y avisarlo explícitamente en el resumen de la tarea — no dejar que quede implícito en el diff.

---

## 2. Plantilla `ANCLA.md` (una por módulo, en `src/modules/<módulo>/`)

```markdown
# ANCLA — Módulo: <Nombre del módulo>

## Contrato (no romper sin actualizar este archivo)
- Responsabilidad: <una frase — qué es lo único de lo que este módulo es dueño>
- NO hace: <lo que explícitamente no es su responsabilidad, para no absorberlo por error>
- Entradas que consume: <de qué otros módulos recibe datos/eventos, y cuáles>
- Salidas que expone: <funciones públicas que otros módulos pueden llamar>

## Estado actual
- [x] <tarea ya cerrada>
- [ ] <tarea pendiente>

## Dónde está cada cosa
- Esquema de BD (Drizzle): `src/modules/<módulo>/schema.ts`
- Server actions: `src/modules/<módulo>/actions.ts`
- Repository (acceso a datos de este módulo): `src/modules/<módulo>/repository.ts`
- Tests: `src/modules/<módulo>/*.test.ts`

## Decisiones tomadas que un agente no debe revertir
- <regla específica de este módulo que no es obvia leyendo el código>

## Última actualización: <fecha> — <quién/qué sesión>
```

**Regla práctica:** actualizar `ANCLA.md` es parte de terminar la tarea, no un paso opcional — igual que correr los tests.

---

## 3. Plantilla `AGENTS.md` por módulo (solo si el módulo lo necesita)

No todos los módulos necesitan su propio `AGENTS.md` — solo tiene sentido cuando hay una regla específica de ese módulo que no está ya en el `AGENTS.md` raíz. Ejemplo (Módulo Operativo, Nicho 1):

```markdown
# AGENTS.md — Módulo Operativo (Nicho 1: Alimentos/Bebidas por Lotes)

## Regla específica de este módulo
Este módulo implementa la interfaz "Operaciones" definida en
docs/architecture/CEOM_Arquitectura.md sección 5.1. Cualquier función pública
nueva que se agregue acá tiene que existir también, aunque sea como stub,
en la implementación de Nicho 4 — son intercambiables por diseño (Strategy
Pattern), no se puede romper esa simetría sin decirlo explícitamente.

## Conversión de unidades
Las recetas manejan conversión de unidades (kg ↔ g, l ↔ ml) — la lógica de
conversión vive en `src/modules/operativo/nichos/nicho-1/unidades.ts` y
NO se duplica en ningún otro archivo. Ver Módulo 6, sección 4.
```

---

## 4. Cuándo usar Claude Code vs. Antigravity

Criterio de trabajo por defecto (ajustable módulo por módulo, no una regla absoluta):

| Tipo de módulo | Herramienta / modo sugerido |
|---|---|
| Lógica de negocio densa y reglas de consistencia estrictas (Identidad/Autorización, Ventas, Financiero, Gateway de Consentimiento) | Sesión dedicada de Claude Code, en modo plan, con el plan revisado por vos antes de implementar. |
| Pantallas, formularios, CRUD simple, reportes de solo lectura | Iteración más rápida, menos supervisión punto a punto — buen candidato para Antigravity. |

Esta tabla es un punto de partida — a medida que uses ambas herramientas en la práctica, conviene ajustarla acá con lo que realmente funcione mejor para cada tipo de tarea.

---

## 5. Convenciones de código

### 5.1 Estructura de un módulo

```
src/modules/<módulo>/
├── AGENTS.md          (solo si hace falta — sección 3)
├── ANCLA.md
├── schema.ts           ← esquema Drizzle + políticas RLS (crudPolicy)
├── repository.ts        ← única capa que toca las tablas de este módulo
├── actions.ts           ← Server Actions, la capa pública ("salidas que expone")
└── *.test.ts
```

- **`repository.ts` es la única capa que ejecuta queries de Drizzle sobre las tablas de este módulo.** Ningún otro módulo importa este archivo directamente — solo consume `actions.ts`.
- **`actions.ts` es el contrato del módulo** — es literalmente la lista de "salidas que expone" documentada en `docs/modules/Modulo_XX.md` y en `ANCLA.md`, traducida a funciones.

### 5.2 Manejo de errores
Las Server Actions devuelven un resultado tipado (`{ ok: true, data }` o `{ ok: false, error }`), nunca solo lanzan una excepción sin capturar — el llamador (otro módulo, o la UI) siempre puede reaccionar sin un `try/catch` genérico envolviendo todo.

### 5.3 Commits y Pull Requests
- Un PR = un módulo (o una tarea acotada dentro de un módulo). Nunca un PR que mezcla dos módulos sin necesidad.
- Título del PR: `[Modulo_XX] descripción corta` (ej. `[Modulo_02] CRUD de productos + snapshot de costo`).
- Descripción del PR incluye: qué prueba de caja negra queda cubierta, y si se tocó el contrato de otro módulo.

---

## 6. Testing

| Nivel | Herramienta | Qué cubre |
|---|---|---|
| Unitario / integración de módulo | **Vitest** + Testing Library | La prueba de caja negra de cada módulo, aislada con mocks de sus dependencias (ej. Productos e Inventario probado con un mock de "Operaciones") |
| End-to-end | **Playwright** | Los 4 flujos completos de la Fase 2 del roadmap (Nicho 1, Nicho 4, Modo Básico, consentimiento) — de punta a punta, sin mocks |

Convención de archivos: `src/modules/<módulo>/<archivo>.test.ts` para unitarios, `e2e/<flujo>.spec.ts` para Playwright.

**La prueba de caja negra ya definida en cada `docs/modules/Modulo_XX.md` es el punto de partida del test unitario de ese módulo** — no hay que inventar casos nuevos desde cero, hay que traducir la prueba ya diseñada a código.

---

## 7. Migraciones con Drizzle

Flujo estándar para cualquier cambio de esquema:

```bash
# 1. Editar src/modules/<módulo>/schema.ts (tablas + políticas RLS con crudPolicy)
# 2. Generar la migración
pnpm drizzle-kit generate

# 3. Revisar el SQL generado en drizzle/migrations/ antes de aplicarlo —
#    nunca aplicar una migración generada sin leerla, sobre todo si toca RLS.

# 4. Aplicar contra el entorno de desarrollo
pnpm drizzle-kit migrate
```

- Nunca editar a mano una migración ya generada y aplicada — si hace falta corregir algo, se genera una migración nueva.
- Toda tabla nueva que maneje datos de un tenant lleva su política RLS en el mismo cambio que la crea — no "para después" (ya está en `AGENTS.md` raíz, se repite acá porque es la regla que más se salta bajo presión de tiempo).

---

## 7.1. Scripts de bootstrap (`scripts/`)

Para tareas puntuales que no encajan en un Server Action (necesitan correr
una sola vez, fuera del ciclo de vida de Next.js — ej. sembrar el primer
usuario `ceom_admin` cuando el entorno recién se levanta) usamos
`scripts/*.ts`, corridos con **`tsx`** (devDependency — Node nativo no
resuelve el alias `@/*` que usa casi todo `src/modules/**`, `tsx` sí porque
lee `tsconfig.json`).

```bash
pnpm seed:admin <email> ["Nombre completo"]
```

Convención para cualquier script nuevo en esta carpeta:
- Reutilizar los `actions.ts`/`repository.ts` de los módulos existentes
  igual que el resto del código — un script no es una excusa para duplicar
  lógica de negocio.
- **No** importar `src/lib/supabase/server.ts` completo si solo hace falta
  `crearClienteAdmin()` — ese archivo también exporta `crearClienteServidor`,
  que importa `next/headers` (asume runtime de Next.js). Armar el cliente
  admin de Supabase inline si el script corre fuera de Next.js.
- Cerrar la conexión de Postgres al final (`await client.end()`, exportado
  desde `src/db/client.ts` junto a `db`) — si no, el proceso de Node queda
  colgado.
- Idempotente cuando sea razonable (ver `scripts/seed-admin.ts`: si el
  usuario ya existe, no hace nada en vez de fallar).
- **Cargar el `.env.local` con `node --env-file=.env.local` en el comando de
  `package.json`, nunca con `process.loadEnvFile()` dentro del script** —
  los `import` estáticos se hoistean antes que cualquier código del cuerpo
  del archivo, así que `src/db/client.ts` (que lee `DATABASE_URL` al
  importarse) ya se evalúa con el env todavía vacío si `loadEnvFile()` se
  llama después de los imports. Bug real encontrado durante esta tarea.

---

## 7.2. Migraciones que tocan `auth`/`storage`: verificar contra un contenedor limpio, no solo contra el entorno de desarrollo compartido

**Regla dura, no opcional:** toda migración que inserte/actualice datos en los schemas `auth` o
`storage` (no solo que llame a `auth.uid()` — que *escriba* en `auth.users`/`storage.objects`) tiene
que probarse contra un Postgres recién levantado (`docker run postgres:16` + `scripts/ci/apply-stub.mjs`
+ `drizzle-kit migrate`, exactamente el orden de `ci.yml`) **antes** de darla por buena — no alcanza con
que pase contra el proyecto de Supabase Cloud de desarrollo compartido, porque ese proyecto ya tiene el
schema real completo de Supabase Auth (33 columnas en `auth.users`), mientras que
`scripts/ci/stub-supabase-schemas.sql` mantiene una aproximación deliberadamente mínima que solo crece
cuando una migración nueva la necesita.

**Incidente real** (Etapa 4.a del backstop de RLS, PR #14, 2026-07-22): la migración
`0034_gateway_sistema_seed.sql` insertaba en `auth.users` con columnas (`aud`, `role`,
`encrypted_password`, `banned_until`, etc.) que sí existen en el proyecto Cloud real pero que el stub
de CI no tenía (`auth.users` ahí solo era `id uuid primary key` — nada más lo había necesitado hasta esa
migración). `pnpm test` completo pasó en local (205/205) porque corrió contra el proyecto Cloud
compartido, que ya tenía el schema completo — **la migración nunca se probó contra un Postgres vacío
antes de abrir el PR**, y CI (que sí arranca de cero) reventó con
`column "aud" of relation "users" does not exist`, un error que solo aparece en los logs crudos del
contenedor (`docker logs`/el step "Stop containers" de Actions), no en la salida de `drizzle-kit`
mismo — buscar ahí primero, no conformarse con "Process completed with exit code 1".

**Cómo reproducir en limpio, paso a paso** (lo que faltó hacer antes de este incidente):
```bash
docker run -d --name repro -e POSTGRES_PASSWORD=postgres -p 15432:5432 postgres:16
mv .env.local .env.local.bak   # CRÍTICO: drizzle.config.ts carga .env.local si existe y pisa
                                 # DATABASE_URL/DIRECT_URL con el proyecto Cloud real sin avisar
DATABASE_URL="postgresql://postgres:postgres@localhost:15432/postgres" \
DIRECT_URL="postgresql://postgres:postgres@localhost:15432/postgres" \
  node scripts/ci/apply-stub.mjs
DATABASE_URL="postgresql://postgres:postgres@localhost:15432/postgres" \
DIRECT_URL="postgresql://postgres:postgres@localhost:15432/postgres" \
  pnpm exec drizzle-kit migrate
mv .env.local.bak .env.local
docker rm -f repro
```
Si algo falla, `docker logs repro | grep -i error` — no confiar en la salida de `drizzle-kit`, que a
veces no propaga el mensaje real de Postgres.

**Arreglo, no parche puntual:** cuando el stub le falte algo a una migración nueva, extender
`scripts/ci/stub-supabase-schemas.sql` con las columnas reales verificadas contra el proyecto Cloud
(`information_schema.columns`), no simplificar la migración para esquivar el stub — el stub existe para
aproximar la realidad, la migración está escrita para la realidad.

---

## 8. Integración continua (GitHub Actions)

```yaml
# .github/workflows/ci.yml
name: CI
on:
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
```

Se amplía más adelante con el job de Playwright (necesita un entorno con Supabase local o un proyecto de staging) y con el despliegue de preview de Vercel, que ya corre automático por integración nativa sin necesidad de un job propio acá.

---

## 9. Convenciones de UI

Reglas específicas para el trabajo de frontend (`src/app/`, `src/components/`,
`src/modules/<módulo>/components/`), complementarias a las convenciones de
código de la sección 5.

- **Server Components por defecto.** Un componente pasa a Client Component
  (`"use client"`) solo cuando hay interacción real que lo exige: formularios,
  modales, carrito de venta, cualquier `useState`/`onClick`/etc. Si un
  componente solo lee y renderiza datos, se queda como Server Component.
- **Estado local, no estado global.** `useState`/`useReducer` para estado de
  UI. Nada de librería de estado global (Redux, Zustand, Jotai, etc.) sin
  aprobación explícita del dueño del proyecto — no se instala "por si acaso".
- **Un solo Context de sesión.** Tenant, usuario, rol y permisos viven en un
  único Context de solo lectura, poblado en el layout raíz de `/app` a partir
  de `obtenerUsuarioActual()` (`src/modules/identidad/actions.ts`). Ningún
  componente vuelve a pedir esos datos por su cuenta ni mantiene su propia
  copia mutable.
- **Formularios con `react-hook-form` + `zod`**, reutilizando el mismo schema
  de validación que ya usa la Server Action correspondiente — nunca un schema
  de formulario distinto del que valida en el servidor, para no tener dos
  fuentes de verdad sobre qué es un dato válido.
- **`loading.tsx` y `error.tsx` por ruta.** Nunca un spinner o un mensaje de
  error armado a mano dentro de una pantalla — se usan los archivos especiales
  de Next.js App Router para que la carga y el error sean consistentes en toda
  la app.
- **Un componente de módulo nunca importa un componente de otro módulo.**
  Mismo principio de caja negra que rige el backend (`AGENTS.md`, regla 2):
  `src/modules/<A>/components/` no importa de `src/modules/<B>/components/`.
  Lo común entre módulos vive en `src/components/ui/` (primitivos genéricos)
  o `src/components/shared/` (compuestos con forma de producto CEOM pero sin
  dueño de módulo, ej. estado vacío, modal de confirmación).
- **Subida de archivos (imágenes) va por `src/lib/supabase/storage.ts`**,
  nunca directo con `supabase-js` desde un componente. Un solo bucket
  compartido (`tenant-uploads`, público para lectura), un path por
  `{tenantId}/{carpeta}/{uuid}.{ext}`, aislado por tenant vía RLS de
  `storage.objects` (`drizzle/migrations/0024_storage_tenant_uploads_rls.sql`).
  Un componente compartido (ej. `product-form.tsx`) nunca importa la Server
  Action de subida de una ruta puntual directo — la recibe como prop
  (`onSubirImagen`), inyectada por el caller de esa ruta. Detalle completo
  de la arquitectura (por qué público, por qué este cliente y no el admin,
  el bug de RLS real que encontró y corrigió esta integración) en
  `src/modules/productos/ANCLA.md`, sección "`imagen_url` conectado a
  Storage".

### 9.1 Cierre de tanda

Al terminar de construir y verificar todas las pantallas de una tanda de UI:

1. Actualizar `docs/ui/pantallas.md` por completo — cada pantalla construida pasa a `[x]` con su
   nota de detalle, y la sección "Próxima tanda sugerida" se reescribe para reflejar el estado
   real, no se deja desactualizada.
2. Nunca cerrar con un genérico "decime cómo seguir". Siempre anunciar explícitamente, sin que se
   pregunte: cuál es la siguiente tanda según el orden ya fijado (roadmap + matriz de
   dependencias de `CEOM_Arquitectura.md` sección 7), y el listado exacto de pantallas/modales
   que la componen, por nombre, tal como aparecen en `pantallas.md` — para que puedan pasarse
   directamente como pedido de diseño a otra herramienta.
3. Si la siguiente tanda todavía no tiene el contrato de backend completo (ej. le falta una
   Server Action o un wrapper en `actions.ts`), avisarlo ahí mismo, no descubrirlo a mitad de la
   implementación de UI.
4. Commitear después de cada pantalla construida y verificada — no acumular varias sin
   commitear.

---

## 10. Método de trabajo para tareas de diagnóstico/verificación (seguridad, RLS, y en general)

Cuatro hábitos que se repitieron en las sesiones del backstop de RLS
(`docs/security/PLAN-RLS-BACKSTOP.md`) y que atraparon algo real cada vez que se
aplicaron — no es ceremonia, cada uno tiene un incidente concreto detrás.

1. **Diagnóstico de solo lectura antes de implementar, con recomendación explícita
   al final, no código.** Las Etapas 4.a y 4.b (`§13`, `§16` del plan de RLS)
   empezaron con una sesión entera de solo lectura — grep, lectura de código,
   consultas de solo `SELECT` contra la base real — que terminó en una
   recomendación, nunca en un cambio. Las dos veces cambió el diseño que el
   propio plan ya daba por sentado: la Etapa 4.a descubrió que la Opción A
   "obvia" (reusar el bypass de `ceom_admin`) era una regresión real de defensa
   en profundidad, y propuso A′ en su lugar; la Etapa 4.b descubrió que el
   diseño original (§2.3 Caso 3) había quedado arquitectónicamente inviable
   después de la propia Etapa 4.a, y que el gap real a cerrar no era el que
   motivó la pregunta original. Ninguno de los dos hallazgos aparece si el
   diagnóstico se salta para llegar antes al código.
2. **Verificar una hipótesis con evidencia antes de actuar sobre ella, no
   asumirla porque "tiene sentido".** `es_ceom_admin()` se creyó hoisteable a
   `InitPlan` por analogía con `current_tenant_id()` — la hipótesis original
   (`§10.3`) resultó incompleta, corregida recién con `EXPLAIN ANALYZE` real
   contra volumen sintético (`§12`), que además encontró que el patrón correcto
   sí existía (`(select ...)`), solo que nunca se había probado. Mismo criterio
   aplicado en la Etapa 4.b.0: antes de escribir el índice único parcial se
   verificó con una consulta real que existía exactamente un par
   institución-tenant con filas duplicadas en la base — no se asumió "cero" ni
   se limpió "por las dudas" antes de mirar.
3. **Todo test de seguridad se valida rompiéndolo a propósito, no solo
   corriéndolo en verde.** Un test que nunca se vio fallar no probó nada —
   puede estar pasando por casualidad. El test dorado de la Etapa 4.b.0 se
   confirmó mutando la función SQL real en vivo (dentro de una sesión
   controlada, restaurada exactamente después) y verificando que el test
   efectivamente se pone en rojo, por la razón correcta — recién ahí se confía
   en que un futuro bug real también lo haría.
4. **El caso negativo se corre ANTES de aplicar el fix, no después.** Un test
   que "debería fallar sin la policy" solo prueba algo si efectivamente se lo
   vio fallar sin la policy — si se escribe y se corre después de aplicar el
   fix, no hay forma de distinguir un test que mide algo real de uno que pasa
   por tautología. Aplicado en la Etapa 3 (`§11.1` punto 4: un `ceom_admin`
   real daba 0 filas antes de `es_ceom_admin()`, 1 después) y en la Etapa 4.b.0
   (confirmado que el Gateway leía datos de un tenant sin consentimiento vigente
   *antes* de aplicar `gatewayVigenciaBypassPolicy()` — la vulnerabilidad real
   que motivó la etapa, no una tautología).

**Nota práctica relacionada, encontrada en la sesión de consolidación
(2026-07-22):** correr varias suites de test completas en paralelo (varios
`pnpm test` de fondo superpuestos) contra la misma base de desarrollo compartida
genera falsos positivos de "residuo" — cada corrida usa su propio sufijo
(`Date.now()`), así que no chocan entre sí, pero confunde el diagnóstico de cuál
corrida dejó qué. Correr la suite completa en solitario para cualquier
verificación final de "quedó todo limpio".

**Segunda nota, de la misma sesión, que es el hábito 2 aplicado a sí mismo:**
"la suite pasó en verde" NO es evidencia de que la base quedó limpia — hay que
consultarla. Con las 32 suites en verde y las tablas de `public` sin una sola
fila de sobra, una consulta directa a `auth.users` encontró **51 usuarios
`@ceom-erp.test` huérfanos** contra 2 legítimos, acumulados de corridas cortadas
de sesiones anteriores. La causa era estructural, no un descuido puntual:
`admin.auth.admin.deleteUser()` era la última línea de cada `afterAll` — tiene
que ir última, porque `public.usuarios.id` referencia `auth.users.id` con
`ON DELETE NO ACTION` — así que cualquier excepción previa lo salteaba, y una vez
borrada la fila de `usuarios` no queda ningún join por el cual una limpieza
posterior pudiera encontrar al usuario de Auth (`auth.users` no tiene
`tenant_id`). De ahí sale `limpiarConAuthGarantizada()`
(`src/test-utils/limpieza.ts`): el borrado de Auth corre igual aunque la
limpieza de negocio falle, y el error de la parte que falló se relanza en vez de
esconderse.

**Y la misma lección otra vez, en la misma sesión:** la afirmación "`auth.users`
no tiene FK contra `public.usuarios`" se escribió en tres archivos antes de ser
verificada. Era falsa. La consulta que la "confirmó" filtraba
`constraint_column_usage` por `table_schema = 'public'`, lo que descarta
justamente las FK cruzadas de esquema — la consulta tenía el bug, y su salida
vacía se leyó como evidencia. Apareció corriendo el test (`23503`,
`usuarios_id_users_id_fk`), no revisando el diseño. Una consulta de verificación
también es una hipótesis: si su resultado es "no hay nada", vale la pena
preguntarse si la consulta podía haber encontrado algo.

**Tercera vuelta de lo mismo, y la más útil de las tres:** garantizar que un
paso de limpieza se EJECUTE no garantiza que FUNCIONE. Con el arreglo anterior
ya aplicado y una corrida 32/32 archivos / 216/216 tests en verde, igual quedó
un usuario de Auth huérfano — porque `admin.auth.admin.deleteUser()` no rechaza
la promesa cuando la API falla: devuelve el error en el `{ error }` del valor de
retorno. Un `await` suelto sobre esa llamada se ve idéntico funcione o falle.
Regla general para cualquier SDK con ese contrato (`{ data, error }` en vez de
excepciones): en código de limpieza, chequear el `error` explícitamente, o el
paso es decorativo. Verde no es lo mismo que hecho.

---

## 11. Checklist extendido de "tarea terminada" (detalle de lo ya resumido en `AGENTS.md`)

- [ ] `pnpm typecheck && pnpm lint && pnpm test` pasan localmente.
- [ ] La prueba de caja negra del módulo (sección 6) está cubierta por un test real, no solo mencionada.
- [ ] `ANCLA.md` del módulo actualizado.
- [ ] Si se tocó el contrato de un módulo: impacto revisado contra `CEOM_Arquitectura.md` sección 7, y avisado explícitamente en el PR.
- [ ] Ninguna tabla nueva de negocio sin su política RLS.
- [ ] CI en verde antes de mergear.