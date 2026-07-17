"use client";

import { useRouter } from "next/navigation";
import { InsumoForm, type InsumoFormInitialValues } from "@/components/shared/insumo-form";
import type { InsumoFormInput } from "@/modules/operativo/nichos/nicho-1/validation";
import { actualizarInsumoAction } from "../../../actions";

export function EditarInsumoCliente({
  insumoId,
  initialValues,
}: {
  insumoId: string;
  initialValues: InsumoFormInitialValues;
}) {
  const router = useRouter();

  async function onSubmit(values: InsumoFormInput) {
    const resultado = await actualizarInsumoAction(insumoId, values);
    if (!resultado.ok) return { ok: false, error: resultado.error };
    router.push(`/app/produccion/insumos/${insumoId}`);
    return { ok: true };
  }

  return <InsumoForm mode="editar" initialValues={initialValues} onSubmit={onSubmit} />;
}
