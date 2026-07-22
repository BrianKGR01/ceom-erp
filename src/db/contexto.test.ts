import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// Blindaje del backstop de RLS (docs/security/PLAN-RLS-BACKSTOP.md, Etapa 0,
// §2.2 "imposible de olvidar"). Mismo criterio AST que
// src/lib/security/access-manifest.test.ts: un test que falla el build es
// la única garantía que no depende de que alguien se acuerde de revisarlo a
// mano. Los tres guards de acá se probaron con un negativo deliberado antes
// de darlos por buenos (ver historial de commits de este archivo).

const REPO_ROOT = path.resolve(__dirname, "../../");
const IGNORAR_DIRS = new Set(["node_modules", ".next", "dist", "e2e", ".git"]);
const DIRS_A_ESCANEAR = ["src", "scripts"];

/**
 * Módulos ya migrados a `src/db/contexto.ts` — crece con cada nueva etapa
 * del plan (§3). Agregar un módulo acá es un paso deliberado: nunca migres
 * uno sin sumarlo, o este guard sigue validando el estado viejo sin avisar.
 */
const MODULOS_MIGRADOS_A_CONTEXTO: string[] = ["src/modules/patrimonio", "src/modules/proveedores"];

/**
 * Quién puede importar `@/db/contexto` — quien ya resolvió `usuario`/
 * `institucion` vía obtenerUsuarioActual()/obtenerInstitucionActual() antes
 * de llamar comoUsuario/comoInstitucion. Repository.ts NO debería estar
 * acá: recibe `Ejecutor` por parámetro, nunca abre su propio contexto.
 */
const ALLOWLIST_IMPORTA_CONTEXTO: string[] = [
  "src/modules/patrimonio/actions.ts",
  "src/modules/proveedores/actions.ts",
];

/** Prefijos de path (relativos a REPO_ROOT) desde donde `comoSistema()` puede
 * invocarse — el escape hatch de bypass total no debe poder llamarse desde
 * cualquier lado solo porque compila. */
const ALLOWLIST_COMO_SISTEMA_PREFIJOS = ["scripts/"];

/**
 * Excepciones explícitas y acotadas al guard "ningún archivo de un módulo
 * migrado importa db/client crudo" — cada entrada exige un motivo escrito
 * acá, no solo en el archivo. Agregar una entrada nueva es un paso
 * deliberado (docs/security/PLAN-RLS-BACKSTOP.md §9.6): el guard existe
 * para prevenir justamente esto, así que cada excepción debe poder
 * justificarse sola, sin depender de leer el código para saber por qué
 * está permitida.
 *
 * - `src/modules/proveedores/actions.ts`: SOLO por el fallback de
 *   `consultarPagosCompraEnPeriodo()` — es la única función de Proveedores
 *   alcanzada por el camino Gateway (vía financiero.flujoCaja() ←
 *   Monitoreo Institucional → `solicitanteGateway()`, un solicitante
 *   sintético sin fila real en `usuarios`/`auth.users`). Desde la Etapa 3
 *   (`es_ceom_admin()` + policy de bypass, docs/security/
 *   PLAN-RLS-BACKSTOP.md §10.3/§10.8) el camino `ceom_admin` real (Panel
 *   Admin CEOM) ya pasa por `comoUsuario()` sin excepción — el `db` crudo
 *   solo se usa como fallback cuando `comoUsuario()` lanza
 *   `ContextoRlsNoResueltoError`. Se cierra del todo cuando la Etapa 4
 *   rediseñe el solicitante sintético del Gateway (§10.4) — no expandir a
 *   otras funciones de este archivo sin la misma revisión.
 */
const ALLOWLIST_IMPORTA_DB_CRUDO: string[] = ["src/modules/proveedores/actions.ts"];

/** Solo estos nombres abren un contexto de RLS en runtime — `Tx`/`Ejecutor`
 * son tipos puros (sin comportamiento, sin bypass) que cualquier
 * repository.ts migrado necesita importar para tipar su parámetro, y no
 * deben pasar por el allowlist de abajo. */
const FUNCIONES_DE_CONTEXTO = new Set([
  "comoUsuario",
  "comoCeomAdmin",
  "comoGatewaySistema",
  "comoInstitucion",
  "comoSistema",
]);

interface ImportInfo {
  especificador: string;
  nombresImportados: string[];
}

interface ArchivoEscaneado {
  relPath: string;
  texto: string;
  imports: ImportInfo[];
}

