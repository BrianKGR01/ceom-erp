"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MessageCircle, Share2, Store, Tent, Upload, X } from "lucide-react";
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
  actualizarTenantSchema,
  type ActualizarTenantInput,
} from "@/modules/identidad/validation";
import { guardarNegocio, subirLogoAction } from "@/app/app/onboarding/actions";

// Extraido de onboarding-wizard.tsx (decision 3 del refactor de Fase A):
// desacoplado del wizard para que sea usable fuera de el, sin cambiar su
// comportamiento. La pantalla de edicion dedicada que lo consuma (en vez
// de reabrir el wizard completo para un Owner que solo quiere corregir un
// dato) es Fase C — este cambio solo mueve el componente, no agrega un
// consumidor nuevo todavia.
const CANALES_SUGERIDOS = [
  { value: "redes_sociales", label: "Redes sociales", icono: Share2 },
  { value: "feria", label: "Feria / pop-up", icono: Tent },
  { value: "local_fisico", label: "Local físico", icono: Store },
  { value: "boca_a_boca", label: "Boca a boca", icono: MessageCircle },
];

const MONEDAS = [
  { value: "BOB", label: "Boliviano (BOB)" },
  { value: "USD", label: "Dólar estadounidense (USD)" },
  { value: "ARS", label: "Peso argentino (ARS)" },
  { value: "PEN", label: "Sol peruano (PEN)" },
  { value: "CLP", label: "Peso chileno (CLP)" },
  { value: "COP", label: "Peso colombiano (COP)" },
  { value: "MXN", label: "Peso mexicano (MXN)" },
  { value: "EUR", label: "Euro (EUR)" },
];

export interface TenantActual {
  nombreNegocio: string;
  ciudadBase: string | null;
  monedaPrincipal: string;
  canalesVenta: string[];
  nichoId: "nicho_1" | "nicho_4" | null;
  logoUrl: string | null;
}

