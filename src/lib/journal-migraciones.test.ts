import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * El journal de drizzle-kit tiene que estar ordenado por `when`, y cada `tag`
 * tiene que corresponder a un `.sql` que exista.
 *
 * **Por qué existe este test — trampa real, encontrada al aplicar la migración
 * de H-15.** `drizzle-kit migrate` no compara qué migraciones estan aplicadas:
 * mira el `created_at` mas alto de `drizzle.__drizzle_migrations` y **saltea
 * toda entrada del journal con un `when` menor o igual**. La migración `0043`
 * (H-49) se selló a mano con un timestamp por delante del reloj real, así que
 * la `0044` recién generada nació con un `when` MENOR que la anterior.
 *
 * Resultado: contra una base que ya tenía la `0043`, `drizzle-kit migrate`
 * imprimió **`migrations applied successfully`** y no aplicó nada. La columna
 * no existía y el único síntoma fue un test de integración fallando con
 * `column "costo_desconocido" ... does not exist` — bastante lejos de la
 * causa. Contra un Postgres vacío sí se aplicaba, así que la verificación
 * contra contenedor limpio (dev-practices §7.2) **no lo detecta**: es el caso
 * exactamente inverso al incidente que motivó esa regla.
 *
 * Una migración que se saltea en silencio es la peor forma de fallar: el
 * comando dice que salió bien.
 */

const DIR = join(process.cwd(), "drizzle", "migrations");

interface Entrada {
  idx: number;
  when: number;
  tag: string;
}

const journal: { entries: Entrada[] } = JSON.parse(
  readFileSync(join(DIR, "meta", "_journal.json"), "utf8")
);

describe("journal de migraciones", () => {
  it("los `when` son estrictamente crecientes — si no, drizzle-kit saltea migraciones sin decir nada", () => {
    const desordenadas = journal.entries
      .slice(1)
      .filter((entrada, i) => entrada.when <= journal.entries[i].when)
      .map((entrada, i) => `${entrada.tag} (when=${entrada.when}) <= ${journal.entries[i].tag}`);

    expect(
      desordenadas,
      `Hay migraciones con un \`when\` menor o igual al de la anterior. ` +
        `\`drizzle-kit migrate\` las va a SALTEAR contra cualquier base que ya tenga ` +
        `la anterior, imprimiendo "migrations applied successfully" igual. ` +
        `Arreglo: subir el \`when\` de la entrada nueva en ` +
        `drizzle/migrations/meta/_journal.json por encima de la anterior (el .sql no se toca).`
    ).toEqual([]);
  });

  it("cada entrada del journal tiene su archivo .sql", () => {
    const archivos = new Set(readdirSync(DIR).filter((f) => f.endsWith(".sql")));
    const faltantes = journal.entries
      .map((e) => `${e.tag}.sql`)
      .filter((archivo) => !archivos.has(archivo));

    expect(faltantes, "Entrada de journal sin su .sql — se renombró el archivo y no el tag.").toEqual(
      []
    );
  });

  it("cada .sql tiene su entrada en el journal", () => {
    const tags = new Set(journal.entries.map((e) => e.tag));
    const huerfanos = readdirSync(DIR)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => f.replace(/\.sql$/, ""))
      .filter((tag) => !tags.has(tag));

    expect(
      huerfanos,
      "Archivo .sql que el journal no lista — no lo va a aplicar nadie."
    ).toEqual([]);
  });
});
