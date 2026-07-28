import postgres from "postgres";

/**
 * Candado de suite: **una sola corrida a la vez contra la base compartida.**
 *
 * Por qué existe. Los tests de integración de este proyecto corren contra el
 * Supabase de desarrollo real (decisión documentada en `docs/dev-practices/`
 * §6), y nada impedía que dos corridas se pisaran. Pasó de verdad el
 * 2026-07-27: dos `pnpm test` solapados produjeron
 * `Test Files 45 passed (45) / Tests 363 passed (363) / Errors 1 error` y
 * `1 failed | 44 passed (45) / 362 passed | 4 skipped (366)` — dos resultados
 * distintos, ninguno real, y **los dos plausibles**. Casi se reportan como
 * regresión del código. La corrida aislada daba 46/370 limpio.
 *
 * Ese es el problema exacto: no falla, da un número creíble y equivocado. En
 * CI, con un push mientras otra corrida está viva, genera fantasmas que nadie
 * puede reproducir.
 *
 * Cómo. Un advisory lock de sesión de Postgres, tomado una vez por corrida
 * (`globalSetup`, no `setupFiles` — este corre una sola vez, aquel una vez
 * por archivo). Si otra corrida lo tiene, `pg_try_advisory_lock` devuelve
 * `false` al instante y la suite muere antes del primer test, con un mensaje
 * que dice qué pasó.
 *
 * El lock es **de sesión**: si una corrida se cae, se cuelga o la matan con
 * Ctrl-C, Postgres lo libera solo al cerrarse la conexión. No hay candados
 * huérfanos que limpiar a mano — que era el otro modo de falla posible, y
 * sería peor que el problema original.
 */

// Constante arbitraria y estable. Solo tiene que no chocar con otro advisory
// lock del mismo proyecto; hoy no hay ninguno más.
const CLAVE_CANDADO = 728_030_301;

export default async function setup() {
  // El env se carga en `vitest.setup.ts`, que corre DESPUÉS de este archivo
  // (una vez por archivo de test, contra una vez por corrida). Sin esta línea
  // `DATABASE_URL` está vacía acá y el candado se saltea siempre en silencio
  // — bug real del primer intento: la suite doble no fallaba y parecía que el
  // candado no servía. Mismo `try/catch` que allá: en CI no hay `.env.local`.
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // sin .env.local: seguimos, y el chequeo de abajo se encarga.
  }

  const url = process.env.DATABASE_URL;
  // Sin base no hay nada que proteger: los tests de integración se saltean
  // solos (`describe.skipIf(!hasCredenciales)`) y los unitarios no la tocan.
  if (!url) return;

  const sql = postgres(url, { max: 1, onnotice: () => {} });

  let tomado = false;
  try {
    const [fila] = await sql<{ tomado: boolean }[]>`
      select pg_try_advisory_lock(${CLAVE_CANDADO}) as tomado
    `;
    tomado = fila.tomado;
  } catch (error) {
    // Un fallo de conexión no es asunto de este candado — que lo reporte el
    // test que de verdad necesite la base, con su propio mensaje.
    await sql.end();
    console.warn(
      `[suite] No se pudo tomar el candado de base (${(error as Error).message}). ` +
        "Se sigue igual: si la base está caída, los tests de integración van a decirlo mejor."
    );
    return;
  }

  if (!tomado) {
    await sql.end();
    throw new Error(
      "\n\n" +
        "  ╭─ YA HAY OTRA CORRIDA DE LA SUITE CONTRA ESTA BASE ─────────────────╮\n" +
        "  │                                                                    │\n" +
        "  │  Los tests de integración corren contra el Supabase de desarrollo   │\n" +
        "  │  compartido. Dos corridas a la vez se pisan los datos y producen    │\n" +
        "  │  conteos distintos en cada una — plausibles y falsos.               │\n" +
        "  │                                                                    │\n" +
        "  │  Esperá a que termine la otra corrida (o matala) y volvé a probar.  │\n" +
        "  │  Si estás seguro de que no hay ninguna, la conexión anterior quedó  │\n" +
        "  │  viva: cerrá ese proceso — el candado es de sesión y se libera solo.│\n" +
        "  ╰────────────────────────────────────────────────────────────────────╯\n"
    );
  }

  return async () => {
    await sql`select pg_advisory_unlock(${CLAVE_CANDADO})`;
    await sql.end();
  };
}
