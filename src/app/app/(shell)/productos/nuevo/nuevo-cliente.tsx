"use client";

import { useRouter } from "next/navigation";
import { ProductForm } from "@/components/shared/product-form";
import type { ProductoFormInput } from "@/modules/productos/validation";
import { crearProductoAction } from "../actions";

export function NuevoCliente({
  categorias,
  sucursales,
}: {
  categorias: { id: string; nombre: string }[];
  sucursales: { id: string; nombre: string }[];
}) {
  const router = useRouter();

  async function onSubmit(values: ProductoFormInput) {
    const resultado = await crearProductoAction(values);
    if (!resultado.ok) return { ok: false, error: resultado.error };
    router.push(`/app/productos/${resultado.data.productoId}`);
    return { ok: true };
  }

  return (
    <ProductForm mode="crear" categorias={categorias} sucursales={sucursales} onSubmit={onSubmit} />
  );
}
