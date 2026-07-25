import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { hrefCapitulo } from "@/lib/manual/contenido";

/** Un enlace `04-gastos.md` (o `04-gastos.md#seccion`) dentro de una guía. */
const ENLACE_A_CAPITULO = /^(\d{1,3}-[a-z0-9-]+)\.md(#.*)?$/i;

/**
 * Las marcas del manual (`docs/manual/README.md`, sección "Cómo se marca lo
 * que no existe o no funciona") son todas blockquotes que abren con un
 * emoji. El emoji es lo único que las distingue, así que el color de la nota
 * se elige leyendo con qué arranca el texto del bloque.
 *
 * Se compara contra el codepoint base (⚠ y no ⚠️) para que dé igual si el
 * archivo trae o no el selector de variación U+FE0F.
 */
const MARCAS: ReadonlyArray<{ emoji: string; clase: string }> = [
  { emoji: "⚠", clase: "manual-md-nota--ojo" }, // ⚠️ existe pero sorprende
  { emoji: "\u{1f6a7}", clase: "manual-md-nota--todavia-no" }, // 🚧 no existe todavía
  { emoji: "✅", clase: "manual-md-nota--listo" }, // ✅ hecho / disponible
  { emoji: "\u{1f50e}", clase: "manual-md-nota--interna" }, // 🔎 nota interna
];

/** Texto plano de un nodo de hast, para poder mirar con qué emoji abre. */
function textoDe(nodo: unknown): string {
  if (!nodo || typeof nodo !== "object") return "";
  const n = nodo as { value?: unknown; children?: unknown[] };
  if (typeof n.value === "string") return n.value;
  if (Array.isArray(n.children)) return n.children.map(textoDe).join("");
  return "";
}

/**
 * Render del markdown del manual. Server Component: el texto llega ya leído
 * del disco (`src/lib/manual/contenido.ts`) y acá solo se transforma a HTML.
 *
 * `remark-gfm` es lo que habilita las tablas — que son la mitad del manual —
 * y las listas de tareas. No se habilita HTML crudo (`rehype-raw`) a
 * propósito: el manual no lo usa (el único `<correo>` que aparece está
 * dentro de un bloque de código) y no habilitarlo evita que un `.md` pueda
 * inyectar markup en el panel.
 *
 * El estilado vive en `globals.css` bajo `.manual-md`, con los tokens del
 * design system — es CSS descendente en vez de una clase por elemento
 * porque acá los elementos los genera el markdown, no nosotros.
 */
export function ManualMarkdown({ markdown, guiaSlug }: { markdown: string; guiaSlug: string }) {
  const components: Components = {
    // Los enlaces del manual apuntan al archivo hermano (`04-gastos.md`).
    // Se reescriben a la ruta del panel; cualquier otro `.md` (los
    // documentos internos de desarrollo, que no forman parte del manual)
    // se degrada a texto en vez de quedar como enlace roto.
    a({ href, children }) {
      if (!href) return <>{children}</>;

      const capitulo = href.match(ENLACE_A_CAPITULO);
      if (capitulo) {
        return <Link href={hrefCapitulo(guiaSlug, capitulo[1])}>{children}</Link>;
      }
      if (/\.md(#.*)?$/i.test(href)) {
        return <span className="manual-md-enlace-inerte">{children}</span>;
      }
      if (href.startsWith("#")) {
        return <a href={href}>{children}</a>;
      }
      return (
        <a href={href} target="_blank" rel="noreferrer">
          {children}
        </a>
      );
    },
    blockquote({ node, children }) {
      const texto = textoDe(node).trimStart();
      const marca = MARCAS.find((m) => texto.startsWith(m.emoji));
      return <blockquote className={marca?.clase}>{children}</blockquote>;
    },
    // Las tablas del manual llegan a tener 5-6 columnas: scrollean dentro de
    // su propio contenedor para que a 375px la página no scrollee en
    // horizontal completa.
    table({ children }) {
      return (
        <div className="manual-md-tabla">
          <table>{children}</table>
        </div>
      );
    },
  };

  return (
    <div className="manual-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
