import { Minus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface LineaCarrito {
  productoId: string;
  nombre: string;
  precioVenta: number;
  cantidad: number;
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
  onCambiarCantidad: (productoId: string, cantidad: number) => void;
  onQuitar: (productoId: string) => void;
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
    <div className="space-y-3">
      <div className="space-y-2">
        {lineas.map((linea) => (
          <div key={linea.productoId} className="flex items-center gap-2 text-sm">
            <span className="line-clamp-1 flex-1 text-text-body">{linea.nombre}</span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon-xs"
                onClick={() => onCambiarCantidad(linea.productoId, linea.cantidad - 1)}
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
                onClick={() => onCambiarCantidad(linea.productoId, linea.cantidad + 1)}
              >
                <Plus className="size-3" />
              </Button>
            </div>
            <span className="w-16 text-right font-medium text-navy">
              {(linea.precioVenta * linea.cantidad).toFixed(2)}
            </span>
            <button
              type="button"
              onClick={() => onQuitar(linea.productoId)}
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
