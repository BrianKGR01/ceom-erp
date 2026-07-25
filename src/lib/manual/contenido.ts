/**
 * Lectura del manual de usuario desde `docs/manual/` — SOLO SERVIDOR.
 *
 * Opción A pura: los `.md` se leen del disco **en tiempo de ejecución**, con
 * `fs`. No se importan (eso los congelaría en el bundle de la build), no se
 * copian a la base de datos, no hay ninguna versión intermedia que
 * sincronizar. Lo que se muestra en `/admin/manual` es literalmente lo que
 * dice el archivo en ese momento; para actualizar el manual se edita el `.md`
 * y se despliega.
 *
 * Para que los archivos existan en el servidor de Vercel (que solo empaqueta
 * lo que el trazado de dependencias detecta, y un `readFile` dinámico no se
 * detecta), `next.config.ts` los suma explícitamente con
 * `outputFileTracingIncludes`. Ver el comentario ahí.
 *
 * Nada acá está hardcodeado por nombre: las guías son los subdirectorios de
 * `docs/manual/` y los capítulos son los `.md` numerados dentro de cada uno.
 * Un capítulo nuevo aparece solo con agregar el archivo.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export const RAIZ_MANUAL = path.join(process.cwd(), "docs", "manual");

/** Base de la navegación — un solo lugar del que salen todos los `href`. */
export const BASE_MANUAL = "/admin/manual";

export interface CapituloManual {
  /** Slug de la guía a la que pertenece (nombre del directorio). */
  guiaSlug: string;
  /** Slug del capítulo = nombre del archivo sin `.md` (`01-primeros-pasos`). */
  slug: string;
  /** Número que da el nombre del archivo, no el encabezado del texto. */
  numero: number;
  /** Título tomado del `# ` del archivo, sin su numeración. */
  titulo: string;
  /** Ruta relativa a la raíz del repo — solo para mensajes de diagnóstico. */
  rutaRelativa: string;
}

export interface GuiaManual {
  slug: string;
  titulo: string;
  descripcion: string;
  capitulos: CapituloManual[];
}

/**
 * Un capítulo es un `.md` con prefijo numérico (`01-...`, `02-...`).
 *
 * Esta forma es la que separa el manual de los documentos internos de
 * desarrollo: `hallazgos.md`, `glosario.md`, `auditoria-por-actor.md`,
 * `propuesta-roles-por-defecto.md` y los `README.md` no llevan prefijo, así
 * que quedan afuera sin necesidad de una lista de exclusión que haya que
 * mantener a mano. Además viven en la raíz de `docs/manual/`, no dentro de
 * una guía, y acá solo se leen los subdirectorios.
 */
const NOMBRE_DE_CAPITULO = /^(\d{1,3})-([a-z0-9-]+)\.md$/i;

/**
 * Slug aceptable en una URL: minúsculas, dígitos y guiones simples.
 * Se aplica a lo que llega por `params` ANTES de tocar el disco — junto con
 * la verificación de que la ruta resuelta sigue cayendo dentro de
 * `RAIZ_MANUAL`, cierra cualquier intento de `../` o de ruta absoluta.
 */
const SLUG_VALIDO = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Título y orden de las guías que hoy existen. Es metadata de presentación,
 * no un índice: si mañana aparece un directorio nuevo en `docs/manual/`, se
 * lista igual (al final, con el título derivado del nombre del directorio).
 */
const GUIAS_CONOCIDAS: Record<string, { titulo: string; descripcion: string; orden: number }> = {
  negocio: {
    titulo: "Negocio",
    descripcion: "Lo que ve y hace el dueño de un negocio en /app.",
    orden: 1,
  },
  "equipo-ceom": {
    titulo: "Equipo CEOM",
    descripcion: "El panel interno: planes, alta y seguimiento de negocios.",
    orden: 2,
  },
  instituciones: {
    titulo: "Instituciones",
    descripcion: "El portal de universidades e incubadoras que hacen seguimiento.",
    orden: 3,
  },
};

function metadataDeGuia(slug: string) {
  return (
    GUIAS_CONOCIDAS[slug] ?? {
      titulo: slug.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()),
      descripcion: "",
      orden: 99,
    }
  );
}

/**
 * Título del capítulo: el primer `# ` del archivo, sacándole la numeración
 * que trae adelante.
 *
 * La numeración que manda es la del nombre del archivo, no la del texto —
 * hoy no coinciden en `negocio/04-gastos.md` (`# 5. Gastos`) ni en
 * `negocio/05-compras-y-proveedores.md` (`# 4. Compras y proveedores`), y
 * mostrar las dos a la vez sería contradecirse en pantalla. Si no hay `# `,
 * se cae al nombre del archivo.
 */
function tituloDesde(contenido: string, slugSinNumero: string): string {
  const encabezado = contenido.match(/^#\s+(.+?)\s*$/m);
  if (!encabezado) return slugSinNumero.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
  return encabezado[1].replace(/^\d+[.)]\s*/, "").trim();
}

