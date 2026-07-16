import { Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export interface ProductoParaVenta {
  id: string;
  nombre: string;
  imagenUrl: string | null;
  unidadVenta: string;
  precioVenta: string;
}

// Variante compacta y clickeable de la ProductCard de Modulo 2 — mismo
// lenguaje visual (design-system.md 5.3), pero agrega al carrito en vez de
// llevar a una ficha. Vive en este modulo a proposito (no se importa el
// componente de Productos directamente — caja negra entre modulos de UI).
export function ProductPickerCard({
  producto,
  onAgregar,
}: {
  producto: ProductoParaVenta;
  onAgregar: () => void;
}) {
  return (
    <button type="button" onClick={onAgregar} className="text-left">
      <Card className="transition-shadow hover:shadow-md">
        <div className="flex h-20 items-center justify-center rounded-t-2xl bg-pastel-blue-bg">
          {producto.imagenUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={producto.imagenUrl}
              alt={producto.nombre}
              className="h-full w-full rounded-t-2xl object-cover"
            />
          ) : (
            <Package className="size-6 text-primary" />
          )}
        </div>
        <CardContent className="space-y-0.5 p-2.5">
          <p className="line-clamp-1 text-xs font-medium text-navy">{producto.nombre}</p>
          <p className="text-sm font-semibold text-navy">
            {Number(producto.precioVenta).toFixed(2)}{" "}
            <span className="text-[10px] font-normal text-text-muted">/ {producto.unidadVenta}</span>
          </p>
        </CardContent>
      </Card>
    </button>
  );
}
