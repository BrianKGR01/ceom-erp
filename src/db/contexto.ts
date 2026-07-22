import { db as dbInterno } from "./client";
import { GATEWAY_SISTEMA_USUARIO_ID } from "@/modules/identidad/constants";

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

// UUID canónico (8-4-4-4-12, hex) — el único formato en que Postgres
// devuelve una columna `uuid` como texto. Restringir a este charset (solo
// dígitos hex y guiones) hace que interpolar el valor validado en SQL crudo
// sea seguro por construcción, no por "escapado": no hay comilla, backslash
// ni punto y coma que ese charset pueda contener.
const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function exigirUuid(valor: string, nombreParaError: string): string {
  if (!UUID_REGEX.test(valor)) {
    throw new Error(
      `${nombreParaError} no tiene forma de UUID — se rechaza antes de interpolarlo en SQL crudo, ` +
        `nunca se intenta "escapar" un valor no confiable.`
    );
  }
  return valor;
}

/**
 * Cliente crudo de postgres-js reservado para esta transacción — el mismo
 * objeto que `PostgresJsSession` usa internamente para `tx.select()`/
 * `tx.insert()` (confirmado leyendo drizzle-orm/postgres-js/session.cjs:
 * `PostgresJsTransaction.session.client`). Se usa para mandar las 3
 * sentencias de fijar contexto como UNA sola consulta "simple" (sin
 * parámetros bindeados, multi-sentencia) en vez de 3 round-trips — bajó el
 * costo medido de fijar contexto de ~345ms (pipelineado con Promise.all) a
 * ~125ms, prácticamente el RTT de red puro (ver docs/security/
 * PLAN-RLS-BACKSTOP.md §8). No se puede lograr esto con el `sql` tag de
 * drizzle: Postgres rechaza "multiple commands" en un mismo mensaje Parse
 * en cuanto hay un parámetro bindeado (protocolo extendido) — verificado,
 * no es una limitación de postgres-js. Con params=[] (sin bind), postgres-js
 * cambia solo a protocolo simple, que sí acepta múltiples sentencias.
 *
 * Riesgo aceptado y documentado: esto usa un campo interno de drizzle-orm,
 * no su tipado público — podría romper en una actualización de versión. El
 * chequeo de abajo cubre el caso obvio (la forma desaparece: tira un error
 * explícito, no falla en silencio). Pero hay un caso más peligroso que ESE
 * chequeo no puede cubrir: que `session.client` siga existiendo con forma
 * idéntica (`.unsafe` sigue siendo función) pero deje de ser, por dentro,
 * la conexión reservada de la transacción — ahí el `SET LOCAL ROLE`/
 * `set_config` dejarían de aplicar al contexto real de la query sin que
 * nada tire error: las consultas correrían sin filtro de tenant, en
 * silencio. Por eso `drizzle-orm` está fijado a versión exacta en
 * package.json (sin `^`) — cualquier actualización, aunque sea de patch,
 * tiene que ser deliberada y re-verificada acá, nunca automática. La otra
 * mitigación es tenant-aislamiento.test.ts corriendo en CI: si este
 * mecanismo alguna vez deja de filtrar de verdad, ese test lo detecta.
 */
function clienteCrudoDeLaTransaccion(tx: Tx): { unsafe(query: string): Promise<unknown[][]> } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawClient = (tx as any)?.session?.client;
  if (typeof rawClient?.unsafe !== "function") {
    throw new Error(
      "No se pudo acceder a session.client en el objeto de transacción de drizzle-orm — probablemente " +
        "cambió un detalle interno en una actualización de drizzle-orm/postgres-js. Revisar " +
        "src/db/contexto.ts (clienteCrudoDeLaTransaccion) y ajustar el acceso interno."
    );
  }
  return rawClient;
}