/** Los subdirectorios de `docs/manual/`, en el orden en que se muestran. */
async function listarSlugsDeGuias(): Promise<string[]> {
  const entradas = await readdir(RAIZ_MANUAL, { withFileTypes: true });
  return entradas
    .filter((e) => e.isDirectory() && SLUG_VALIDO.test(e.name))
    .map((e) => e.name)
    .sort((a, b) => {
      const orden = metadataDeGuia(a).orden - metadataDeGuia(b).orden;
      return orden !== 0 ? orden : a.localeCompare(b, "es");
    });
}

async function listarCapitulos(guiaSlug: string): Promise<CapituloManual[]> {
  const dir = path.join(RAIZ_MANUAL, guiaSlug);
  const entradas = await readdir(dir, { withFileTypes: true });

  const capitulos = await Promise.all(
    entradas
      .filter((e) => e.isFile())
      .map((e) => ({ nombre: e.name, match: e.name.match(NOMBRE_DE_CAPITULO) }))
      .filter((e): e is { nombre: string; match: RegExpMatchArray } => e.match !== null)
      .map(async ({ nombre, match }) => {
        const contenido = await readFile(path.join(dir, nombre), "utf8");
        const slug = nombre.replace(/\.md$/i, "");
        return {
          guiaSlug,
          slug,
          numero: Number(match[1]),
          titulo: tituloDesde(contenido, match[2]),
          rutaRelativa: `docs/manual/${guiaSlug}/${nombre}`,
        } satisfies CapituloManual;
      })
  );

  return capitulos.sort((a, b) => a.numero - b.numero || a.slug.localeCompare(b.slug, "es"));
}

/**
 * El índice completo: las guías con sus capítulos, leído del disco en cada
 * request. Sin caché a propósito — el archivo es la única fuente.
 */
export async function listarGuias(): Promise<GuiaManual[]> {
  const slugs = await listarSlugsDeGuias();
  return Promise.all(
    slugs.map(async (slug) => ({
      slug,
      ...metadataDeGuia(slug),
      capitulos: await listarCapitulos(slug),
    }))
  ).then((guias) => guias.filter((g) => g.capitulos.length > 0));
}

/**
 * Una guía sola, o `null` si el slug no corresponde a un directorio real de
 * `docs/manual/` con capítulos adentro. La validación es contra el listado
 * del disco, no contra `GUIAS_CONOCIDAS`, para que una guía nueva funcione
 * sin tocar este archivo.
 */
export async function obtenerGuia(guiaSlug: string): Promise<GuiaManual | null> {
  if (!SLUG_VALIDO.test(guiaSlug)) return null;
  const slugs = await listarSlugsDeGuias();
  if (!slugs.includes(guiaSlug)) return null;

  const capitulos = await listarCapitulos(guiaSlug);
  if (capitulos.length === 0) return null;
  return { slug: guiaSlug, ...metadataDeGuia(guiaSlug), capitulos };
}

export interface CapituloConTexto extends CapituloManual {
  /** El markdown crudo, tal cual está en el archivo. */
  markdown: string;
  /**
   * El mismo markdown sin su `# ` inicial, que es lo que se renderiza: el
   * título ya lo muestra el encabezado de la pantalla, con el número que da
   * el nombre del archivo. Ver `tituloDesde()` para por qué la numeración
   * del texto no se usa.
   */
  cuerpo: string;
}

/**
 * Un capítulo con su texto. `null` si el slug no es válido, si el archivo no
 * existe, o si la ruta resuelta se sale de `docs/manual/` — este último caso
 * no debería poder darse con `SLUG_VALIDO` ya aplicado, pero la verificación
 * queda igual porque es la que hace que un error futuro en la validación no
 * se convierta en una lectura arbitraria del disco.
 */
export async function obtenerCapitulo(
  guiaSlug: string,
  capituloSlug: string
): Promise<CapituloConTexto | null> {
  if (!SLUG_VALIDO.test(guiaSlug) || !SLUG_VALIDO.test(capituloSlug)) return null;
  if (!NOMBRE_DE_CAPITULO.test(`${capituloSlug}.md`)) return null;

  const archivo = path.resolve(RAIZ_MANUAL, guiaSlug, `${capituloSlug}.md`);
  const dentroDelManual =
    archivo.startsWith(path.resolve(RAIZ_MANUAL) + path.sep) &&
    path.dirname(archivo) === path.resolve(RAIZ_MANUAL, guiaSlug);
  if (!dentroDelManual) return null;

  let markdown: string;
  try {
    markdown = await readFile(archivo, "utf8");
  } catch {
    return null;
  }

  const match = `${capituloSlug}.md`.match(NOMBRE_DE_CAPITULO)!;
  return {
    guiaSlug,
    slug: capituloSlug,
    numero: Number(match[1]),
    titulo: tituloDesde(markdown, match[2]),
    rutaRelativa: `docs/manual/${guiaSlug}/${capituloSlug}.md`,
    markdown,
    cuerpo: markdown.replace(/^#\s+.+?\r?\n+/, ""),
  };
}

/** `href` de un capítulo dentro de `/admin/manual`. */
export function hrefCapitulo(guiaSlug: string, capituloSlug: string): string {
  return `${BASE_MANUAL}/${guiaSlug}/${capituloSlug}`;
}
