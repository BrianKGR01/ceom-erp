"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OptionCard } from "@/components/ui/option-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { gastoFormSchema, type GastoFormInput } from "@/modules/gastos/validation";

const TIPOS: { value: GastoFormInput["tipo"]; label: string; descripcion: string }[] = [
  { value: "fijo", label: "Fijo", descripcion: "Costos recurrentes (alquiler, servicios, sueldos)." },
  { value: "variable_no_productivo", label: "Var. No Productivo", descripcion: "Insumos de oficina, limpieza, viáticos." },
  { value: "unico", label: "Único", descripcion: "Inversiones, reparaciones excepcionales o multas." },
];

export interface GastoFormInitialValues {
  sucursalId?: string;
  tipo?: GastoFormInput["tipo"];
  categoriaId?: string;
  monto?: number;
  fechaGasto?: string;
  proveedorId?: string;
  descripcion?: string;
}

export function GastoForm({
  mode,
  initialValues,
  categorias,
  proveedores,
  onSubmit,
  onCrearCategoria,
}: {
  mode: "crear" | "editar";
  initialValues?: GastoFormInitialValues;
  categorias: { id: string; nombre: string }[];
  proveedores: { id: string; nombre: string }[];
  onSubmit: (values: GastoFormInput) => Promise<{ ok: boolean; error?: string }>;
  onCrearCategoria?: () => void;
}) {
  const form = useForm<GastoFormInput>({
    resolver: zodResolver(gastoFormSchema),
    defaultValues: {
      sucursalId: initialValues?.sucursalId ?? "",
      tipo: initialValues?.tipo ?? "fijo",
      categoriaId: initialValues?.categoriaId ?? "",
      monto: initialValues?.monto,
      fechaGasto: initialValues?.fechaGasto ?? "",
      proveedorId: initialValues?.proveedorId ?? "",
      descripcion: initialValues?.descripcion ?? "",
    },
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tipo = form.watch("tipo");

  async function handleSubmit(values: GastoFormInput) {
    setGuardando(true);
    setError(null);
    const resultado = await onSubmit(values);
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error ?? "No se pudo guardar. Intentá de nuevo.");
    }
  }

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="mx-auto max-w-2xl">
      <div className="space-y-5 rounded-2xl bg-card p-6 shadow-card">
        <div className="space-y-1.5">
          <Label>Tipo de Gasto</Label>
          <div className="grid grid-cols-3 gap-2">
            {TIPOS.map((t) => (
              <OptionCard
                key={t.value}
                selected={tipo === t.value}
                disabled={mode === "editar"}
                onSelect={() => form.setValue("tipo", t.value)}
                label={t.label}
                description={t.descripcion}
              />
            ))}
          </div>
          {mode === "editar" && (
            <p className="text-xs text-text-muted">El tipo de gasto no se puede cambiar después de creado.</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="categoriaId">Categoría</Label>
              {onCrearCategoria && (
                <button
                  type="button"
                  onClick={onCrearCategoria}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  + Crear nueva
                </button>
              )}
            </div>
            <Select
              items={Object.fromEntries(categorias.map((c) => [c.id, c.nombre]))}
              value={form.watch("categoriaId")}
              onValueChange={(value) => value && form.setValue("categoriaId", value)}
            >
              <SelectTrigger id="categoriaId" className="w-full">
                <SelectValue placeholder="Selecciona una categoría" />
              </SelectTrigger>
              <SelectContent>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.categoriaId && (
              <p className="text-xs text-error-text">{form.formState.errors.categoriaId.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="monto">Monto del gasto</Label>
            <Input
              id="monto"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              {...form.register("monto", { valueAsNumber: true })}
            />
            {form.formState.errors.monto && (
              <p className="text-xs text-error-text">{form.formState.errors.monto.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="fechaGasto">Fecha</Label>
            <Input id="fechaGasto" type="date" {...form.register("fechaGasto")} />
            {form.formState.errors.fechaGasto && (
              <p className="text-xs text-error-text">{form.formState.errors.fechaGasto.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="proveedorId">Proveedor (opcional)</Label>
            <Select
              items={Object.fromEntries(proveedores.map((p) => [p.id, p.nombre]))}
              value={form.watch("proveedorId") ?? ""}
              onValueChange={(value) => form.setValue("proveedorId", value ?? undefined)}
            >
              <SelectTrigger id="proveedorId" className="w-full">
                <SelectValue placeholder="Sin proveedor asignado" />
              </SelectTrigger>
              <SelectContent>
                {proveedores.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="descripcion">Descripción o notas (opcional)</Label>
          <Textarea
            id="descripcion"
            placeholder="Añadí detalles relevantes sobre este gasto..."
            {...form.register("descripcion")}
          />
        </div>

        {error && (
          <p role="alert" className="text-xs text-error-text">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-gray-border pt-4">
          <Button type="submit" disabled={guardando}>
            {guardando ? "Guardando..." : mode === "crear" ? "Guardar gasto" : "Guardar cambios"}
          </Button>
        </div>
      </div>
    </form>
  );
}
