# Plan RLS Backstop — Fase 0: diagnóstico y diseño

**Estado: aprobado — Etapas 0, 1, 2 y 3 (alcance acordado) implementadas y verificadas (2026-07-21,
ver §8, §9 y §11).** El diagnóstico original (§1-§7) sigue siendo de solo lectura tal cual se
escribió; §8 documenta lo que se implementó después (Etapas 0-1), §9 la Etapa 2 (barrido de N+1 +
Proveedores), §10 el diagnóstico de la Etapa 3 (bypass de `ceom_admin`, incluye una corrección real
a la hipótesis de costo de `es_ceom_admin()` — ver §10.3), y §11 lo que se implementó de la Etapa 3
sobre ese diagnóstico. **§9.6 encontró una regresión real** que cambia una premisa del plan (el
camino Gateway/Panel Admin CEOM no es independiente de las Etapas 3/4 como se asumía) — **§10/§11 la
resuelven para Proveedores y dejan el patrón (`ceomAdminBypassPolicy()`, `ContextoRlsNoResueltoError`)
listo para reusar en cada módulo que migre después.** `logs_acceso_admin_ceom` (sub-etapa 3.d) y la
Etapa 4 (portal, incluido el rediseño del solicitante sintético del Gateway) siguen pendientes,
deliberadamente. Ver §8.4 de `docs/security/AUDITORIA-AUTORIZACION.md` para el contexto que
originó este trabajo.

Diagnóstico hecho el 2026-07-21 vía el conector de Supabase (proyecto `ceom-services`,
`riertvgnjaujstwyqoom`, región `sa-east-1`, Postgres 17.6.1.141) más lectura directa de
`src/db/`, los 10 `schema.ts` de módulos y `drizzle/migrations/`.

---

## 1. Estado actual

### 1.1 Resumen (antes de la tabla, para no repetirlo 49 veces)

- **49/49 tablas de `public` tienen RLS habilitada** (`relrowsecurity = true`).
- **0/49 tienen `FORCE ROW LEVEL SECURITY`** (`relforcerowsecurity = false` en todas).
- **Las 49 son propiedad del rol `postgres`**, que es el rol que usa `DATABASE_URL` (confirmado
  por código: `src/db/client.ts` + comentario de `src/db/rls.ts`). `pg_roles` confirma
  `postgres.rolbypassrls = true`.
- Regla de Postgres (no es una suposición, es determinístico): **si el rol que ejecuta la query es
  dueño de la tabla, RLS se ignora por completo salvo que la tabla tenga `FORCE`.** Con 0 tablas en
  `FORCE`, el resultado es exactamente lo que dice AGENTS.md regla 6 y §8.4 de la auditoría: las
  policies existen, están bien escritas, pero son invisibles para todo el tráfico real de la app.
- **Las policies SÍ existen y SÍ son correctas** — no hay que escribirlas de cero. Las 44 tablas de
  negocio (49 menos las 5 sin `tenant_id`, ver §1.3) tienen exactamente el patrón `crudPolicy()`
  esperado: dos policies (`_tenant_select`, `_tenant_modify`), destino `authenticated`, usando
  `current_tenant_id()` como base de comparación.
- **`current_tenant_id()` ya existe, ya es `SECURITY DEFINER`, y ya tiene su propio bug conocido y
  arreglado** (`drizzle/migrations/0003...sql` + `0025_fix_current_tenant_id_security_definer.sql`):
  resuelve `tenant_id` desde `auth.uid()` contra `usuarios`, con `search_path` fijo. Es la única
  pieza de este mecanismo que ya se ejerció en producción real — para el bucket de Storage
  (`0024_storage_tenant_uploads_rls.sql`), no para negocio.
- **No existe ninguna policy de bypass para `ceom_admin` ni para el Gateway de Consentimiento
  (`/portal`)** en ninguna de las 44 tablas. Si hoy se activara `authenticated` tal cual está, un
  usuario `ceom_admin` (que tiene un `tenant_id` real y fijo — el tenant reservado "CEOM Ops", no
  `null`, ver §1.4) quedaría limitado a ver solo las filas de ese tenant de sistema, y `/admin`
  dejaría de funcionar por completo. Este es el hallazgo más importante de este diagnóstico.

### 1.2 Tabla × módulo × camino al tenant × policy declarada

| Tabla | Módulo | `tenant_id` | Camino | Policy hoy (resumen) |
|---|---|---|---|---|
| tenants | identidad | — (PK = tenant) | directo | `id = current_tenant_id()` |
| sucursales | identidad | ✅ | directo | `tenant_id = current_tenant_id()` |
| roles | identidad | ✅ nullable | directo | `tenant_id = current_tenant_id() OR tenant_id IS NULL` (roles de sistema) |
| usuarios | identidad | ✅ | directo | `tenant_id = current_tenant_id()` |
| permisos | identidad | — | join → roles | `rol_id IN (roles WHERE tenant_id = current_tenant_id() OR NULL)` |
| permisos_especiales_por_rol | identidad | — | join → roles | ídem permisos |
| permisos_especiales_por_usuario | identidad | — | join → usuarios | `usuario_id IN (usuarios WHERE tenant_id = current_tenant_id())` |
| instituciones | consentimiento | ❌ (catálogo N:M) | — | solo `SELECT ... USING (true)`; sin policy de escritura |
| cartera_institucional | consentimiento | ✅ | directo | `tenant_id = current_tenant_id()` |
| solicitudes_seguimiento | consentimiento | ✅ | directo | `tenant_id = current_tenant_id()` |
| aprobaciones_tenant | consentimiento | ✅ | directo | `tenant_id = current_tenant_id()` |
| codigos_acceso | consentimiento | ✅ | directo | `tenant_id = current_tenant_id()` |
| logs_acceso_admin_ceom | consentimiento | ✅ | directo | **ninguna policy** — deny-all deliberado para `authenticated`/`anon` (comentario explícito en el schema) |
| categorias_gasto_sugeridas | gastos | ❌ (catálogo global) | — | `SELECT ... USING (true)`; sin escritura |
| categorias_gasto | gastos | ✅ | directo | `tenant_id = current_tenant_id()` |
| gastos_recurrentes | gastos | ✅ | directo | `tenant_id = current_tenant_id()` |
| gastos | gastos | ✅ | directo | `tenant_id = current_tenant_id()` |
| pagos_gasto | gastos | — | join → gastos | `gasto_id IN (gastos WHERE tenant_id = current_tenant_id())` |
| insumos | operativo/nicho-1 | ✅ | directo | `tenant_id = current_tenant_id()` |
| movimientos_insumo | operativo/nicho-1 | — | join → insumos | ídem patrón join |
| stock_insumo | operativo/nicho-1 | — | join → insumos | ídem patrón join |
| recetas | operativo/nicho-1 | ✅ | directo | `tenant_id = current_tenant_id()` |
| receta_insumos | operativo/nicho-1 | — | join → recetas | ídem patrón join |
| vinculaciones_producto_receta | operativo/nicho-1 | — | join → recetas (⚠️ solo por `receta_id`, ignora `producto_id` como camino alternativo) | ídem patrón join |
| producciones | operativo/nicho-1 | ✅ | directo | `tenant_id = current_tenant_id()` |
| producciones_ajuste | operativo/nicho-1 | — | join → producciones | ídem patrón join |
| activos | patrimonio | ✅ | directo | `tenant_id = current_tenant_id()` |
| pasivos | patrimonio | ✅ | directo | `tenant_id = current_tenant_id()` |
| pagos_pasivo | patrimonio | — | join → pasivos | `pasivo_id IN (pasivos WHERE tenant_id = current_tenant_id())` |
| categorias_sugeridas | productos | ❌ (catálogo global) | — | `SELECT ... USING (true)`; sin escritura |
| categorias_producto | productos | ✅ | directo | `tenant_id = current_tenant_id()` |
| productos | productos | ✅ | directo | `tenant_id = current_tenant_id()` |
| stock | productos | — | join → productos | `producto_id IN (productos WHERE tenant_id = current_tenant_id())` |
| movimientos_stock | productos | — | join → productos | ídem |
| proveedores | proveedores | ✅ | directo | `tenant_id = current_tenant_id()` |
| compras | proveedores | ✅ | directo | `tenant_id = current_tenant_id()` |
| pagos_compra | proveedores | — | join → compras | `compra_id IN (compras WHERE tenant_id = current_tenant_id())` |
| compras_ajuste | proveedores | — | join → compras | ídem |
| configuracion_simulaciones | simulaciones | ✅ (PK) | directo | `tenant_id = current_tenant_id()` |
| simulaciones | simulaciones | ✅ | directo | `tenant_id = current_tenant_id()` |
| planes | suscripcion | ❌ (catálogo global) | — | `SELECT ... USING (true)`; sin escritura |
| clientes | ventas | ✅ | directo | `tenant_id = current_tenant_id()` |
| canales_venta | ventas | ✅ | directo | `tenant_id = current_tenant_id()` |
| metodos_pago | ventas | ✅ | directo | `tenant_id = current_tenant_id()` |
| eventos | ventas | ✅ | directo | `tenant_id = current_tenant_id()` |
| ventas | ventas | ✅ | directo | `tenant_id = current_tenant_id()` |
| detalles_venta | ventas | — | join → ventas | `venta_id IN (ventas WHERE tenant_id = current_tenant_id())` |
| ajustes_venta | ventas | — | join → ventas | ídem |
| pagos_venta | ventas | — | join → ventas | ídem |

Todas las filas de arriba: **RLS ✅ habilitada, FORCE ❌ apagada** (uniforme, ver §1.1).

### 1.3 Las 5 tablas sin `tenant_id` (y por qué está bien)

`instituciones`, `planes`, `categorias_sugeridas` (productos), `categorias_gasto_sugeridas`
(gastos) son catálogos globales legítimos: 0 o N:1 con el tenant, no 1:1. `auth.users` (schema
`auth`, no `public`) es una referencia de solo lectura administrada por Supabase, no cuenta entre
las 49.

### 1.4 Conexión, rol y pooler

- `DATABASE_URL` (runtime, `postgres-js`) apunta al **pooler en modo transacción** de Supabase,
  puerto **6543** — confirmado por `.env.example` y el comentario de `src/db/client.ts` (`prepare:
  false` es obligatorio por esto exacto). Implica: nada de `SET ROLE`/GUCs a nivel de sesión fuera
  de una transacción — todo debe ir dentro de `SET LOCAL` / `set_config(..., true)` dentro de un
  `BEGIN…COMMIT` explícito, porque el pooler puede reasignar la conexión física entre transacciones
  de clientes distintos.
- `DIRECT_URL` (solo `drizzle-kit`) usa el **session pooler**, puerto 5432, exclusivamente para DDL.
- El conector Supabase MCP (usado para este diagnóstico) autentica como `postgres` — no puedo
  verificar el 100% que el valor literal de `DATABASE_URL` en el entorno de despliegue sea
  exactamente ese rol (el conector no expone esa cadena), pero es la única configuración estándar
  de un proyecto Supabase para ese formato de URL, y coincide con lo que dice el código. **Punto a
  verificar antes de la Etapa 1** (ver §7, decisión 1).
- **La app SÍ usa Supabase Auth (GoTrue)** para autenticación — `obtenerUsuarioActual()`
  (`identidad/actions.ts:34-41`) llama `supabase.auth.getUser()`. Esto **corrige la premisa de la
  tarea**: no es cierto que "la app no usa Supabase Auth". Lo que sí es cierto — y es lo que
  importa para el diseño — es que el JWT de Supabase Auth **solo trae identidad** (`auth.uid()` +
  email), nunca autorización: `tenantId`, `rolId`, `esOwner`, permisos y capacidades especiales
  viven exclusivamente en tablas propias (`usuarios`, `roles`, `permisos`,
  `permisos_especiales_por_*`) y se resuelven frescos en cada Server Action, nunca desde un claim.
- `ceom_admin` **no** tiene `tenant_id` null: pertenece a un tenant real de sistema, "CEOM Ops"
  (`4ee580bc-14d8-49a4-b8c9-468569467f2f`, sembrado en `0005_seed_ceom_ops_tenant.sql`), y se
  identifica por `rolId = ROL_CEOM_ADMIN_ID` (`c1027307-fc75-4517-b2af-9687234c694d`), no por
  ausencia de tenant. Esto es exactamente lo que hace que activar `authenticated` sin más rompa
  `/admin` (ver §1.1, último punto).
- El Gateway de Consentimiento también autentica instituciones vía Supabase Auth
  (`instituciones.authUserId`, nullable hasta el primer login por magic link).

### 1.5 Hallazgos adicionales del diagnóstico (no bloqueantes, no son RLS)

Vía `get_advisors(type: security)`:
- `current_tenant_id()` es invocable directamente como RPC por `anon` y `authenticated`
  (`/rest/v1/rpc/current_tenant_id`) — no es una vulnerabilidad en sí (con sesión anónima devuelve
  `null`), pero es superficie de API no documentada; se podría `REVOKE EXECUTE ... FROM anon`.
- La protección contra contraseñas filtradas (HaveIBeenPwned) está deshabilitada en Supabase Auth —
  no relacionado a RLS, hallazgo de seguridad real, dejo anotado para otro trabajo.
- `logs_acceso_admin_ceom` tiene RLS habilitada con cero policies — confirmado intencional (deny-all
  para `authenticated`/`anon`, comentario explícito en el schema). Correcto tal cual está.

---

## 2. Diseño propuesto

### 2.1 Decisión de diseño clave: **no crear un rol nuevo**

La tentación obvia es crear un rol `app_runtime` con credenciales propias. **No lo recomiendo.**
Los roles `authenticated`/`anon` de Supabase **no son loginable** (`rolcanlogin = false`,
confirmado) — son roles a los que un rol loginable (`postgres`, en este caso) puede **saltar con
`SET LOCAL ROLE`** dentro de una transacción. Como además todas las policies ya declaradas están
escritas `to: authenticated`, reusar ese rol exacto significa **cero reescritura de las 44 policies
ya existentes**. Crear un rol nuevo obligaría a reescribir cada `crudPolicy()` de los 10
`schema.ts` para apuntar a él, sin ganar nada a cambio.

### 2.2 Mecanismo: `src/db/contexto.ts`

Ningún repository importa `db` de `src/db/client.ts` directamente nunca más — todos pasan por
funciones que abren una transacción, fijan el contexto vía `SET LOCAL` (que revierte solo al
terminar la transacción, seguro bajo pooler de transacción) y ejecutan dentro de ella:

```ts
// src/db/contexto.ts
import { db as dbInterno } from "./client"; // única importación legítima de "db" crudo en todo el repo

async function conRol<T>(
  rol: "authenticated" | "postgres",
  jwtClaims: Record<string, unknown> | null,
  fn: (tx: typeof dbInterno) => Promise<T>
): Promise<T> {
  return dbInterno.transaction(async (tx) => {
    if (jwtClaims) {
      await tx.execute(sql`select set_config('request.jwt.claims', ${JSON.stringify(jwtClaims)}, true)`);
    }
    if (rol !== "postgres") {
      await tx.execute(sql`set local role ${sql.raw(rol)}`);
    }
    return fn(tx);
  });
}

// Caso 1: tenant propio. La identidad se resuelve UNA VEZ, en el mismo Server Action que ya
// llamó a obtenerUsuarioActual()/tienePermiso() — nunca se acepta un objeto usuario ya resuelto
// como para decidir el contexto de RLS, por la misma razón que motivó el hallazgo crítico de
// §8.3.1 de AUDITORIA-AUTORIZACION.md (no confiar en identidad pasada por parámetro).
export function comoUsuario<T>(usuarioId: string, fn: Parametros<T>) {
  return conRol("authenticated", { sub: usuarioId, role: "authenticated" }, fn);
}

// Caso 2: ceom_admin — mismo JWT que un usuario normal (current_tenant_id() igual resuelve a
// CEOM Ops); lo que cambia es que las tablas relevantes tienen ADEMÁS una policy de bypass
// basada en es_ceom_admin() (ver 2.3). Reusa comoUsuario tal cual.
export const comoCeomAdmin = comoUsuario;

// Caso 3: portal — la institución también autentica via Supabase Auth (instituciones.auth_user_id).
export function comoInstitucion<T>(institucionAuthUserId: string, fn: Parametros<T>) {
  return conRol("authenticated", { sub: institucionAuthUserId, role: "authenticated" }, fn);
}

// Caso 4: sistema — onboarding/jobs/seeds. Sin SET ROLE: se queda en el rol de conexión
// (postgres), igual que hoy. Es el único caso que conserva el bypass total — de uso
// deliberadamente raro y auditable (ver 2.4).
export function comoSistema<T>(fn: Parametros<T>) {
  return conRol("postgres", null, fn);
}
```

**"Imposible de olvidar" (el requisito explícito del pedido):**

1. `src/db/client.ts` deja de exportar `db` públicamente — solo `contexto.ts` lo importa (import
   relativo interno, no vía el alias `@/*`). Cualquier otro archivo que intente `import { db } from
   "@/db/client"` falla en build porque el símbolo no existe.
