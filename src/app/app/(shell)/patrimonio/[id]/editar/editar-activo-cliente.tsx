"use client";

import { useRouter } from "next/navigation";
import { ActivoForm, type ActivoFormInitialValues } from "@/components/shared/activo-form";
import type { ActivoFormInput } from "@/modules/patrimonio/validation";
import { actualizarActivoAction } from "../../actions";

export function EditarActivoCliente({
  activoId,
  initialValues,
  sucursales,
  proveedores,
}: {
  activoId: string;
  initialValues: ActivoFormInitialValues;
  sucursales: { id: string; nombre: string }[];
  proveedores: { id: string; nombre: string }[];
}) {
  const router = useRouter();

  async function onSubmit(values: ActivoFormInput) {
    const resultado = await actualizarActivoAction(activoId, values);
    if (!resultado.ok) return { ok: false, error: resultado.error };
    router.push(`/app/patrimonio/${activoId}`);
    return { ok: true };
  }

  return (
    <ActivoForm
      mode="editar"
      initialValues={initialValues}
      sucursales={sucursales}
      proveedores={proveedores}
      onSubmit={onSubmit}
    />
  );
}
