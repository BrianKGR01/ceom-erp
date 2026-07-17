"use client";

import { useRouter } from "next/navigation";
import {
  PasivoForm,
  type ActivoSeleccionable,
  type PasivoFormInitialValues,
} from "@/components/shared/pasivo-form";
import type { PasivoFormInput } from "@/modules/patrimonio/validation";
import { refinanciarPasivoAction } from "../../../actions";

export function RefinanciarPasivoCliente({
  pasivoAnteriorId,
  activos,
  initialValues,
}: {
  pasivoAnteriorId: string;
  activos: ActivoSeleccionable[];
  initialValues: PasivoFormInitialValues;
}) {
  const router = useRouter();

  async function onSubmit(values: PasivoFormInput) {
    const resultado = await refinanciarPasivoAction(pasivoAnteriorId, values);
    if (!resultado.ok) return { ok: false, error: resultado.error };
    router.push(`/app/patrimonio/pasivos/${resultado.data.pasivoId}`);
    return { ok: true };
  }

  return (
    <PasivoForm
      mode="refinanciar"
      initialValues={initialValues}
      activos={activos}
      onSubmit={onSubmit}
    />
  );
}
