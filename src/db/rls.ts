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
 * PLAN-RLS-BACKSTOP.md §10.3/§10.8) — policy permisiva adicional que se
 * OR-ea sola con la de crudPolicy() (semántica nativa de Postgres para
 * múltiples policies permisivas del mismo comando). Reusar esta función,
 * no reescribir el `using`/`withCheck` a mano, para que toda tabla con
 * bypass use exactamente `es_ceom_admin()` — no una variante local.
 *
 * Invariante de diseño que hay que preservar en cada módulo que la use
 * (§10.3, "costo por fila"): `es_ceom_admin()` NO se hoistea a un InitPlan
 * como `current_tenant_id()` (verificado con EXPLAIN ANALYZE real, no
 * asumido) — se evalúa por fila candidata, con costo acotado SOLO porque
 * la query que la aplicación arma siempre trae además un filtro de
 * `tenant_id` explícito (evaluado primero, más barato, descarta la mayoría
 * de las filas antes de llegar al bypass). Nunca usar esta policy como
 * excusa para quitar el filtro de tenant explícito de una query — sin ese
 * filtro, el costo deja de estar acotado por tenant y pasa a ser por tabla
 * completa.
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
    using: sql`es_ceom_admin()`,
    withCheck: sql`es_ceom_admin()`,
  });
}