2. Un test de cobertura (mismo patrón AST que `access-manifest.test.ts` de §8.3) falla si algún
   archivo bajo `src/modules/**/repository.ts` referencia `dbInterno`/importa desde `db/client`
   directamente, salvo `src/db/contexto.ts` mismo y un allowlist explícito para scripts de sistema.
3. Un segundo test (misma técnica) restringe `comoSistema()` a un allowlist de call-sites
   (`scripts/*.ts`, la acción de creación de tenant en onboarding, jobs programados) — el escape
   hatch de bypass total no debe poder usarse desde cualquier lado solo porque compila.

### 2.3 Política canónica — los 4 casos

**Caso 1 — tenant propio: ya existe, cero cambios.** `crudPolicy()` + `current_tenant_id()`
cubren esto en las 44 tablas de negocio hoy mismo.

**Caso 2 — `ceom_admin`: nueva función + nueva policy por tabla (solo en las tablas que `/admin`
toca).**

```sql
-- Mismo patrón de seguridad que current_tenant_id() (0025_fix...): SECURITY DEFINER porque si
-- se agrega "OR es_ceom_admin()" a la policy de usuarios/roles, evaluar la función requiere leer
-- esas mismas tablas -> recursión, el mismo bug ya pagado una vez para current_tenant_id().
create function public.es_ceom_admin() returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.usuarios u
    join public.roles r on r.id = u.rol_id
    where u.id = auth.uid()
      and r.id = 'c1027307-fc75-4517-b2af-9687234c694d' -- ROL_CEOM_ADMIN_ID
      and r.es_rol_sistema
  )
$$;
revoke all on function public.es_ceom_admin() from public, anon;
grant execute on function public.es_ceom_admin() to authenticated;

-- Por cada tabla que ceom_admin necesita cruzar (bypass, permisiva -> se OR-ea con la de tenant
-- propio automáticamente, semántica nativa de Postgres para múltiples policies permisivas):
create policy "<tabla>_ceom_admin_bypass" on <tabla>
  for all to authenticated
  using (es_ceom_admin())
  with check (es_ceom_admin());
```

**Caso 3 — portal (Gateway de Consentimiento): nueva función que duplica deliberadamente la
lógica de vigencia.**

```sql
create function public.tenant_autorizado_para_institucion_actual(tenant_objetivo uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.instituciones i
    join public.aprobaciones_tenant a on a.institucion_id = i.id
    where i.auth_user_id = auth.uid()
      and a.tenant_id = tenant_objetivo
      and a.revocado_en is null
      and a.fecha_aprobacion = (
        select max(a2.fecha_aprobacion) from public.aprobaciones_tenant a2
        where a2.institucion_id = i.id and a2.tenant_id = tenant_objetivo
      )
  )
$$;
```

Esto **duplica** la regla "la más reciente manda, revocada mata" de
`obtenerAprobacionVigente()`/`tieneConsentimiento()` (`consentimiento/actions.ts:364-378`). Es
deliberado y necesario: si la policy simplemente confiara en un GUC que la propia app calculó, un
bug en `tieneConsentimiento()` no tendría ningún backstop (la policy repetiría el mismo error). Ver
riesgo/decisión 3 en §7 — este es el punto más delicado de todo el plan.

**Nota importante: RLS no puede expresar el filtro por `modulosAprobados`** (qué módulos veedores
ve la institución) — eso sigue siendo responsabilidad exclusiva del código de aplicación (ver §6).

**Caso 4 — sistema: sin policy nueva.** `comoSistema()` simplemente no hace `SET ROLE` — se queda
en `postgres`, igual que today. El control es de código (allowlist de call-sites, §2.2 punto 3),
no de SQL.

### 2.4 ¿Hace falta `FORCE ROW LEVEL SECURITY`?

**No, con este diseño.** `FORCE` solo importa cuando el rol que ejecuta la query es dueño de la
tabla (que es exactamente lo que evita el `SET LOCAL ROLE authenticated`: durante la transacción,
el rol efectivo deja de ser `postgres`). Aun así, recomiendo activar `FORCE` igual, al final de
cada etapa, como hardening barato que no cambia nada para `authenticated` (nunca es dueño) pero
cierra la puerta a que alguien vuelva a correr una query de negocio directamente como `postgres` y
la app se "olvide" de todo el mecanismo por accidente.

---

## 3. Plan de migración por etapas

| Etapa | Qué | Nuevas migraciones SQL | Riesgo | Reversión |
|---|---|---|---|---|
| **0** | Crear `contexto.ts` + `comoUsuario()`, sin activar `SET ROLE` todavía (valida el plumbing de transacciones/pooler) | Ninguna | Nulo | Borrar el archivo |
| **1** | Migrar **Patrimonio** (conejillo de indias, ver §3.1) a `comoUsuario()` real, con `SET ROLE authenticated` | Ninguna — `crudPolicy()` ya es correcto para el caso tenant-propio | Bajo — módulo aislado, sin ceom_admin ni portal | Revertir 1 archivo (`patrimonio/repository.ts`), sin tocar la DB |
| **2** | Repetir para Proveedores, luego Consentimiento/Suscripción/Simulaciones/Gastos (en ese orden de acoplamiento creciente), dejando Identidad/Productos/Ventas al final | Ninguna | Medio — más superficie, mismo mecanismo ya validado en Etapa 1 | Ídem, por módulo |
| **3** | `es_ceom_admin()` + policies de bypass en las tablas que `/admin` toca; migrar `panel-admin-ceom`/rutas `/admin` a `comoCeomAdmin()` | Sí — nueva función + N policies | Alto — bug acá = ceom_admin pierde acceso a todo, o algo peor si la función está mal | Migración `drizzle-kit` down; revertir el código de `/admin` |
| **4** | `tenant_autorizado_para_institucion_actual()` + policies de portal; migrar `/portal` a `comoInstitucion()` | Sí | Alto — la etapa más delicada (duplica lógica de negocio en SQL, §2.3 caso 3) | Migración down; revertir `/portal` |
| **5** | `FORCE ROW LEVEL SECURITY` en las 44 tablas de negocio | Sí (barato) | Bajo, dado el diseño | Migración down |
| **6** | Eliminar el export crudo `db` de `client.ts` por completo | No | Nulo (ya no debería haber ningún consumidor) | Restaurar la línea de export |

### 3.1 Por qué Patrimonio es el conejillo de indias

Comparación real (no corazonada), del ranking de módulos:

| Módulo | Tablas | Entrantes (quién depende de él) | Salientes (de qué depende) | Acoplamiento total |
|---|---|---|---|---|
| **Patrimonio** | 3 | 2 (gastos, operativo-nicho) | 1 (identidad) | **3** ← mínimo |
| Proveedores | 4 | 1 (financiero) | 2 (identidad, productos) | 3 (empatado, pero 1 tabla más) |
| Simulaciones | 2 | 0 | 5 (financiero, gastos, identidad, productos, ventas) | 5 |
| Gastos | 5 | 2 | 4 | 6 |
| Productos | 5 | 4 | — | núcleo, mal candidato |
| Ventas | 8 | 5 | — | núcleo, el más grande, mal candidato |
| Identidad | 7 | **12** (todos) | — | núcleo absoluto, peor candidato posible |

Patrimonio gana por acoplamiento combinado más bajo entre los candidatos de tamaño serio, y —punto
decisivo— **ni `ceom_admin` ni el Gateway de Consentimiento tocan sus tablas**, así que la Etapa 1
no depende de nada de las Etapas 3/4 (las más arriesgadas): es un caso 100% "tenant propio", el más
simple de los cuatro, y valida todo el plumbing de conexión/transacción/pooler sin arrastrar ningún
otro riesgo.

**Pendiente antes de la Etapa 3**: confirmar el listado exacto de tablas que `panel-admin-ceom` y
`monitoreo-institucional` tocan (ambos módulos no tienen `schema.ts` propio, cruzan hacia otros) —
este diagnóstico no llegó a ese nivel de detalle y no quiero adivinarlo.

---

## 4. Plan de tests cross-tenant

### 4.1 El gap real hoy: no hay DB en CI

`.github/workflows/ci.yml` no define `DATABASE_URL` — los tests de integración de cada módulo
(`describe.skipIf(!hasCredenciales)`, donde `hasCredenciales = DATABASE_URL && SUPABASE_SECRET_KEY`)
**hoy se saltean en CI** y solo corren en local, contra el proyecto de Supabase Cloud de
desarrollo. `docs/dev-practices/dev-practices.md` §8 ya señala esto como pendiente ("se amplía más
adelante... necesita Supabase local o un proyecto de staging").

### 4.2 Propuesta: contenedor Postgres liviano en CI, no `supabase start`

Estos tests solo necesitan Postgres + el esquema de Drizzle + RLS — no GoTrue/Storage/Realtime.
Un `postgres:16` como servicio en `ci.yml`, con `drizzle-kit migrate` corriendo contra él antes de
`pnpm test`, activa automáticamente el `hasCredenciales` de todos los tests existentes **sin tocar
ningún archivo de test** — efecto colateral gratis: cierra el gap de "no hay DB en CI" que existe
hoy, independientemente de RLS.

### 4.3 Test por módulo migrado: `tenant-aislamiento.test.ts`

Patrón, uno por módulo migrado a `comoUsuario()`:

```ts
describe.skipIf(!hasCredenciales)("Patrimonio — aislamiento cross-tenant (RLS)", () => {
  it("tenant B no puede leer un activo de tenant A vía comoUsuario()", async () => {
    const { tenantA, usuarioA } = await crearTenantDePrueba();
    const { tenantB, usuarioB } = await crearTenantDePrueba();
    const activo = await comoUsuario(usuarioA.id, (tx) => crearActivo(tx, tenantA.id, ...));

    const filas = await comoUsuario(usuarioB.id, (tx) => tx.select().from(activos).where(eq(activos.id, activo.id)));
    expect(filas).toHaveLength(0); // RLS filtra la fila, no la app
  });

  it("el mismo intento vía el bypass de sistema SÍ ve la fila (prueba que el test mide RLS, no el guard de app)", async () => {
    const filas = await comoSistema((tx) => tx.select().from(activos).where(eq(activos.id, activo.id)));
    expect(filas).toHaveLength(1);
  });
});
```

Cobertura: uno de estos por cada tabla de cada módulo migrado, para `SELECT`/`UPDATE`/`DELETE`
cruzados. Se gatea igual que los tests de integración existentes (`hasCredenciales`), así que no
agrega infraestructura nueva más allá de 4.2.

---

## 5. Plan de rollback

- **Etapas 0-2 (caso tenant propio, sin SQL nuevo):** revertir es un revert de código puro —
  `crudPolicy()` ya estaba en la base antes de este plan, no hay migración que deshacer. El
  rollback más barato posible.
- **Etapas 3-4 (funciones + policies nuevas):** `drizzle-kit` genera la migración down
  correspondiente (`drop policy`, `drop function`) — DDL reversible, sin tocar datos.
- **Etapa 6:** restaurar una línea de export.
- **Detección rápida en producción:** dado que el diseño falla cerrado (falta de contexto = 0
  filas, nunca "todas las filas"), un incidente se manifiesta como *"el usuario X de repente no ve
  sus propios datos"*, no como una fuga silenciosa. Agregar un chequeo canario post-deploy por
  etapa: una llamada de prueba contra una cuenta sembrada conocida, alertando si vuelve vacía
  cuando debería tener datos — más barato que instrumentar APM completo y suficiente para este
  patrón de falla.

---

## 6. Lo que RLS explícitamente NO va a cubrir

- **No valida IDs anidados.** RLS filtra filas de la tabla que se está consultando — si una Server
  Action acepta un `sucursalId`/`productoId` ajeno y lo escribe en una fila que sí pertenece al
  tenant correcto, la policy de esa tabla pasa (la fila es mía) aunque la referencia sea ajena. Eso
  es exactamente lo que corrigen `recursoPerteneceAlTenant()`, `requireProductoDelTenant()` y la
  validación de `sucursalId` en `registrarVenta` (§6 de `AUDITORIA-AUTORIZACION.md`) — esos guards
  **siguen siendo obligatorios**, RLS no los reemplaza ni los vuelve opcionales.
- **No reemplaza `tienePermiso()`.** RLS solo sabe "de qué tenant", nunca "qué rol puede hacer qué
  acción dentro de qué módulo", ni las capacidades especiales por usuario.
- **No reemplaza el manifiesto de acceso ni el test AST de §8.3.** Una Server Action que se olvide
  de llamar `obtenerUsuarioActual()` y en cambio confíe en un objeto de identidad recibido por
  parámetro sigue siendo un bug de autorización de aplicación primero. Dicho esto — punto a favor
  de este plan, no absoluto: **si `comoUsuario()` resuelve el `sub` del JWT desde el mismo id que ya
  validó `obtenerUsuarioActual()` en ese Server Action (nunca desde un campo `tenantId` de un objeto
  recibido por parámetro), la clase de bug de §8.3.1 (`esOwner`/`tenantId` forjados) pierde su
  filo**: `current_tenant_id()` volvería a resolver el tenant real del atacante desde `auth.uid()`,
  ignorando cualquier `tenantId` falso en el objeto pasado. Es una razón más para blindar
  `comoUsuario()` exactamente así (§2.2) — pero es una defensa en profundidad adicional, no la
  primera línea.
- **No cubre el filtro por módulo veedor del portal** (`modulosAprobados`) — solo qué tenants ve una
  institución, no qué módulos de esos tenants. Eso sigue en código.
- **No es *"y ya no hace falta revisar los Server Actions nuevos"*.** Sigue siendo obligatorio que
  todo endpoint nuevo declare su nivel en `access-manifest.ts` (§8.3) y pase el guard que
  corresponda — RLS es la segunda capa, nunca la primera.

---

## 7. Riesgos y decisiones que necesito que tomes

1. **¿`postgres` (el rol real de `DATABASE_URL`) puede hacer `SET ROLE authenticated`?** Es
   altamente probable (configuración estándar de Supabase — es el mismo mecanismo que usa el SQL
   Editor del dashboard para "impersonar" roles), pero no lo verifiqué con una query real porque
   hubiera significado tocar el comportamiento de una conexión, aunque sea de lectura, y esta fase
   es estrictamente de solo lectura sobre metadatos. **Recomiendo verificarlo con un solo
   `SELECT`/`SET LOCAL ROLE` de prueba al arrancar la Etapa 0**, antes de escribir ningún código de
   producción sobre ese supuesto.
2. **Rol nuevo (`app_runtime`) vs. `SET ROLE` dentro de la transacción (recomendado, §2.1).**
   Recomiendo `SET ROLE` — cero infraestructura nueva, cero policies para reescribir. Si preferís
   un rol dedicado por alguna razón de auditoría/observabilidad de Postgres, es un plan distinto
   con más superficie.
3. **Portal: ¿aceptamos duplicar la lógica de vigencia en SQL (§2.3 caso 3), o diferimos RLS de
   portal indefinidamente y lo dejamos 100% en código?** Es la decisión más delicada del plan — la
   política solo es un backstop *real* si re-deriva la vigencia de forma independiente, pero eso
   crea dos lugares que deben mantenerse sincronizados. Si elegís duplicar, recomiendo un test
   "dorado" que corra el mismo conjunto de escenarios sintéticos contra `tieneConsentimiento()` (TS)
   y contra `tenant_autorizado_para_institucion_actual()` (SQL) y falle si alguna vez difieren.
4. **¿Agregamos `FORCE ROW LEVEL SECURITY` (Etapa 5)?** No es necesario para que el mecanismo
   funcione (§2.4), pero es barato. Recomiendo sí, al cierre de cada etapa ya migrada.
5. **Test DB en CI: contenedor Postgres liviano (recomendado, §4.2) vs. branch efímero de Supabase
   por PR.** Un branch es más fiel al entorno real pero tiene costo y latencia por PR, y usar
   `create_branch`/`confirm_cost` es una acción que esta fase de solo lectura no debía tomar por su
   cuenta — decisión tuya.
6. **Orden exacto de la Etapa 2 en adelante** — ¿seguís el ranking de acoplamiento (Proveedores →
   Consentimiento/Suscripción/Simulaciones → Gastos → Productos/Ventas/Identidad al final), o hay
   un orden de roadmap de negocio que pese más?
7. **Hallazgos aparte (no bloqueantes, §1.5):** ¿revocar el `EXECUTE` de `current_tenant_id()` para
   `anon`, y habilitar la protección de contraseñas filtradas en Supabase Auth? Ninguno es parte de
   este plan de RLS pero salieron del mismo diagnóstico y prefiero que los veas antes de descartarlos.

---

---

## 8. Etapas 0 y 1 — implementado y verificado (2026-07-21)

Con las 7 decisiones de §7 ya tomadas por el usuario. Todo lo de abajo se hizo contra el mismo
proyecto de desarrollo del diagnóstico (`riertvgnjaujstwyqoom`, confirmado como el único proyecto
Supabase existente — no hay "produccion" separada todavía, ver `docs/production/produccion.md`).

### 8.1 Decisión 1 — `SET ROLE` verificado empíricamente, funciona

Contra la base real, dentro de una transacción con `rollback` al final (cero efectos):

```sql
begin;
set local role authenticated;                                    -- rol_efectivo = "authenticated"
select set_config('request.jwt.claims', '{"sub":"...","role":"authenticated"}', true);
select auth.uid();                                                -- resuelve al "sub" seteado
select public.current_tenant_id();                                -- resuelve al tenant real del usuario
rollback;                                                          -- rol_tras_rollback = "postgres", claims = null
```

Verificado además sobre datos reales de Patrimonio (no solo la función): un usuario del tenant
`365ff798...` (3 activos reales) ve exactamente 3 filas de `activos` bajo este contexto; un usuario
de otro tenant ve 0. `SET LOCAL ROLE`/`set_config(..., true)` revierten solos al terminar la
transacción (confirmado con `rollback`) — seguro bajo el pooler de transacción.

### 8.2 `src/db/contexto.ts` — implementado

`comoUsuario` / `comoCeomAdmin` (función propia, no alias — así el test de allowlist distingue
call-sites) / `comoInstitucion` / `comoSistema`, según §2.2, con dos agregados pedidos:

- **Falla ruidosa**: tras fijar el contexto, se exige que `current_tenant_id()` (o `auth.uid()`
  para `comoInstitucion`) resuelva — si no, tira una excepción en vez de dejar que la query de
  negocio devuelva cero filas silenciosamente.
- **`comoCeomAdmin` es una función propia**, no `= comoUsuario`, exactamente por lo pedido: el test
  de allowlist de `contexto.test.ts` distingue call-sites por el nombre importado, y deja lugar
  para que la Etapa 3 le agregue una verificación adicional sin tocar `comoUsuario`.

**Transacciones anidadas — verificado, no solo razonado.** Un `tx.transaction()` (savepoint) dentro
del `fn` de `comoUsuario` preserva `auth.uid()`/rol incluso si ese savepoint hace rollback parcial
(confirmado con un script real: `ANTES` / `DENTRO del savepoint` / `DESPUÉS del rollback parcial`
devuelven el mismo `auth.uid()` los tres). Es la semántica esperada de Postgres (`SET LOCAL` fijado
*antes* de un savepoint sobrevive a su rollback), pero se verificó igual en vez de asumirla. Esto
importa para las Etapas 2+: varios repositories ya migrados (`refinanciarPasivoTx`,
`registrarPagoPasivoTx`) abrían su propia `db.transaction()` interna — en Patrimonio se sacó esa
transacción anidada porque ya no hace falta (la atomicidad la da la transacción externa de
`comoUsuario`), pero si algún módulo futuro prefiere conservar su propio `tx.transaction()` interno,
queda confirmado que es seguro hacerlo.

**Blindaje "imposible de olvidar" — 3 tests en `src/db/contexto.test.ts`, cada uno con negativo
deliberado antes de darlo por bueno** (mismo criterio que `access-manifest.test.ts` de la auditoría
de autorización):
1. Ningún archivo de un módulo en `MODULOS_MIGRADOS_A_CONTEXTO` importa `db`/`client` crudo.
2. Solo el allowlist explícito importa las *funciones* de contexto (no sus *tipos* — `Ejecutor`/`Tx`
   son tipos puros que cualquier repository migrado necesita para tipar su parámetro, y no pasan
   por este allowlist).
3. `comoSistema()` solo se llama desde `scripts/`.

Cada regla se negativo-testeó con un archivo de prueba real (creado, confirmado que rompía el test
con el mensaje esperado, borrado) antes de confiar en ella.

### 8.3 Etapa 1 — Patrimonio migrado

`patrimonio/repository.ts`: las 15 funciones exportadas reciben `tx: Ejecutor` como primer
parámetro en vez de importar `db`. `patrimonio/actions.ts`: cada función exportada abre un solo
`comoUsuario(solicitante.id, async (tx) => {...})` envolviendo todo su cuerpo (una sola fijación de
contexto por invocación de Server Action, no una por cada llamada a `repo.*`); donde el `tenantId`
ya es un parámetro directo (no hace falta leer una fila primero para saberlo), el chequeo
`tienePermiso()` se hace *antes* de abrir el contexto, para no pagar el round-trip en el camino
rechazado.

**Verificación en vivo (Paso 3):**
- Los 7 tests existentes de `patrimonio.test.ts` (activos, pasivos, refinanciación, transferencia,
  fichaPasivo, valor patrimonial) pasan contra la base real de desarrollo, como owner, sin cambiar
  ninguna aserción de negocio — solo se le subió el timeout a un test con 6 round-trips secuenciales
  (mismo criterio ya usado en el propio archivo para el test de `fichaPasivo`).
- Caso negativo cross-tenant, nuevo: `tenant-aislamiento.test.ts` (§8.4) confirma que un usuario de
  otro tenant no ve ni puede escribir el activo ajeno vía `comoUsuario()`, y que el mismo dato SÍ es
  visible vía `comoSistema()` (bypass total) — prueba que el aislamiento lo da RLS, no una
  coincidencia del guard de aplicación.
- Efecto colateral real y positivo: RLS ahora bloquea un cross-tenant lookup con "Activo no
  encontrado" en vez de con "No tenés permiso" (antes, sin RLS, `repo.obtenerActivoPorId` no
  filtraba por tenant y `tienePermiso()` era quien decía "no tenés permiso" después de haber
  confirmado que la fila existía) — deja de revelar que un id de otro tenant existe, mismo criterio
  ya aplicado en `recursoPerteneceAlTenant()` (auditoría de autorización, fase anterior).

