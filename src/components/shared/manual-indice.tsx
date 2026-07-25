"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ChevronDown, List } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CapituloDelIndice {
  slug: string;
  numero: number;
  titulo: string;
}

export interface GuiaDelIndice {
  slug: string;
  titulo: string;
  descripcion: string;
  capitulos: CapituloDelIndice[];
}

/**
 * Primer nivel del manual: las guías con sus capítulos, siempre a la vista.
 *
 * En escritorio es una columna pegajosa a la izquierda del contenido (regla
 * `.manual-indice` en globals.css). Abajo de 1024px se colapsa detrás de un
 * botón y, al abrirse, empuja el contenido hacia abajo en vez de taparlo —
 * no es un drawer superpuesto como el del shell, justamente para que el
 * capítulo que se está leyendo nunca quede debajo del índice.
 */
export function ManualIndice({
  guias,
  base,
}: {
  guias: GuiaDelIndice[];
  base: string;
}) {
  const pathname = usePathname();
  // Elegir un capítulo en móvil cierra el índice al vuelo (mismo mecanismo
  // que el drawer de AdminShell): si quedara abierto, cada navegación
  // arrancaría con la lista entera arriba del texto.
  const [abierto, setAbierto] = useState(false);

  const total = guias.reduce((suma, g) => suma + g.capitulos.length, 0);

  return (
    <div>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-controls="manual-indice"
        className="manual-indice-toggle mb-3 w-full items-center justify-between gap-2 rounded-2xl bg-card px-4 py-3 text-sm font-medium text-navy shadow-card"
      >
        <span className="flex items-center gap-2">
          <List className="size-4 shrink-0 text-primary" />
          Índice del manual
          <span className="text-xs font-normal text-text-muted">
            ({guias.length} guías · {total} capítulos)
          </span>
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 transition-transform", abierto && "rotate-180")}
        />
      </button>

      <nav
        id="manual-indice"
        aria-label="Índice del manual"
        className={cn(
          "manual-indice rounded-2xl bg-card p-3 shadow-card",
          abierto && "manual-indice--abierto"
        )}
      >
        <Link
          href={base}
          onClick={() => setAbierto(false)}
          className={cn(
            "mb-2 flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors hover:bg-pastel-blue-bg",
            pathname === base ? "bg-pastel-blue-bg text-navy" : "text-text-muted"
          )}
        >
          <BookOpen className="size-4 shrink-0 text-primary" />
          Todas las guías
        </Link>

        <div className="space-y-4">
          {guias.map((guia) => (
            <div key={guia.slug}>
              <p className="px-2.5 pb-1 text-[11px] font-semibold tracking-wide text-text-muted uppercase">
                {guia.titulo}
              </p>
              <ul className="space-y-0.5">
                {guia.capitulos.map((capitulo) => {
                  const href = `${base}/${guia.slug}/${capitulo.slug}`;
                  const activo = pathname === href;
                  return (
                    <li key={capitulo.slug}>
                      <Link
                        href={href}
                        onClick={() => setAbierto(false)}
                        aria-current={activo ? "page" : undefined}
                        className={cn(
                          "flex gap-2 rounded-lg px-2.5 py-1.5 text-[13px] leading-snug transition-colors hover:bg-pastel-blue-bg hover:text-navy",
                          activo ? "bg-pastel-blue-bg font-medium text-navy" : "text-text-body"
                        )}
                      >
                        <span className={cn("shrink-0", activo ? "text-navy" : "text-text-muted")}>
                          {capitulo.numero}.
                        </span>
                        <span className="min-w-0">{capitulo.titulo}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>
    </div>
  );
}
