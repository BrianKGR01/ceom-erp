"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProductCard, type ProductCardData } from "@/modules/productos/components/product-card";

export function CatalogoCliente({
  productos,
  categorias,
}: {
  productos: ProductCardData[];
  categorias: { id: string; nombre: string }[];
}) {
  const [categoriaId, setCategoriaId] = useState<string>("todas");

  const filtrados =
    categoriaId === "todas"
      ? productos
      : productos.filter((p) => p.categoriaId === categoriaId);

  return (
    <div className="space-y-4">
      {categorias.length > 0 && (
        <Select
          items={{
            todas: "Todas las categorías",
            ...Object.fromEntries(categorias.map((c) => [c.id, c.nombre])),
          }}
          value={categoriaId}
          onValueChange={(value) => setCategoriaId(value ?? "todas")}
        >
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las categorías</SelectItem>
            {categorias.map((categoria) => (
              <SelectItem key={categoria.id} value={categoria.id}>
                {categoria.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {filtrados.map((producto) => (
          <ProductCard key={producto.id} producto={producto} />
        ))}
      </div>
    </div>
  );
}
