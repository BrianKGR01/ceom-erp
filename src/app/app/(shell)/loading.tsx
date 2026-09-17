import { Skeleton } from "@/components/ui/skeleton";

/**
 * Lo que se ve mientras una pantalla de `/app` está cargando.
 *
 * **Por qué existe** (incidente del 2026-09-17, `src/modules/proveedores/ANCLA.md`, H-50): sin
 * `loading.tsx`, en una navegación del cliente Next.js deja la pantalla ANTERIOR hasta que la nueva
 * termina de renderizar en el servidor. Cuando el módulo de Proveedores se colgó, las usuarias no
 * vieron "cargando" ni un error: vieron que tocar el menú no hacía nada, y lo reportaron como un
 * clic perdido. Un tiempo de carga alto sigue siendo un problema, pero deja de ser invisible.
 *
 * Vive en el route group `(shell)` a propósito: el sidebar y la cabecera son parte del layout
 * padre, así que **siguen visibles y usables** mientras esto se muestra. La persona puede irse a
 * otra pantalla sin esperar.
 *
 * Deliberadamente genérico: alto de cabecera + tarjetas, con las mismas medidas del
 * `design-system.md` (§5.1 contenedor, §5.3 tarjetas). No imita cada pantalla — un esqueleto que
 * miente sobre la forma de lo que viene molesta más de lo que ayuda.
 */
export default function CargandoPantallaDeApp() {
  return (
    <div className="min-h-screen bg-gray-bg p-6 xl:p-8" aria-busy="true" aria-live="polite">
      <div className="mx-auto max-w-5xl space-y-4 py-6">
        <span className="sr-only">Cargando…</span>
        <div className="space-y-2">
          <Skeleton className="h-7 w-56 bg-card" />
          <Skeleton className="h-4 w-80 bg-card" />
        </div>
        <div className="space-y-3 rounded-2xl bg-card p-6 shadow-card">
          {[0, 1, 2, 3, 4].map((fila) => (
            <div key={fila} className="flex items-center gap-4">
              <Skeleton className="size-10 shrink-0 rounded-xl bg-gray-bg" />
              <Skeleton className="h-4 flex-1 bg-gray-bg" />
              <Skeleton className="h-4 w-24 bg-gray-bg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
