"use client";

import { useRouter } from "next/navigation";
import { InsumoForm } from "@/components/shared/insumo-form";
import type { InsumoFormInput } from "@/modules/operativo/nichos/nicho-1/validation";
import { crearInsumoAction } from "../../actions";

export function NuevoInsumoCliente() {
  const router = useRouter();

  async function onSubmit(values: InsumoFormInput) {
    const resultado = await crearInsumoAction(values);
    if (!resultado.ok) return { ok: false, error: resultado.error };
    router.push(`/app/produccion/insumos/${resultado.data.insumoId}`);
    return { ok: true };
  }

  return <InsumoForm mode="crear" onSubmit={onSubmit} />;
}
