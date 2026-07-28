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

  /**
   * Agregado en la Etapa 3 (tanda 3.3) después de que la trampa volviera a
   * morder con la `0047` — **pese a que el test de arriba ya existía**.
   *
   * Por qué no alcanzaba: el test de arriba detecta el síntoma
   * (`when` no creciente) **después** de que la migración nueva ya nació rota,
   * y solo si alguien corre la suite antes de aplicarla. La causa está un paso
   * antes: la `0043` es una migración **escrita a mano** cuya entrada de
   * journal se agregó a mano con `when = 1785203400000`, que en ese momento
   * estaba **~16 horas por delante del reloj real**. Eso no rompe la monotonía
   * —`0043 > 0042`, el test pasaba— pero **condena a toda migración generada
   * después**: `drizzle-kit generate` sella con `Date.now()`, que es menor, así
   * que la entrada nace violando el orden.
   *
   * Una entrada con `when` en el futuro es una trampa **armada**: no falla
   * hoy, falla en manos del próximo. Por eso se chequea acá y no en una
   * convención.
   */
  it("ningún `when` está en el futuro — un timestamp adelantado condena a la PRÓXIMA migración", () => {
    const ahora = Date.now();
    const futuras = journal.entries
      .filter((e) => e.when > ahora)
      .map((e) => `${e.tag} (when=${e.when}, ${new Date(e.when).toISOString()})`);

    expect(
      futuras,
      `Hay entradas de journal con un \`when\` POSTERIOR al reloj real. No rompe nada hoy, pero ` +
        `la próxima migración generada va a nacer con un \`when\` menor y \`drizzle-kit migrate\` ` +
        `la va a SALTEAR imprimiendo "migrations applied successfully". ` +
        `Arreglo: bajar ese \`when\` a un instante ya pasado, manteniéndolo mayor que el de la ` +
        `entrada anterior (el .sql no se toca).`
    ).toEqual([]);
  });

  /**
   * El pedido literal de la tanda 3.3: "que el orden que drizzle va a usar no
   * pueda divergir del orden de los archivos". Es distinto de la monotonía:
   * los `when` podrían ser crecientes y aun así estar asignados a los tags en
   * un orden que no es el de los prefijos numéricos (un renombre, un
   * cherry-pick, un merge que reordena). Drizzle aplica por `when`; la persona
   * lee por prefijo. Si difieren, lo que se aplica no es lo que se leyó.
   */
  it("el orden por `when` coincide con el orden de los prefijos numéricos de los archivos", () => {
    const porWhen = [...journal.entries]
      .sort((a, b) => a.when - b.when)
      .map((e) => e.tag);
    const porPrefijo = [...journal.entries]
      .sort((a, b) => Number(a.tag.slice(0, 4)) - Number(b.tag.slice(0, 4)))
      .map((e) => e.tag);

    const primeraDivergencia = porWhen.findIndex((t, i) => t !== porPrefijo[i]);
    expect(
      primeraDivergencia,
      primeraDivergencia === -1
        ? ""
        : `El orden de aplicación de drizzle (por \`when\`) difiere del orden de los archivos ` +
          `(por prefijo) a partir de la posición ${primeraDivergencia}: drizzle aplicaría ` +
          `"${porWhen[primeraDivergencia]}" donde el prefijo dice "${porPrefijo[primeraDivergencia]}". ` +
          `Lo que se aplica no es lo que se lee.`
    ).toBe(-1);
  });

  it("los `idx` son consecutivos desde 0 — un hueco significa una entrada perdida en un merge", () => {
    const idx = journal.entries.map((e) => e.idx);
    expect(idx).toEqual(idx.map((_, i) => i));
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
