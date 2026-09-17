import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * **Adentro del callback de `comoUsuario()` (y sus hermanas) solo se toca la
 * base a través del `tx`.**
 *
 * La regla que nadie había escrito y que produjo el incidente de producción
 * del 2026-09-17 (mecanismo completo en `src/modules/proveedores/ANCLA.md`):
 * la transacción retiene una conexión del pool mientras corre el callback; si
 * el callback llama a algo que pide OTRA conexión —`tienePermiso()`, cualquier
 * `actions.ts` de un módulo todavía con `db` crudo, otro `comoUsuario()`—, con
 * tantas transacciones simultáneas como conexiones tiene el pool, todas
 * esperan una que ninguna suelta. No hay error: hay cuelgue.
 *
 * La migración a `comoUsuario()` va módulo por módulo (R-8.5), así que la
 * trampa aparece en cada etapa, y la forma natural de migrar una función la
 * reintroduce (mover el cuerpo entero adentro del callback). Por eso es un
 * guard y no una advertencia en un ANCLA.
 *
 * **Qué marca, dentro de cada callback de una función de contexto** (y dentro
 * de las funciones locales del mismo archivo que ese callback llame, en
 * forma transitiva):
 * 1. Una llamada a una función importada de un archivo que toca la base —
 *    directo o por sus imports— **sin pasarle el `tx`**. Pasarle el `tx` es la
 *    forma correcta (`repo.x(tx, …)`): corre sobre la conexión reservada.
 * 2. Cualquier referencia a `db`/`client` de `@/db/client`.
 * 3. Una función de contexto anidada (abre otra transacción, otra conexión).
 *
 * **Qué no puede ver**, y por eso existen además los tests de
 * `src/db/agotamiento-pool*.test.ts`: una promesa creada fuera del callback y
 * esperada adentro, o una función que llega por parámetro.
 *
 * El resultado correcto no es exceptuar la llamada: es resolverla **antes** de
 * abrir la transacción (`preautorizarSobreRecurso()` para permisos) o
 * **después** del commit (entradas de stock, gastos, chequeos de otro módulo).
 */

const REPO_ROOT = path.resolve(__dirname, "../../");
const SRC = path.join(REPO_ROOT, "src");
const IGNORAR_DIRS = new Set(["node_modules", ".next", "dist", "e2e", ".git"]);

const FUNCIONES_DE_CONTEXTO = new Set([
  "comoUsuario",
  "comoCeomAdmin",
  "comoGatewaySistema",
  "comoInstitucion",
  "comoSistema",
]);

/** Paquetes que abren conexiones por sí mismos. */
const PAQUETES_DE_BASE = new Set(["postgres", "pg"]);

// --- Grafo de imports: ¿este archivo toca la base? --------------------------

function listarArchivos(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (IGNORAR_DIRS.has(entry)) continue;
    const abs = path.join(dir, entry);
    if (statSync(abs).isDirectory()) listarArchivos(abs, acc);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) acc.push(abs);
  }
  return acc;
}

function resolver(desde: string, especificador: string): string | null {
  let base: string;
  if (especificador.startsWith("@/")) base = path.join(SRC, especificador.slice(2));
  else if (especificador.startsWith(".")) base = path.resolve(path.dirname(desde), especificador);
  else return null;
  for (const candidato of [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
    if (existsSync(candidato)) return candidato;
  }
  return null;
}

interface ImportDeValor {
  especificador: string;
  resuelto: string | null;
  nombres: string[];
  namespace: string | null;
}

const cacheFuente = new Map<string, ts.SourceFile>();
function fuente(abs: string): ts.SourceFile {
  let sf = cacheFuente.get(abs);
  if (!sf) {
    sf = ts.createSourceFile(abs, readFileSync(abs, "utf-8"), ts.ScriptTarget.Latest, true);
    cacheFuente.set(abs, sf);
  }
  return sf;
}

/** Solo imports que existen en runtime: `import type` y `type X` no abren conexiones. */
function importsDeValor(sf: ts.SourceFile): ImportDeValor[] {
  const salida: ImportDeValor[] = [];
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt) || !ts.isStringLiteral(stmt.moduleSpecifier)) continue;
    const clausula = stmt.importClause;
    if (!clausula || clausula.isTypeOnly) continue;
    const especificador = stmt.moduleSpecifier.text;
    const nombres: string[] = [];
    let namespace: string | null = null;
    if (clausula.name) nombres.push(clausula.name.text);
    const b = clausula.namedBindings;
    if (b && ts.isNamedImports(b)) {
      for (const el of b.elements) if (!el.isTypeOnly) nombres.push(el.name.text);
    } else if (b && ts.isNamespaceImport(b)) {
      namespace = b.name.text;
    }
    if (nombres.length === 0 && !namespace) continue;
    salida.push({ especificador, resuelto: resolver(sf.fileName, especificador), nombres, namespace });
  }
  return salida;
}

