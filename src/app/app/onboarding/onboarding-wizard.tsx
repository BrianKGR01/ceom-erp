"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  Check,
  MessageCircle,
  Share2,
  Store,
  Tent,
  Upload,
  UtensilsCrossed,
  Wrench,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Stepper } from "@/components/ui/stepper";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import {
  actualizarTenantSchema,
  type ActualizarTenantInput,
} from "@/modules/identidad/validation";
import { elegirRubro, finalizarOnboarding, guardarNegocio, subirLogoAction } from "./actions";

// Canales reales de Modulo_01 seccion 1.1 — no los de la referencia visual
// (esta pantalla se rediseño con imagenes de otra herramienta como guia de
// distribucion de componentes unicamente, nunca de datos/copy).
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

const PASOS = [{ label: "Tu negocio" }, { label: "Tu rubro" }];

type Nicho = "nicho_1" | "nicho_4";

const OPCIONES_RUBRO: {
  valor: Nicho | "basico";
  nombre: string;
  detalle: string;
  icono: typeof Store;
}[] = [
  {
    valor: "nicho_1",
    nombre: "Alimentos y bebidas por lotes",
    detalle: "Producís en lotes con receta: panadería, repostería, bebidas, conservas.",
    icono: UtensilsCrossed,
  },
  {
    valor: "nicho_4",
    nombre: "Comercio minorista y distribución",
    detalle: "Comprás y revendés productos: tienda, distribuidora, kiosco.",
    icono: Store,
  },
  {
    valor: "basico",
    nombre: "Modo Básico",
    detalle: "Todavía no lo sé, o vendo de varias formas distintas.",
    icono: Wrench,
  },
];

interface TenantActual {
  nombreNegocio: string;
  ciudadBase: string | null;
  monedaPrincipal: string;
  canalesVenta: string[];
  nichoId: Nicho | null;
  logoUrl: string | null;
}

export function OnboardingWizard({ tenant }: { tenant: TenantActual }) {
  const router = useRouter();
  // Si ya vino con un rubro asignado (retomando el onboarding), saltamos
  // directo al paso 2 — no tiene sentido pedirle de nuevo "Configurar negocio".
  const [paso, setPaso] = useState(tenant.nichoId ? 1 : 0);
  const [nichoElegido, setNichoElegido] = useState<Nicho | null>(tenant.nichoId);
  const [terminado, setTerminado] = useState(false);

  return (
    <Card className="w-full">
      <CardContent className="space-y-6 pt-6">
        <Logo className="mx-auto h-9 w-auto" />
        <Stepper steps={PASOS} currentStep={terminado ? 2 : paso} />

        {paso === 0 && <PasoNegocio tenant={tenant} onGuardado={() => setPaso(1)} />}

        {paso === 1 && (
          <PasoRubro
            nichoElegido={nichoElegido}
            onElegido={async (nicho) => {
              setNichoElegido(nicho);
              setTerminado(true);
              await finalizarOnboarding();
            }}
            onModoBasico={async () => {
              setTerminado(true);
              await finalizarOnboarding();
            }}
          />
        )}

        {terminado && (
          <div className="flex flex-col items-center gap-3 border-t border-gray-border pt-6 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-success-bg text-success-text">
              <Check className="size-5" />
            </span>
            <p className="text-sm text-text-body">
              {nichoElegido
                ? "Listo, ya configuramos tu negocio y tu rubro."
                : "Listo, ya configuramos tu negocio. Podés elegir un rubro más adelante cuando quieras."}
            </p>
            <Button onClick={() => router.push("/app")}>Ir a mi panel</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PasoNegocio({
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

function PasoRubro({
  nichoElegido,
  onElegido,
  onModoBasico,
}: {
  nichoElegido: Nicho | null;
  onElegido: (nicho: Nicho) => void;
  onModoBasico: () => void;
}) {
  const [seleccion, setSeleccion] = useState<Nicho | "basico" | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (nichoElegido) {
    const rubro = OPCIONES_RUBRO.find((r) => r.valor === nichoElegido);
    return (
      <div className="space-y-1 text-center">
        <h2 className="font-heading text-lg font-semibold text-navy">Tu rubro ya está elegido</h2>
        <p className="text-sm text-text-muted">
          Elegiste <span className="font-medium text-navy">{rubro?.nombre}</span> — esta
          elección no se puede cambiar.
        </p>
      </div>
    );
  }

  async function confirmar() {
    if (!seleccion) return;
    setConfirmando(true);
    setError(null);

    if (seleccion === "basico") {
      setConfirmando(false);
      onModoBasico();
      return;
    }

    const resultado = await elegirRubro(seleccion);
    setConfirmando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    onElegido(seleccion);
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading text-lg font-semibold text-navy">¿Cuál es el rubro de tu negocio?</h2>
        <p className="mt-1 text-sm text-text-muted">
          Elegí la opción que más se parece a lo que hacés — una vez elegida, no se puede
          cambiar.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {OPCIONES_RUBRO.map((opcion) => (
          <button
            key={opcion.valor}
            type="button"
            onClick={() => setSeleccion(opcion.valor)}
            className={cn(
              "relative flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-colors",
              seleccion === opcion.valor
                ? "border-primary bg-pastel-blue-bg"
                : "border-gray-border hover:border-primary/50"
            )}
          >
            {seleccion === opcion.valor && (
              <span className="absolute -top-2 right-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-white">
                Seleccionado
              </span>
            )}
            <span className="flex size-10 items-center justify-center rounded-lg bg-pastel-blue-bg text-primary">
              <opcion.icono className="size-5" />
            </span>
            <span className="text-sm font-medium text-navy">{opcion.nombre}</span>
            <span className="text-xs text-text-muted">{opcion.detalle}</span>
          </button>
        ))}
      </div>

      {seleccion && (
        <div className="flex items-start gap-2 rounded-lg bg-warning-bg p-3 text-xs text-warning-text">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            {seleccion === "basico"
              ? "Vas a operar en Modo Básico. Vas a poder elegir un rubro más adelante si querés — pero una vez que elijas uno, no vas a poder cambiarlo."
              : "Una vez confirmado, no vas a poder cambiar el rubro de tu negocio — es una decisión de una sola vez."}
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-error-text">
          {error}
        </p>
      )}

      <Button onClick={confirmar} disabled={!seleccion || confirmando} className="w-full justify-center">
        {confirmando ? "Confirmando..." : "Confirmar y empezar"}
      </Button>
    </div>
  );
}
