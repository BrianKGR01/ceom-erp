import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// El repo tiene DOS archivos de instrucciones para agentes, uno por
// convención de cada harness: `CLAUDE.md` (Claude Code) y `AGENTS.md`
// (Codex y compatibles). No son un archivo y su copia de cortesía: son la
// misma fuente de verdad leída por herramientas distintas, y hasta ahora se
// mantenían sincronizados a mano.
//
// Eso falló en silencio. Al agregar la regla #9 (marcadores de completitud,
// Etapa 3 tanda 3.1) se editó solo `CLAUDE.md`: los dos archivos eran
// byte-idénticos desde el 2026-07-13 y quedaron divergentes, así que la
// mitad de los agentes no veía una regla no negociable recién escrita. No lo
// detectó nadie hasta que se preguntó explícitamente.
//
// Es el mismo modo de falla que este proyecto persigue en el producto —algo
// que existe, no se propaga, y nada falla— así que se cierra igual: con un
// chequeo que rompe la build en vez de una convención que hay que recordar.
//
// Si algún día hace falta que difieran de verdad (una sección específica de
// un harness), este test es el lugar donde declararlo: agregar la excepción
// acá, con el motivo, en vez de dejar que la divergencia sea implícita.

const RAIZ = path.resolve(__dirname, "../../");

function leer(nombre: string): string {
  // Normaliza los finales de línea: el repo se trabaja en Windows con
  // `core.autocrlf`, así que un archivo puede quedar con CRLF y el otro con
  // LF en el working tree sin que eso sea una divergencia real de contenido.
  return readFileSync(path.join(RAIZ, nombre), "utf8").replace(/\r\n/g, "\n");
}

describe("instrucciones de agentes", () => {
  it("CLAUDE.md y AGENTS.md son idénticos — una regla nueva tiene que llegar a los dos harnesses", () => {
    const claude = leer("CLAUDE.md");
    const agents = leer("AGENTS.md");

    if (claude !== agents) {
      const lineasClaude = claude.split("\n");
      const lineasAgents = agents.split("\n");
      const primeraDiferencia = lineasClaude.findIndex((l, i) => l !== lineasAgents[i]);
      throw new Error(
        `CLAUDE.md y AGENTS.md divergieron (primera diferencia en la línea ${primeraDiferencia + 1}):\n` +
          `  CLAUDE.md: ${JSON.stringify(lineasClaude[primeraDiferencia] ?? "(fin del archivo)")}\n` +
          `  AGENTS.md: ${JSON.stringify(lineasAgents[primeraDiferencia] ?? "(fin del archivo)")}\n` +
          "Copiá el que esté actualizado sobre el otro: son la misma fuente de verdad " +
          "leída por dos harnesses distintos."
      );
    }
    expect(claude).toBe(agents);
  });

  it("las reglas no negociables están numeradas sin saltos ni repetidos", () => {
    // Guarda barata contra el error de copiar/pegar una regla nueva: dos
    // "9." o un salto de 8 a 10 pasan desapercibidos leyendo en diagonal.
    const contenido = leer("CLAUDE.md");
    const seccion = contenido.split("## Reglas de arquitectura")[1] ?? "";
    const numeros = [...seccion.matchAll(/^(\d+)\. \*\*/gm)].map((m) => Number(m[1]));

    expect(numeros.length).toBeGreaterThan(0);
    expect(numeros).toEqual(Array.from({ length: numeros.length }, (_, i) => i + 1));
  });
});
