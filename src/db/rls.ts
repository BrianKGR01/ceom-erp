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