/**
 * Falla ruidosa específica de "el contexto de RLS no resolvió" — nunca un
 * `Error` genérico, para que un caller que necesite distinguir esto de
 * cualquier otro fallo (ej. un bug real dentro de la función envuelta) pueda
 * hacer `instanceof` en vez de andar comparando el texto del mensaje.
 *
 * Único uso legítimo hoy (docs/security/PLAN-RLS-BACKSTOP.md §9.6/§10.4):
 * `proveedores/actions.ts` → `consultarPagosCompraEnPeriodo()`, la función
 * alcanzada por `solicitanteGateway()` (id sintético sin fila real en
 * `usuarios`/`auth.users`, que por diseño nunca puede resolver contexto).
 * No usar este tipo para "tragarse" errores en ningún otro call-site sin
 * la misma revisión — sigue siendo una falla ruidosa por defecto.
 */
export class ContextoRlsNoResueltoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContextoRlsNoResueltoError";
  }
}

/**
 * Fija el contexto de RLS (SET LOCAL ROLE + JWT claims) y, en el mismo
 * round-trip, exige que `current_tenant_id()` resuelva — falla ruidosa, no
 * silenciosa (pedido explícito): si no resuelve, un reporte financiero en
 * cero es indistinguible de uno legítimamente vacío. Un usuario eliminado
 * (soft delete — current_tenant_id() filtra `eliminado_en is null`) o un id
 * que no existe deben romper acá, no devolver cero filas mas abajo.
 */
async function fijarContextoYExigirTenant(tx: Tx, authUserId: string): Promise<string> {
  const id = exigirUuid(authUserId, "authUserId");
  const resultado = await clienteCrudoDeLaTransaccion(tx).unsafe(`
    set local role authenticated;
    select set_config('request.jwt.claims', '{"sub":"${id}","role":"authenticated"}', true);
    select public.current_tenant_id() as tenant_id;
  `);
  const tenantId = (resultado[2]?.[0] as { tenant_id: string | null } | undefined)?.tenant_id;
  if (!tenantId) {
    throw new ContextoRlsNoResueltoError(
      "current_tenant_id() no resolvió ningún tenant tras fijar el contexto de RLS. El usuario no " +
        "existe, está eliminado, o el contexto no se aplicó — no se continúa con la operación."
    );
  }
  return tenantId;
}

/** Misma técnica que fijarContextoYExigirTenant, para instituciones (no son
 * un tenant, no hay current_tenant_id() que resolver para ellas). */
async function fijarContextoYExigirAuthUid(tx: Tx, authUserId: string): Promise<string> {
  const id = exigirUuid(authUserId, "authUserId");
  const resultado = await clienteCrudoDeLaTransaccion(tx).unsafe(`
    set local role authenticated;
    select set_config('request.jwt.claims', '{"sub":"${id}","role":"authenticated"}', true);
    select auth.uid() as uid;
  `);
  const uid = (resultado[2]?.[0] as { uid: string | null } | undefined)?.uid;
  if (!uid) {
    throw new ContextoRlsNoResueltoError("auth.uid() no resolvió tras fijar el contexto de RLS — no se continúa.");
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
 * Caso 2b (Etapa 4.a, docs/security/PLAN-RLS-BACKSTOP.md §13/§15): Gateway
 * de Consentimiento. Mecánicamente idéntica a `comoCeomAdmin`/`comoUsuario`
 * (la fila sembrada en `0034_gateway_sistema_seed.sql` pertenece a un tenant
 * real — CEOM Ops — así que `current_tenant_id()` resuelve igual, Caso 2
 * encaja sin cambios de mecanismo). Símbolo propio, no alias, por el mismo
 * motivo que `comoCeomAdmin`: que el test de allowlist distinga sus
 * call-sites.
 *
 * La diferencia real NO está acá — está en qué policy de bypass ve del otro
 * lado (`es_gateway_sistema()`, propia y de solo lectura, nunca
 * `es_ceom_admin()`) y en `tienePermiso()`, que restringe este id puntual a
 * `accion === "ver"`. Este wrapper por sí solo no impone esa restricción —
 * confiar en `tienePermiso()`/las policies, no en este nombre, para la
 * defensa real.
 */
export async function comoGatewaySistema<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return dbInterno.transaction(async (tx) => {
    await fijarContextoYExigirTenant(tx, GATEWAY_SISTEMA_USUARIO_ID);
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
