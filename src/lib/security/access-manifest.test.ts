import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { ACCESS_MANIFEST, type NivelAcceso } from "./access-manifest";

// Test de cobertura del manifiesto de acceso (docs/security/AUDITORIA-AUTORIZACION.md
// §8.3). Enumera por AST todas las funciones exportadas de los archivos
// "use server" del proyecto y falla si alguna no está clasificada en
// access-manifest.ts, o si el manifiesto tiene una entrada que ya no
// corresponde a ninguna función real (typo/entrada obsoleta). Además, para
// las entradas declaradas "estatica", intenta confirmar por texto que el
// guard esperado del nivel declarado está presente en la función o en la
// función de módulo a la que delega (1 salto de resolución de imports o
// helpers locales) — best-effort, no un analizador de flujo real; por eso
// el manifiesto permite marcar una entrada como "manual" cuando esto no
// alcanza (ver README.md de esta carpeta).

const SRC_ROOT = path.resolve(__dirname, "../../");
const IGNORAR_DIRS = new Set(["node_modules", ".next", "dist", "e2e"]);

interface FuncionExportada {
  nombre: string;
  texto: string;
  /** Texto crudo de la lista de parámetros (nombre + tipo de cada uno,
   * separados por coma) — usado para detectar parámetros de tipo identidad/
   * sesión/permisos (ver test "ningún endpoint recibe..."). */
  parametrosTexto: string;
}

function textoDeParametros(params: ts.NodeArray<ts.ParameterDeclaration>, sourceFile: ts.SourceFile): string {
  return params.map((p) => p.getText(sourceFile)).join(", ");
}

interface ImportInfo {
  /** nombre local usado en el archivo (puede diferir del exportado via "as") */
  local: string;
  /** nombre exportado real en el módulo origen */
  exportado: string;
  /** especificador del módulo tal cual aparece en el import (ej. "@/modules/x/actions") */
  especificador: string;
}

interface ArchivoParseado {
  absPath: string;
  relPath: string; // relativo a SRC_ROOT, con "/"
  esUseServer: boolean;
  funciones: Map<string, FuncionExportada>; // TODAS las funciones top-level (exportadas o no)
  exportadas: Set<string>; // subconjunto de `funciones` que son export
  imports: ImportInfo[];
}

const cacheArchivos = new Map<string, ArchivoParseado | null>();

function listarArchivosFuente(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (IGNORAR_DIRS.has(entry)) continue;
    const abs = path.join(dir, entry);
    const st = statSync(abs);
    if (st.isDirectory()) {
      listarArchivosFuente(abs, acc);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      acc.push(abs);
    }
  }
  return acc;
}

/** Cuerpo de `export async function foo(...) {...}` y variantes
 * `export const foo = async (...) => {...}` / `export const foo = (...) => {...}`,
 * exportadas o no (las no-exportadas son helpers locales que igual nos
 * interesa poder buscar por texto cuando una funcion exportada los llama). */