const cacheTocaBase = new Map<string, boolean>();
function tocaBase(abs: string, visitando = new Set<string>()): boolean {
  const cacheado = cacheTocaBase.get(abs);
  if (cacheado !== undefined) return cacheado;
  if (visitando.has(abs)) return false;
  visitando.add(abs);
  const rel = path.relative(REPO_ROOT, abs).split(path.sep).join("/");
  let resultado = rel === "src/db/client.ts";
  if (!resultado) {
    for (const imp of importsDeValor(fuente(abs))) {
      if (PAQUETES_DE_BASE.has(imp.especificador) || (imp.resuelto && tocaBase(imp.resuelto, visitando))) {
        resultado = true;
        break;
      }
    }
  }
  visitando.delete(abs);
  cacheTocaBase.set(abs, resultado);
  return resultado;
}

// --- Análisis de un archivo ----------------------------------------------------

interface Violacion {
  archivo: string;
  linea: number;
  llamada: string;
  motivo: string;
}

function textoDeLlamada(expr: ts.Expression): string {
  return expr.getText().replace(/\s+/g, " ").slice(0, 80);
}

function analizarFuente(sf: ts.SourceFile, relPath: string): { callbacks: number; violaciones: Violacion[] } {
  const imports = importsDeValor(sf);
  const porNombre = new Map<string, ImportDeValor>();
  const porNamespace = new Map<string, ImportDeValor>();
  for (const imp of imports) {
    for (const n of imp.nombres) porNombre.set(n, imp);
    if (imp.namespace) porNamespace.set(imp.namespace, imp);
  }
  const nombresDbCrudo = new Set(
    imports.filter((i) => i.especificador === "@/db/client").flatMap((i) => i.nombres)
  );

  const funcionesLocales = new Map<string, ts.FunctionLikeDeclaration>();
  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name && stmt.body) funcionesLocales.set(stmt.name.text, stmt);
    if (ts.isVariableStatement(stmt)) {
      for (const d of stmt.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) {
          funcionesLocales.set(d.name.text, d.initializer);
        }
      }
    }
  }

  const importTocaBase = (imp: ImportDeValor | undefined) =>
    !!imp && (PAQUETES_DE_BASE.has(imp.especificador) || (!!imp.resuelto && tocaBase(imp.resuelto)));

  const violaciones: Violacion[] = [];
  let callbacks = 0;

  /** Recorre `cuerpo` como código que corre con una transacción abierta. */
  function recorrer(cuerpo: ts.Node, nombresTx: Set<string>, cadena: string[], visitadas: Set<string>) {
    const reportar = (nodo: ts.Node, llamada: string, motivo: string) =>
      violaciones.push({
        archivo: relPath,
        linea: sf.getLineAndCharacterOfPosition(nodo.getStart()).line + 1,
        llamada,
        motivo: cadena.length ? `${motivo} (vía ${cadena.join(" → ")})` : motivo,
      });

    const visitar = (nodo: ts.Node) => {
      if (ts.isIdentifier(nodo) && nombresDbCrudo.has(nodo.text) && !ts.isImportSpecifier(nodo.parent)) {
        reportar(nodo, nodo.text, "usa db/client crudo con la transacción abierta");
      }
      if (ts.isCallExpression(nodo)) {
        const callee = nodo.expression;
        const pasaTx = nodo.arguments.some((a) => ts.isIdentifier(a) && nombresTx.has(a.text));
        if (ts.isIdentifier(callee)) {
          const nombre = callee.text;
          if (FUNCIONES_DE_CONTEXTO.has(nombre) && porNombre.get(nombre)?.especificador === "@/db/contexto") {
            reportar(nodo, textoDeLlamada(callee), "abre otra transacción (otra conexión) adentro de una transacción");
          } else if (!pasaTx && importTocaBase(porNombre.get(nombre))) {
            reportar(nodo, textoDeLlamada(callee), `llama a una función de "${porNombre.get(nombre)!.especificador}", que usa su propia conexión`);
          } else if (funcionesLocales.has(nombre) && !visitadas.has(nombre)) {
            const decl = funcionesLocales.get(nombre)!;
            const paramsTx = new Set<string>();
            decl.parameters.forEach((p, i) => {
              const arg = nodo.arguments[i];
              if (ts.isIdentifier(p.name) && arg && ts.isIdentifier(arg) && nombresTx.has(arg.text)) paramsTx.add(p.name.text);
            });
            visitadas.add(nombre);
            if (decl.body) recorrer(decl.body, paramsTx, [...cadena, nombre], visitadas);
            visitadas.delete(nombre);
          }
        } else if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression)) {
          const ns = porNamespace.get(callee.expression.text);
          if (!pasaTx && !nombresTx.has(callee.expression.text) && importTocaBase(ns)) {
            reportar(nodo, textoDeLlamada(callee), `llama a "${ns!.especificador}" sin pasarle el tx`);
          }
        }
      }
      ts.forEachChild(nodo, visitar);
    };
    visitar(cuerpo);
  }

  const buscarCallbacks = (nodo: ts.Node) => {
    if (
      ts.isCallExpression(nodo) &&
      ts.isIdentifier(nodo.expression) &&
      FUNCIONES_DE_CONTEXTO.has(nodo.expression.text) &&
      porNombre.get(nodo.expression.text)?.especificador === "@/db/contexto"
    ) {
      const fn = nodo.arguments.find((a) => ts.isArrowFunction(a) || ts.isFunctionExpression(a)) as
        | ts.ArrowFunction
        | ts.FunctionExpression
        | undefined;
      if (fn) {
        callbacks++;
        const nombresTx = new Set(fn.parameters.filter((p) => ts.isIdentifier(p.name)).map((p) => (p.name as ts.Identifier).text));
        recorrer(fn.body, nombresTx, [], new Set());
        return; // lo de adentro ya se recorrió como transaccional
      }
    }
    ts.forEachChild(nodo, buscarCallbacks);
  };
  buscarCallbacks(sf);
  return { callbacks, violaciones };
}

