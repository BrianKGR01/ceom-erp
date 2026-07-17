"use client";

import { useRouter } from "next/navigation";
import { PasivoForm, type ActivoSeleccionable } from "@/components/shared/pasivo-form";
import type { PasivoFormInput } from "@/modules/patrimonio/validation";
import { crearPasivoAction } from "../../actions";

export function NuevoPasivoCliente({ activos }: { activos: ActivoSeleccionable[] }) {
  const router = useRouter();

  async function onSubmit(values: PasivoFormInput) {
    const resultado = await crearPasivoAction(values);
    if (!resultado.ok) return { ok: false, error: resultado.error };
    router.push(`/app/patrimonio/pasivos/${resultado.data.pasivoId}`);
    return { ok: true };
  }

  return <PasivoForm mode="crear" activos={activos} onSubmit={onSubmit} />;
}