function parsearArchivo(absPath: string): ArchivoParseado | null {
  if (cacheArchivos.has(absPath)) return cacheArchivos.get(absPath)!;

  let contenido: string;
  try {
    contenido = readFileSync(absPath, "utf-8");
  } catch {
    cacheArchivos.set(absPath, null);
    return null;
  }

  const sourceFile = ts.createSourceFile(absPath, contenido, ts.ScriptTarget.Latest, true);

  let esUseServer = false;
  const primera = sourceFile.statements[0];
  if (
    primera &&
    ts.isExpressionStatement(primera) &&
    ts.isStringLiteral(primera.expression) &&
    primera.expression.text === "use server"
  ) {
    esUseServer = true;
  }

  const funciones = new Map<string, FuncionExportada>();
  const exportadas = new Set<string>();
  const imports: ImportInfo[] = [];

  function esExport(node: ts.Node): boolean {
    const mods = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    return !!mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  }

  for (const stmt of sourceFile.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name) {
      const nombre = stmt.name.text;
      funciones.set(nombre, {
        nombre,
        texto: stmt.getText(sourceFile),
        parametrosTexto: textoDeParametros(stmt.parameters, sourceFile),
      });
      if (esExport(stmt)) exportadas.add(nombre);
      continue;
    }

    if (ts.isVariableStatement(stmt)) {
      const esExportada = esExport(stmt);
      for (const decl of stmt.declarationList.declarations) {
        if (
          ts.isIdentifier(decl.name) &&
          decl.initializer &&
          (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))
        ) {
          const nombre = decl.name.text;
          funciones.set(nombre, {
            nombre,
            texto: stmt.getText(sourceFile),
            parametrosTexto: textoDeParametros(decl.initializer.parameters, sourceFile),
          });
          if (esExportada) exportadas.add(nombre);
        }
      }
      continue;
    }

    if (ts.isImportDeclaration(stmt) && stmt.importClause?.namedBindings) {
      const especificador = ts.isStringLiteral(stmt.moduleSpecifier) ? stmt.moduleSpecifier.text : "";
      const bindings = stmt.importClause.namedBindings;
      if (ts.isNamedImports(bindings)) {
        for (const el of bindings.elements) {
          imports.push({
            local: el.name.text,
            exportado: el.propertyName?.text ?? el.name.text,
            especificador,
          });
        }
      }
    }
  }

  const resultado: ArchivoParseado = {
    absPath,
    relPath: path.relative(SRC_ROOT, absPath).split(path.sep).join("/"),
    esUseServer,
    funciones,
    exportadas,
    imports,
  };
  cacheArchivos.set(absPath, resultado);
  return resultado;
}

function resolverEspecificador(desdeAbsPath: string, especificador: string): string | null {
  let base: string;
  if (especificador.startsWith("@/")) {
    base = path.join(SRC_ROOT, especificador.slice(2));
  } else if (especificador.startsWith(".")) {
    base = path.resolve(path.dirname(desdeAbsPath), especificador);
  } else {
    return null; // paquete externo, no resolvemos
  }
  for (const candidato of [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
    if (cacheArchivos.has(candidato)) return candidato;
    try {
      statSync(candidato);
      return candidato;
    } catch {
      // sigue probando
    }
  }
  return null;
}

/** Identificadores usados como callee de una llamada dentro de `texto`
 * (heurística por regex sobre el texto ya extraído por AST, no un walk
 * semántico completo — suficiente para esto: "¿esta función llama a X?"). */
function identificadoresLlamados(texto: string): string[] {
  const vistos = new Set<string>();
  const re = /\b([A-Za-z_$][\w$]*)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto))) vistos.add(m[1]);
  return [...vistos];
}

/**
 * Guards canónicos: su sola PRESENCIA como llamada (ej. "tienePermiso(") ya
 * satisface el patrón de keywords del nivel correspondiente — NUNCA hay que
 * inlinear su propia implementación. Es critico excluirlos de la expansión:
 * tienePermiso() internamente contiene "solicitante.esOwner", "ROL_CEOM_
 * ADMIN_ID" Y "tenantId !== tenantObjetivoId" TODOS A LA VEZ (es el motor
 * genérico de autorización) — si se inlinea su cuerpo, CUALQUIER función que
 * la llame "aprueba" los tres patrones (owner/ceom_admin/por-recurso) sin
 * importar cuál es su nivel real, vaciando de contenido a este test. Esto no
 * es hipotético: se detectó con una prueba negativa deliberada antes de dar
 * por buena esta herramienta (ver commit).
 */
const GUARDS_TERMINALES = new Set([
  "tienePermiso",
  "recursoPerteneceAlTenant",
  "requiereOwnerDelTenant",
  "requiereCeomAdmin",
  "tieneConsentimiento",
  "estaEnCartera",
  "esCeomAdmin",
  "obtenerUsuarioActual",
  "obtenerInstitucionActual",
]);

/** Texto de búsqueda para una función exportada: su propio cuerpo + (hasta
 * 2 saltos) el cuerpo de las funciones que llama, ya sean helpers locales
 * del mismo archivo o funciones importadas de otro archivo — salvo los
 * GUARDS_TERMINALES, que se quedan como call-site (su definición nunca se
 * inlinea). Acotado con un set de visitados para no explotar en archivos con
 * mucha interdependencia. */