// --- Los tests -------------------------------------------------------------------

const archivosConContexto = listarArchivos(SRC)
  .map((abs) => ({ abs, sf: fuente(abs) }))
  .filter(({ sf }) => importsDeValor(sf).some((i) => i.especificador === "@/db/contexto"));

function analizarTexto(relPath: string, texto: string) {
  const abs = path.join(REPO_ROOT, relPath);
  return analizarFuente(ts.createSourceFile(abs, texto, ts.ScriptTarget.Latest, true), relPath);
}

describe("Ningún callback de comoUsuario() toca la base por fuera del tx (incidente 2026-09-17)", () => {
  it("el scanner encuentra los callbacks reales (si no, el guard pasaría en vacío)", () => {
    const total = archivosConContexto.reduce(
      (acc, { abs, sf }) => acc + analizarFuente(sf, path.relative(REPO_ROOT, abs)).callbacks,
      0
    );
    // Proveedores + Patrimonio tenían 40 call-sites el 2026-09-17. Si esto cae a
    // cero, el scanner dejó de reconocer el patrón, no es que el código mejoró.
    expect(total).toBeGreaterThanOrEqual(30);
  });

  it("detecta las cuatro formas del bug (fixture: el código de antes del fix)", () => {
    const { violaciones } = analizarTexto(
      "src/modules/proveedores/fixture-del-guard.ts",
      `
      import { comoUsuario } from "@/db/contexto";
      import { db } from "@/db/client";
      import { listarSucursalesPorTenant, tienePermiso } from "@/modules/identidad/actions";
      import { registrarEntradaCompraReventa } from "@/modules/productos/actions";
      import * as repo from "./repository";

      async function requireSucursalOperable(s, t, id) {
        const res = await listarSucursalesPorTenant(s, t);
        return res;
      }

      export async function fichaProveedor(solicitante, proveedorId) {
        return comoUsuario(solicitante.id, async (tx) => {
          const proveedor = await repo.obtenerProveedorPorId(tx, proveedorId);
          if (!(await tienePermiso(solicitante, proveedor.tenantId, "proveedores", "ver"))) return null;
          await requireSucursalOperable(solicitante, proveedor.tenantId, "x");
          await registrarEntradaCompraReventa(solicitante, proveedor.tenantId, {});
          await db.select();
          await comoUsuario(solicitante.id, async (tx2) => repo.obtenerProveedorPorId(tx2, proveedorId));
          return proveedor;
        });
      }
      `
    );
    const resumen = violaciones.map((v) => `${v.llamada} :: ${v.motivo}`);
    expect(resumen).toEqual([
      expect.stringContaining("tienePermiso"),
      expect.stringMatching(/listarSucursalesPorTenant.*vía requireSucursalOperable/),
      expect.stringContaining("registrarEntradaCompraReventa"),
      expect.stringMatching(/^db ::/),
      expect.stringMatching(/comoUsuario :: abre otra transacción/),
    ]);
  });

  it("acepta la forma correcta (fixture: el código después del fix)", () => {
    const { callbacks, violaciones } = analizarTexto(
      "src/modules/proveedores/fixture-del-guard.ts",
      `
      import { comoUsuario } from "@/db/contexto";
      import { preautorizarSobreRecurso, tienePermiso } from "@/modules/identidad/actions";
      import { registrarEntradaCompraReventa } from "@/modules/productos/actions";
      import * as repo from "./repository";

      async function leer(tx, id) { return repo.obtenerProveedorPorId(tx, id); }

      export async function fichaProveedor(solicitante, proveedorId) {
        const puedeVer = await preautorizarSobreRecurso(solicitante, "proveedores", "ver");
        const r = await comoUsuario(solicitante.id, async (tx) => {
          const proveedor = await leer(tx, proveedorId);
          if (!puedeVer(proveedor.tenantId)) return null;
          const [a, b] = await Promise.all([repo.resumen(tx, proveedorId), repo.listar(tx, proveedorId)]);
          return { proveedor, a, b };
        });
        await registrarEntradaCompraReventa(solicitante, "t", {});
        return r;
      }
      `
    );
    expect(callbacks).toBe(1);
    expect(violaciones).toEqual([]);
  });

  it("el código real no tiene ninguna violación", () => {
    const violaciones = archivosConContexto.flatMap(({ abs, sf }) =>
      analizarFuente(sf, path.relative(REPO_ROOT, abs).split(path.sep).join("/")).violaciones
    );
    expect(
      violaciones.map((v) => `${v.archivo}:${v.linea} ${v.llamada} — ${v.motivo}`),
      "Resolvé la llamada ANTES de abrir la transacción (preautorizarSobreRecurso para permisos) o " +
        "DESPUÉS del commit (llamadas a otros módulos). No la exceptúes: ver proveedores/ANCLA.md, " +
        "incidente 2026-09-17."
    ).toEqual([]);
  });
});
