"use client";

import { useRouter } from "next/navigation";
import { ProductForm, type ProductFormInitialValues } from "@/components/shared/product-form";
import type { ProductoFormInput } from "@/modules/productos/validation";
import { actualizarProductoAction, subirImagenProductoAction } from "../../actions";

export function EditarCliente({
  productoId,
  initialValues,
  categorias,
  costoBloqueado,
}: {
  productoId: string;
  initialValues: ProductFormInitialValues;
  categorias: { id: string; nombre: string }[];
  costoBloqueado: boolean;
}) {
  const router = useRouter();

  async function onSubmit(values: ProductoFormInput) {
    const resultado = await actualizarProductoAction(productoId, values);
    if (!resultado.ok) return { ok: false, error: resultado.error };
    router.push(`/app/productos/${productoId}`);
    return { ok: true };
  }

  return (
    <ProductForm
      mode="editar"
      initialValues={initialValues}
      categorias={categorias}
      sucursales={[]}
      costoBloqueado={costoBloqueado}
      onSubirImagen={(file) => subirImagenProductoAction(file, productoId)}
      onSubmit={onSubmit}
    />
  );
}
