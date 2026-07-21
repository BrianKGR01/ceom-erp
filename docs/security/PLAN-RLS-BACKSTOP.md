# Plan RLS Backstop — Fase 0: diagnóstico y diseño

**Estado: propuesta, sin aplicar.** Este documento es 100% de solo lectura — ningún archivo de
código ni objeto de la base fue modificado para producirlo. Ver §8.4 de
`docs/security/AUDITORIA-AUTORIZACION.md` para el contexto que originó este trabajo.

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

Quedo a la espera de tu aprobación (y de las decisiones de §7) antes de tocar cualquier archivo de
código o cualquier objeto de la base.
