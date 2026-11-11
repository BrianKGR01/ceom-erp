"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ProductCard, type ProductCardData } from "@/modules/productos/components/product-card";

export function CatalogoCliente({
  productos,
  categorias,
}: {
  productos: ProductCardData[];
  categorias: { id: string; nombre: string }[];
}) {
  const [categoriaId, setCategoriaId] = useState<string>("todas");
  const [busqueda, setBusqueda] = useState("");
  const categoriaPorId = new Map(categorias.map((c) => [c.id, c.nombre]));
  // Una categoria sin ningun producto en esta pantalla seria un boton que al tocarlo deja la
  // lista vacia — "el filtro no funciona". Se muestra solo lo que de verdad filtra algo.
  const categoriasConProductos = new Set(
    productos.map((p) => p.categoriaId).filter((id): id is string => Boolean(id))
  );
  const categoriasFiltrables = categorias.filter((c) => categoriasConProductos.has(c.id));

  const filtrados = productos
    .filter((p) => categoriaId === "todas" || p.categoriaId === categoriaId)
    .filter((p) => p.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {categoriasFiltrables.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCategoriaId("todas")}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                categoriaId === "todas"
                  ? "bg-primary text-white"
                  : "bg-pastel-blue-bg text-text-body hover:bg-pastel-blue-bg/70"
              )}
            >
              Todas
            </button>
            {categoriasFiltrables.map((categoria) => (
              <button
                key={categoria.id}
                type="button"
                onClick={() => setCategoriaId(categoria.id)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                  categoriaId === categoria.id
                    ? "bg-primary text-white"
                    : "bg-pastel-blue-bg text-text-body hover:bg-pastel-blue-bg/70"
                )}
              >
                {categoria.nombre}
              </button>
            ))}
          </div>
        )}

        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-muted" />
          <Input
            placeholder="Buscar por nombre..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {filtrados.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-muted">
          Ningún producto coincide con esta búsqueda.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtrados.map((producto) => (
            <ProductCard
              key={producto.id}
              producto={producto}
              categoriaNombre={producto.categoriaId ? categoriaPorId.get(producto.categoriaId) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
