"use client";

import { useRouter } from "next/navigation";
import { ActivoForm } from "@/components/shared/activo-form";
import type { ActivoFormInput } from "@/modules/patrimonio/validation";
import { crearActivoAction } from "../actions";

export function NuevoActivoCliente({
  sucursales,
  proveedores,
}: {
  sucursales: { id: string; nombre: string }[];
  proveedores: { id: string; nombre: string }[];
}) {
  const router = useRouter();

  async function onSubmit(values: ActivoFormInput) {
    const resultado = await crearActivoAction(values);
    if (!resultado.ok) return { ok: false, error: resultado.error };
    router.push(`/app/patrimonio/${resultado.data.activoId}`);
    return { ok: true };
  }

  return (
    <ActivoForm mode="crear" sucursales={sucursales} proveedores={proveedores} onSubmit={onSubmit} />
  );
}
