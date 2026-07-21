import { sql } from "drizzle-orm";
import { db as dbInterno } from "./client";

// Backstop de RLS (docs/security/PLAN-RLS-BACKSTOP.md, Etapa 0). Este es el
// UNICO archivo del repo que debe importar `db`/`client` de "./client" —
// todo repository.ts de un modulo ya migrado recibe un `Ejecutor` (`tx`) por
// parametro en vez de importar `db` directamente. src/db/contexto.test.ts
// hace cumplir esto por AST para los modulos ya migrados (ver
// MODULOS_MIGRADOS ahi) y crece con cada nueva etapa — nunca migres un
// modulo sin agregarlo a esa lista, o el guard no lo va a cubrir.
//
// Diseño (§2.1 del plan): sin rol nuevo. `authenticated`/`anon` de Supabase
// no son loginable (rolcanlogin = false, verificado) — son roles a los que
// el rol de conexion (`postgres`, dueño de las tablas) puede saltar con
// `SET LOCAL ROLE` dentro de una transaccion. Verificado empiricamente
// contra la base de desarrollo (riertvgnjaujstwyqoom) el 2026-07-21:
// SET LOCAL ROLE + set_config('request.jwt.claims', …, true) +
// current_tenant_id() resuelven correctamente, revierten solos al terminar
// la transaccion (COMMIT o ROLLBACK, seguro bajo el pooler de transaccion),
// y sobreviven a un savepoint anidado (tx.transaction() dentro del `fn`)
// incluso si ese savepoint hace rollback parcial.

export type Tx = Parameters<Parameters<typeof dbInterno.transaction>[0]>[0];
/** Repositories reciben esto, no `db` ni `Tx` por separado: les permite
 * funcionar tanto dentro de un contexto ya abierto (`tx`) como, en tests que
 * no ejercitan RLS, contra `db` crudo (ver src/db/contexto.test.ts, "asserts
 * de estado" en *.test.ts que leen con `db` a proposito para no depender de
 * qué usuario quedó de contexto). */
export type Ejecutor = typeof dbInterno | Tx;

function claimsJwt(authUserId: string): string {
  return JSON.stringify({ sub: authUserId, role: "authenticated" });
}

/**
 * Fija el contexto de RLS (SET LOCAL ROLE + JWT claims) y, en el mismo
 * round-trip, exige que `current_tenant_id()` resuelva — falla ruidosa, no
 * silenciosa (pedido explícito): si no resuelve, un reporte financiero en
 * cero es indistinguible de uno legítimamente vacío. Un usuario eliminado
 * (soft delete — current_tenant_id() filtra `eliminado_en is null`) o un id
 * que no existe deben romper acá, no devolver cero filas mas abajo.
 *
 * Las 3 sentencias van con Promise.all (no awaits secuenciales): postgres-js
 * pipelinea las queries que se disparan sobre la misma conexión sin esperar
 * la respuesta de la anterior, así que esto paga la latencia de red UNA vez
 * en vez de tres — medido empíricamente contra la base de desarrollo: baja
 * el costo de fijar contexto de ~750ms a ~345ms (pooler transaccion,
 * sa-east-1, ver docs/security/PLAN-RLS-BACKSTOP.md §8). No se puede
 * colapsar a una sola sentencia de texto porque Postgres rechaza "multiple
 * commands" dentro de un mismo mensaje Parse cuando hay un parámetro
 * bindeado (protocolo extendido) — verificado, no es una limitación de
 * postgres-js.
 */
async function fijarContextoYExigirTenant(tx: Tx, authUserId: string): Promise<string> {
  const [, , filas] = await Promise.all([
    tx.execute(sql`set local role authenticated`),
    tx.execute(sql`select set_config('request.jwt.claims', ${claimsJwt(authUserId)}, true)`),
    tx.execute(sql`select public.current_tenant_id() as tenant_id`),
  ]);
  const tenantId = (filas[0] as { tenant_id: string | null } | undefined)?.tenant_id;
  if (!tenantId) {
    throw new Error(
      "current_tenant_id() no resolvió ningún tenant tras fijar el contexto de RLS. El usuario no " +
        "existe, está eliminado, o el contexto no se aplicó — no se continúa con la operación."
    );
  }
  return tenantId;
}

/** Misma técnica que fijarContextoYExigirTenant, para instituciones (no son
 * un tenant, no hay current_tenant_id() que resolver para ellas). */
async function fijarContextoYExigirAuthUid(tx: Tx, authUserId: string): Promise<string> {
  const [, , filas] = await Promise.all([
    tx.execute(sql`set local role authenticated`),
    tx.execute(sql`select set_config('request.jwt.claims', ${claimsJwt(authUserId)}, true)`),
    tx.execute(sql`select auth.uid() as uid`),
  ]);
  const uid = (filas[0] as { uid: string | null } | undefined)?.uid;
  if (!uid) {
    throw new Error("auth.uid() no resolvió tras fijar el contexto de RLS — no se continúa.");
  }
  return uid;
}

/**
 * Caso 1 (§2.3): tenant propio. `usuarioId` debe ser el id ya resuelto por
 * `obtenerUsuarioActual()` en el mismo Server Action que llama a esta
 * función — nunca un campo `.id` de un objeto `UsuarioConRol` recibido por
 * parámetro de otra fuente (la misma razón detrás del hallazgo crítico de
 * §8.3.1 de AUDITORIA-AUTORIZACION.md: no confiar en identidad ya resuelta
 * que llega por parámetro).
 */
export async function comoUsuario<T>(usuarioId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return dbInterno.transaction(async (tx) => {
    await fijarContextoYExigirTenant(tx, usuarioId);
    return fn(tx);
  });
}

/**
 * Caso 2 (§2.3): ceom_admin. Hoy es idéntica a `comoUsuario` en
 * comportamiento (current_tenant_id() resuelve al tenant reservado "CEOM
 * Ops") — deliberadamente NO es `export const comoCeomAdmin = comoUsuario`:
 * ser un símbolo propio permite que el test de allowlist de
 * contexto.test.ts distinga sus call-sites de los de comoUsuario, y deja
 * lugar para que la Etapa 3 le agregue una verificación adicional (ej.
 * confirmar es_ceom_admin() una vez que esa función/policy exista) sin
 * tocar comoUsuario.
 */
export async function comoCeomAdmin<T>(usuarioId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return dbInterno.transaction(async (tx) => {
    await fijarContextoYExigirTenant(tx, usuarioId);
    return fn(tx);
  });
}

/**
 * Caso 3 (§2.3): portal. La institución también autentica vía Supabase Auth
 * (instituciones.auth_user_id) pero no es un tenant — no hay
 * current_tenant_id() que resolver para ella, así que la falla ruidosa acá
 * verifica auth.uid() en cambio.
 */
export async function comoInstitucion<T>(
  institucionAuthUserId: string,
  fn: (tx: Tx) => Promise<T>
): Promise<T> {
  return dbInterno.transaction(async (tx) => {
    await fijarContextoYExigirAuthUid(tx, institucionAuthUserId);
    return fn(tx);
  });
}

/**
 * Caso 4 (§2.3): sistema (onboarding, jobs, seeds). Sin `SET ROLE` — se
 * queda en el rol de conexión (bypass total, igual que hoy). Call-sites
 * restringidos por allowlist en contexto.test.ts: este escape hatch no debe
 * poder usarse desde cualquier lado solo porque compila.
 */
export async function comoSistema<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return dbInterno.transaction(async (tx) => fn(tx));
}