**Medición de latencia (pedida explícitamente) — el hallazgo más importante de esta etapa:**

| | avg | p50 | p95 |
|---|---|---|---|
| Sin contexto (`db` crudo, rol `postgres`) | 244ms | 242ms | 248ms |
| Con contexto, primera versión (3 round-trips secuenciales para fijar contexto) | 986ms | 985ms | 1000ms |
| Con contexto, versión final (3 statements pipelineados con `Promise.all`) | 837ms | 834ms | 851ms |

**+593ms promedio, +243%, sobre `listarActivosPorTenant` (3 filas reales), pooler transacción,
`sa-east-1`.** Es un impacto serio y hay que ser honesto sobre dos cosas a la vez:

1. **La optimización de pipelinear con `Promise.all` en vez de 3 `await` secuenciales es real y se
   aplicó** (`fijarContextoYExigirTenant`/`fijarContextoYExigirAuthUid` en `contexto.ts`): postgres-js
   encola las queries sobre la misma conexión sin esperar la respuesta de la anterior antes de
   enviar la siguiente, así que las 3 sentencias de fijar contexto (`SET LOCAL ROLE`,
   `set_config(...)`, `select current_tenant_id()`) pagan la latencia de red una vez, no tres — bajó
   el overhead de fijar contexto de ~750ms a ~345ms en aislamiento. Intenté ir más lejos (combinar
   las 3 sentencias en un solo mensaje de texto) pero Postgres lo rechaza ("cannot insert multiple
   commands into a prepared statement") en cuanto hay un parámetro bindeado — es una restricción de
   Postgres sobre el protocolo extendido, no de postgres-js, y evitarla exigiría interpolar el valor
   a mano en el SQL (validando que sea un UUID) en vez de parametrizarlo — no lo hice: el riesgo de
   construir SQL a mano no vale la ganancia marginal restante.
2. **El número absoluto (~600-1000ms) está inflado por la distancia de red entre esta máquina y
   `sa-east-1`** — el baseline de una sola query simple ya cuesta ~244ms, que es alto para una
   query trivial. El *múltiplo* de round-trips (BEGIN + contexto pipelineado + query + COMMIT, ~4
   viajes en vez de 1) es el hallazgo portable; el costo *absoluto* en producción (Vercel en
   `sa-east-1`, o el VPS self-hosteado eventual en la misma región) va a ser muchísimo menor en
   milisegundos absolutos, pero el *mismo múltiplo relativo* — no lo medí en un entorno de esa
   latencia porque no existe todavía.

**No decidí por mi cuenta que esto está bien** — lo dejo explícito para que el usuario decida antes
de replicarlo en los 13 módulos restantes: si el múltiplo de ~4x te preocupa incluso después del
ajuste de región, una optimización futura real (no aplicada esta sesión, por riesgo/alcance) es que
`comoUsuario()` abra la transacción con `BEGIN` pipelineado junto con las 3 sentencias de contexto
en vez de dejar que `db.transaction()` lo haga por separado — exigiría manejar `BEGIN`/`COMMIT`/
`ROLLBACK` a mano en vez de con el wrapper de Drizzle, más riesgo de bugs de limpieza, evaluado y
descartado para esta sesión por alcance ("Etapa 0 y 1 solamente").

### 8.4 Infra de tests cross-tenant (Paso 4)

`.github/workflows/ci.yml`: servicio `postgres:16` + `scripts/ci/stub-supabase-schemas.sql` (roles
`anon`/`authenticated`/`service_role`, `auth.users`/`auth.uid()`, `storage.objects`/
`storage.foldername()` — lo mínimo que las migraciones reales dan por hecho) + `drizzle-kit migrate`
antes de `pnpm test`. `DATABASE_URL` apunta al contenedor pero `SUPABASE_SECRET_KEY` NO se define en
CI — a propósito: el resto de los tests de integración (gastos, ventas, identidad, etc., que sí
llaman `crearClienteAdmin().auth.admin.createUser()`, un servicio de Auth real que el contenedor no
tiene) siguen salteándose exactamente igual que hoy. Esto **no** cierra el gap más amplio de "no hay
DB en CI" para esa suite completa — sería una tarea aparte (stack completo de `supabase start` con
GoTrue, o refactorizar esos tests para no depender de un signup real). Solo habilita el nuevo test
de aislamiento, que se gatea únicamente en `DATABASE_URL` y no necesita Auth real: crea sus propias
filas sintéticas de `auth.users`/`usuarios`/`tenants` por SQL directo, sin pasar por GoTrue.

**Advertencia honesta: no pude validar este pipeline de punta a punta con Docker en esta máquina**
(Docker Desktop está instalado pero el servicio no está corriendo, y arrancarlo no me pareció una
acción que debía tomar por mi cuenta). El SQL del stub está cruzado con hechos ya verificados contra
la base real (nombres de rol exactos vía `pg_roles`, la expresión exacta de `auth.uid()` vía el
helper `authUid` que exporta `drizzle-orm/supabase/rls`), pero **la primera corrida real de CI es la
verificación pendiente**, no algo que ya esté confirmado.

`src/modules/patrimonio/tenant-aislamiento.test.ts`: 4 tests — B no lee el activo de A, A sí lee el
suyo, B no puede escribirlo (UPDATE) aunque lo intente, y `comoSistema()` (bypass) sí lo ve para
confirmar que las 3 anteriores miden RLS y no el guard de aplicación. Pasan contra la base de
desarrollo real (que ya tiene todo lo que el stub imita, de fábrica).

### 8.5 Decisión 7 — hallazgos aparte

- **Revocado `EXECUTE` de `current_tenant_id()` para `anon`/`public`** vía migración versionada
  (`drizzle/migrations/0028_revoke_current_tenant_id_execute_anon.sql`, aplicada con
  `drizzle-kit migrate` — nada a mano desde el conector). Verificado antes/después con
  `get_advisors`: el hallazgo `anon_security_definer_function_executable` desapareció;
  `authenticated_security_definer_function_executable` sigue (esperado, es necesario para que
  `crudPolicy()` funcione).
- **Protección de contraseñas filtradas (HaveIBeenPwned): NO pude habilitarla.** Es una
  configuración de Supabase Auth (Dashboard → Authentication → Providers → Email, o la Management
  API), no un objeto de base de datos ni algo expuesto por el conector de Supabase que tengo
  disponible. Queda pendiente de que lo actives vos manualmente — no es parte de este mecanismo de
  RLS, salió del mismo diagnóstico de advisors.

### 8.6 Verificación final

`pnpm typecheck` / `pnpm lint` (0 errores) / `pnpm test` limpios, salvo un test de
`operativo-nicho1.test.ts` (`consultarCapacidadProduccionUsada/Almacenamiento...`) que falla por
timeout de 5000ms — **confirmado pre-existente y no relacionado**: ese módulo no fue tocado en esta
sesión (`git status` sobre `src/modules/operativo/` está limpio), reproduce igual corriendo el
archivo solo, y tiene la misma forma exacta (timeout en el límite default de 5000ms, sin override)
que el problema real que sí corregí en `patrimonio.test.ts` — evidencia de que es la base de
desarrollo bajo carga hoy, no un bug de lógica.

---

Etapas 0 y 1 cerradas (§8). Antes de tocar el módulo 2 de la Etapa 2 (Proveedores, según el ranking
de §3.1): decisión pendiente sobre el múltiplo de latencia de §8.3 — replicarlo tal cual, o invertir
en la optimización de `BEGIN` pipelineado antes de seguir escalando a los 13 módulos restantes.

---

## 9. Etapa 2 — Barrido de N+1 y Proveedores (implementado y verificado, 2026-07-21)

Se decidió replicar el mecanismo de latencia tal cual (§8.3) sin invertir en la optimización de
`BEGIN` pipelineado — evaluar esa optimización con datos de más de un módulo migrado, no solo
Patrimonio.

### 9.1 Barrido de N+1 en los 13 módulos restantes (previo a migrar Proveedores)

Motivación confirmada en el propio código: `git log` ya tiene un commit previo
(`0dc2f71 fix(operativo): corrige N+1 secuencial y arregla el timeout flaky de sección 4`) para
exactamente el síntoma descrito en la tarea — un `for...of` secuencial en `operativo-nicho1.test.ts`
que quedó al borde del timeout de 5000ms de Vitest cuando la migración de Patrimonio sumó costo real.
El barrido de esta ronda buscó el mismo patrón en los 13 módulos que todavía no pasaron por
`comoUsuario()`, con 13 agentes en paralelo (uno por módulo), cada uno con acceso solo a
`repository.ts`/`actions.ts` de su módulo.

**Resultado: 10 módulos sin ningún patrón aplicable, 3 módulos con hallazgos reales, 0 tests en
rojo.**

| Módulo | Hallazgos | Decisión |
|---|---|---|
| consentimiento, financiero, identidad, monitoreo-institucional, panel-admin-ceom, productos, proveedores, reportes, simulaciones, suscripción | 0 | Ya usan `Promise.all` donde corresponde, o no tienen bucles con `await` — sin cambios. |
| **gastos** | 1 | `sembrarCategoriasGastoDefault` (5 categorías fijas, inserciones independientes) → `Promise.all`. |
| **operativo** (Nicho 1) | 3 | `registrarProduccion` (N lecturas de stock por línea de receta) → `Promise.all`. `actualizarComposicionReceta` (validación de tenant por insumo) → `Promise.all`. `crearProduccionTx` (upsert de `stock_insumo` por insumo+sucursal) → **se dejó secuencial**: si una receta repitiera el mismo insumo en dos líneas (nada en el schema lo impide), dos upserts concurrentes sobre la misma clave podrían pisarse o chocar contra el unique index. |
| **ventas** | 2 | Snapshot de precio/costo por línea de `registrarVenta` (lecturas independientes por producto) → `Promise.all`, preservando "primer error en el orden original". Descuento de stock por línea (`descontarStockVenta`) → **se dejó secuencial**: es lee-disponible-luego-escribe-movimiento en dos pasos no atómicos; si dos líneas de la misma venta comparten producto+sucursal, paralelizarlo permitiría sobregiro de stock. |

**Ningún hallazgo se marcó `creceSinLimite` (crecimiento sin tope).** Los 6 bucles encontrados están
todos acotados por un tope de negocio chico (líneas de una venta, insumos de una receta, un set fijo
de 5 categorías) — consistente con que esta es la primera pasada sobre módulos que en su mayoría
todavía no migran a `comoUsuario()` (el costo extra de round-trips que hizo aflorar el bug original en
Patrimonio/Nicho-1 todavía no se aplicó a estos otros módulos). Vale re-barrer con el mismo criterio
cuando cada módulo migre, no asumir que quedó "cerrado para siempre".

Los 2 casos dejados secuenciales comparten la misma forma: un **upsert derivado (lee-el-estado-actual,
luego decide insert/update)** sobre una clave que dos iteraciones del mismo bucle podrían compartir.
Es el mismo patrón de riesgo en ambos módulos distintos — vale tenerlo presente como heurística para
las próximas etapas: cualquier bucle que recalcule un saldo/cantidad derivada por clave compuesta es
sospechoso de N+1 real, no de "solo lento".

Commits: `b3c1722` (gastos), `7a0e057` (operativo), `a646914` (ventas) — uno por módulo, tests de ese
módulo en verde antes de cada commit.

### 9.2 Proveedores migrado a `comoUsuario()`

Mismo patrón exacto que Patrimonio (Etapa 1, §8.3), sin sorpresas de diseño:

- `repository.ts`: las 17 funciones exportadas reciben `tx: Ejecutor` como primer parámetro.
  `registrarPagoCompraTx` deja de abrir su propia `db.transaction()` anidada — la atomicidad ya la da
  la transacción externa de `comoUsuario()`, mismo ajuste que `refinanciarPasivoTx` en Patrimonio.