function espacioDeBusqueda(archivo: ArchivoParseado, nombreFuncion: string, saltosRestantes = 2): string {
  const visitados = new Set<string>();
  function recolectar(archivo: ArchivoParseado, nombreFuncion: string, saltos: number): string {
    const clave = `${archivo.absPath}::${nombreFuncion}`;
    if (visitados.has(clave)) return "";
    visitados.add(clave);

    const fn = archivo.funciones.get(nombreFuncion);
    if (!fn) return "";
    let texto = fn.texto;
    if (saltos <= 0) return texto;

    for (const llamado of identificadoresLlamados(fn.texto)) {
      if (llamado === nombreFuncion) continue;
      if (GUARDS_TERMINALES.has(llamado)) continue;
      if (archivo.funciones.has(llamado)) {
        texto += "\n" + recolectar(archivo, llamado, saltos - 1);
        continue;
      }
      const imp = archivo.imports.find((i) => i.local === llamado);
      if (!imp) continue;
      const destinoPath = resolverEspecificador(archivo.absPath, imp.especificador);
      if (!destinoPath) continue;
      const destino = parsearArchivo(destinoPath);
      if (!destino || !destino.funciones.has(imp.exportado)) continue;
      texto += "\n" + recolectar(destino, imp.exportado, saltos - 1);
    }
    return texto;
  }
  return recolectar(archivo, nombreFuncion, saltosRestantes);
}

