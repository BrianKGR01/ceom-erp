import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Anti-regresion de H-49, en la linea del manifiesto de acceso por AST: convierte
 * "alguien copio el borde viejo" en test rojo en vez de en un total mal.
 *
 * Vale la pena porque asi nacio el defecto. El commit `2ea20e5` lo dice con todas
 * las letras: "Copie el borde superior de sumarAjustesVentaPeriodo (lte timestamp
 * <= hasta), y ahi esta el problema". Un borde inclusivo sobre una columna que
 * guarda un instante deja afuera todo lo que paso durante el ultimo dia del rango.
 *
 * La regla, entonces:
 *   - columna `timestamptz`  ->  borde superior `lt` (intervalo semiabierto)
 *   - columna `date`         ->  borde superior `lte` (dia calendario, sin huso)
 *
 * El test lee el schema de cada modulo para saber de que tipo es cada columna —
 * no mantiene una lista a mano que se desactualice.
 */

const RAIZ = join(process.cwd(), "src", "modules");

const REPOSITORIOS = [
  ["ventas", "ventas"],
  ["gastos", "gastos"],
  ["proveedores", "proveedores"],
  ["consentimiento", "consentimiento"],
  ["operativo/nichos/nicho-1", "nicho-1"],
] as const;

/** Columnas declaradas como `timestamp(...)` en el schema de un modulo, en camelCase. */
function columnasTimestamp(modulo: string): Set<string> {
  const schema = readFileSync(join(RAIZ, modulo, "schema.ts"), "utf8");
  const encontradas = new Set<string>();
  for (const m of schema.matchAll(/(\w+):\s*timestamp\(/g)) encontradas.add(m[1]);
  return encontradas;
}

/** Columnas declaradas como `date(...)` — el caso contrario, que SI usa `lte`. */
function columnasDate(modulo: string): Set<string> {
  const schema = readFileSync(join(RAIZ, modulo, "schema.ts"), "utf8");
  const encontradas = new Set<string>();
  for (const m of schema.matchAll(/(\w+):\s*date\(/g)) encontradas.add(m[1]);
  return encontradas;
}

describe("H-49 — bordes de periodo", () => {
  it.each(REPOSITORIOS)(
    "%s: ningun `lte` sobre una columna timestamptz",
    (modulo) => {
      const repo = readFileSync(join(RAIZ, modulo, "repository.ts"), "utf8");
      const timestamps = columnasTimestamp(modulo);

      const infracciones: string[] = [];
      for (const m of repo.matchAll(/lte\(\s*(\w+)\.(\w+)\s*,/g)) {
        const [, tabla, columna] = m;
        if (timestamps.has(columna)) infracciones.push(`lte(${tabla}.${columna}, …)`);
      }

      expect(
        infracciones,
        `Borde superior inclusivo sobre una columna que guarda un instante. ` +
          `Sobre un timestamp, \`<= fin\` deja afuera todo lo que paso durante el ` +
          `ultimo dia del rango — es el defecto H-49. Usá \`lt(columna, fin)\` con ` +
          `el \`fin\` que devuelve rangoInstantes() en src/lib/periodo.ts.`
      ).toEqual([]);
    }
  );

  it.each(REPOSITORIOS)(
    "%s: ningun `lt` sobre una columna date (el caso contrario)",
    (modulo) => {
      const repo = readFileSync(join(RAIZ, modulo, "repository.ts"), "utf8");
      const dates = columnasDate(modulo);

      const infracciones: string[] = [];
      for (const m of repo.matchAll(/\blt\(\s*(\w+)\.(\w+)\s*,/g)) {
        const [, tabla, columna] = m;
        if (dates.has(columna)) infracciones.push(`lt(${tabla}.${columna}, …)`);
      }

      expect(
        infracciones,
        `Borde superior EXCLUSIVO sobre una columna \`date\`. Un dia calendario no ` +
          `tiene instante ni huso: se compara contra el mismo string YYYY-MM-DD que ` +
          `manda la UI, y el borde correcto es \`lte\`. Con \`lt\` se pierde el ` +
          `ultimo dia del rango entero.`
      ).toEqual([]);
    }
  );

  it("la capa de acciones no vuelve a convertir el periodo con `new Date()`", () => {
    // El anclaje a medianoche UTC nacia aca, no en el repositorio: `new Date(
    // periodo.hasta)` sobre una fecha de solo-dia da 00:00Z, que en Bolivia son
    // las 20:00 del dia anterior. La traduccion tiene que pasar por
    // rangoInstantes(), que es el unico lugar que conoce la zona del negocio.
    const infracciones: string[] = [];
    for (const [modulo] of REPOSITORIOS) {
      const acciones = readFileSync(join(RAIZ, modulo, "actions.ts"), "utf8");
      if (/new Date\(\s*periodo\.\w+\s*\)/.test(acciones)) infracciones.push(modulo);
    }
    expect(infracciones).toEqual([]);
  });
});
