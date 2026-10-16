import { Minus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface LineaCarrito {
  /** Identifica la linea: el mismo producto con otros modificadores es otra linea. */
  clave: string;
  productoId: string;
  nombre: string;
  /** Precio unitario ya con lo que suman los modificadores. */
  precioVenta: number;
  cantidad: number;
  /** Fase 3 Cafiatto. */
  modificadorIds: string[];
  modificadoresTexto: string[];
  observacion: string;
}

// Panel de resumen en vivo — mismo patron ya usado en el Stepper de
// Onboarding (design-system.md 5.4: "panel lateral derecho con resumen en
// vivo de lo que se esta registrando").
export function CartPanel({
  lineas,
  onCambiarCantidad,
  onQuitar,
}: {
  lineas: LineaCarrito[];
  onCambiarCantidad: (clave: string, cantidad: number) => void;
  onQuitar: (clave: string) => void;
}) {
  const total = lineas.reduce((acc, l) => acc + l.precioVenta * l.cantidad, 0);

  if (lineas.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-text-muted">
        Tocá un producto para agregarlo acá.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {lineas.map((linea) => (
          <div key={linea.clave} className="flex items-center gap-2 text-sm">
            <div className="min-w-0 flex-1">
              <span className="line-clamp-1 text-text-body">{linea.nombre}</span>
              {linea.modificadoresTexto.length > 0 && (
                <span className="line-clamp-2 text-[11px] text-text-muted">
                  {linea.modificadoresTexto.join(" · ")}
                </span>
              )}
              {linea.observacion && (
                <span className="line-clamp-1 text-[11px] text-text-muted italic">{linea.observacion}</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon-xs"
                onClick={() => onCambiarCantidad(linea.clave, linea.cantidad - 1)}
              >
                <Minus className="size-3" />
              </Button>
              <span className="w-6 text-center text-xs font-medium text-navy">
                {linea.cantidad}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon-xs"
                onClick={() => onCambiarCantidad(linea.clave, linea.cantidad + 1)}
              >
                <Plus className="size-3" />
              </Button>
            </div>
            <span className="w-16 text-right font-medium text-navy">
              {(linea.precioVenta * linea.cantidad).toFixed(2)}
            </span>
            <button
              type="button"
              onClick={() => onQuitar(linea.clave)}
              className="text-text-muted hover:text-error-text"
              aria-label={`Quitar ${linea.nombre}`}
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-gray-border pt-3">
        <span className="text-sm font-medium text-text-body">Total</span>
        <span className="text-lg font-semibold text-navy">{total.toFixed(2)}</span>
      </div>
    </div>
  );
}
