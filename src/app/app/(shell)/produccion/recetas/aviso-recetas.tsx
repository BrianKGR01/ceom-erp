"use client";

import { useSyncExternalStore } from "react";
import { Info, X } from "lucide-react";

// Cambiar la version vuelve a mostrar el aviso a quien ya lo cerró.
const CLAVE = "ceom:aviso-recetas-al-vender:v1";
const EVENTO = "ceom:aviso-recetas";

function leerCerrado(): boolean {
  try {
    return window.localStorage.getItem(CLAVE) === "1";
  } catch {
    return false;
  }
}

function suscribir(alCambiar: () => void) {
  window.addEventListener(EVENTO, alCambiar);
  return () => window.removeEventListener(EVENTO, alCambiar);
}

/**
 * Aviso cerrable con la X sobre el cambio de las recetas: ahora cada venta descuenta los
 * insumos de la receta del producto. Se acuerda del cierre en este navegador; no es un dato
 * del negocio (si falla el almacenamiento, simplemente se vuelve a mostrar).
 */
export function AvisoRecetas() {
  // En el servidor se asume cerrado para no parpadear; el cliente lee su valor real.
  const cerrado = useSyncExternalStore(suscribir, leerCerrado, () => true);
  if (cerrado) return null;

  function cerrar() {
    try {
      window.localStorage.setItem(CLAVE, "1");
    } catch {
      // sin almacenamiento: el aviso vuelve a aparecer en la próxima visita
    }
    window.dispatchEvent(new Event(EVENTO));
  }

  return (
    <div role="status" className="mb-4 flex items-start gap-3 rounded-2xl bg-pastel-blue-bg p-4 text-sm text-navy">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="flex-1 space-y-1">
        <p className="font-medium">Revisen las recetas: ahora descuentan insumos en cada venta</p>
        <p className="text-text-body">
          Los productos que se preparan al vender descuentan de inventario los insumos de su receta cada vez que se
          vende, y el costo de la venta sale de esos insumos. Conviene revisar que cada receta tenga los insumos y
          cantidades correctos (por ejemplo, vasos y tapas fríos o calientes, la cantidad de café y los jarabes). Los
          cambios que hagan aquí afectan solo a las ventas nuevas; las ya registradas no cambian.
        </p>
      </div>
      <button
        type="button"
        onClick={cerrar}
        aria-label="Cerrar aviso"
        className="rounded-lg p-1 text-navy/70 hover:bg-white/60 hover:text-navy"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
