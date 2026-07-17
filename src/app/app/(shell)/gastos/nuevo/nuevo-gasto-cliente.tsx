"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GastoForm } from "@/components/shared/gasto-form";
import type { GastoFormInput } from "@/modules/gastos/validation";
import {
  GestionarCategoriasGastoDialog,
  type CategoriaGasto,
  type CategoriaGastoSugerida,
} from "../gestionar-categorias-dialog";
import { crearGastoAction } from "../actions";

export function NuevoGastoCliente({
  categorias,
  proveedores,
  categoriasSugeridas,
}: {
  categorias: CategoriaGasto[];
  proveedores: { id: string; nombre: string }[];
  categoriasSugeridas: CategoriaGastoSugerida[];
}) {
  const router = useRouter();
  const [dialogoCategorias, setDialogoCategorias] = useState(false);

  async function onSubmit(values: GastoFormInput) {
    const resultado = await crearGastoAction(values);
    if (!resultado.ok) return { ok: false, error: resultado.error };
    router.push("/app/gastos");
    return { ok: true };
  }

  return (
    <>
      <GastoForm
        mode="crear"
        categorias={categorias}
        proveedores={proveedores}
        onSubmit={onSubmit}
        onCrearCategoria={() => setDialogoCategorias(true)}
      />
      <GestionarCategoriasGastoDialog
        open={dialogoCategorias}
        onOpenChange={setDialogoCategorias}
        categorias={categorias}
        categoriasSugeridas={categoriasSugeridas}
      />
    </>
  );
}
