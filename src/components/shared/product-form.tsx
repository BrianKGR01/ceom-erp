"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  productoFormSchema,
  type ProductoFormInput,
} from "@/modules/productos/validation";

const UNIDADES: { value: ProductoFormInput["unidadVenta"]; label: string }[] = [
  { value: "unidad", label: "Unidad" },
  { value: "kg", label: "Kilogramo (kg)" },
  { value: "g", label: "Gramo (g)" },
  { value: "l", label: "Litro (l)" },
  { value: "ml", label: "Mililitro (ml)" },
  { value: "docena", label: "Docena" },
];

export interface ProductFormInitialValues {
  categoriaId?: string;
  nombre?: string;
  unidadVenta?: ProductoFormInput["unidadVenta"];
  precioVenta?: number;
  costoOperativoVigente?: number;
  vidaUtilDias?: number;
  activo?: boolean;
}

export function ProductForm({
  mode,
  initialValues,
  categorias,
  sucursales,
  costoBloqueado,
  onSubmit,
}: {
  mode: "crear" | "editar";
  initialValues?: ProductFormInitialValues;
  categorias: { id: string; nombre: string }[];
  sucursales: { id: string; nombre: string }[];
  /** true cuando tipoOrigenProducto === "produccion_nicho" — el costo lo
   * actualiza el Módulo Operativo, nunca se edita a mano (Modulo_02 regla 2). */
  costoBloqueado?: boolean;
  onSubmit: (values: ProductoFormInput) => Promise<{ ok: boolean; error?: string }>;
}) {
  const form = useForm<ProductoFormInput>({
    resolver: zodResolver(productoFormSchema),
    defaultValues: {
      categoriaId: initialValues?.categoriaId ?? "",
      nombre: initialValues?.nombre ?? "",
      unidadVenta: initialValues?.unidadVenta ?? "unidad",
      precioVenta: initialValues?.precioVenta,
      costoOperativoVigente: initialValues?.costoOperativoVigente,
      vidaUtilDias: initialValues?.vidaUtilDias,
      activo: initialValues?.activo ?? true,
      // Nunca undefined en el valor inicial — un Select de base-ui que
      // arranca con value=undefined queda "no controlado" y crashea si mas
      // tarde pasa a un string real (ver fix en pos-cliente.tsx).
      sucursalId: sucursales.length === 1 ? sucursales[0].id : "",
    },
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(values: ProductoFormInput) {
    setGuardando(true);
    setError(null);
    const resultado = await onSubmit(values);
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error ?? "No se pudo guardar. Intentá de nuevo.");
    }
  }

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="nombre">Nombre del producto</Label>
        <Input id="nombre" placeholder="Ej. Gelato Frutos Rojos" {...form.register("nombre")} />
        {form.formState.errors.nombre && (
          <p className="text-xs text-error-text">{form.formState.errors.nombre.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="categoriaId">Categoría (opcional)</Label>
        <Select
          items={Object.fromEntries(categorias.map((c) => [c.id, c.nombre]))}
          value={form.watch("categoriaId") ?? ""}
          onValueChange={(value) => form.setValue("categoriaId", value ?? undefined)}
        >
          <SelectTrigger id="categoriaId" className="w-full">
            <SelectValue placeholder="Sin categoría" />
          </SelectTrigger>
          <SelectContent>
            {categorias.map((categoria) => (
              <SelectItem key={categoria.id} value={categoria.id}>
                {categoria.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="precioVenta">Precio de venta</Label>
          <Input
            id="precioVenta"
            type="number"
            step="0.01"
            min="0"
            {...form.register("precioVenta", { valueAsNumber: true })}
          />
          {form.formState.errors.precioVenta && (
            <p className="text-xs text-error-text">
              {form.formState.errors.precioVenta.message}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="unidadVenta">Se vende por</Label>
          <Select
            items={Object.fromEntries(UNIDADES.map((u) => [u.value, u.label]))}
            value={form.watch("unidadVenta")}
            onValueChange={(value) =>
              value && form.setValue("unidadVenta", value as ProductoFormInput["unidadVenta"])
            }
          >
            <SelectTrigger id="unidadVenta" className="w-full">
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
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="costoOperativoVigente">
          Costo por {form.watch("unidadVenta")} (opcional)
        </Label>
        <Input
          id="costoOperativoVigente"
          type="number"
          step="0.01"
          min="0"
          disabled={costoBloqueado}
          {...form.register("costoOperativoVigente", {
            setValueAs: (v) => (v === "" ? undefined : Number(v)),
          })}
        />
        {costoBloqueado && (
          <p className="text-xs text-text-muted">
            Este costo lo actualiza tu proceso de producción, no se edita a mano acá.
          </p>
        )}
        <p className="text-xs text-text-muted">
          Nos sirve para calcularte el margen — si no lo sabés todavía, lo podés dejar en blanco.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="vidaUtilDias">Vida útil en días (opcional)</Label>
        <Input
          id="vidaUtilDias"
          type="number"
          step="1"
          min="0"
          placeholder="Ej. 7 — dejalo vacío si no vence"
          {...form.register("vidaUtilDias", {
            setValueAs: (v) => (v === "" ? undefined : Number(v)),
          })}
        />
      </div>

      {mode === "crear" && (
        <div className="space-y-3 rounded-xl border border-dashed border-gray-border p-3">
          <div className="space-y-1.5">
            <Label htmlFor="stockInicial">Stock inicial (opcional)</Label>
            <Input
              id="stockInicial"
              type="number"
              step="0.01"
              min="0"
              placeholder="¿Cuánto tenés ahora mismo?"
              {...form.register("stockInicial", {
                setValueAs: (v) => (v === "" ? undefined : Number(v)),
              })}
            />
          </div>
          {sucursales.length > 1 && (
            <div className="space-y-1.5">
              <Label htmlFor="sucursalId">Sucursal</Label>
              <Select
                items={Object.fromEntries(sucursales.map((s) => [s.id, s.nombre]))}
                value={form.watch("sucursalId")}
                onValueChange={(value) => form.setValue("sucursalId", value ?? undefined)}
              >
                <SelectTrigger id="sucursalId" className="w-full">
                  <SelectValue placeholder="Elegí una sucursal" />
                </SelectTrigger>
                <SelectContent>
                  {sucursales.map((sucursal) => (
                    <SelectItem key={sucursal.id} value={sucursal.id}>
                      {sucursal.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-text-body">
        <Checkbox
          checked={form.watch("activo")}
          onCheckedChange={(checked) => form.setValue("activo", checked === true)}
        />
        Visible para la venta
      </label>

      {error && (
        <p role="alert" className="text-xs text-error-text">
          {error}
        </p>
      )}

      <Button type="submit" disabled={guardando} className="w-full justify-center">
        {guardando ? "Guardando..." : mode === "crear" ? "Crear producto" : "Guardar cambios"}
      </Button>
    </form>
  );
}
