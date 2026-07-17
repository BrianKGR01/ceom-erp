"use client";

import { useRouter } from "next/navigation";
import { GastoForm, type GastoFormInitialValues } from "@/components/shared/gasto-form";
import type { GastoFormInput } from "@/modules/gastos/validation";
import { actualizarGastoAction } from "../../actions";

export function EditarGastoCliente({
  gastoId,
  categorias,
  proveedores,
  initialValues,
}: {
  gastoId: string;
  categorias: { id: string; nombre: string }[];
  proveedores: { id: string; nombre: string }[];
  initialValues: GastoFormInitialValues;
}) {
  const router = useRouter();

  async function onSubmit(values: GastoFormInput) {
    const resultado = await actualizarGastoAction(gastoId, values);
    if (!resultado.ok) return { ok: false, error: resultado.error };
    router.push(`/app/gastos/${gastoId}`);
    return { ok: true };
  }

  return (
    <GastoForm
      mode="editar"
      categorias={categorias}
      proveedores={proveedores}
      initialValues={initialValues}
      onSubmit={onSubmit}
    />
  );
}
