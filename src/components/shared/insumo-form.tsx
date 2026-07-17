"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { insumoFormSchema, type InsumoFormInput } from "@/modules/operativo/nichos/nicho-1/validation";

const UNIDADES: { value: InsumoFormInput["unidadMedida"]; label: string }[] = [
  { value: "litros", label: "Litros" },
  { value: "ml", label: "Mililitros (ml)" },
  { value: "kg", label: "Kilogramos (kg)" },
  { value: "g", label: "Gramos (g)" },
  { value: "unidad", label: "Unidad" },
  { value: "metros", label: "Metros" },
];

export interface InsumoFormInitialValues {
  nombre?: string;
  unidadMedida?: InsumoFormInput["unidadMedida"];
  vidaUtilDias?: number;
  stockMinimo?: number;
}

export function InsumoForm({
  mode,
  initialValues,
  onSubmit,
}: {
  mode: "crear" | "editar";
  initialValues?: InsumoFormInitialValues;
  onSubmit: (values: InsumoFormInput) => Promise<{ ok: boolean; error?: string }>;
}) {
  const form = useForm<InsumoFormInput>({
    resolver: zodResolver(insumoFormSchema),
    defaultValues: {
      nombre: initialValues?.nombre ?? "",
      unidadMedida: initialValues?.unidadMedida ?? "kg",
      vidaUtilDias: initialValues?.vidaUtilDias,
      stockMinimo: initialValues?.stockMinimo,
    },
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(values: InsumoFormInput) {
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
      <Card>
        <CardHeader>
          <CardTitle>Datos del insumo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre del insumo</Label>
            <Input id="nombre" placeholder="Ej. Leche entera" {...form.register("nombre")} />
            {form.formState.errors.nombre && (
              <p className="text-xs text-error-text">{form.formState.errors.nombre.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="unidadMedida">Unidad de medida</Label>
            <Select
              items={Object.fromEntries(UNIDADES.map((u) => [u.value, u.label]))}
              value={form.watch("unidadMedida")}
              onValueChange={(value) =>
                value && form.setValue("unidadMedida", value as InsumoFormInput["unidadMedida"])
              }
            >
              <SelectTrigger id="unidadMedida" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNIDADES.map((unidad) => (
                  <SelectItem key={unidad.value} value={unidad.value}>
                    {unidad.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="vidaUtilDias">Vida útil en días (opcional)</Label>
              <Input
                id="vidaUtilDias"
                type="number"
                step="1"
                min="0"
                placeholder="Dejalo vacío si no vence"
                {...form.register("vidaUtilDias", {
                  setValueAs: (v) => (v === "" ? undefined : Number(v)),
                })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stockMinimo">Stock mínimo (opcional)</Label>
              <Input
                id="stockMinimo"
                type="number"
                step="0.01"
                min="0"
                placeholder="Alerta de reposición"
                {...form.register("stockMinimo", {
                  setValueAs: (v) => (v === "" ? undefined : Number(v)),
                })}
              />
            </div>
          </div>

          <p className="text-xs text-text-muted">
            El costo unitario vigente se calcula solo (promedio ponderado) cada vez que registrás
            una entrada de compra — no se edita a mano acá.
          </p>

          {error && (
            <p role="alert" className="text-xs text-error-text">
              {error}
            </p>
          )}

          <Button type="submit" disabled={guardando} className="w-full justify-center">
            {guardando ? "Guardando..." : mode === "crear" ? "Crear insumo" : "Guardar cambios"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
