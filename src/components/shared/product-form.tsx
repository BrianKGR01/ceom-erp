"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Upload, X } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
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
  imagenUrl?: string;
  unidadVenta?: ProductoFormInput["unidadVenta"];
  precioVenta?: number;
  costoOperativoVigente?: number;
  vidaUtilDias?: number;
  fechaVencimientoReferencia?: string;
  activo?: boolean;
}

export type ResultadoSubidaImagen =
  | { ok: true; data: { url: string } }
  | { ok: false; error: string };

export function ProductForm({
  mode,
  initialValues,
  categorias,
  sucursales,
  costoBloqueado,
  onSubirImagen,
  onSubmit,
}: {
  mode: "crear" | "editar";
  initialValues?: ProductFormInitialValues;
  categorias: { id: string; nombre: string }[];
  sucursales: { id: string; nombre: string }[];
  /** true cuando tipoOrigenProducto === "produccion_nicho" — el costo lo
   * actualiza el Módulo Operativo, nunca se edita a mano (Modulo_02 regla 2). */
  costoBloqueado?: boolean;
  /** Sube la imagen a Storage y devuelve su URL pública — inyectada por el
   * caller (nuevo-cliente.tsx/editar-cliente.tsx) en vez de importarse acá
   * directo, para que este componente compartido no dependa de la Server
   * Action de una ruta puntual (docs/dev-practices/dev-practices.md §9). */
  onSubirImagen: (file: File) => Promise<ResultadoSubidaImagen>;
  onSubmit: (values: ProductoFormInput) => Promise<{ ok: boolean; error?: string }>;
}) {
  const form = useForm<ProductoFormInput>({
    resolver: zodResolver(productoFormSchema),
    defaultValues: {
      categoriaId: initialValues?.categoriaId ?? "",
      nombre: initialValues?.nombre ?? "",
      imagenUrl: initialValues?.imagenUrl,
      unidadVenta: initialValues?.unidadVenta ?? "unidad",
      precioVenta: initialValues?.precioVenta,
      costoOperativoVigente: initialValues?.costoOperativoVigente,
      vidaUtilDias: initialValues?.vidaUtilDias,
      fechaVencimientoReferencia: initialValues?.fechaVencimientoReferencia ?? "",
      activo: initialValues?.activo ?? true,
      // Nunca undefined en el valor inicial — un Select de base-ui que
      // arranca con value=undefined queda "no controlado" y crashea si mas
      // tarde pasa a un string real (ver fix en pos-cliente.tsx).
      sucursalId: sucursales.length === 1 ? sucursales[0].id : "",
    },
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Imagen del producto: se sube a Storage apenas se elige (onSubirImagen),
  // no recien al guardar el formulario — mismo criterio que el logo del
  // negocio (Onboarding Paso 1).
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagenPreview, setImagenPreview] = useState<string | null>(initialValues?.imagenUrl ?? null);
  const [imagenError, setImagenError] = useState<string | null>(null);
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);

  async function elegirImagen(file: File) {
    setImagenError(null);
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setImagenError("Solo se aceptan imágenes PNG o JPG.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImagenError("La imagen no puede pesar más de 5MB.");
      return;
    }

    const preview = URL.createObjectURL(file);
    setSubiendoImagen(true);
    setImagenPreview(preview);
    const resultado = await onSubirImagen(file);
    setSubiendoImagen(false);
    URL.revokeObjectURL(preview);

    if (!resultado.ok) {
      setImagenError(resultado.error);
      setImagenPreview(initialValues?.imagenUrl ?? null);
      return;
    }
    form.setValue("imagenUrl", resultado.data.url);
    setImagenPreview(resultado.data.url);
  }

  function quitarImagen() {
    form.setValue("imagenUrl", undefined);
    setImagenPreview(null);
  }

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
    <form onSubmit={form.handleSubmit(handleSubmit)} className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Información básica</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nombre">Nombre del producto</Label>
              <Input id="nombre" placeholder="Ej. Gelato Frutos Rojos" {...form.register("nombre")} />
              {form.formState.errors.nombre && (
                <p className="text-xs text-error-text">{form.formState.errors.nombre.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Precios y costos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-4">
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
              </div>
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
            </div>
            {costoBloqueado && (
              <p className="text-xs text-text-muted">
                Este costo lo actualiza tu proceso de producción, no se edita a mano acá.
              </p>
            )}
            <p className="text-xs text-text-muted">
              El costo nos sirve para calcularte el margen — si no lo sabés todavía, lo podés
              dejar en blanco.
            </p>
          </CardContent>
        </Card>

        {mode === "crear" && (
          <Card>
            <CardHeader>
              <CardTitle>Stock inicial (opcional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="stockInicial">¿Cuánto tenés ahora mismo?</Label>
                <Input
                  id="stockInicial"
                  type="number"
                  step="0.01"
                  min="0"
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
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Imagen del producto</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setArrastrando(true);
              }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={(e) => {
                e.preventDefault();
                setArrastrando(false);
                const file = e.dataTransfer.files?.[0];
                if (file) elegirImagen(file);
              }}
              onClick={() => !subiendoImagen && fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-disabled={subiendoImagen}
              className={cn(
                "flex min-h-40 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed p-5 text-center transition-colors",
                subiendoImagen && "pointer-events-none opacity-60",
                arrastrando ? "border-primary bg-pastel-blue-bg" : "border-gray-border hover:border-primary/50"
              )}
            >
              {imagenPreview ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagenPreview}
                    alt="Imagen del producto"
                    className="size-28 rounded-lg object-cover"
                  />
                  {!subiendoImagen && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        quitarImagen();
                      }}
                      aria-label="Quitar imagen"
                      className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-error-text text-white"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                  {subiendoImagen && (
                    <p className="mt-1.5 text-[11px] text-text-muted">Subiendo...</p>
                  )}
                </div>
              ) : (
                <>
                  <Upload className="size-5 text-text-muted" />
                  <p className="text-xs text-text-body">
                    Arrastrá una imagen acá o{" "}
                    <span className="font-medium text-primary">explorá tus archivos</span>
                  </p>
                  <p className="text-[11px] text-text-muted">PNG o JPG, máximo 5MB</p>
                </>
              )}
            </div>
            {imagenError && <p className="mt-1.5 text-xs text-error-text">{imagenError}</p>}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) elegirImagen(file);
                e.target.value = "";
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Control y estado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm text-text-body">
                Visible para la venta
                <span className="block text-xs text-text-muted">
                  Si lo apagás, se oculta del catálogo sin borrarlo.
                </span>
              </span>
              <Switch
                checked={form.watch("activo")}
                onCheckedChange={(checked) => form.setValue("activo", checked)}
              />
            </label>

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

            <div className="space-y-1.5">
              <Label htmlFor="fechaVencimientoReferencia">
                Fecha de vencimiento (lote inicial, opcional)
              </Label>
              <Input
                id="fechaVencimientoReferencia"
                type="date"
                {...form.register("fechaVencimientoReferencia")}
              />
              <p className="text-xs text-text-muted">
                Solo de referencia para este primer lote — no se recalcula solo.
              </p>
            </div>
          </CardContent>
        </Card>

        {error && (
          <p role="alert" className="text-xs text-error-text">
            {error}
          </p>
        )}

        <Button type="submit" disabled={guardando} className="w-full justify-center">
          {guardando ? "Guardando..." : mode === "crear" ? "Crear producto" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
