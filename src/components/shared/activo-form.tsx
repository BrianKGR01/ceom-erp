"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import {
  activoFormSchema,
  type ActivoFormInput,
} from "@/modules/patrimonio/validation";

const TIPOS: { value: ActivoFormInput["tipo"]; label: string }[] = [
  { value: "equipo_productivo", label: "Equipo productivo" },
  { value: "mobiliario", label: "Mobiliario" },
  { value: "vehiculo", label: "Vehículo" },
  { value: "otro", label: "Otro" },
];

export interface ActivoFormInitialValues {
  nombre?: string;
  tipo?: ActivoFormInput["tipo"];
  sucursalId?: string;
  valorCompra?: number;
  fechaAdquisicion?: string;
  vidaUtilMeses?: number;
  proveedorId?: string;
  numeroSerie?: string;
  vencimientoGarantia?: string;
  capacidadProduccionCantidad?: number;
  capacidadProduccionUnidad?: string;
  capacidadAlmacenamientoCantidad?: number;
  capacidadAlmacenamientoUnidad?: string;
}

export function ActivoForm({
  mode,
  initialValues,
  sucursales,
  proveedores,
  onSubmit,
}: {
  mode: "crear" | "editar";
  initialValues?: ActivoFormInitialValues;
  sucursales: { id: string; nombre: string }[];
  proveedores: { id: string; nombre: string }[];
  onSubmit: (values: ActivoFormInput) => Promise<{ ok: boolean; error?: string }>;
}) {
  const form = useForm<ActivoFormInput>({
    resolver: zodResolver(activoFormSchema),
    defaultValues: {
      nombre: initialValues?.nombre ?? "",
      tipo: initialValues?.tipo ?? "equipo_productivo",
      sucursalId: initialValues?.sucursalId ?? "",
      valorCompra: initialValues?.valorCompra,
      fechaAdquisicion: initialValues?.fechaAdquisicion ?? "",
      vidaUtilMeses: initialValues?.vidaUtilMeses,
      proveedorId: initialValues?.proveedorId ?? "",
      numeroSerie: initialValues?.numeroSerie ?? "",
      vencimientoGarantia: initialValues?.vencimientoGarantia ?? "",
      capacidadProduccionCantidad: initialValues?.capacidadProduccionCantidad,
      capacidadProduccionUnidad: initialValues?.capacidadProduccionUnidad ?? "",
      capacidadAlmacenamientoCantidad: initialValues?.capacidadAlmacenamientoCantidad,
      capacidadAlmacenamientoUnidad: initialValues?.capacidadAlmacenamientoUnidad ?? "",
    },
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(values: ActivoFormInput) {
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
      <div className="rounded-2xl bg-card p-6 shadow-card">
        <div className="space-y-4 border-b border-gray-border pb-6">
          <h2 className="font-heading text-base font-semibold text-navy">Datos principales</h2>

          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre del activo</Label>
            <Input id="nombre" placeholder="Ej. Horno Industrial Modelo X" {...form.register("nombre")} />
            {form.formState.errors.nombre && (
              <p className="text-xs text-error-text">{form.formState.errors.nombre.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="tipo">Categoría</Label>
              <Select
                items={Object.fromEntries(TIPOS.map((t) => [t.value, t.label]))}
                value={form.watch("tipo")}
                onValueChange={(value) => value && form.setValue("tipo", value as ActivoFormInput["tipo"])}
              >
                <SelectTrigger id="tipo" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sucursalId">Sucursal (opcional)</Label>
              <Select
                items={Object.fromEntries(sucursales.map((s) => [s.id, s.nombre]))}
                value={form.watch("sucursalId") ?? ""}
                onValueChange={(value) => form.setValue("sucursalId", value ?? undefined)}
              >
                <SelectTrigger id="sucursalId" className="w-full">
                  <SelectValue placeholder="Todo el negocio" />
                </SelectTrigger>
                <SelectContent>
                  {sucursales.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="space-y-4 border-b border-gray-border py-6">
          <h2 className="font-heading text-base font-semibold text-navy">
            Detalles de adquisición y operación
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="valorCompra">Valor de adquisición</Label>
              <Input
                id="valorCompra"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                {...form.register("valorCompra", { valueAsNumber: true })}
              />
              {form.formState.errors.valorCompra && (
                <p className="text-xs text-error-text">{form.formState.errors.valorCompra.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fechaAdquisicion">Fecha de adquisición</Label>
              <Input id="fechaAdquisicion" type="date" {...form.register("fechaAdquisicion")} />
              {form.formState.errors.fechaAdquisicion && (
                <p className="text-xs text-error-text">{form.formState.errors.fechaAdquisicion.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="vidaUtilMeses">Vida útil en meses (opcional)</Label>
              <Input
                id="vidaUtilMeses"
                type="number"
                step="1"
                min="0"
                placeholder="Dejalo vacío si no deprecia"
                {...form.register("vidaUtilMeses", {
                  setValueAs: (v) => (v === "" ? undefined : Number(v)),
                })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proveedorId">Proveedor (opcional)</Label>
              <Select
                items={Object.fromEntries(proveedores.map((p) => [p.id, p.nombre]))}
                value={form.watch("proveedorId") ?? ""}
                onValueChange={(value) => form.setValue("proveedorId", value ?? undefined)}
              >
                <SelectTrigger id="proveedorId" className="w-full">
                  <SelectValue placeholder="Sin proveedor" />
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="numeroSerie">Número de serie (opcional)</Label>
              <Input id="numeroSerie" {...form.register("numeroSerie")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vencimientoGarantia">Vencimiento de garantía (opcional)</Label>
              <Input id="vencimientoGarantia" type="date" {...form.register("vencimientoGarantia")} />
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-6">
          <div>
            <h2 className="font-heading text-base font-semibold text-navy">Capacidad (opcional)</h2>
            <p className="text-xs text-text-muted">
              Solo de referencia — Patrimonio no calcula uso ni alertas de capacidad.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="capacidadProduccionCantidad">Capacidad de producción</Label>
              <Input
                id="capacidadProduccionCantidad"
                type="number"
                step="0.01"
                min="0"
                placeholder="Ej. 7"
                {...form.register("capacidadProduccionCantidad", {
                  setValueAs: (v) => (v === "" ? undefined : Number(v)),
                })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="capacidadProduccionUnidad">Unidad</Label>
              <Input
                id="capacidadProduccionUnidad"
                placeholder="Ej. litros por lote"
                {...form.register("capacidadProduccionUnidad")}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="capacidadAlmacenamientoCantidad">Capacidad de almacenamiento</Label>
              <Input
                id="capacidadAlmacenamientoCantidad"
                type="number"
                step="0.01"
                min="0"
                placeholder="Ej. 200"
                {...form.register("capacidadAlmacenamientoCantidad", {
                  setValueAs: (v) => (v === "" ? undefined : Number(v)),
                })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="capacidadAlmacenamientoUnidad">Unidad</Label>
              <Input
                id="capacidadAlmacenamientoUnidad"
                placeholder="Ej. kg"
                {...form.register("capacidadAlmacenamientoUnidad")}
              />
            </div>
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 text-xs text-error-text">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2 border-t border-gray-border pt-4">
          <Button type="submit" disabled={guardando}>
            {guardando ? "Guardando..." : mode === "crear" ? "Guardar activo" : "Guardar cambios"}
          </Button>
        </div>
      </div>
    </form>
  );
}
