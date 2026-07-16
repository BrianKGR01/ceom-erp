import Link from "next/link";
import { Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export interface ProductCardData {
  id: string;
  categoriaId: string | null;
  nombre: string;
  imagenUrl: string | null;
  unidadVenta: string;
  precioVenta: string;
  costoOperativoVigente: string | null;
  activo: boolean;
}

// Vista principal del catalogo (design-system.md seccion 5.3: cards antes
// que listas) — bloque de imagen o placeholder de color arriba, badge de
// estado en la esquina, nombre + precio + margen debajo.
export function ProductCard({ producto }: { producto: ProductCardData }) {
  const precio = Number(producto.precioVenta);
  const costo = producto.costoOperativoVigente !== null ? Number(producto.costoOperativoVigente) : null;
  const margenPct = costo !== null && precio > 0 ? ((precio - costo) / precio) * 100 : null;

  return (
    <Link href={`/app/productos/${producto.id}`}>
      <Card className="h-full transition-shadow hover:shadow-md">
        <div className="relative flex h-28 items-center justify-center rounded-t-2xl bg-pastel-blue-bg">
          {producto.imagenUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={producto.imagenUrl}
              alt={producto.nombre}
              className="h-full w-full rounded-t-2xl object-cover"
            />
          ) : (
            <Package className="size-8 text-primary" />
          )}
          <div className="absolute top-2 right-2">
            <Badge variant={producto.activo ? "success" : "outline"}>
              {producto.activo ? "Activo" : "Oculto"}
            </Badge>
          </div>
        </div>
        <CardContent className="space-y-1">
          <p className="line-clamp-1 text-sm font-medium text-navy">{producto.nombre}</p>
          <div className="flex items-baseline justify-between">
            <p className="text-base font-semibold text-navy">
              {precio.toFixed(2)}{" "}
              <span className="text-xs font-normal text-text-muted">/ {producto.unidadVenta}</span>
            </p>
            {margenPct !== null && (
              <span className="text-xs font-medium text-success-text">
                {margenPct.toFixed(0)}% margen
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
