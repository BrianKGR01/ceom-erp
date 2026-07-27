import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Anti-regresion de la causa raiz comun de H-24, H-27 y H-10, en la linea del
 * manifiesto de acceso y de bordes-de-periodo.test.ts: convierte "se
 * construyo la funcion y se olvido el cable" en test rojo en vez de en un
 * numero mal.
 *
 * Las tres veces fue el mismo defecto, no tres defectos parecidos: una
 * funcion `generarGasto*` completa, probada y correcta, que **no llamaba
 * nadie fuera de los tests**. El egreso existia en el codigo y no llegaba al
 * estado de resultados, siempre en la direccion optimista — el negocio se
 * veia mas rentable de lo real, en silencio.
 *
 * La regla, entonces: **toda funcion exportada de gastos/actions.ts que
 * genere un Gasto automatico tiene que tener al menos un llamador en codigo
 * de produccion.** Los tests no cuentan: un test verde sobre una funcion que
 * el producto nunca invoca es exactamente lo que dejo pasar H-24 y H-27.
 *
 * Si esta lista crece (un `generarGastoX` nuevo), el test lo exige conectado
 * en el mismo cambio que lo crea. Si una funcion se retira de verdad, hay que
 * borrarla, no dejarla huerfana.
 */

const RAIZ = join(process.cwd(), "src");
const MODULO_GASTOS = join(RAIZ, "modules", "gastos", "actions.ts");

/** Archivos de produccion: todo `.ts`/`.tsx` bajo src/ que no sea un test ni
 * el propio archivo que declara las funciones. */
function archivosDeProduccion(dir: string, acc: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    if (entrada === "node_modules" || entrada === ".next") continue;
    const abs = join(dir, entrada);
    if (statSync(abs).isDirectory()) {
      archivosDeProduccion(abs, acc);
    } else if (/\.tsx?$/.test(entrada) && !/\.test\.tsx?$/.test(entrada)) {
      acc.push(abs);
    }
  }
  return acc;
}

/** Nombres exportados de gastos/actions.ts que empiezan con `generarGasto`. */
function funcionesDeAutoGeneracion(): string[] {
  const fuente = readFileSync(MODULO_GASTOS, "utf8");
  const nombres = new Set<string>();
  for (const m of fuente.matchAll(/export\s+async\s+function\s+(generarGasto\w*)/g)) {
    nombres.add(m[1]);
  }
  return [...nombres].sort();
}

const FUNCIONES = funcionesDeAutoGeneracion();
const PRODUCCION = archivosDeProduccion(RAIZ).filter((f) => f !== MODULO_GASTOS);

describe("H-24 / H-27 — la auto-generacion de gastos esta conectada", () => {
  it("gastos/actions.ts declara al menos una funcion generarGasto* (si no, este guard quedo sin objeto)", () => {
    expect(FUNCIONES.length).toBeGreaterThan(0);
  });

  it.each(FUNCIONES)("%s tiene un llamador en codigo de produccion", (nombre) => {
    // Llamada real, no solo la mencion en un import o en un comentario.
    const llamada = new RegExp(`\\b${nombre}\\s*\\(`);
    const llamadores = PRODUCCION.filter((archivo) =>
      llamada.test(readFileSync(archivo, "utf8"))
    ).map((archivo) => relative(process.cwd(), archivo).split(sep).join("/"));

    expect(
      llamadores,
      `\`${nombre}\` no la llama nadie fuera de los tests. Esa es exactamente la ` +
        `forma de H-24 (la comision de venta) y H-27 (la cuota de pasivo): la funcion ` +
        `existe, funciona y tiene test verde, pero el egreso nunca llega al estado de ` +
        `resultados ni al flujo de caja — el negocio se ve mas rentable de lo real, en ` +
        `silencio. Conectala desde el modulo dueño del evento que la origina, o borrala.`
    ).not.toEqual([]);
  });
});