function listarArchivos(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (IGNORAR_DIRS.has(entry)) continue;
    const abs = path.join(dir, entry);
    const st = statSync(abs);
    if (st.isDirectory()) {
      listarArchivos(abs, acc);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      acc.push(abs);
    }
  }
  return acc;
}

function escanearArchivo(absPath: string): ArchivoEscaneado {
  const texto = readFileSync(absPath, "utf-8");
  const sourceFile = ts.createSourceFile(absPath, texto, ts.ScriptTarget.Latest, true);
  const imports: ImportInfo[] = [];

  for (const stmt of sourceFile.statements) {
    if (!ts.isImportDeclaration(stmt) || !ts.isStringLiteral(stmt.moduleSpecifier)) continue;
    const especificador = stmt.moduleSpecifier.text;
    const nombresImportados: string[] = [];
    const bindings = stmt.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const el of bindings.elements) nombresImportados.push(el.name.text);
    }
    imports.push({ especificador, nombresImportados });
  }

  return {
    relPath: path.relative(REPO_ROOT, absPath).split(path.sep).join("/"),
    texto,
    imports,
  };
}

const archivos: ArchivoEscaneado[] = DIRS_A_ESCANEAR.flatMap((dir) =>
  listarArchivos(path.join(REPO_ROOT, dir)).map(escanearArchivo)
);

describe("db/contexto — blindaje de la Etapa 0", () => {
  it("encontró archivos para escanear (sanity check del propio scanner)", () => {
    expect(archivos.length).toBeGreaterThan(0);
  });

  it("ningún archivo de un módulo ya migrado importa `db`/`client` crudo de @/db/client", () => {
    const violaciones: string[] = [];
    for (const archivo of archivos) {
      const migrado = MODULOS_MIGRADOS_A_CONTEXTO.some((prefijo) => archivo.relPath.startsWith(prefijo));
      if (!migrado) continue;
      if (ALLOWLIST_IMPORTA_DB_CRUDO.includes(archivo.relPath)) continue;
      const importaClienteCrudo = archivo.imports.some(
        (imp) => imp.especificador === "@/db/client" || imp.especificador === "./client"
      );
      if (importaClienteCrudo) violaciones.push(archivo.relPath);
    }
    if (violaciones.length > 0) {
      throw new Error(
        `Archivo(s) de un módulo ya migrado a contexto.ts que igual importan "db"/"client" crudo — ` +
          `deben recibir un Ejecutor (tx) por parámetro en cambio (docs/security/PLAN-RLS-BACKSTOP.md ` +
          `§2.2):\n  - ${violaciones.join("\n  - ")}`
      );
    }
  });

  it("solo el allowlist explícito importa las funciones de contexto (no sus tipos)", () => {
    const violaciones: string[] = [];
    for (const archivo of archivos) {
      const importaFuncionDeContexto = archivo.imports.some(
        (imp) =>
          imp.especificador === "@/db/contexto" &&
          imp.nombresImportados.some((n) => FUNCIONES_DE_CONTEXTO.has(n))
      );
      if (importaFuncionDeContexto && !ALLOWLIST_IMPORTA_CONTEXTO.includes(archivo.relPath)) {
        violaciones.push(archivo.relPath);
      }
    }
    if (violaciones.length > 0) {
      throw new Error(
        `Archivo(s) que importan @/db/contexto sin estar en ALLOWLIST_IMPORTA_CONTEXTO de este test ` +
          `— si es una migración nueva y deliberada, agregalo a la lista; si no, el repository.ts ` +
          `debería recibir un Ejecutor por parámetro en vez de abrir su propio contexto:\n  - ${violaciones.join("\n  - ")}`
      );
    }
  });

  it("comoSistema() solo se llama desde el allowlist de call-sites", () => {
    const violaciones: string[] = [];
    for (const archivo of archivos) {
      if (archivo.relPath === "src/db/contexto.ts") continue; // la propia definición
      if (!/\bcomoSistema\s*\(/.test(archivo.texto)) continue;
      const permitido = ALLOWLIST_COMO_SISTEMA_PREFIJOS.some((prefijo) => archivo.relPath.startsWith(prefijo));
      if (!permitido) violaciones.push(archivo.relPath);
    }
    if (violaciones.length > 0) {
      throw new Error(
        `comoSistema() (bypass total de RLS) llamado fuera del allowlist de call-sites — este escape ` +
          `hatch no debe usarse desde cualquier lado solo porque compila:\n  - ${violaciones.join("\n  - ")}`
      );
    }
  });
});
