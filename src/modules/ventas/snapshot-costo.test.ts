import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Toda linea de venta que congela un costo tiene que decir si ese costo era
 * conocido (H-15).
 *
 * **Por que hace falta un test y no alcanza el compilador.**
 * `detalles_venta.costo_desconocido` tiene `.default(false)` en el schema, asi
 * que en `$inferInsert` de Drizzle es un campo **opcional**. Un camino de
 * escritura que se olvide de setearlo compila perfecto, pasa el typecheck, y
 * escribe `false` — o sea, afirma que el costo se conocia cuando nadie lo
 * dijo. Es exactamente el modo de falla de H-15: un dato plausible y
 * equivocado, en la direccion optimista.
 *
 * Paso de verdad durante esta misma tarea: `registrarVenta` quedo marcado y
 * `importarVentaHistorica` **no**, sin una sola queja del compilador. Todo el
 * historial importado habria quedado como "costo medido".
 *
 * La regla: en la capa de acciones de Ventas, todo objeto que setee
 * `costoUnitarioSnapshot` tiene que setear tambien `costoDesconocido`.
 */

const ACTIONS = readFileSync(
  join(process.cwd(), "src", "modules", "ventas", "actions.ts"),
  "utf8"
);

/** Los objetos literales que arman una linea de venta, identificados por
 * setear `costoUnitarioSnapshot:`. Devuelve el bloque de texto de cada uno
 * (desde la llave que lo abre hasta la que lo cierra) para poder mirar si
 * tambien setea el flag.
 *
 * Se saltean las declaraciones de tipo (`interface`/`type`), donde la
 * propiedad termina en `;` en vez de `,`: ahi el flag no corresponde porque
 * es un tipo de ENTRADA — el costo desconocido se deriva, no se recibe. */
function bloquesQueCongelanCosto(): string[] {
  const bloques: string[] = [];
  for (const m of ACTIONS.matchAll(/costoUnitarioSnapshot\??\s*:/g)) {
    const finDeLinea = ACTIONS.indexOf("\n", m.index!);
    const restoDeLinea = ACTIONS.slice(m.index!, finDeLinea === -1 ? undefined : finDeLinea);
    if (restoDeLinea.trimEnd().endsWith(";")) continue;
    // Retrocede hasta la `{` que abre el objeto literal, contando llaves.
    let profundidad = 0;
    let inicio = m.index!;
    while (inicio > 0) {
      const c = ACTIONS[inicio];
      if (c === "}") profundidad++;
      else if (c === "{") {
        if (profundidad === 0) break;
        profundidad--;
      }
      inicio--;
    }
    // Y avanza hasta la `}` que lo cierra.
    let fin = m.index!;
    profundidad = 0;
    while (fin < ACTIONS.length) {
      const c = ACTIONS[fin];
      if (c === "{") profundidad++;
      else if (c === "}") {
        if (profundidad === 0) break;
        profundidad--;
      }
      fin++;
    }
    bloques.push(ACTIONS.slice(inicio, fin + 1));
  }
  return bloques;
}

describe("H-15 — el snapshot de costo dice si el costo era conocido", () => {
  it("hay al menos un camino de escritura que congela costo (si no, este guard quedo sin objeto)", () => {
    expect(bloquesQueCongelanCosto().length).toBeGreaterThan(0);
  });

  it("todo objeto que congela `costoUnitarioSnapshot` setea tambien `costoDesconocido`", () => {
    // Acepta tanto `costoDesconocido: expr` como la forma corta
    // `costoDesconocido,` (shorthand de objeto) — las dos setean el campo.
    const sinMarcar = bloquesQueCongelanCosto().filter(
      (bloque) => !/costoDesconocido\s*[,:}\n]/.test(bloque)
    );

    expect(
      sinMarcar.map((b) => b.slice(0, 160).replace(/\s+/g, " ")),
      `Camino de escritura de una linea de venta que congela un costo sin decir si ` +
        `era conocido. El compilador NO lo va a atrapar: la columna tiene default en ` +
        `la base, asi que el campo es opcional en el tipo de insert — se escribe ` +
        `\`false\` solo, afirmando que el costo se conocia cuando nadie lo dijo. Es el ` +
        `defecto H-15 entrando por otra puerta. Agregá \`costoDesconocido\` al objeto.`
    ).toEqual([]);
  });

  it("`costo_desconocido` sigue teniendo default en el schema — de ahi viene el riesgo que este test cubre", () => {
    const schema = readFileSync(
      join(process.cwd(), "src", "modules", "ventas", "schema.ts"),
      "utf8"
    );
    expect(schema).toMatch(/costoDesconocido:\s*boolean\("costo_desconocido"\)/);
  });
});
