import { sql, type SQL } from "drizzle-orm";
import { pgPolicy } from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";

// drizzle-orm no trae crudPolicy() para Supabase (solo existe para Neon en la
// version instalada) — ver drizzle.config.ts y ANCLA.md de Identidad. Este
// helper local conserva el nombre que ya usa AGENTS.md, construido sobre
// pgPolicy() + los roles de drizzle-orm/supabase/rls.
//
// RLS acá es una segunda capa de defensa (AGENTS.md regla 6): las Server
// Actions ya filtran por tenant_id explicitamente via tienePermiso() y usan
// el rol "postgres" (DATABASE_URL/DIRECT_URL), que bypassea RLS por ser
// dueño de las tablas. Estas policies protegen accesos futuros via los
// roles "authenticated"/"anon" de Supabase (ej. si algun dia se usa
// Realtime), no son el mecanismo principal de aislamiento.
export function crudPolicy(tableName: string, tenantScope: SQL) {
  return [
    pgPolicy(`${tableName}_tenant_select`, {
      for: "select",
      to: authenticatedRole,
      using: tenantScope,
    }),
    pgPolicy(`${tableName}_tenant_modify`, {
      for: "all",
      to: authenticatedRole,
      using: tenantScope,
      withCheck: tenantScope,
    }),
  ];
}

/**
 * Bypass de ceom_admin (Etapa 3 del backstop de RLS, docs/security/
 * PLAN-RLS-BACKSTOP.md §10.3/§10.8/§12) — policy permisiva adicional que se
 * OR-ea sola con la de crudPolicy() (semántica nativa de Postgres para
 * múltiples policies permisivas del mismo comando). Reusar esta función,
 * no reescribir el `using`/`withCheck` a mano, para que toda tabla con
 * bypass use exactamente `(select es_ceom_admin())` — no una variante local.
 *
 * `(select es_ceom_admin())`, no `es_ceom_admin()` a secas (§12, medido con
 * EXPLAIN ANALYZE real, en transacción con rollback, a volumen sintético de
 * 40k filas): envolver la llamada en una subconsulta escalar la hoistea a un
 * `InitPlan` — se evalúa UNA sola vez por consulta, igual que
 * `current_tenant_id()` (mismo patrón que recomienda Supabase para
 * `auth.uid()`). Corrige la hipótesis anterior de §10.3/§11.1 punto 6
 * ("una función booleana usada como término suelto de un OR nunca se
 * hoistea"): esa conclusión era cierta para `es_ceom_admin()` a secas o
 * `= true`, pero nunca se probó la forma `(select ...)` — que sí hoistea,
 * sin relación con ser o no operando de una comparación. Con esto, el costo
 * de este bypass YA NO depende de que la query de la aplicación traiga un
 * filtro de `tenant_id` explícito (esa dependencia era el invariante frágil
 * que §12 fue a eliminar) — queda acotado por diseño, evaluándose una vez
 * por consulta sin importar cuántas filas tenga la tabla.
 *
 * NUNCA aplicar sobre `usuarios`/`roles`/`permisos`/
 * `permisos_especiales_por_*` (riesgo de recursión real si esas tablas
 * alguna vez reciben FORCE ROW LEVEL SECURITY — ver el comentario en
 * identidad/schema.ts).
 */
export function ceomAdminBypassPolicy(tableName: string) {
  return pgPolicy(`${tableName}_ceom_admin_bypass`, {
    for: "all",
    to: authenticatedRole,
    using: sql`(select es_ceom_admin())`,
    withCheck: sql`(select es_ceom_admin())`,
  });
}

/**
 * Bypass del Gateway de Consentimiento (Etapa 4.a, docs/security/
 * PLAN-RLS-BACKSTOP.md §13/§14/§15, Opción A′) — PROPIA y deliberadamente
 * distinta de `ceomAdminBypassPolicy()`, nunca reusar esa para este caso.
 *
 * Dos diferencias, ambas a propósito, ambas la razón de ser de esta función
 * separada:
 * 1. `for: "select"` únicamente, nunca `"all"` — el Gateway solo lee. No
 *    hay `withCheck` porque no hay policy de escritura que proteger.
 * 2. Usa `es_gateway_sistema()` (filtra por `usuarios.id` puntual), no
 *    `es_ceom_admin()` (filtra por rol) — así este bypass NUNCA se hereda
 *    automáticamente de cualquier tabla que ya tenga o llegue a tener
 *    `ceomAdminBypassPolicy()`. Cada tabla que el Gateway necesite leer
 *    recibe esta policy explícitamente, en el mismo commit que esa tabla
 *    migre a `comoUsuario()` (checklist 3.e/§11.2, con el ítem nuevo de
 *    §14.3) — nunca "porque total ya tiene la de ceom_admin".
 *
 * `(select es_gateway_sistema())` desde el día uno (§12): hoisted a
 * `InitPlan` sin tener que corregirlo después, mismo patrón ya aplicado en
 * `ceomAdminBypassPolicy()`.
 */