const KEYWORDS_POR_NIVEL: Partial<Record<NivelAcceso, RegExp>> = {
  owner: /\b(esOwner|requiereOwnerDelTenant)\b/,
  ceom_admin: /\b(ROL_CEOM_ADMIN_ID|esCeomAdmin|requiereCeomAdmin)\b/,
  "por-recurso": /\b(recursoPerteneceAlTenant|tienePermiso|requiereOwnerDelTenant|tieneConsentimiento|estaEnCartera)\s*\(|\.tenantId\s*(!==|===)/,
  autenticado: /\b(obtenerUsuarioActual|obtenerInstitucionActual)\b/,
};

/**
 * Tipos que llevan identidad/permisos/tenant YA resueltos (docs/security/
 * AUDITORIA-AUTORIZACION.md §8.3, hallazgo de construirDashboard/
 * obtenerCapacidadAlmacenamientoWidget — confirmado explotable: TODA función
 * exportada de un archivo "use server" recibe un action ID real de Next.js
 * sin importar si algún Client Component la importa, así que recibir uno de
 * estos tipos como parámetro es un bypass de autorización invocable por POST
 * directo con un objeto forjado, no una optimización inofensiva). Ningún
 * endpoint debe recibirlos por parámetro — debe resolverlos internamente vía
 * obtenerUsuarioActual()/obtenerInstitucionActual().
 */
const TIPOS_IDENTIDAD_PROHIBIDOS = /\b(UsuarioConRol|SolicitanteCeomAdmin|Institucion)\b/;

// --- Descubrimiento ---------------------------------------------------------

const archivosFuente = listarArchivosFuente(SRC_ROOT);
const archivosUseServer = archivosFuente
  .map((abs) => parsearArchivo(abs))
  .filter((a): a is ArchivoParseado => !!a && a.esUseServer);

const funcionesReales = new Map<string, ArchivoParseado>(); // clave "relPath::nombre" -> archivo
for (const archivo of archivosUseServer) {
  for (const nombre of archivo.exportadas) {
    funcionesReales.set(`${archivo.relPath}::${nombre}`, archivo);
  }
}

describe("access-manifest — cobertura", () => {
  it(`encontró al menos un archivo "use server" real (sanity check del propio scanner)`, () => {
    expect(archivosUseServer.length).toBeGreaterThan(0);
  });

  it("toda función exportada de un archivo \"use server\" tiene entrada en el manifiesto", () => {
    const faltantes = [...funcionesReales.keys()].filter((clave) => !(clave in ACCESS_MANIFEST));
    if (faltantes.length > 0) {
      throw new Error(
        `Endpoint(s) sin clasificar en access-manifest.ts — agregá una entrada para cada uno ` +
          `(ver src/lib/security/README.md):\n  - ${faltantes.join("\n  - ")}`
      );
    }
  });

  it("toda entrada del manifiesto corresponde a una función real (sin entradas obsoletas/typos)", () => {
    const obsoletas = Object.keys(ACCESS_MANIFEST).filter((clave) => !funcionesReales.has(clave));
    if (obsoletas.length > 0) {
      throw new Error(
        `Entrada(s) de access-manifest.ts que ya no corresponden a ninguna función "use server" real ` +
          `(renombrada, eliminada, o typo en la clave):\n  - ${obsoletas.join("\n  - ")}`
      );
    }
  });

  it("ningún endpoint \"use server\" recibe identidad/permisos/tenant ya resueltos por parámetro", () => {
    const violaciones: string[] = [];
    for (const [clave, archivo] of funcionesReales) {
      const [, nombreFuncion] = clave.split("::");
      const fn = archivo.funciones.get(nombreFuncion);
      if (!fn) continue;
      if (TIPOS_IDENTIDAD_PROHIBIDOS.test(fn.parametrosTexto)) {
        violaciones.push(`${clave} — parámetros: (${fn.parametrosTexto})`);
      }
    }
    if (violaciones.length > 0) {
      throw new Error(
        `Endpoint(s) "use server" que reciben un objeto de identidad/permisos/tenant YA RESUELTO ` +
          `como parámetro — Next.js asigna un action ID real a TODA función exportada de un archivo ` +
          `"use server" sin importar si algún Client Component la usa (confirmado en .next/server/**/` +
          `server-reference-manifest.json), así que esto es invocable por POST directo con un objeto ` +
          `forjado (ej. { esOwner: true, tenantId: "<otro-tenant>" }), evadiendo toda la capa de ` +
          `autorización de una sola vez. Resolvé el usuario/institución internamente con ` +
          `obtenerUsuarioActual()/obtenerInstitucionActual() en vez de recibirlo por parámetro:\n  - ${violaciones.join("\n  - ")}`
      );
    }
  });

  it("toda entrada 'manual' documenta por qué en `nota`", () => {
    const sinNota = Object.entries(ACCESS_MANIFEST)
      .filter(([, e]) => e.verificacion === "manual" && !e.nota?.trim())
      .map(([clave]) => clave);
    expect(sinNota, `Entradas "manual" sin nota: ${sinNota.join(", ")}`).toEqual([]);
  });

  it("toda entrada 'estatica' con nivel owner/ceom_admin/por-recurso/autenticado tiene evidencia textual del guard esperado", () => {
    const sinEvidencia: string[] = [];
    for (const [clave, entrada] of Object.entries(ACCESS_MANIFEST)) {
      if (entrada.verificacion !== "estatica") continue;
      const patron = KEYWORDS_POR_NIVEL[entrada.nivel];
      if (!patron) continue; // "publico" no requiere evidencia
      const archivo = funcionesReales.get(clave);
      if (!archivo) continue; // ya reportado por el test de cobertura
      const [, nombreFuncion] = clave.split("::");
      const texto = espacioDeBusqueda(archivo, nombreFuncion);
      if (!patron.test(texto)) {
        sinEvidencia.push(`${clave} (nivel "${entrada.nivel}")`);
      }
    }
    if (sinEvidencia.length > 0) {
      throw new Error(
        `No se encontró evidencia textual del guard esperado para estas entradas "estatica" ` +
          `(el análisis busca hasta 2 saltos de delegación/imports/helpers locales). Si el código ` +
          `realmente no gatea así, es un hallazgo real: corregilo o, si el análisis estático ` +
          `genuinamente no alcanza para este caso, cambiá verificacion a "manual" con una nota ` +
          `explicando por qué:\n  - ${sinEvidencia.join("\n  - ")}`
      );
    }
  });
});