- `actions.ts`: cada función exportada envuelve su cuerpo en un solo
  `comoUsuario(solicitante.id, ...)`; donde `tenantId` ya es un parámetro directo, `tienePermiso()` se
  chequea antes de abrir el contexto (mismo criterio de no pagar el round-trip en el camino
  rechazado).
- `contexto.test.ts`: `src/modules/proveedores` sumado a `MODULOS_MIGRADOS_A_CONTEXTO`,
  `proveedores/actions.ts` sumado al allowlist de import de `comoUsuario()`.
- `tenant-aislamiento.test.ts` (nuevo, mismo patrón que Patrimonio): tenant B no lee ni puede
  actualizar el `proveedor` de tenant A vía `comoUsuario()`; `comoSistema()` (bypass) confirma que la
  fila real sigue existiendo — la prueba mide RLS, no el guard de aplicación.
- Impacto de contrato revisado contra la matriz de dependencias (§7 de la arquitectura, sección 7):
  nadie fuera del módulo importa `proveedores/repository.ts` directo (confirmado por grep) — Financiero
  y las rutas de UI consumen exclusivamente `actions.ts`, cuyo contrato público (firmas de
  `solicitante`/`tenantId`/`input`) no cambió. Cero impacto fuera del módulo.
- `FORCE ROW LEVEL SECURITY` activado en las 4 tablas (`proveedores`, `compras`, `pagos_compra`,
  `compras_ajuste`) al cierre de la etapa, vía migración versionada
  (`0029_proveedores_force_rls.sql`, generada con `drizzle-kit generate --custom`, aplicada con
  `drizzle-kit migrate`) — decisión §7.4, aplicada por-módulo en vez de esperar a la Etapa 5 original
  del plan. Verificado post-aplicación contra `pg_class`: `relforcerowsecurity = true` en las 4.
- 21/21 tests en verde (costo-unitario, proveedores.test.ts, tenant-aislamiento.test.ts,
  contexto.test.ts) tanto antes como después de activar `FORCE`.

Commits: `063515c` (migración a `comoUsuario()` + tests), `3cc7d53` (FORCE RLS).

### 9.3 Frontera Proveedores → Productos/Nicho-1 (módulo no migrado) — verificado empíricamente, no solo razonado

`registrarCompra`/`recibirCompra` disparan `dispararEntradaStock()`, que llama a
`registrarEntradaCompraReventa()` (Productos, Módulo 2) o `registrarEntradaCompraInsumo()`
(Operativo/Nicho-1) — ninguno de los dos módulos está migrado todavía, así que ambos siguen
importando `db` crudo internamente (no reciben `tx`). Esta es la **primera vez** que una función ya
migrada llama, en pleno vuelo de su propia transacción, a una función de un módulo que no lo está —
la pregunta que definía el criterio para las 11 etapas restantes.

**Verificación real** (no solo lectura de código): un script descartable
(`comoUsuario(usuarioId, async (tx) => {...})` con una query de sondeo tanto por `tx` como por `db`
crudo dentro del mismo callback, más un insert vía `tx` no comiteado todavía) confirmó:

```json
{
  "dentroTx":              { "rol": "authenticated", "pid": 756507 },
  "crudoDentro":            { "rol": "none",          "pid": 756508 },
  "veloDesdeCrudoAntesDeCommit": 0,
  "veloDesdeCrudoDespuesDeCommit": 1
}
```

- **`pid` distinto** → la llamada al módulo no migrado toma una conexión física *distinta* del pool de
  postgres-js, no la conexión reservada de la transacción de `comoUsuario()`.
- **`rol` vuelve a `none`** (el rol de conexión por defecto, `postgres` — dueño de las tablas, bypassea
  RLS por completo) — el `SET LOCAL ROLE authenticated` fijado dentro de `tx` no aplica a esa conexión
  distinta.
- **La fila insertada vía `tx` (todavía sin commit) es invisible** para la query cruda hasta que
  `comoUsuario()` resuelve y comitea — aislamiento estándar de transacciones entre sesiones distintas
  de Postgres, confirmado en la práctica, no asumido.

**Conclusión — la respuesta para las 11 etapas restantes:** una llamada desde un módulo migrado hacia
uno no migrado **no hereda nada** (ni rol, ni contexto de RLS, ni la transacción) — abre su propia
unidad de trabajo con bypass total, exactamente como corría *antes* de migrar nada. Esto **no es una
regresión de seguridad** (Productos/Nicho-1 nunca tuvieron RLS real en el camino de la app, siguen sin
tenerlo hoy) pero sí introduce una ventana de **atomicidad cruzada nueva y más fina** que antes no
existía: antes de esta migración, `crearCompra()` era un `INSERT` autocommiteado inmediato (sin
transacción envolvente), así que para cuando `dispararEntradaStock()` corría, la Compra ya estaba
comiteada de forma irreversible. Ahora `crearCompra()` vive dentro de la transacción todavía abierta de
`comoUsuario()` — si algo *después* de `dispararEntradaStock()` lanzara una excepción (hoy no hay nada
que lo haga: el código solo arma el objeto de retorno), la Compra se revertiría pero el movimiento de
stock ya comiteado del otro lado quedaría huérfano, referenciando un `compra_id` que dejó de existir.
El riesgo es despreciable hoy (no hay ningún `await` entre `dispararEntradaStock()` y el `return`), pero
es la primera aparición real de esta clase de bug, y va a repetirse en cada módulo que dispare una
llamada cruzada mientras el otro lado siga sin migrar.

**Implicación para las etapas 3-13 (no resuelta esta sesión, queda como diseño pendiente):** el arreglo
de fondo no es "migrar todo a la vez" (fuera de alcance, y el plan explícitamente escalona por
acoplamiento) sino que, cuando el módulo *llamado* migre, su función pública podría aceptar un `tx`
opcional para que un caller que ya está dentro de un `comoUsuario()` propio se lo pase en vez de forzar
una conexión nueva — hoy ninguna de las dos partes de este par (Proveedores ✅ migrado, Productos/Nicho-1
❌ no) lo soporta, así que no se implementó; queda anotado acá para cuando se migren esos dos módulos.

### 9.4 Latencia de Proveedores — se parece a Patrimonio en forma, no en el número exacto

| | avg | p50 | p95 |
|---|---|---|---|
| Sin contexto (`db` crudo) | 233ms | 232ms | 245ms |
| Con contexto (`comoUsuario()`) | 583ms | 582ms | 599ms |

+350ms, +150% sobre `listarProveedoresPorTenant` (3 filas reales), mismo mecanismo compartido de
`contexto.ts` que Patrimonio (ya con el pipelining de `Promise.all`/mensaje simple de §8.3 — no se
tocó `contexto.ts` en esta etapa). La comparación honesta contra Patrimonio (§8.3: sin contexto 244ms,
con contexto 837ms, +593ms/+243%) muestra un múltiplo *menor* acá, no mayor — probablemente varianza de
red/hora del día contra el mismo proyecto de desarrollo en `sa-east-1` (ambos módulos comparten
exactamente el mismo código de `contexto.ts`, así que no hay una razón estructural para que difieran).
**No sacar conclusiones de la diferencia entre los dos números absolutos** — la señal que importa es
que el orden de magnitud del overhead (unos cientos de ms, 1.5x-2.5x) se mantiene estable entre el
primer y el segundo módulo migrado, no que uno sea "más rápido" que el otro.

### 9.6 Regresión real encontrada y corregida: el camino Gateway/Panel Admin CEOM no es independiente de las Etapas 3/4

**Esto cambia una premisa del plan, no es una nota al pie.** El diseño original (§3, tabla de la
sección 3) asumía que el caso "tenant propio" (Etapas 1-2) era ortogonal a `ceom_admin` (Etapa 3) y al
portal (Etapa 4) — que se podía migrar módulo por módulo sin arrastrar ese riesgo hasta llegar
explícitamente a esas etapas. **Proveedores demostró que eso es falso en la práctica:** es el primer
módulo migrado que además es alcanzado por el camino Monitoreo Institucional/Panel Admin CEOM (vía
`financiero.flujoCaja()` → `consultarPagosCompraEnPeriodo()`), y migrarlo rompió ese camino de dos
formas distintas al correr la suite completa (`pnpm test`, no solo los tests del propio módulo):

1. **Monitoreo Institucional, crash real** — llama con `solicitanteGateway()`
   (`identidad/actions.ts:264`), un `UsuarioConRol` **sintético**: `id = "00000000-0000-0000-0000-000000000000"`,
   sin fila real en `usuarios` ni en `auth.users`. `comoUsuario()` exige que `current_tenant_id()`
   resuelva (falla ruidosa, §2.2) y esa exigencia no tiene forma de cumplirse — no es un bug de dato
   faltante, es un id que **no puede existir** porque nunca pasó por un login real. 2 tests en rojo
   (`monitoreo-institucional.test.ts`, caso 2 y caso borde 1).
2. **Panel Admin CEOM, corrupción de dato silenciosa (más grave que el crash)** — llama con un
   `ceom_admin` real (sí existe en `usuarios`), así que `current_tenant_id()` resuelve — pero al tenant
   propio del admin ("CEOM Ops"), no al `tenantId` que se quiere inspeccionar. Sin `es_ceom_admin()` +
   policy de bypass (Etapa 3, no implementada), RLS filtra todo a 0 filas — y **ningún test lo
   detectaba**: `panel-admin-ceom.test.ts` solo afirmaba `typeof financiero.data.flujoCaja === "number"`,
   que sigue siendo cierto para `0`. Un cero incorrecto (RLS filtrando) es indistinguible de un cero
   correcto (tenant sin movimientos) con ese assert — exactamente la clase de falla silenciosa que
   `comoUsuario()` intenta evitar en la capa de contexto (§2.2), colándose por una capa arriba, en el
   test que debía probarla.

**Corrección aplicada, acotada a lo mínimo (no se adelantó nada de la Etapa 3):**
`consultarPagosCompraEnPeriodo()` es ahora la única función de Proveedores que **no** abre
`comoUsuario()` — sigue leyendo por `tenantId` explícito + `tienePermiso()`, igual que todo el módulo
antes de esta migración. La excepción es explícita en el código (comentario largo justo en la función)
y en un allowlist dedicado y nuevo de `contexto.test.ts` (`ALLOWLIST_IMPORTA_DB_CRUDO`) que exige que
cualquier excepción futura se agregue ahí a propósito, con motivo escrito — no que se cuele. Las otras
17 funciones de Proveedores siguen migradas sin cambios. Además, se corrigió el assert débil de
`panel-admin-ceom.test.ts` ("caso 3"): ahora siembra una Compra + Pago de Compra reales
(`registrarCompra`/`registrarPagoCompra` como Owner) y afirma el valor exacto de `flujoCaja` (`-100`,
no solo su tipo) — ese assert nuevo es el que habría atrapado la corrupción silenciosa si hubiera
existido antes.

**Otro assert del mismo patrón débil, encontrado pero NO corregido esta sesión** (pedido explícito:
listarlo alcanza, no hace falta arreglarlo ahora): `monitoreo-institucional.test.ts:156`,
`expect(typeof financiero.data.detalle.flujoCaja).toBe("number")` dentro de "caso 2". Mismo riesgo en
potencia — hoy no oculta nada porque ese test tampoco siembra Compras/Ventas/Gastos reales para el
tenant (haría falta el mismo trabajo de seeding que se hizo en panel-admin-ceom.test.ts para que el
assert tenga algo real que verificar), pero es el mismo hueco.

**Qué módulos de los que faltan migrar son alcanzables desde Gateway/Panel Admin CEOM** (auditado
contra `financiero/actions.ts` y las llamadas directas de ambos módulos — no se rastreó más profundo
que un nivel de indirección):

| Módulo | Alcanzado por | Cómo |
|---|---|---|
| **Ventas** | Monitoreo Institucional (`tendenciaVentas`), ambos (vía `financiero.flujoCaja`/`estadoResultados`) | `consultarPagosVentaEnPeriodo`, `consultarIngresosPeriodo`, `consultarAjustesVentaEnPeriodo` |
| **Gastos** | ambos (vía `financiero.flujoCaja`/`estadoResultados`/`costoFijoTotal`) | `consultarTotalCostosFijos`, `consultarPagosGastoEnPeriodo`, `consultarTotalGastosEnPeriodo` |
| **Operativo/Nicho-1** | ambos, directo (sin pasar por Financiero) | `listarProducciones`, `consultarMermaPeriodo`, `listarInsumos` |
| Identidad, Suscripción, Consentimiento | Panel Admin CEOM toca partes de Identidad/Suscripción, pero hoy vía funciones que ya tienen su propio bypass de `ceom_admin` **dentro de `tienePermiso()`/`repository.ts`** (no vía RLS) — no se rastreó a fondo si eso sigue siendo cierto una vez que Identidad migre (es la Etapa final, §3.1, por su acoplamiento — este hallazgo es una razón más para tratarla con cuidado ahí, no antes) | No auditado en profundidad esta sesión |

**Conclusión práctica: cada uno de Ventas, Gastos y Operativo/Nicho-1 va a necesitar el mismo tipo de
excepción puntual (o la Etapa 3 real) en su propia migración**, no solo Proveedores — no es un caso
aislado. Vale decidir, antes de migrar el próximo de estos tres, si conviene adelantar la Etapa 3
(`es_ceom_admin()` + `comoCeomAdmin` real) en vez de acumular excepciones módulo por módulo — la
decisión queda para el usuario, no tomada acá.

**El solicitante sintético de `solicitanteGateway()` necesita un rediseño en la Etapa 4, no solo una
policy nueva.** Toda policy de RLS depende de `auth.uid()` resolviendo a algo — `es_ceom_admin()` (la
función propuesta en §2.3 para la Etapa 3) hace `where u.id = auth.uid()`, y ese `auth.uid()` sigue
siendo el UUID de ceros sintético, que nunca va a tener una fila en `usuarios`. Ninguna policy, por bien
escrita que esté, puede autorizar un `auth.uid()` que no existe — el problema no es "falta la policy
correcta", es que el mecanismo entero de "un usuario real autenticado vía Supabase Auth" no aplica a
este solicitante por diseño. La Etapa 4 (portal) va a necesitar decidir esto de raíz: o
`solicitanteGateway()` deja de ser un objeto 100% en memoria y pasa a ser un usuario real sembrado
(con su propio `auth.users`/`usuarios`, tenant "CEOM Ops", igual que un `ceom_admin` humano), o las
funciones que Monitoreo Institucional consume siguen sin poder pasar por `comoUsuario()`/`comoCeomAdmin()`
nunca, y necesitan su propio mecanismo (quizás `comoInstitucion()` extendido, ya que conceptualmente
"el Gateway ya autorizó esto" es más parecido al caso 3 que al caso 2). No decidido acá — es
exactamente el tipo de decisión de alto impacto que el usuario pidió reservarse para cuando se llegue
a esa etapa.

### 9.5 Estado y próximos pasos

Etapa 2 cerrada — Proveedores es el segundo módulo migrado, con la suite completa (`pnpm test`, 201
tests, 31 archivos) en verde, no solo los tests del propio módulo. Sigue pendiente, en el orden de
§3.1: Etapa 2 continúa con Consentimiento/Suscripción/Simulaciones/Gastos, luego Productos/Ventas/
Identidad, y recién después las Etapas 3 (`ceom_admin`) y 4 (portal) — **no tocadas esta sesión**, tal
como se pidió. Dos condicionantes nuevos para ese orden, ambos de §9.3/§9.6:

- Antes de migrar Productos o Nicho-1 en concreto, revisar §9.3: esa migración es la primera
  oportunidad real de cerrar la ventana de atomicidad cruzada documentada ahí, en vez de solo
  heredarla de nuevo.
- Antes de migrar Ventas, Gastos u Operativo/Nicho-1 (los tres confirmados alcanzables desde Gateway/
  Panel Admin CEOM en §9.6), correr la suite completa —no solo la del módulo— y decidir si conviene
  adelantar la Etapa 3 en vez de acumular una excepción puntual por módulo, como se hizo acá para
  Proveedores.

**Decisión tomada después de cerrar la Etapa 2: la Etapa 3 va ahora.** Acumular una excepción por
módulo (Ventas, Gastos, Operativo/Nicho-1 la necesitarían cada uno) es peor que enfrentar esta etapa
con calma. Lo que sigue (§10) es la fase de **diagnóstico puro** de la Etapa 3 — inspección de solo
lectura contra la base real (conector de Supabase) más lectura de código, sin ningún cambio de
código ni DDL. Termina con una pregunta al usuario, no con código.

---

## 10. Etapa 3 — Diagnóstico (`ceom_admin`), sin cambios de código ni de base (2026-07-21)