export function PasoNegocio({
  tenant,
  onGuardado,
}: {
  tenant: TenantActual;
  onGuardado: () => void;
}) {
  const form = useForm<ActualizarTenantInput>({
    resolver: zodResolver(actualizarTenantSchema),
    defaultValues: {
      nombreNegocio: tenant.nombreNegocio,
      ciudadBase: tenant.ciudadBase ?? "",
      monedaPrincipal: tenant.monedaPrincipal,
      canalesVenta: tenant.canalesVenta,
      logoUrl: tenant.logoUrl ?? undefined,
    },
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canales = form.watch("canalesVenta");
  const moneda = form.watch("monedaPrincipal");

  function alternarCanal(value: string) {
    const actuales = form.getValues("canalesVenta");
    form.setValue(
      "canalesVenta",
      actuales.includes(value) ? actuales.filter((c) => c !== value) : [...actuales, value]
    );
  }

  // --- Logo: se sube a Storage apenas se elige (subirLogoAction), no
  // recien al guardar el formulario — asi el preview que se muestra ya es
  // la URL real persistida, no un blob local. "Guardar y continuar" manda
  // logoUrl como un campo mas del formulario, no una llamada aparte.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(tenant.logoUrl);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);

  async function elegirLogo(file: File) {
    setLogoError(null);
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setLogoError("Solo se aceptan imágenes PNG o JPG.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError("La imagen no puede pesar más de 2MB.");
      return;
    }

    const preview = URL.createObjectURL(file);
    const dimensionesOk = await new Promise<boolean>((resolve) => {
      const img = new window.Image();
      img.onload = () => resolve(img.width >= 512 && img.height >= 512);
      img.src = preview;
    });
    if (!dimensionesOk) {
      setLogoError("La imagen tiene que ser de al menos 512×512px.");
      URL.revokeObjectURL(preview);
      return;
    }

    setSubiendoLogo(true);
    setLogoPreview(preview);
    const resultado = await subirLogoAction(file);
    setSubiendoLogo(false);
    URL.revokeObjectURL(preview);

    if (!resultado.ok) {
      setLogoError(resultado.error);
      setLogoPreview(tenant.logoUrl);
      return;
    }
    form.setValue("logoUrl", resultado.data.url);
    setLogoPreview(resultado.data.url);
  }

  function quitarLogo() {
    form.setValue("logoUrl", undefined);
    setLogoPreview(null);
  }

  async function onSubmit(values: ActualizarTenantInput) {
    setGuardando(true);
    setError(null);
    const resultado = await guardarNegocio(values);
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    onGuardado();
  }

  return (
    <div>
      <h2 className="font-heading text-lg font-semibold text-navy">Contanos de tu negocio</h2>
      <p className="mt-1 text-sm text-text-muted">Esto lo podés cambiar cuando quieras desde tu panel.</p>

      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="nombreNegocio">Nombre de tu negocio</Label>
            <Input id="nombreNegocio" {...form.register("nombreNegocio")} />
            {form.formState.errors.nombreNegocio && (
              <p className="text-xs text-error-text">
                {form.formState.errors.nombreNegocio.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ciudadBase">Ciudad</Label>
            <Input id="ciudadBase" {...form.register("ciudadBase")} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="monedaPrincipal">Moneda principal</Label>
          <Select
            items={Object.fromEntries(MONEDAS.map((m) => [m.value, m.label]))}
            value={moneda}
            onValueChange={(v) => v && form.setValue("monedaPrincipal", v)}
          >
            <SelectTrigger id="monedaPrincipal" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONEDAS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.formState.errors.monedaPrincipal && (
            <p className="text-xs text-error-text">
              {form.formState.errors.monedaPrincipal.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Logo del negocio (opcional)</Label>
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
              if (file) elegirLogo(file);
            }}
            onClick={() => !subiendoLogo && fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-disabled={subiendoLogo}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed p-5 text-center transition-colors",
              subiendoLogo && "pointer-events-none opacity-60",
              arrastrando ? "border-primary bg-pastel-blue-bg" : "border-gray-border hover:border-primary/50"
            )}
          >
            {logoPreview ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoPreview}
                  alt="Logo elegido"
                  className="size-16 rounded-lg object-cover"
                />
                {!subiendoLogo && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      quitarLogo();
                    }}
                    aria-label="Quitar logo"
                    className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-error-text text-white"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            ) : (
              <>
                <Upload className="size-5 text-text-muted" />
                <p className="text-xs text-text-body">
                  Arrastrá tu logo acá o{" "}
                  <span className="font-medium text-primary">explorá tus archivos</span>
                </p>
                <p className="text-[11px] text-text-muted">
                  PNG o JPG, cuadrado, mínimo 512×512px, máximo 2MB
                </p>
              </>
            )}
            {subiendoLogo && <p className="text-[11px] text-text-muted">Subiendo...</p>}
          </div>
          {logoError && <p className="text-xs text-error-text">{logoError}</p>}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) elegirLogo(file);
              e.target.value = "";
            }}
          />
        </div>

        <div className="space-y-1.5">
          <Label>¿Dónde vendés hoy?</Label>
          <div className="grid grid-cols-2 gap-2">
            {CANALES_SUGERIDOS.map((canal) => {
              const elegido = canales.includes(canal.value);
              return (
                <button
                  key={canal.value}
                  type="button"
                  onClick={() => alternarCanal(canal.value)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-colors",
                    elegido
                      ? "border-primary bg-pastel-blue-bg"
                      : "border-gray-border hover:border-primary/50"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-8 items-center justify-center rounded-lg",
                      elegido ? "bg-primary text-white" : "bg-pastel-blue-bg text-primary"
                    )}
                  >
                    <canal.icono className="size-4" />
                  </span>
                  <span className="text-xs font-medium text-navy">{canal.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <p role="alert" className="text-xs text-error-text">
            {error}
          </p>
        )}

        <Button type="submit" disabled={guardando} className="w-full justify-center">
          {guardando ? "Guardando..." : "Guardar y continuar"}
        </Button>
      </form>
    </div>
  );
}
