"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Armchair, Boxes, Info, Settings2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  pasivoFormSchema,
  type PasivoFormInput,
} from "@/modules/patrimonio/validation";

type TipoActivo = "equipo_productivo" | "mobiliario" | "vehiculo" | "otro";

const ICONO_TIPO: Record<TipoActivo, typeof Settings2> = {
  equipo_productivo: Settings2,
  mobiliario: Armchair,
  vehiculo: Truck,
  otro: Boxes,
};

const LABEL_TIPO: Record<TipoActivo, string> = {
  equipo_productivo: "Equipo productivo",
  mobiliario: "Mobiliario",
  vehiculo: "Vehículo",
  otro: "Otro",
};

const FRECUENCIAS: { value: PasivoFormInput["frecuenciaCuota"]; label: string }[] = [
  { value: "mensual", label: "Mensual" },
  { value: "semanal", label: "Semanal" },
  { value: "quincenal", label: "Quincenal" },
  { value: "anual", label: "Anual" },
];

export interface ActivoSeleccionable {
  id: string;
  nombre: string;
  tipo: TipoActivo;
}

export interface PasivoFormInitialValues {
  activoId?: string;
  montoTotal?: number;
  cuotaPeriodica?: number;
  frecuenciaCuota?: PasivoFormInput["frecuenciaCuota"];
  plazoCuotas?: number;
  fechaInicio?: string;
}

export function PasivoForm({
  mode,
  initialValues,
  activos,
  onSubmit,
}: {
  mode: "crear" | "refinanciar";
  initialValues?: PasivoFormInitialValues;
  activos: ActivoSeleccionable[];
  onSubmit: (values: PasivoFormInput) => Promise<{ ok: boolean; error?: string }>;
}) {
  const form = useForm<PasivoFormInput>({
    resolver: zodResolver(pasivoFormSchema),
    defaultValues: {
      activoId: initialValues?.activoId ?? "",
      montoTotal: initialValues?.montoTotal,
      cuotaPeriodica: initialValues?.cuotaPeriodica,
      frecuenciaCuota: initialValues?.frecuenciaCuota ?? "mensual",
      plazoCuotas: initialValues?.plazoCuotas,
      fechaInicio: initialValues?.fechaInicio ?? "",
    },
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activoIdElegido = form.watch("activoId");

  async function handleSubmit(values: PasivoFormInput) {
    setGuardando(true);
    setError(null);
    const resultado = await onSubmit(values);
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error ?? "No se pudo guardar. Intentá de nuevo.");
    }
  }

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="mx-auto max-w-2xl space-y-4">
      {mode === "refinanciar" && (
        <div className="flex items-start gap-2 rounded-xl bg-pastel-blue-bg p-3 text-sm text-primary">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p>
            Refinanciación en curso: al guardar, el pasivo anterior se marca como{" "}
            <span className="font-medium">refinanciado</span> — nunca se edita el original.
          </p>
        </div>
      )}

      <div className="rounded-2xl bg-card p-6 shadow-card">
        <div className="space-y-3">
          <Label>Activo relacionado (opcional)</Label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => form.setValue("activoId", "")}
              className={cn(
                "relative flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-colors",
                !activoIdElegido
                  ? "border-primary bg-pastel-blue-bg"
                  : "border-gray-border hover:border-primary/50"
              )}
            >
              <span className="flex size-8 items-center justify-center rounded-lg bg-pastel-blue-bg text-primary">
                <Boxes className="size-4" />
              </span>
              <span className="text-xs font-medium text-navy">Sin activo relacionado</span>
            </button>
            {activos.map((activo) => {
              const Icono = ICONO_TIPO[activo.tipo];
              const elegido = activoIdElegido === activo.id;
              return (
                <button
                  key={activo.id}
                  type="button"
                  onClick={() => form.setValue("activoId", activo.id)}
                  className={cn(
                    "relative flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-colors",
                    elegido ? "border-primary bg-pastel-blue-bg" : "border-gray-border hover:border-primary/50"
                  )}
                >
                  {elegido && (
                    <span className="absolute -top-2 right-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-white">
                      Seleccionado
                    </span>
                  )}
                  <span className="flex size-8 items-center justify-center rounded-lg bg-pastel-blue-bg text-primary">
                    <Icono className="size-4" />
                  </span>
                  <span className="text-xs font-medium text-navy">{activo.nombre}</span>
                  <span className="text-[11px] text-text-muted">{LABEL_TIPO[activo.tipo]}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-gray-border pt-5">
          <div className="space-y-1.5">
            <Label htmlFor="montoTotal">Monto total</Label>
            <Input
              id="montoTotal"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              {...form.register("montoTotal", { valueAsNumber: true })}
            />
            {form.formState.errors.montoTotal && (
              <p className="text-xs text-error-text">{form.formState.errors.montoTotal.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fechaInicio">Fecha de inicio</Label>
            <Input id="fechaInicio" type="date" {...form.register("fechaInicio")} />
            {form.formState.errors.fechaInicio && (
              <p className="text-xs text-error-text">{form.formState.errors.fechaInicio.message}</p>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="cuotaPeriodica">Cuota periódica</Label>
            <Input
              id="cuotaPeriodica"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              {...form.register("cuotaPeriodica", { valueAsNumber: true })}
            />
            {form.formState.errors.cuotaPeriodica && (
              <p className="text-xs text-error-text">{form.formState.errors.cuotaPeriodica.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="frecuenciaCuota">Frecuencia</Label>
            <Select
              items={Object.fromEntries(FRECUENCIAS.map((f) => [f.value, f.label]))}
              value={form.watch("frecuenciaCuota")}
              onValueChange={(value) =>
                value && form.setValue("frecuenciaCuota", value as PasivoFormInput["frecuenciaCuota"])
              }
            >
              <SelectTrigger id="frecuenciaCuota" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FRECUENCIAS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-4 w-1/2 pr-2 space-y-1.5">
          <Label htmlFor="plazoCuotas">Plazo (cuotas)</Label>
          <Input
            id="plazoCuotas"
            type="number"
            step="1"
            min="1"
            placeholder="Ej. 12"
            {...form.register("plazoCuotas", { valueAsNumber: true })}
          />
          {form.formState.errors.plazoCuotas && (
            <p className="text-xs text-error-text">{form.formState.errors.plazoCuotas.message}</p>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-4 text-xs text-error-text">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2 border-t border-gray-border pt-4">
          <Button type="submit" disabled={guardando}>
            {guardando ? "Guardando..." : mode === "crear" ? "Guardar pasivo" : "Confirmar refinanciación"}
          </Button>
        </div>
      </div>
    </form>
  );
}