Método: 3 agentes de investigación en paralelo (matriz de tablas de Panel Admin CEOM; bypasses de
`ceom_admin` ya existentes en la aplicación; asserts débiles en los tests del camino Gateway/Panel
Admin) + inspección directa contra la base real (`riertvgnjaujstwyqoom`) vía el conector de
Supabase: definición y grants de `current_tenant_id()` como precedente, estado de `FORCE ROW LEVEL
SECURITY` en todas las tablas, `EXPLAIN ANALYZE` real bajo rol `authenticated` para medir el costo
por fila de una función `STABLE SECURITY DEFINER` en una policy, estructura de `roles`/`usuarios`,
esquema y policies de `logs_acceso_admin_ceom`, y `get_advisors` de seguridad. Cero DDL, cero
migraciones, cero archivos de la app tocados.

### 10.0 Resumen ejecutivo — lo que este diagnóstico cambia de lo que ya estaba escrito

1. **El bypass de RLS que agregue la Etapa 3 hoy solo tiene efecto real sobre 4 tablas: las de
   Proveedores.** De los 8 módulos que Panel Admin CEOM alcanza transitivamente (Identidad,
   Suscripción, Financiero, Ventas, Proveedores, Gastos, Operativo/Nicho-1, Consentimiento), **solo
   Proveedores está migrado a `comoUsuario()`** — los otros 7 siguen leyendo/escribiendo con `db`
   crudo (rol `postgres`, dueño de las tablas, RLS invisible de fábrica). Escribir policies de bypass
   para `tenants`, `planes`, `producciones`, `insumos`, y los agregados de Ventas/Gastos ahora sería
   trabajo real pero **inerte** hasta que esos módulos migren — cambia el alcance recomendado de esta
   etapa (§10.7-§10.8), no solo el diagnóstico.
2. **`es_ceom_admin()` tal como está propuesta en §2.3 tiene un gap real, no cosmético**: no filtra
   `usuarios.eliminado_en is null` ni `usuarios.activo`, a diferencia de `current_tenant_id()` (que sí
   filtra `eliminado_en is null`). Un `ceom_admin` desactivado o soft-eliminado seguiría teniendo
   bypass total. Corregido en la propuesta de §10.3.
3. **El solicitante sintético de `solicitanteGateway()` no tiene arreglo dentro de la Etapa 3** —
   confirmado con más detalle del que tenía §9.6 (§10.4): ni `comoCeomAdmin()` ni un `comoInstitucion()`
   extendido lo resuelven sin sembrar una fila real. Es una decisión de la Etapa 4, explícitamente.
4. **`logs_acceso_admin_ceom` va a quedar ciega si migra bajo el patrón genérico** — es la tabla de
   más riesgo de todas las tocadas, y ya tiene gaps de cobertura hoy, antes de que exista ningún
   bypass (§10.5).
