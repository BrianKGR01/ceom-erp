/**
 * Helper de limpieza compartido para tests de integración (docs/security/
 * PLAN-RLS-BACKSTOP.md §17.2).
 *
 * El problema real que motiva esto: el `afterAll` de cada módulo tiene
 * varios "grupos" de deletes sin dependencia de FK entre sí (las filas de
 * Ventas de un tenant no dependen de las de Gastos, ni las de Gastos de las
 * de Compras) que corrían secuenciales, uno atrás del otro. Si un grupo
 * fallaba (una FK inesperada, una columna que cambió de forma), los grupos
 * siguientes nunca llegaban a correr — la fila huérfana que casi rompe la
 * migración `0037_aprobaciones_tenant_vigente_unica` (una semana vieja,
 * fixture de una corrida cuyo `afterAll` se cortó a mitad de camino) nació
 * de exactamente este patrón.
 *
 * `Promise.allSettled` corre TODOS los pasos igual, sin importar si alguno
 * falla — los que sí pueden completarse, se completan. El fallo no se
 * esconde: se junta y se relanza al final (`AggregateError`), para que
 * Vitest lo muestre como lo que es (un `afterAll` roto que puede haber
 * dejado residuo), no como una corrida silenciosamente verde.
 */
export async function limpiarEnParalelo(pasos: Array<() => Promise<unknown>>): Promise<void> {
  const resultados = await Promise.allSettled(pasos.map((paso) => paso()));
  const fallos = resultados.filter(
    (r): r is PromiseRejectedResult => r.status === "rejected"
  );
  if (fallos.length > 0) {
    throw new AggregateError(
      fallos.map((f) => f.reason),
      `limpiarEnParalelo: ${fallos.length}/${pasos.length} paso(s) de limpieza fallaron -- ` +
        "los demás sí corrieron (Promise.allSettled), pero esto puede haber dejado un " +
        "residuo en la base de desarrollo compartida. Revisar los errores agregados y, si " +
        "hace falta, limpiar a mano por el patrón de nombre del tenant/institución de este archivo."
    );
  }
}

/**
 * Garantiza que el borrado de los usuarios de Supabase Auth corra SIEMPRE,
 * incluso si la limpieza de las tablas de negocio falló a mitad de camino.
 *
 * Esto no es defensivo por las dudas: es el canal de residuo que más filas
 * dejó. `admin.auth.admin.deleteUser()` era la última línea de cada
 * `afterAll` — cualquier excepción anterior (una FK inesperada, una tabla que
 * cambió de forma) lo salteaba, y el usuario de Auth quedaba huérfano sin que
 * ninguna limpieza posterior pudiera encontrarlo: `auth.users` no tiene
 * `tenant_id`, y una vez borrada la fila de `public.usuarios` no queda ningún
 * join por el cual llegar hasta él. Al momento de escribir esto había 51
 * usuarios `@ceom-erp.test` huérfanos acumulados de corridas cortadas de
 * sesiones anteriores, contra 2 legítimos.
 *
 * **El orden importa y no es negociable: primero la base, después Auth.**
 * `public.usuarios.id` referencia `auth.users.id`
 * (`usuarios_id_users_id_fk`, ON DELETE NO ACTION), igual que
 * `public.instituciones.auth_user_id` — borrar Auth antes revienta con 23503.
 *
 * Por eso mismo la garantía es parcial, y conviene decirlo: si la limpieza de
 * base falla ANTES de llegar a borrar `usuarios`, el borrado de Auth también
 * va a fallar por esa FK. Lo que sí cambia es que ese caso ahora se reporta
 * como `AggregateError` con las dos causas en vez de saltearse en silencio, y
 * que cualquier fallo POSTERIOR a `usuarios` (que es donde se cortaban las
 * corridas reales) ya no deja el usuario de Auth colgado.
 *
 * El fallo de la parte de base NO se esconde: se relanza después de intentar
 * la limpieza de Auth, y si fallan las dos partes se agregan.
 */
export async function limpiarConAuthGarantizada(
  limpiezaDb: () => Promise<unknown>,
  limpiezaAuth: () => Promise<unknown>
): Promise<void> {
  let errorDb: unknown;
  try {
    await limpiezaDb();
  } catch (error) {
    errorDb = error;
  }

  try {
    await limpiezaAuth();
  } catch (errorAuth) {
    if (errorDb !== undefined) {
      throw new AggregateError(
        [errorDb, errorAuth],
        "limpiarConAuthGarantizada: fallaron la limpieza de base Y la de Auth -- " +
          "hay residuo en las dos puntas, revisar a mano por el patrón de nombre de este archivo."
      );
    }
    throw errorAuth;
  }

  if (errorDb !== undefined) throw errorDb;
}