export function gatewaySistemaBypassPolicy(tableName: string) {
  return pgPolicy(`${tableName}_gateway_sistema_bypass`, {
    for: "select",
    to: authenticatedRole,
    using: sql`(select es_gateway_sistema())`,
  });
}

/**
 * Backstop de VIGENCIA para el Gateway (Etapa 4.b.0, docs/security/
 * PLAN-RLS-BACKSTOP.md §16.9.1) — reemplaza a `gatewaySistemaBypassPolicy()`
 * en TODA tabla que la toque, nunca convive con ella (semántica `OR` de
 * policies permisivas múltiples: la vieja, sin restricción de tenant, anula
 * a la nueva). `gatewaySistemaBypassPolicy()` ya no debería usarse en
 * ninguna tabla — no queda como opción "por si acaso": se borra del código
 * en el mismo commit que reemplaza su último call-site (§16.11 decisión 6),
 * así que referenciarla es un error de compilación, no un lint a ignorar.
 *
 * Restringe el bypass de `es_gateway_sistema()` (que por sí solo autoriza
 * CUALQUIER tenant, sin excepción — el gap real que motivó esta etapa,
 * §16.1.2) a "este tenant tiene consentimiento vigente de ALGUNA institución
 * para el módulo veedor de esta tabla". Backstop GRUESO, no fino: no
 * distingue QUÉ institución pregunta (eso es 4.b.1, diferido — necesita un
 * canal nuevo para que la identidad de la institución llegue a la sesión de
 * base de datos, que hoy no existe bajo `comoGatewaySistema()`).
 *
 * `tenantIdExpr`: por defecto la columna `tenant_id` directa de la tabla.
 * Tablas hijas sin `tenant_id` propio (ej. `pagos_compra`, tenant vía
 * `compra_id → compras.tenant_id`) pasan su propio fragmento — mismo
 * criterio que el segundo argumento de `crudPolicy()`.
 *
 * REGLA DURA sobre el costo, no solo documentada en el plan — verificada con
 * `EXPLAIN ANALYZE` real (§16.5): a diferencia de `es_ceom_admin()`/
 * `es_gateway_sistema()` (sin argumentos, constantes por consulta, SÍ
 * hoistean a un `InitPlan` con `(select ...)`), `tenant_tiene_consentimiento_vigente()`
 * toma `tenant_id` como argumento — varía por fila. Envolverla en
 * `(select ...)` NO la hoistea nunca, sin importar cómo se escriba: Postgres
 * la ejecuta como un `SubPlan` CORRELACIONADO, una vez por cada fila
 * candidata. El costo queda acotado SOLO si la query de aplicación trae su
 * propio filtro de tenant explícito (~4ms medido) — sin ese filtro, el costo
 * escala linealmente con el tamaño de la tabla (~450ms a 40k filas
 * sintéticas, el peor caso medido). Toda tabla nueva que reciba esta policy
 * entra en el checklist de §16.10 con este ítem explícito: la query real que
 * el Gateway usa sobre esa tabla, ¿trae su filtro de tenant?
 */
export function gatewayVigenciaBypassPolicy(
  tableName: string,
  moduloVeedor: "financiero" | "operativo" | "inventario_operativo",
  tenantIdExpr: SQL = sql`tenant_id`
) {
  return pgPolicy(`${tableName}_gateway_vigencia_bypass`, {
    for: "select",
    to: authenticatedRole,
    using: sql`(select es_gateway_sistema())
      and (select public.tenant_tiene_consentimiento_vigente((${tenantIdExpr}), ${sql.raw(`'${moduloVeedor}'::modulo_veedor`)}))`,
  });
}