5. **Dos tablas de catálogo (`planes`, `instituciones`) y varias escrituras de Identidad
   (`tenants` vía `crearTenant`/`cambiarPlanTenant`/`cambiarEstadoSuscripcion`) no tienen ninguna
   policy de la que partir** — el patrón genérico de §2.3 ("se OR-ea con la de tenant propio
   automáticamente") no las cubre; necesitan diseño de policy dedicado, módulo por módulo, cuando
   cada uno migre (§10.2).

### 10.1 Matriz de tablas × operación que necesita Panel Admin CEOM

**Escrituras: una sola, en todo el alcance del módulo.** `INSERT` en `logs_acceso_admin_ceom` (el
propio log de auditoría interno de CEOM), nunca `UPDATE`/`DELETE`, y nunca sobre una tabla de negocio
de un tenant ajeno. Se dispara desde `consultarFinancieroTenant`/`consultarOperativoTenant`/
`consultarInventarioOperativoTenant`, una vez por llamada, después de que las lecturas resolvieron
OK. **Mínimo privilegio se cumple hoy a nivel aplicación — ninguna policy de bypass debería otorgar
`INSERT`/`UPDATE`/`DELETE` sobre tablas de negocio de otro tenant, solo `SELECT` (y el `INSERT` propio
sobre `logs_acceso_admin_ceom`).**

| Tabla | Op. | Vía (función de Panel Admin CEOM) | Camino real (archivo:línea) | `tenant_id` |
|---|---|---|---|---|
| `tenants` | SELECT | `saludAgregadaPlataforma` | `identidad/repository.ts:57-59` `listarTenants()` — **sin filtro**, cross-tenant completo a propósito | directa (es la propia tabla) |
| `planes` | SELECT | `saludAgregadaPlataforma` | `suscripcion/repository.ts:12-17` `listarPlanes()` | N/A — catálogo global |
| `tenants` | SELECT | `consultarTenantDetalle` | `identidad/repository.ts:47-54` `obtenerTenantPorId(tenantId)` | directa |
| `pagos_venta` | SELECT | `consultarFinancieroTenant` → `flujoCaja` | `ventas/repository.ts:371-391` | indirecta, vía `venta_id → ventas.tenant_id` |
| **`pagos_compra`** | SELECT | `consultarFinancieroTenant` → `flujoCaja` | `proveedores/repository.ts:203-224` — **única tabla de esta lista ya bajo RLS real (Etapa 2, `FORCE` activo)** | indirecta, vía `compra_id → compras.tenant_id` |
| `pagos_gasto` | SELECT | `consultarFinancieroTenant` → `flujoCaja` | `gastos/repository.ts:286-306` | indirecta, vía `gasto_id → gastos.tenant_id` |
| `detalles_venta` | SELECT | `consultarFinancieroTenant` → `estadoResultados` | `ventas/repository.ts:316-336` | indirecta |
| `gastos` | SELECT | `consultarFinancieroTenant` → `estadoResultados`/`costoFijoTotal` | `gastos/repository.ts:311-331` y `237-256` (filtro `tipo='fijo'`) | directa |
| `ajustes_venta` | SELECT | `consultarFinancieroTenant` → `estadoResultados` | `ventas/repository.ts:395-415` | indirecta |
| `producciones` | SELECT | `consultarOperativoTenant` | `operativo/nichos/nicho-1/repository.ts:359-365` y `401-414` (merma) | directa |
| `insumos` | SELECT | `consultarInventarioOperativoTenant` | `operativo/nichos/nicho-1/repository.ts:82-87` | directa |
| `logs_acceso_admin_ceom` | **INSERT** | las 3 funciones `consultar*Tenant` de arriba | `consentimiento/repository.ts:283-286` | directa (registra qué tenant se consultó) |

**Gaps de auditoría ya existentes hoy, antes de cualquier bypass de RLS** (documentados en el propio
código, confirmados en esta pasada):
- `consultarTenantDetalle` **no llama a `loguearAcceso`** — comentario explícito en
  `panel-admin-ceom/actions.ts:119-122`: `"identidad"` no es un valor de `moduloPermisoEnum`, no hay
  categoría de log, "se documenta como pendiente, no se inventa un valor de enum solo para esto". Hoy
  `ceom_admin` puede ver nombre/plan/nicho/estado de cualquier tenant sin dejar rastro.
- `saludAgregadaPlataforma` tampoco loguea (por diseño: es agregado cross-tenant, no "acceso a un
  tenant puntual").
- Panel Admin CEOM puede **escribir** en `logs_acceso_admin_ceom` pero no expone ninguna función
  propia para **leerlo** de vuelta — `listarLogsAcceso()` vive en `consentimiento/actions.ts`, gateada
  a `ceom_admin`, pero `panel-admin-ceom/actions.ts` no la importa ni la re-expone; solo el propio test
  la consume directo de Consentimiento.

**No verificado en esta pasada** (fuera del alcance de rastrear `actions.ts`/`repository.ts`): no se
abrió cada `schema.ts` para confirmar si `tenants`/`planes`/`producciones`/`insumos`/`ventas`/`gastos`/
`detalles_venta`/`ajustes_venta`/`pagos_venta`/`pagos_gasto` ya tienen `crudPolicy()` declarada en el
schema (aunque hoy no se ejecute, por el bypass del rol `postgres`, la policy puede ya estar definida
esperando a que el módulo migre). Recomiendo una pasada dedicada sobre esos `schema.ts` antes de
diseñar la policy de cada módulo — en particular para las tablas **hijas sin `tenant_id` propio**
(`detalles_venta`, `ajustes_venta`, `pagos_venta`, `pagos_gasto`, `pagos_compra`): una policy
`tenant_id = current_tenant_id() OR es_ceom_admin()` directa no compila ahí porque `tenant_id` no
existe en esas tablas — van a necesitar el mismo patrón que ya usa Proveedores (`compra_id in (select
id from compras where ...)`) extendido con el OR.

### 10.2 Bypasses de `ceom_admin` que ya existen en la aplicación — y cómo van a interactuar con RLS

Todo bypass listado abajo es HOY la única defensa (0/49 tablas con `FORCE`, confirmado de nuevo en
esta pasada — ver §10.3). Hay dos familias, con implicancias distintas:

**Familia A — bypass de FILTRO sobre tablas que YA tienen `crudPolicy()` tenant-scoped.**
`tienePermiso()` (`identidad/actions.ts:83`, el motor de autorización de todo el Core:
`solicitante.rol.esRolSistema && solicitante.rolId === ROL_CEOM_ADMIN_ID → return true`),
`recursoPerteneceAlTenant()` (`:120-126`), `obtenerTenantPorId()` (`:137-149`), `listarSucursalesPorTenant()`
(`:238-247`), y en Consentimiento `listarSolicitudesPorTenant()`/`consultarAprobacionesPorTenant()`
(`consentimiento/actions.ts:316-325`, `344-353`, chequeo inline sin pasar por el helper compartido).
**El patrón genérico de §2.3 (OR sobre la policy existente) SÍ cubre a esta familia — con una
condición dura: la policy de bypass tiene que entrar en la MISMA migración que el cambio de código,
nunca después.** Si no, el resultado es la contradicción silenciosa que ya pasó una vez en la
práctica (§9.6): el gate de aplicación dice "adelante", RLS filtra a la fila de "CEOM Ops" y devuelve
0/1 en silencio.

**Familia B — gate REQUIRE-only sobre catálogos/tablas de sistema sin policy de escritura (o con
deny-all).** `crearTenant()`/`cambiarPlanTenant()`/`cambiarEstadoSuscripcion()` (escrituras a
`tenants`, chequeo único sin `esRolSistema`), Suscripción→`planes`, Consentimiento→`instituciones` y
`logs_acceso_admin_ceom`, Gastos→`categorias_gasto_sugeridas`, Productos→`categorias_sugeridas`. **El
patrón genérico NO las cubre**: no hay policy de tenant propio de la que partir (son catálogos
globales de solo-lectura-abierta, o tablas deny-all) — cada una necesita una policy de escritura
diseñada a mano, no la extensión automática de un OR.

**El caso más afilado: `logs_acceso_admin_ceom`.** Hoy es deny-all deliberado para
`authenticated`/`anon` (confirmado en el propio schema y en §1.2/§1.5) — funciona porque hoy solo
escribe `postgres` (dueño, bypass total). El gate de aplicación (`requiereCeomAdmin()` en
`registrarAccesoAdminCeom()`/`listarLogsAcceso()`, `consentimiento/actions.ts:516-545`) es hoy la
única protección, y funciona. **El día que Consentimiento migre bajo el patrón genérico sin una
policy bespoke para esta tabla específica, el resultado es la peor combinación posible: el `INSERT`
del log de auditoría empieza a fallar (o, si el código no revisa el resultado, el log simplemente
deja de escribirse) justo en el momento en que el bypass cross-tenant se vuelve real** — la tabla que
existe para dejar rastro de qué miró `ceom_admin` queda ciega exactamente cuando más importa que no lo
esté. Recomiendo tratar esta tabla como excepción de diseño explícita desde ya, no como una fila más
del barrido genérico (ver §10.5, §10.8).

**Confirmación de forma, no de fondo:** el chequeo doble que ya usa la aplicación
(`solicitante.rol.esRolSistema && solicitante.rolId === ROL_CEOM_ADMIN_ID`) es exactamente la
condición que la `es_ceom_admin()` propuesta en §2.3 replica (`r.id = ROL_CEOM_ADMIN_ID and
r.es_rol_sistema`) — coincide. **Un chequeo más laxo (solo `rol_id`, sin `es_rol_sistema` — el que
usan hoy Suscripción/Consentimiento/Gastos/Productos en sus propios `requiereCeomAdmin()` locales)
introduciría una asimetría real entre lo que la app ya permite y lo que la policy permitiría** — vale
unificar esos cuatro helpers a la condición doble antes o durante la Etapa 3, no solo para RLS sino
porque hoy mismo son cuatro implementaciones ligeramente distintas del mismo concepto.

### 10.3 `es_ceom_admin()` — recursión, costo por fila, superficie

**Recursión — confirmado que NO ocurre hoy, y por qué exactamente (no "porque `SECURITY DEFINER` lo
arregla mágicamente").** `usuarios` y `roles` tienen `relforcerowsecurity = false` (confirmado en
vivo, junto con `permisos`/`permisos_especiales_por_*`/`tenants`/`logs_acceso_admin_ceom` — las 7,
igual que las 44 tablas de negocio antes de la Etapa 2). Postgres **ignora RLS por completo para el
dueño de la tabla salvo que tenga `FORCE`** — y `SECURITY DEFINER` hace que la función corra *como su
dueño* (`postgres`). Por eso `current_tenant_id()` (misma forma: `STABLE SECURITY DEFINER`, lee
`usuarios`) no recursiona hoy: su lectura interna de `usuarios` ni siquiera evalúa la policy de
`usuarios`, porque `FORCE` está apagado ahí. `es_ceom_admin()` (misma forma, lee `usuarios` + `roles`)
tendría exactamente la misma propiedad, por la misma razón — **no por diseño de la función, sino por
el estado actual de `FORCE` en esas dos tablas específicas.**

**Esto es una dependencia real a vigilar, no una garantía permanente.** El día que `usuarios`/`roles`
reciban `FORCE` (parte natural de cerrar el plan — §2.4 recomienda `FORCE` al cierre de cada etapa
migrada, y la Etapa final de Identidad eventualmente las toca), si a esas MISMAS tablas se les agrega
`OR es_ceom_admin()` en su propia policy, ahí sí hay recursión real: evaluar la policy de `usuarios`
llamaría a `es_ceom_admin()`, que lee `usuarios` de nuevo, re-disparando la policy. **Regla a dejar
escrita para cuando llegue la migración de Identidad: `usuarios`/`roles`/`permisos`/
`permisos_especiales_por_*` NUNCA deberían recibir `OR es_ceom_admin()` en su propia policy** — el
acceso de `ceom_admin` a la fila de identidad de OTRO tenant, si hace falta, necesita resolverse
distinto (ej. una función separada que no dependa circularmente de sí misma), no extendiendo el mismo
patrón sin pensarlo. Documentado también como decisión abierta en §10.11.

**Costo por fila — medido en vivo con la policy REAL aplicada (no simulada), y la hipótesis original de
"una vez por consulta" resultó INCORRECTA para `es_ceom_admin()` específicamente — corregido acá antes
de implementar 3.b.** Verificación pendiente de la primera versión de este documento, ahora cerrada:
`CREATE POLICY` real (dentro de una transacción con `rollback`, mismo criterio que Stage 0 §8.1) sobre
`usuarios` y `proveedores`, combinada con la policy de tenant propio ya existente, bajo `SET LOCAL ROLE
authenticated` + JWT de un `ceom_admin` real.

```
"Filter": "((usuarios.tenant_id = (InitPlan 1).col1) OR (usuarios.tenant_id = (InitPlan 2).col1)
            OR es_ceom_admin())"
```

**`current_tenant_id()` sigue hoisteándose a `InitPlan` (confirmado con la policy real, no solo
simulada) — pero `es_ceom_admin()` NO.** Aparece como una llamada de función directa dentro del
`Filter`, sin nodo `InitPlan` propio. Se probaron tres variantes para descartar causas (`es_ceom_admin()
= true` explícito; una versión sin el `JOIN` a `roles`, solo contra `usuarios`; una función trivial
`select true`) — ninguna cambió el resultado: **una función booleana usada como término suelto de un
`OR` nunca se hoistea en Postgres, sin importar cuán simple sea su cuerpo.** El mecanismo que sí
hoistea `current_tenant_id()` es específico de su forma de uso: aparece como operando de una
comparación (`columna = current_tenant_id()`), no como predicado booleano suelto — esa es la
diferencia real, no `SECURITY DEFINER`, ni la presencia de un `JOIN`, ni la complejidad del cuerpo.

**Corrección posterior (§12, 2026-07-21): esta explicación de la causa era incompleta, no los datos.**
Lo de arriba es cierto para `es_ceom_admin()` **a secas** (sin envolver) — pero nunca se probó la
forma `(select es_ceom_admin())` (el patrón que Supabase recomienda para `auth.uid()`), que **sí**
hoistea a un `InitPlan`, medido con `EXPLAIN ANALYZE` real. La causa real no es "operando de
comparación vs. predicado suelto" — es si la expresión está envuelta en una subconsulta escalar
sin correlación con la fila externa o no. Ver §12 para la medición completa (chica y a volumen
sintético de 40k filas) y el cambio aplicado.

**La consecuencia práctica es acotada, y también se verificó en vivo, no se asumió.** Postgres evalúa
`OR` con cortocircuito por fila: si el primer término (`tenant_id = current_tenant_id()`) ya es
verdadero para una fila, `es_ceom_admin()` ni se llama para esa fila. Con la policy real activa se
probaron dos escenarios:

1. **Sin filtro adicional en la query** (`select * from usuarios`): `es_ceom_admin()` se evalúa para
   cada fila que NO pertenece al tenant propio del `ceom_admin` ("CEOM Ops") — en este caso, para
   prácticamente toda la tabla.
2. **Con el filtro que la aplicación YA agrega siempre** (`select * from usuarios where tenant_id =
   '<tenant objetivo>'`, exactamente como hace cada función de Panel Admin CEOM hoy, §10.1):
   Postgres evalúa `tenant_id = '<objetivo>'` primero (comparación literal, sin subconsulta, la más
   barata) — `Rows Removed by Filter` confirma que la mayoría de las filas de la tabla se descartan
   ahí mismo, **antes** de llegar al `OR` que contiene `es_ceom_admin()`. El costo real de
   `es_ceom_admin()` queda acotado a cuántas filas tiene el TENANT OBJETIVO en esa tabla, no la tabla
   completa — para el tamaño real de este producto (unidades a decenas de filas por tenant por tabla,
   confirmado en las mediciones de la Etapa 2), es un costo despreciable.

**Invariante ELIMINADO (§12, 2026-07-21) — ya no aplica, dejado acá tachado en sentido para que quede
trazable qué se creía antes y por qué se corrigió.** Esta sección decía que el costo bajo estaba
condicionado a que cada función de Panel Admin CEOM trajera `tenantId` como filtro explícito de la
query — y que si alguna función nueva bypaseada por `es_ceom_admin()` hiciera un agregado genuinamente
sin filtro de tenant, el costo dejaría de estar acotado. **Eso era cierto para `es_ceom_admin()` a
secas, la forma que estaba en producción hasta esta fecha.** §12 midió con `EXPLAIN ANALYZE` real
(volumen sintético de 40k filas) que envolver la llamada en una subconsulta escalar —
`using ((select es_ceom_admin()))`, ya aplicado en `ceomAdminBypassPolicy()` y en las 4 policies de
Proveedores vía la migración `0033_ceom_admin_bypass_hoist_initplan.sql` — la hoistea a un `InitPlan`:
se evalúa una sola vez por consulta, sin importar si la query trae o no un filtro de tenant. El costo
ahora está acotado por diseño de la policy, no por una convención de la aplicación que una query futura
podría romper sin darse cuenta. Sigue siendo buena práctica que cada query traiga su filtro de tenant
explícito (por el resto de la query, no por este bypass en particular) — pero ya no es la única razón
por la que `es_ceom_admin()` no sale caro. De paso, verificado en el código (§12.5): `saludAgregadaPlataforma`
tampoco era el caso de riesgo que esta sección insinuaba — no pasa por RLS/`es_ceom_admin()` en
absoluto, usa el cliente `db` crudo (rol `postgres`, dueño de la tabla). Detalle completo en §12.

**Superficie — mismo criterio ya aplicado a `current_tenant_id()`.** Grants actuales de
`current_tenant_id()`, confirmados en vivo: `EXECUTE` para `authenticated`, `postgres`, `service_role`
— **no** para `anon`/`public` (migración `0028`). `es_ceom_admin()` debería nacer con el mismo patrón
desde el día uno (`revoke all from public, anon; grant execute to authenticated`), no revocarlo
después como se tuvo que hacer con `current_tenant_id()`. El advisor de seguridad de Supabase va a
marcar la misma señal esperada (`authenticated_security_definer_function_executable`, nivel `WARN`,
ya presente hoy para `current_tenant_id()`) — es ruido conocido y aceptado, no un hallazgo nuevo.

**SQL propuesto, con la corrección de §10.0.3 ya incluida:**

```sql
create function public.es_ceom_admin() returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.usuarios u
    join public.roles r on r.id = u.rol_id
    where u.id = auth.uid()
      and u.eliminado_en is null   -- NUEVO respecto a §2.3: un ceom_admin
      and u.activo                  -- soft-eliminado o desactivado no debe
                                     -- conservar el bypass. current_tenant_id()
                                     -- ya filtra eliminado_en; activo es
                                     -- defensa en profundidad adicional.
      and r.id = 'c1027307-fc75-4517-b2af-9687234c694d' -- ROL_CEOM_ADMIN_ID
      and r.es_rol_sistema
  )
$$;
revoke all on function public.es_ceom_admin() from public, anon;
grant execute on function public.es_ceom_admin() to authenticated;
```

### 10.4 El solicitante sintético del Gateway — no tiene arreglo dentro de la Etapa 3

Confirmado con más precisión técnica que en §9.6: **ni "tratarlo como caso 2" ni "tratarlo como caso
3" funcionan sin sembrar una fila real.**

- **Caso 2 (`comoCeomAdmin`, lo que propone §2.3):** requiere `current_tenant_id()`, que lee
  `usuarios` filtrando por `auth.uid()`. El id de ceros nunca tiene fila — sigue reventando, con o sin
  `es_ceom_admin()`, porque el problema no es la policy, es que `auth.uid()` jamás puede *coincidir*
  con una fila que no existe.
- **Caso 3 (`comoInstitucion`) — analizado en más detalle esta vez.** `comoInstitucion()` NO exige
  `current_tenant_id()`, exige `auth.uid()` (vía `fijarContextoYExigirAuthUid`) — y `auth.uid()` en
  Supabase es literalmente `nullif(current_setting('request.jwt.claims',true)::json->>'sub','')::uuid`:
  **no consulta ninguna tabla**, solo lee el claim del JWT. El UUID de ceros SÍ resolvería como
  `auth.uid()` bajo este camino, sin reventar. Pero la política de la Etapa 4
  (`tenant_autorizado_para_institucion_actual()`, §2.3 caso 3) hace `where i.auth_user_id =
  auth.uid()` contra `instituciones` — y tampoco hay ninguna fila de `instituciones` con
  `auth_user_id` = ese UUID. El resultado es el mismo: no revienta, pero tampoco autoriza nada. Migrar
  el Gateway a `comoInstitucion()` tal cual está diseñada hoy la Etapa 4 **no resuelve el problema
  sin además sembrar algo real.**

**Las tres opciones, con consecuencias:**

| Opción | Consecuencias |
|---|---|
| **A. Sembrar un usuario de sistema real** para el Gateway (`auth.users` + `usuarios`, tenant "CEOM Ops", `rolId = ROL_CEOM_ADMIN_ID`, un id fijo nuevo tipo `GATEWAY_SISTEMA_USUARIO_ID` en `identidad/constants.ts`) y hacer que `solicitanteGateway()` devuelva ese id real en vez de fabricar el objeto en memoria | Cero caso especial en `contexto.ts`/RLS — funciona exactamente igual que un `ceom_admin` humano, incluido el bypass de `es_ceom_admin()` recién diseñado. Costo: una fila más "artificial" en `usuarios`/CEOM Ops (fácil de excluir de listados humanos si hace falta), y una migración de seed nueva. Este usuario nunca hace login real vía GoTrue — el código lo usa directo por id, igual que ya se confía en `DATABASE_URL` para todo lo demás. **Es la que recomendaría**, pero es trabajo de la Etapa 4 (ver abajo), no de esta. |
| **B. Tratar como caso 3 extendido** | No alcanza por sí sola (ver arriba) — necesitaría TAMBIÉN una fila real en `instituciones` con ese `auth_user_id`, lo cual es conceptualmente más raro (el Gateway no es una institución) que sembrar un usuario de sistema. Más trabajo por menos claridad que la opción A. |
| **C. Mantenerlo fuera de RLS indefinidamente, con excepciones explícitas** | Es literalmente lo que ya se hizo esta sesión para `consultarPagosCompraEnPeriodo()` — funciona, pero no escala: cada función de cada módulo migrado que el Gateway alcance (Ventas, Gastos, Operativo/Nicho-1, y eventualmente Identidad) necesita su propia excepción, para siempre. Es el statu quo, no una solución. |

**Mi recomendación: Opción A, pero como decisión y trabajo de la Etapa 4, no de la Etapa 3.** La
razón no es solo de alcance — es conceptual: quién autoriza qué es exactamente lo que la Etapa 4
(portal/Gateway) existe para resolver; la Etapa 3 es sobre operadores humanos de CEOM usando el Panel
Admin. Forzar la Etapa 3 a resolver también el caso del Gateway mezclaría dos modelos de confianza
distintos en una sola pieza de trabajo. **Consecuencia práctica y explícita para el alcance de la
Etapa 3: la excepción de `consultarPagosCompraEnPeriodo()` para el camino Gateway NO se puede
eliminar cuando la Etapa 3 cierre** — solo se elimina la mitad del problema (el `ceom_admin` real de
Panel Admin CEOM). Ver §10.7.

### 10.5 Auditoría y visibilidad

Estado actual, confirmado en vivo: `logs_acceso_admin_ceom` (`id`, `usuario_ceom_id`, `tenant_id`,
`modulo_consultado` tipado como `modulo_permiso` — el enum grande de 10 valores, no `modulo_veedor`
— , `creado_en`), RLS habilitada, **cero policies** (deny-all real, no solo declarado). El
`get_advisors` de seguridad lo marca como `INFO` esperado ("RLS Enabled No Policy"), consistente con
que es intencional.

**Cobertura real de qué queda rastro hoy** (antes de cualquier bypass — ya un problema, no algo que
vaya a empeorar con la Etapa 3, pero sí algo que la Etapa 3 debería cerrar de paso ya que va a tocar
este módulo):
- ✅ `consultarFinancieroTenant`, `consultarOperativoTenant`, `consultarInventarioOperativoTenant`
  quedan logueadas.
- ❌ `consultarTenantDetalle` — no loguea (sin categoría de enum para "identidad").
- ❌ `saludAgregadaPlataforma` — no loguea (por diseño, es agregado no puntual — razonable, pero vale
  confirmarlo como decisión, no como omisión).
- ❌ No existe ninguna forma de que un `ceom_admin` (ni nadie) audite "quién leyó los logs de
  auditoría" — `listarLogsAcceso()` en sí no queda logueada en ningún lado.

**Si una cuenta `ceom_admin` se compromete, ¿queda rastro de qué tenants consultó?** Parcialmente:
las 3 funciones de arriba sí, `consultarTenantDetalle` no. Con la Etapa 3 activa (bypass real de RLS),
un atacante con credenciales de un `ceom_admin` comprometido podría leer `tenants` completo vía
`saludAgregadaPlataforma`/`consultarTenantDetalle` (metadata básica, no financiera) sin dejar ningún
rastro — hoy ese mismo acceso ya es posible a nivel aplicación (el gate deja pasar), así que la Etapa
3 no lo empeora, pero tampoco lo arregla si no se toca a propósito.

**Recomendación concreta para el diseño de la Etapa 3 (no solo diagnóstico):** agregar una categoría
de log para lecturas de identidad/plataforma (nuevo valor de enum, o una tabla/columna separada para
"acceso agregado" vs "acceso puntual a un tenant") como parte del mismo trabajo, en vez de dejarlo
como veía documentado "pendiente" indefinidamente — es exactamente el momento en que el bypass se
vuelve real y el costo de NO tener este rastro sube.

### 10.6 Blast radius y detección

**Si `es_ceom_admin()` está mal escrita y siempre devuelve `false`:**
- **Qué se rompe:** el bypass simplemente no existe — `ceom_admin` queda limitado a ver solo la fila
  de su propio tenant ("CEOM Ops") en cada tabla con la policy nueva.
- **¿Visible o silencioso?** **Silencioso**, con el mismo patrón exacto ya confirmado una vez en la
  práctica (§9.6): un `SELECT` que debería devolver N filas devuelve 0, sin error — el panel
  administrativo "funciona" (no hay excepción) pero muestra datos vacíos/incorrectos para cualquier
  tenant que no sea CEOM Ops. **Es el caso peligroso, y ya nos mordió.**
- **Qué test lo detectaría hoy:** solo `panel-admin-ceom.test.ts` caso 3 (ya corregido, assert de
  valor exacto `-100`) lo detectaría para `consultarFinancieroTenant`. **`consultarOperativoTenant`/
  `consultarInventarioOperativoTenant` no tienen NINGÚN test (§10.1/hallazgo de cobertura) — un
  `es_ceom_admin()` roto ahí pasaría completamente desapercibido.** Los 4 asserts débiles de
  `monitoreo-institucional.test.ts` (§10.6-bis, tabla abajo) tampoco lo detectarían, aunque ese camino
  específico ya está fuera del alcance de la Etapa 3 (§10.4).

**Si `es_ceom_admin()` devuelve `true` de más (ej. el `join` está mal y matchea otro rol, o falta el
filtro `es_rol_sistema`/`eliminado_en`/`activo`):**
- **Quién gana acceso a qué:** cualquier usuario cuyo `rol_id` coincida por error (ej. si el filtro
  `es_rol_sistema` se omite y algún tenant llegara a tener un rol *no-sistema* con el mismo UUID por
  colisión — improbable pero es exactamente el tipo de descuido que un chequeo doble existe para
  prevenir) gana lectura cross-tenant total sobre cada tabla con la policy. Con el filtro
  `eliminado_en`/`activo` faltante (gap real encontrado en §10.3), un `ceom_admin` desactivado
  conserva el bypass indefinidamente.
- **¿Visible o silencioso?** También silencioso en el caso general — nada en la aplicación notaría
  que alguien sin debiera tener bypass lo tiene, salvo una auditoría manual de accesos (y ver §10.5:
  hoy esa auditoría tiene sus propios huecos).
- **Qué test lo detectaría:** ninguno de los existentes — no hay ningún test que verifique
  explícitamente "un usuario CASI ceom_admin (mismo rol_id pero `es_rol_sistema=false`, o
  desactivado, o soft-eliminado) NO tiene bypass". Es un test nuevo a escribir (§10.9).

**Otros asserts débiles encontrados en el barrido más amplio** (más allá de los dos ya conocidos de
§9.6), todos en el camino Gateway/Panel Admin, ninguno corregido en esta fase de diagnóstico:

| Archivo:línea | Qué falla en detectar |
|---|---|
| `monitoreo-institucional.test.ts:156` | Ya señalado en §9.6, sigue sin corregir — `typeof flujoCaja === "number"`. |
| `monitoreo-institucional.test.ts:151-156` | `estadoResultados`/`costoFijoTotal` (los otros 2 campos de `detalleFinanciero`) no tienen NINGUNA aserción, ni siquiera `typeof`. |
| `monitoreo-institucional.test.ts:198-206` | Solo verifica el booleano `autorizado` de `detalleOperativo`/`detalleInventarioOperativo` — nunca inspecciona `detalle.producciones`/`detalle.insumos`. Un cross-tenant leak que agregue filas de otro tenant, o un RLS que vacíe el array correcto, pasan igual. |
| `monitoreo-institucional.test.ts:158-161` | `tendenciaVentas` — solo `autorizado`, nunca `detalle.ingresos`. |
| `identidad/identidad.test.ts:441-443` | `listarPermisosPorRol` para un colaborador — solo `ok:true`, no compara `.data` (el test inmediatamente anterior sobre el Owner sí lo hace, correctamente, contra `[]`). |
| `identidad/identidad.test.ts:404-407` | `listarUsuarios` usa `toContain` en vez de comparar la lista completa/longitud — no detecta filas de MÁS (leak cross-tenant que agregue, no que falte). |

**Causa raíz común de los 4 hallazgos de `monitoreo-institucional.test.ts`:** su `beforeAll`
(líneas 49-100) nunca siembra ventas/compras/gastos/producciones/insumos reales — solo
tenant+owner+plan+institución+cartera. Mientras eso no cambie, cualquier assert de valor exacto que
se agregue ahí seguirá siendo ciego, porque 0/vacío es también el valor legítimo hoy (mismo problema,
mismo fix que ya se aplicó en `panel-admin-ceom.test.ts`: sembrar datos reales primero). **Este
archivo específico corresponde al camino Gateway (§10.4), fuera del alcance de arreglo de la Etapa 3
— se deja documentado para cuando se aborde la Etapa 4.**

**Gaps de cobertura (cero test, ni débil ni fuerte) relevantes para la Etapa 3:**
`consultarOperativoTenant`, `consultarInventarioOperativoTenant` (Panel Admin CEOM),
`tienePermiso()` nunca se prueba con un solicitante `ceom_admin` real en `identidad.test.ts`,
`registrarAccesoAdminCeom`/`listarLogsAcceso` no tienen test directo en `consentimiento.test.ts`
(solo indirecto vía `panel-admin-ceom.test.ts`).

### 10.7 Qué se desbloquea — respuesta directa

**No, la Etapa 3 no elimina todas las excepciones futuras, y no todo lo que se pensaba.** Específicamente:

- **`consultarPagosCompraEnPeriodo()` — se puede eliminar la excepción SOLO para el camino
  `ceom_admin`/Panel Admin CEOM**, una vez que exista `es_ceom_admin()` + la policy de bypass en las 4
  tablas de Proveedores. **No se puede eliminar para el camino Gateway/`solicitanteGateway()`** — eso
  necesita la Etapa 4 (§10.4). La función va a necesitar seguir teniendo *algún* manejo especial
  mientras el Gateway no tenga una identidad real, aunque ya no necesite el manejo especial actual
  para el caso `ceom_admin`.
- **Ventas, Gastos y Operativo/Nicho-1 NO quedan migrables sin excepciones nuevas solo porque la
  Etapa 3 exista.** Cada uno va a necesitar SU PROPIA policy de bypass (`es_ceom_admin()` ya existe,
  reutilizable, pero la policy por tabla hay que escribirla y aplicarla en la MISMA migración que su
  paso a `comoUsuario()` — igual que se tuvo que hacer, tarde, para Proveedores). Y cada uno TAMBIÉN
  va a seguir necesitando una excepción tipo `consultarPagosCompraEnPeriodo()` para las funciones
  específicas que el Gateway alcanza, hasta que la Etapa 4 resuelva el solicitante sintético.
- **Lo que SÍ se desbloquea de verdad:** (a) el patrón queda definido y probado una sola vez
  (`es_ceom_admin()`, el SQL de política de bypass, la forma de verificarlo con `EXPLAIN ANALYZE`
  antes de confiar en él) en vez de improvisarse módulo por módulo; (b) Proveedores queda con su
  historia completa (ya no necesita NINGUNA excepción para el camino `ceom_admin`, solo para el
  Gateway); (c) el checklist de "qué revisar antes de migrar un módulo" (§10.8) se puede aplicar
  mecánicamente a Ventas/Gastos/Nicho-1/Identidad/Consentimiento/Suscripción cuando les toque, en vez
  de re-descubrir cada vez el mismo tipo de bug.

### 10.8 Plan de sub-etapas verificables y reversibles — nada de aplicar N policies de una vez

**3.a — `es_ceom_admin()` sola, sin ninguna policy todavía.** Crear la función (SQL de §10.3, con el
filtro `eliminado_en`/`activo` agregado), revocar `EXECUTE` de `anon`/`public` en la misma migración
(no en una separada y posterior, como pasó con `current_tenant_id()`). Verificar con el mismo
`EXPLAIN ANALYZE` de §10.3 pero ahora contra la función real. Cero impacto en producción — ninguna
policy la referencia todavía. Reversible con un `DROP FUNCTION` sin dependientes.

**3.b — Policy de bypass SOLO en las 4 tablas de Proveedores.** Es el único lugar donde tiene efecto
real hoy (§10.0.1). `for all to authenticated using (es_ceom_admin()) with check (es_ceom_admin())`
en `proveedores`/`compras`/`pagos_compra`/`compras_ajuste`, policy permisiva adicional (se OR-ea sola
con la existente por semántica nativa de Postgres). Verificar con el `tenant-aislamiento.test.ts` de
Proveedores extendido (un caso nuevo: ceom_admin SÍ ve la fila de un tenant ajeno) + repetir
`panel-admin-ceom.test.ts` caso 3. Reversible con `DROP POLICY` por nombre, sin tocar la tabla.

**3.c — Eliminar la excepción de `consultarPagosCompraEnPeriodo()` para el camino `ceom_admin`
(dejar la excepción del Gateway intacta).** Volver a envolver la función en `comoCeomAdmin()`
condicionalmente, o directamente decidir si conviene que TODA la función pase a `comoCeomAdmin()`/
`comoUsuario()` según quién llama — esto sí es una decisión de código, para cuando se implemente (no
en esta fase de diagnóstico). Verificar: el test ya existente (`panel-admin-ceom.test.ts` caso 3)
sigue en verde, y el camino Gateway (`monitoreo-institucional.test.ts`) también, sin haberlo tocado.

**3.d — `logs_acceso_admin_ceom`: diseño de policy bespoke, no el patrón genérico.** Sub-etapa
aparte a propósito, dado el riesgo ya descrito en §10.2/§10.5. Policy de escritura para `ceom_admin`
(`INSERT ... with check(es_ceom_admin())`) + decisión explícita sobre si `ceom_admin` puede leer sus
propios logs vía RLS o si eso se sigue resolviendo solo a nivel aplicación. Cerrar de paso el gap de
"Panel Admin CEOM no expone lectura de sus propios logs" (§10.1) si se decide que vale la pena en esta
misma pasada.

**3.e — Checklist documentado para Ventas/Gastos/Operativo-Nicho-1/Identidad/Consentimiento/
Suscripción**, para aplicar CADA VEZ que uno de esos módulos migre a `comoUsuario()` (no se ejecuta
en esta etapa, se deja escrito): (1) ¿qué tablas de este módulo toca Panel Admin CEOM o Monitoreo
Institucional? (§10.1 ya cubre las de Ventas/Gastos/Operativo — falta Identidad/Consentimiento/
Suscripción si no se cubrieron ya en la Familia B de §10.2); (2) ¿la tabla ya tiene `crudPolicy()`
(Familia A) o necesita policy nueva (Familia B)?; (3) la policy de bypass entra en el MISMO commit
que el cambio de `comoUsuario()`, nunca después; (4) correr la suite COMPLETA (no solo el módulo)
antes de dar por cerrada la migración — la lección de §9.6; (5) ¿esa migración también deja alguna
función alcanzable por `solicitanteGateway()`? Si sí, va a necesitar su propia excepción tipo
`consultarPagosCompraEnPeriodo()` hasta que exista la Etapa 4.

### 10.9 Tests a escribir/reforzar ANTES de tocar código

1. **`tenant-aislamiento.test.ts` de Proveedores, extendido** con un caso nuevo: un usuario
   `ceom_admin` real (sembrado, no sintético) SÍ ve la fila de un tenant ajeno vía `comoCeomAdmin()` —
   hoy el archivo solo prueba que un usuario NORMAL no la ve.
2. **Caso negativo del punto anterior, explícito**: un usuario con `rol_id = ROL_CEOM_ADMIN_ID` pero
   `es_rol_sistema = false` (o desactivado, o soft-eliminado) NO tiene bypass — cubre el "devuelve
   true de más" de §10.6 y el gap de `eliminado_en`/`activo` de §10.3.
3. **Reforzar `panel-admin-ceom.test.ts`** con casos para `consultarOperativoTenant`/
   `consultarInventarioOperativoTenant` (hoy sin ningún test) con datos reales sembrados y asserts de
   valor exacto — mismo criterio que ya se aplicó a `consultarFinancieroTenant`.
4. **Test directo de `es_ceom_admin()` vía SQL**, análogo al de §8.1 para `current_tenant_id()`: una
   transacción con `rollback` al final que confirma que la función resuelve `true` para un
   `ceom_admin` sembrado y `false` para todo lo demás (usuario normal, `ceom_admin` desactivado,
   sesión anónima) — antes de escribir ninguna policy que dependa de ella.
5. **No obligatorio para el cierre de la Etapa 3, pero recomendado de paso** dado que se va a tocar el
   módulo: corregir los 4 asserts débiles de `monitoreo-institucional.test.ts` (§10.6) — aunque el
   camino Gateway en sí quede fuera del alcance de esta etapa, esos asserts son débiles con o sin
   Etapa 3.

### 10.10 Plan de rollback

Igual de barato que las etapas anteriores, por el mismo diseño: **3.a** es un `DROP FUNCTION
public.es_ceom_admin()` sin dependientes mientras no exista ninguna policy (revertir 3.a antes que
3.b). **3.b** es `DROP POLICY "<tabla>_ceom_admin_bypass" ON <tabla>` por cada una de las 4 tablas de
Proveedores — no toca la policy de tenant-propio existente, no toca datos. **3.c** es revertir un
archivo de código (`proveedores/actions.ts`), sin tocar la base. **3.d** es `DROP POLICY` sobre
`logs_acceso_admin_ceom` — vuelve al estado deny-all actual. Ninguna sub-etapa de esta lista requiere
tocar datos ni puede dejar el sistema en un estado a medio camino si se revierte una sola de ellas por
separado (a diferencia de, por ejemplo, revertir 3.b sin revertir 3.c — ahí sí quedaría
`consultarPagosCompraEnPeriodo()` esperando un bypass que ya no existe; el orden de reversión
correcto es el inverso al de aplicación: 3.d → 3.c → 3.b → 3.a).

### 10.11 Decisiones abiertas — recomendación en cada una

1. **¿`es_ceom_admin()` con el filtro `eliminado_en`/`activo` agregado (recomendado, §10.3), o tal
   cual estaba en §2.3?** Recomiendo agregarlo — es gratis, y sin él hay un gap de seguridad real
   (admin desactivado conserva bypass).
2. **¿Alcance de la Etapa 3 ahora: solo `es_ceom_admin()` + Proveedores (3.a-3.c, recomendado), o
   además diseñar ya las policies de Familia B (`planes`, `instituciones`, `logs_acceso_admin_ceom`,
   escrituras de `tenants`) aunque todavía no tengan efecto porque sus módulos no migraron?**
   Recomiendo hacer 3.a-3.d ahora (incluyendo `logs_acceso_admin_ceom` por su riesgo particular,
   §10.2) y dejar el resto de la Familia B para cuando cada módulo migre (checklist de 3.e) — escribir
   policies para tablas cuyo módulo no está migrado es trabajo que no se puede verificar de verdad
   todavía (no hay forma de probar el bypass si `comoUsuario()` ni siquiera está en el camino).
3. **`usuarios`/`roles`/`permisos*` — ¿alguna vez reciben `OR es_ceom_admin()` en su propia policy?**
   Recomiendo que no, nunca, por el riesgo de recursión real una vez que tengan `FORCE` (§10.3) —
   dejarlo escrito como regla dura para cuando Identidad migre, no como algo a decidir en ese momento.
4. **Solicitante sintético del Gateway (§10.4): Opción A (sembrar usuario real) cuando se aborde la
   Etapa 4** — ya recomendado arriba, repetido acá porque es la decisión de mayor impacto de todo el
   diagnóstico y el usuario pidió explícitamente una recomendación clara.
5. **Unificar los 4 `requiereCeomAdmin()` locales (Suscripción/Consentimiento/Gastos/Productos, chequeo
   único sin `es_rol_sistema`) al chequeo doble canónico, ¿ahora o cuando cada módulo migre?**
   Recomiendo ahora, es un cambio de código chico y barato (no toca RLS ni requiere DDL) que cierra
   una asimetría real entre la app y el futuro `es_ceom_admin()` antes de que dependan una de la otra.
6. **¿Agregar una categoría de log para lecturas de identidad/plataforma (`consultarTenantDetalle`,
   `saludAgregadaPlataforma`) como parte de la Etapa 3, o dejarlo pendiente igual que hoy (§10.5)?**
   Recomiendo hacerlo como parte de 3.d, ya que se va a tocar `logs_acceso_admin_ceom` de todas formas
   en esa sub-etapa.

### 10.12 Contradicciones/correcciones encontradas contra §2.3 y §9.6

- **§2.3 no tiene contradicción de fondo en el diseño de `es_ceom_admin()`** — la condición doble
  coincide exactamente con lo que ya usa la aplicación (§10.2). Sí tiene un **gap concreto**: falta
  `eliminado_en`/`activo` (§10.3), corregido en la propuesta de este diagnóstico.
- **§2.3 asume que "por cada tabla que ceom_admin necesita cruzar... se OR-ea con la de tenant propio
  automáticamente"** — cierto solo para la Familia A (§10.2). Para la Familia B (catálogos y
  `logs_acceso_admin_ceom`) no hay policy de la que partir; §2.3 no lo anticipaba.
- **§3.1 dice explícitamente "Pendiente antes de la Etapa 3: confirmar el listado exacto de tablas
  que panel-admin-ceom... toca — este diagnóstico no llegó a ese nivel de detalle".** Este documento
  (§10.1) es esa confirmación.
- **§9.6 recomendaba "Opción A: sembrar un usuario real" para el Gateway sin profundizar en si
  alcanzaba.** Este diagnóstico (§10.4) confirma que Opción A es necesaria pero también confirma que
  ni comoCeomAdmin ni comoInstitucion "tal cual están" la resuelven solos — hace falta la fila real
  además del cambio de código, y es trabajo de la Etapa 4, no de la 3.
- **Hallazgo nuevo, no anticipado por ninguna sección anterior:** la mayoría de las tablas que Panel
  Admin CEOM toca todavía no están bajo RLS real (§10.0.1) — el plan en general no había señalado
  explícitamente que el *efecto* de la Etapa 3 es incremental, módulo por módulo, y no un cambio de
  una sola vez.

---

**Fin del diagnóstico. Sin cambios de código ni de base en esa sesión — el conector de Supabase se
usó exclusivamente para lecturas (`EXPLAIN ANALYZE`, catálogos `pg_class`/`pg_proc`/`information_schema`,
`get_advisors`), ninguna sentencia DDL ni de escritura.**

---

## 11. Etapa 3 — implementado y verificado (2026-07-21)

Con las 6 decisiones de §10.11 ya tomadas por el usuario, sobre la misma base de desarrollo. Alcance
final acordado: **3.a, 3.b, 3.c, 3.e** (documentado) + el fix de auditoría de la decisión 6
(desacoplado de 3.d) + la unificación de `requiereCeomAdmin()` (decisión 5, antes de todo lo demás).
**3.d se difirió** — confirmado antes de empezar: `logs_acceso_admin_ceom` la escribe
`registrarAccesoAdminCeom()` (`consentimiento/actions.ts`), y Consentimiento no está migrado a
`comoUsuario()` — esa escritura corre como `db` crudo (rol `postgres`, bypass total) exactamente
igual que las tablas de la Familia B ya diferidas. Una policy ahí hoy sería tan inerte como las que
§10.11 decisión 2 ya excluía por la misma razón — mismo argumento, aplicado con consistencia.

### 11.1 Orden real de ejecución (el pedido por el usuario, seguido tal cual)

1. **Unificación de `requiereCeomAdmin()`** — los 4 locales de Suscripción/Consentimiento/Gastos/
   Productos (chequeo único `rolId !== ROL_CEOM_ADMIN_ID`) pasaron al chequeo doble canónico
   (`rol.esRolSistema && rolId === ROL_CEOM_ADMIN_ID`), igual que `tienePermiso()`/
   `esCeomAdmin()`. De paso se encontró y corrigió un call-site real
   (`src/app/admin/(shell)/planes/actions.ts`) que armaba un objeto `{ rolId }` a mano en vez de
   pasar el `usuario` completo que ya devuelve `obtenerUsuarioActual()`. 79 tests en verde.
2. **Fix de auditoría (decisión 6)** — `"identidad"` agregado a `moduloPermisoEnum` (migración
   aislada, mismo patrón que `"proveedores"`), exclusivamente para
   `logs_acceso_admin_ceom.modulo_consultado` — sigue sin participar en la matriz real de permisos.
   `consultarTenantDetalle`/`saludAgregadaPlataforma` ahora auditan (la segunda, atribuida a
   `CEOM_OPS_TENANT_ID` por ser agregada, no puntual). Encontrado en el camino: el `afterAll` de
   `panel-admin-ceom.test.ts` necesitó un delete nuevo (el log atribuido a `CEOM_OPS_TENANT_ID`) o
   el borrado del usuario de prueba chocaba con la FK — detalle que una migración real a producción
   también va a necesitar tener en cuenta si algún día se purgan usuarios de `CEOM_OPS_TENANT_ID`.
3. **Regla dura contra recursión (decisión 3)** — comentario explícito en `identidad/schema.ts`
   (`roles`/`usuarios`/`permisos`/`permisos_especiales_por_rol`/`permisos_especiales_por_usuario`):
   nunca `OR es_ceom_admin()` en la policy de esas tablas. Solo comentarios — confirmado con
   `drizzle-kit generate` ("No schema changes, nothing to migrate") que no alteró ningún DDL.
4. **Tests de §10.9 ANTES de la policy** — extendido `tenant-aislamiento.test.ts` de Proveedores con
   dos usuarios reales (`ceom_admin` activo, `ceom_admin` desactivado). Corridos y confirmados
   *antes* de 3.a/3.b: el primero daba 0 filas (RLS filtrando de verdad, sin bypass todavía — no una
   tautología), el segundo también. Commit propio, con el resultado "antes" documentado en el mensaje
   para que quede trazable.
5. **3.a — `es_ceom_admin()`.** Igual al SQL propuesto en §10.3, con el filtro `eliminado_en`/
   `activo` (decisión 1) ya incluido. Verificado en vivo (transacción con `rollback`): `true` para un
   `ceom_admin` real, `false` para un usuario regular, `false` para un `sub` inexistente (el caso del
   Gateway). Grants: `EXECUTE` solo para `authenticated`/`postgres`/`service_role`, igual que
   `current_tenant_id()`.
6. **Verificación del caso de dos policies reales (el paso que §10.3 había dejado pendiente) — y
   corrigió la hipótesis original.** `CREATE POLICY` real dentro de una transacción con `rollback`,
   sobre `usuarios` y `proveedores`: **`es_ceom_admin()` NO se hoistea a un `InitPlan`** como
   `current_tenant_id()` — se probaron tres variantes (`= true` explícito, sin `JOIN`, una función
   trivial `select true`) y ninguna cambió el resultado. La diferencia real: `current_tenant_id()` se
   usa como operando de una comparación (`columna = current_tenant_id()`), `es_ceom_admin()` se usa
   como término suelto de un `OR` — esa es la forma que Postgres sí/no hoistea, no la complejidad del
   cuerpo de la función. **El costo práctico queda acotado igual, mediante un mecanismo distinto**:
   cortocircuito de `OR` por fila + el filtro de `tenant_id` explícito que cada query de Panel Admin
   CEOM ya trae (confirmado también en vivo: con `WHERE tenant_id = X`, Postgres evalúa esa
   comparación primero, barata, y descarta la mayoría de las filas antes de llegar a
   `es_ceom_admin()`). §10.3 corregido con este hallazgo — la sección ya no dice "una vez por
   consulta", dice lo que se verificó de verdad.

   **Corrección posterior (§12, 2026-07-21): esta conclusión resultó incompleta.** Las tres variantes
   probadas acá (`= true` explícito, sin `JOIN`, `select true`) nunca incluyeron la forma
   `(select es_ceom_admin())` — envolver la llamada en una subconsulta escalar sí la hoistea a un
   `InitPlan`, medido con `EXPLAIN ANALYZE` real a volumen sintético de 40k filas (~68x más rápido en
   el peor caso, "sin filtro"). Ya aplicado como el patrón por defecto de `ceomAdminBypassPolicy()`.
   Ver §12 para la medición completa y qué cambió.
7. **3.b — policy de bypass en las 4 tablas de Proveedores.** Nuevo helper reusable
   `ceomAdminBypassPolicy(tableName)` en `src/db/rls.ts` (junto a `crudPolicy()`), declarado en
   `schema.ts` (no SQL suelto) para que quede reconocido como estado esperado, no como drift, en el
   próximo `drizzle-kit generate`. El test del punto 4 que daba 0 filas ahora da 1 — bypass real
   confirmado; el del `ceom_admin` desactivado se mantiene en 0.
8. **3.c — angostar la excepción de `consultarPagosCompraEnPeriodo()`.** Nuevo
   `ContextoRlsNoResueltoError` (clase propia en `contexto.ts`, no un `Error` genérico) para poder
   distinguir "el contexto de RLS no resolvió" de cualquier otro fallo real. La función intenta
   `comoUsuario()` primero (funciona ahora para tenant propio Y para `ceom_admin` real, gracias al
   bypass de 3.b) y cae al camino de `db` crudo solo si ese error específico se dispara — hoy,
   exclusivamente el solicitante sintético del Gateway. Riesgo aceptado documentado: un
   `ContextoRlsNoResueltoError` de otro origen quedaría enmascarado por este fallback — ya existía
   antes (la excepción original era más ancha), ahora la superficie es más chica.

### 11.2 3.e — checklist para las próximas migraciones, con lo aprendido de verdad (no solo lo previsto en §10.8)

El checklist original de §10.8 seguía siendo correcto en su forma — se agregan acá los puntos que
solo se confirmaron al implementar, no al diagnosticar:

1. Mapear qué tablas de este módulo toca Panel Admin CEOM/Monitoreo Institucional (§10.1 ya cubre
   Ventas/Gastos/Operativo — falta confirmar Identidad/Consentimiento/Suscripción con el mismo nivel
   de detalle antes de migrar cualquiera de esos tres).
2. Clasificar cada tabla: Familia A (ya tiene `crudPolicy()`, el bypass se agrega con
   `ceomAdminBypassPolicy(tableName)` — usar el helper de `src/db/rls.ts`, no reescribir el
   `using`/`withCheck` a mano) vs. Familia B (catálogo o tabla sin policy de tenant propio de la que
   partir — necesita diseño dedicado, no el helper genérico).
3. La policy de bypass entra en el MISMO commit que el cambio a `comoUsuario()` — nunca después
   (§9.6).
4. **Nuevo, confirmado en la implementación:** si el módulo tiene algún `requiereCeomAdmin()`/gate
   local propio (como tenían Suscripción/Consentimiento/Gastos/Productos antes de esta etapa),
   confirmar que ya usa el chequeo doble canónico — si no, unificarlo ANTES de escribir la policy de
   RLS, en su propio commit (mismo orden que se siguió acá).
5. **Nuevo:** si alguna función de este módulo puede terminar corriendo con `es_ceom_admin()`
   evaluándose por fila (cualquier bypass nuevo tiene esta forma, confirmado en el punto 6 de
   §11.1) — confirmar que la query real de la aplicación sigue trayendo un filtro de `tenant_id`
   explícito, no solo la policy. Es la única razón por la que el costo queda acotado; sacar ese
   filtro "porque total la policy ya filtra" reintroduce el costo por fila completo de la tabla.
6. **Nuevo:** si alguna función de este módulo puede recibir un solicitante que no tenga fila real en
   `usuarios`/`auth.users` (hoy, solo `solicitanteGateway()`), va a necesitar el mismo patrón de 3.c
   (`comoUsuario()` con fallback a `db` crudo capturando específicamente
   `ContextoRlsNoResueltoError`, nunca `Error` genérico) — hasta que la Etapa 4 cierre el problema de
   raíz.
7. Correr la suite COMPLETA (no solo el módulo) antes de dar por cerrada la migración — la lección
   de §9.6, repetida acá porque sigue siendo la más fácil de saltear.

### 11.3 Verificación final

`pnpm typecheck` (0 errores), `pnpm lint` (0 errores, mismos 13 warnings preexistentes de React
Compiler sobre `form.watch()`, no relacionados), `pnpm test` (203/203, 31 archivos — suite completa,
no solo Proveedores/Identidad/Consentimiento) y `pnpm build` (compila limpio, todas las rutas)
verdes. `es_ceom_admin()` y las 4 policies de bypass confirmadas activas contra la base real de
desarrollo (`riertvgnjaujstwyqoom`).

### 11.4 Estado y qué sigue

Etapa 3 cerrada en el alcance acordado (3.a-3.c, 3.e documentado, fix de auditoría, unificación de
gates). **No cerrada del todo**: 3.d (`logs_acceso_admin_ceom`) queda pendiente para cuando
Consentimiento migre a `comoUsuario()` — en ese momento la policy bespoke SÍ tiene efecto real. La
Etapa 4 (portal) sigue sin tocar, tal como se pidió — con una decisión ya registrada para cuando
llegue (§10.11 decisión 4: sembrar un usuario real de sistema para `solicitanteGateway()`, recomendada
pero no implementada, con su propio diagnóstico primero cuando corresponda). Próximo módulo a migrar
a `comoUsuario()` según el orden de acoplamiento de §3.1: Consentimiento o Suscripción — cualquiera de
los dos ya puede reusar el patrón completo de esta etapa (`ceomAdminBypassPolicy()`,
`ContextoRlsNoResueltoError`, el checklist de §11.2) sin tener que redescubrir nada.

## 12. Etapa 3.f — Hoisting de `es_ceom_admin()` a `InitPlan` (implementado y verificado, 2026-07-21)

### 12.1 Motivo

El invariante documentado en §10.3/§11.1 punto 6 era correcto en los datos que tenía, pero frágil por
diseño: el costo de `es_ceom_admin()` quedaba acotado **solo** porque cada query de Panel Admin CEOM
trae un filtro de `tenant_id` explícito, no porque la policy en sí misma lo garantizara. Eso depende
de la forma de las queries de hoy, no de una propiedad estructural — cualquier query futura que
dependiera del bypass sin ese filtro (un agregado real "de toda la plataforma" sobre una tabla de
negocio) volvería a pagar el costo completo por fila. Se probó si envolver la llamada en una
subconsulta escalar — `using ((select es_ceom_admin()))` en vez de `using (es_ceom_admin())`, el mismo
patrón que Supabase recomienda para `auth.uid()` — la promueve a un `InitPlan` (evaluada una sola vez
por consulta), eliminando la dependencia en vez de solo documentarla.

### 12.2 Metodología

Mismo criterio que §8.1/§10.3: todo dentro de una transacción con `rollback` al final (cero efectos
persistentes), contra la base real de desarrollo (`riertvgnjaujstwyqoom`), nunca simulado. Confirmado
antes de empezar, con una prueba explícita (tabla temporal creada en una llamada, consultada en la
siguiente): **cada llamada del conector de este proyecto abre una sesión nueva** — un `begin` sin su
`rollback` en la misma llamada no sobrevive a la llamada siguiente (la conexión se cierra y Postgres
aborta la transacción sola). Por eso cada medición de esta sección — sembrado de volumen sintético,
cambio de policy, `SET LOCAL ROLE`, `EXPLAIN ANALYZE` y `rollback` — va empaquetada en una única
llamada, nunca repartida entre varias.

Dos escalas:
1. **Volumen real de dev** — las 3 filas que tiene hoy `proveedores`.
2. **Volumen sintético** — 40.000 filas de `proveedores` insertadas bajo un tenant sintético
   (`99999999-9999-9999-9999-999999999999`, también sintético, insertado en la misma transacción),
   más las 3 reales. Sembrado, medido y revertido siempre dentro de la misma transacción — confirmado
   después con una consulta nueva (`select count(*) from proveedores` sin transacción) que el conteo
   real (3) y el tenant sintético (0 filas) quedaron exactamente como estaban antes de empezar.

### 12.3 Resultado — sí hoistea; corrige la hipótesis de §10.3/§11.1 punto 6

**Escala chica (3 filas reales, `ceom_admin` real, con el filtro de tenant que la app ya agrega):**

```
Filter: ((tenant_id = 'd672ef4b...'::uuid) AND
         ((tenant_id = (InitPlan 1).col1) OR (tenant_id = (InitPlan 2).col1) OR (InitPlan 3).col1))
```

`(InitPlan 3).col1` es `(select es_ceom_admin())` — se hoistea exactamente igual que los otros dos
`InitPlan` que ya aportaba `crudPolicy()` para `current_tenant_id()`. Con la policy vieja (`es_ceom_admin()`
a secas), el mismo `Filter` muestra la llamada de función directa, sin `InitPlan` propio — la
diferencia observable entre las dos variantes, ambas contra la policy REAL, no simulada.

**Escala sintética, "sin filtro" (40.003 filas — el escenario de riesgo que preocupaba a §10.3:
un agregado que evalúa el bypass para prácticamente toda la tabla):**

| Variante | Execution Time | Buffers (shared hit) |
|---|---|---|
| `es_ceom_admin()` a secas (la de producción, antes de esta migración) | 847.65 ms | 80.770 |
| `(select es_ceom_admin())` (hoisted) | 12.35 ms | 1.238 |

**~68x más rápido, ~65x menos buffers**, para la misma consulta contra el mismo volumen — atribuible
enteramente a que la función se evalúa 1 vez (`InitPlan`) en vez de ~40.000 veces (una por cada fila
que no pertenece al tenant propio del `ceom_admin` de prueba).

**Escala sintética, "con filtro" (el patrón real que usa hoy Panel Admin CEOM — tenant objetivo con
solo 3 filas, enterrado entre 40.000 filas ajenas):**

| Variante | Execution Time |
|---|---|
| `es_ceom_admin()` a secas | 4.88 ms |
| `(select es_ceom_admin())` (hoisted) | 5.97 ms |

Sin diferencia real (ambas dentro del margen de ruido de esta medición) — ambas muestran
`Rows Removed by Filter: 40000` idéntico. Esto confirma que el mecanismo de cortocircuito de `AND`
que ya describía §11.1 punto 6 se sostiene a volumen real: Postgres nunca llega a evaluar el término
del `OR` que contiene el bypass para las filas que ya fallan el filtro de tenant explícito de la
query, sin importar cuántas sean. Este caso no mejora con el hoisting porque ya estaba acotado por un
mecanismo distinto (cortocircuito), no por el costo de la función en sí.

**Sobre la causa, no solo el resultado:** §11.1 punto 6 atribuía la diferencia con `current_tenant_id()`
a "aparecer como operando de una comparación" vs. "término suelto de un `OR`". Esa distinción no es la
causa real — lo que importa es si la expresión está envuelta en una subconsulta escalar sin
correlación con la fila externa (`SubLink` → `InitPlan`, un mecanismo del planner independiente de en
qué posición booleana se use el resultado después) o si es una llamada de función directa (nunca se
hoistea, sin importar la posición). Los tres experimentos de §11.1 (`= true` explícito, sin `JOIN`,
`select true`) nunca probaron la forma `(select ...)` — la conclusión anterior era incompleta en la
causa, no incorrecta en los datos que tenía.

**Correctitud, no solo velocidad — verificado en el camino, mismo criterio que §11.1 punto 4.** Con la
policy hoisted activa (misma transacción con rollback): un `ceom_admin` real cross-tenant sigue viendo
las filas del tenant objetivo (`bypass_deberia_ser_true = true`, filas vistas > 0); un usuario regular
(Owner de otro tenant, no `ceom_admin`) sigue viendo 0 filas del tenant objetivo
(`bypass_deberia_ser_false = false`). El cambio es puramente de plan de ejecución — la semántica de
`es_ceom_admin()` (quién es bypass y quién no) no se tocó.

### 12.4 Aplicado

- `ceomAdminBypassPolicy()` (`src/db/rls.ts`) reescrita: `using`/`withCheck` pasan de `es_ceom_admin()`
  a `(select es_ceom_admin())`. Todo módulo futuro que use este helper nace con el patrón hoisted sin
  tener que saberlo.
- Migración versionada `drizzle/migrations/0033_ceom_admin_bypass_hoist_initplan.sql`, generada con
  `drizzle-kit generate` (no escrita a mano) — `ALTER POLICY` sobre las 4 tablas que ya tenían el
  bypass (`compras`, `compras_ajuste`, `pagos_compra`, `proveedores`). Aplicada con
  `drizzle-kit migrate` y confirmada en vivo contra `riertvgnjaujstwyqoom`: `pg_policies.qual`/
  `with_check` de las 4 policies ahora son `( SELECT es_ceom_admin() AS es_ceom_admin)`.
- `pnpm typecheck` (0 errores), `pnpm lint` (0 errores, los mismos 13 warnings preexistentes de React
  Compiler, no relacionados) y `pnpm test` (203/203, 31 archivos) verdes después del cambio.

**Lo que NO cambia:** seguir trayendo el filtro de tenant explícito en cada query de Panel Admin CEOM
sigue siendo la práctica correcta — por el rendimiento del resto de la query (el bypass es una policy
más, no la única condición que Postgres tiene que evaluar) y porque es la forma en que la aplicación
ya decide qué le muestra al usuario, no solo un artefacto de RLS. Lo que cambia es que ya no es la
**única** razón por la que el bypass no sale caro.

### 12.5 `saludAgregadaPlataforma` — el caso "reporte de toda la plataforma" que preocupaba a §10.3, verificado: no aplica

§10.3 dejaba una advertencia abierta sobre "un reporte de toda la plataforma sobre una tabla de
negocio, no solo sobre `tenants` como hoy hace `saludAgregadaPlataforma`" — con una redacción que daba
a entender que ese caso ya pasaba por el bypass de `es_ceom_admin()`, acotado nada más porque `tenants`
es una tabla chica.

**Verificado en el código, no asumido: no es así, por una razón más simple, no por tamaño de tabla.**
`saludAgregadaPlataforma` (`src/modules/panel-admin-ceom/actions.ts`) llama a `listarTenantsIdentidad`
→ `identidad/actions.ts:listarTenants()` → `identidad/repository.ts:listarTenants()`, que hace
`db.select().from(tenants).where(isNull(tenants.eliminadoEn))` con el cliente `db` **crudo** (rol
`postgres`, dueño de la tabla) — **nunca abre `comoCeomAdmin()`, nunca pasa por RLS, nunca evalúa
`es_ceom_admin()`.** (Tiene sentido además por qué: si este path abriera contexto vía `comoCeomAdmin()`,
`current_tenant_id()` resolvería al tenant propio del `ceom_admin` — CEOM Ops — no "todos los
tenants"; el propio diseño de `comoCeomAdmin()` no serviría para un agregado de plataforma sin pasar
por el bypass explícitamente, que es justo lo que esta función no hace.)

Se revisaron también, completas, las 4 funciones restantes de `panel-admin-ceom/actions.ts`
(`consultarTenantDetalle`, `consultarFinancieroTenant`, `consultarOperativoTenant`,
`consultarInventarioOperativoTenant`): las 4 reciben un `tenantId` puntual como parámetro y lo pasan
explícito a cada función de módulo que invocan — ninguna es un agregado sin filtro de tenant.

**Conclusión práctica:** hoy no existe ninguna consulta real de Panel Admin CEOM que dependa de
`es_ceom_admin()` para un agregado sin filtro de tenant — el escenario de riesgo que motivó este
diagnóstico sigue siendo hipotético, no real. Pero con el hoisting de §12.3/§12.4 ya aplicado, aunque
apareciera mañana una función nueva con esa forma, ya no sería un problema de rendimiento: el costo de
`es_ceom_admin()` queda acotado por diseño de la policy, no por la suerte de que ninguna query nueva
lo haya roto todavía.
