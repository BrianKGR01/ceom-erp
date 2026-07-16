"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Store, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Stepper } from "@/components/ui/stepper";
import { cn } from "@/lib/utils";
import {
  actualizarTenantSchema,
  type ActualizarTenantInput,
} from "@/modules/identidad/validation";
import { elegirRubro, guardarNegocio } from "./actions";

const CANALES_SUGERIDOS = [
  { value: "redes_sociales", label: "Redes sociales" },
  { value: "feria", label: "Feria / pop-up" },
  { value: "local_fisico", label: "Local físico" },
  { value: "boca_a_boca", label: "Boca a boca" },
];

const PASOS = [{ label: "Tu negocio" }, { label: "Tu rubro" }];

type Nicho = "nicho_1" | "nicho_4";

const RUBROS: {
  nicho: Nicho;
  nombre: string;
  detalle: string;
  icono: typeof Store;
}[] = [
  {
    nicho: "nicho_1",
    nombre: "Alimentos y bebidas por lotes",
    detalle: "Producís en lotes con receta: panadería, repostería, bebidas, conservas.",
    icono: UtensilsCrossed,
  },
  {
    nicho: "nicho_4",
    nombre: "Comercio minorista y distribución",
    detalle: "Comprás y revendés productos: tienda, distribuidora, kiosco.",
    icono: Store,
  },
];

interface TenantActual {
  nombreNegocio: string;
  ciudadBase: string | null;
  monedaPrincipal: string;
  canalesVenta: string[];
  nichoId: Nicho | null;
}

export function OnboardingWizard({ tenant }: { tenant: TenantActual }) {
  const router = useRouter();
  // Si ya vino con un rubro asignado (retomando el onboarding), saltamos
  // directo al paso 2 — no tiene sentido pedirle de nuevo "Configurar negocio".
  const [paso, setPaso] = useState(tenant.nichoId ? 1 : 0);
  const [nichoElegido, setNichoElegido] = useState<Nicho | null>(tenant.nichoId);
  const [terminado, setTerminado] = useState(false);

  return (
    <div className="space-y-6">
      <Stepper steps={PASOS} currentStep={terminado ? 2 : paso} />

      {paso === 0 && (
        <PasoNegocio
          tenant={tenant}
          onGuardado={() => setPaso(1)}
        />
      )}

      {paso === 1 && (
        <PasoRubro
          nichoElegido={nichoElegido}
          onElegido={(nicho) => {
            setNichoElegido(nicho);
            setTerminado(true);
          }}
          onModoBasico={() => setTerminado(true)}
        />
      )}

      {terminado && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-success-bg text-success-text">
              <Check className="size-5" />
            </span>
            <p className="text-sm text-text-body">
              {nichoElegido
                ? "Listo, ya configuramos tu negocio y tu rubro."
                : "Listo, ya configuramos tu negocio. Podés elegir un rubro más adelante cuando quieras."}
            </p>
            <Button onClick={() => router.push("/app")}>Ir a mi panel</Button>
          </CardContent>
        </Card>
      )}
    </div>
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
    },
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canales = form.watch("canalesVenta");

  function alternarCanal(value: string) {
    const actuales = form.getValues("canalesVenta");
    form.setValue(
      "canalesVenta",
      actuales.includes(value) ? actuales.filter((c) => c !== value) : [...actuales, value]
    );
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
    <Card>
      <CardHeader>
        <CardTitle>Contanos de tu negocio</CardTitle>
        <CardDescription>Esto lo podés cambiar cuando quieras desde tu panel.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nombreNegocio">Nombre de tu negocio</Label>
            <Input id="nombreNegocio" {...form.register("nombreNegocio")} />
            {form.formState.errors.nombreNegocio && (
              <p className="text-xs text-error-text">
                {form.formState.errors.nombreNegocio.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ciudadBase">Ciudad</Label>
              <Input id="ciudadBase" {...form.register("ciudadBase")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="monedaPrincipal">Moneda (ej. BOB, USD)</Label>
              <Input
                id="monedaPrincipal"
                maxLength={3}
                {...form.register("monedaPrincipal")}
              />
              {form.formState.errors.monedaPrincipal && (
                <p className="text-xs text-error-text">
                  {form.formState.errors.monedaPrincipal.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>¿Dónde vendés hoy?</Label>
            <div className="grid grid-cols-2 gap-2">
              {CANALES_SUGERIDOS.map((canal) => (
                <label
                  key={canal.value}
                  className="flex items-center gap-2 rounded-lg border border-gray-border px-2.5 py-2 text-sm text-text-body"
                >
                  <Checkbox
                    checked={canales.includes(canal.value)}
                    onCheckedChange={() => alternarCanal(canal.value)}
                  />
                  {canal.label}
                </label>
              ))}
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
      </CardContent>
    </Card>
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
  const [pendiente, setPendiente] = useState<Nicho | null>(null);
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [asignando, setAsignando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (nichoElegido) {
    const rubro = RUBROS.find((r) => r.nicho === nichoElegido);
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tu rubro ya está elegido</CardTitle>
          <CardDescription>
            Elegiste <span className="font-medium text-navy">{rubro?.nombre}</span> — esta
            elección no se puede cambiar.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  async function confirmar() {
    if (!pendiente) return;
    setAsignando(true);
    setError(null);
    const resultado = await elegirRubro(pendiente);
    setAsignando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      setDialogoAbierto(false);
      return;
    }
    setDialogoAbierto(false);
    onElegido(pendiente);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>¿Cuál es el rubro de tu negocio?</CardTitle>
        <CardDescription>
          Elegí la opción que más se parece a lo que hacés — una vez elegida, no se puede
          cambiar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <p role="alert" className="text-xs text-error-text">
            {error}
          </p>
        )}

        {RUBROS.map((rubro) => (
          <button
            key={rubro.nicho}
            type="button"
            onClick={() => {
              setPendiente(rubro.nicho);
              setDialogoAbierto(true);
            }}
            className={cn(
              "flex w-full items-start gap-3 rounded-xl border border-gray-border p-3 text-left transition-colors hover:border-primary"
            )}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-pastel-blue-bg text-primary">
              <rubro.icono className="size-4" />
            </span>
            <span>
              <span className="block text-sm font-medium text-navy">{rubro.nombre}</span>
              <span className="block text-xs text-text-muted">{rubro.detalle}</span>
            </span>
          </button>
        ))}

        <button
          type="button"
          onClick={onModoBasico}
          className="w-full rounded-xl border border-dashed border-gray-border p-3 text-left text-sm text-text-muted hover:border-primary hover:text-primary"
        >
          Todavía no lo sé / vendo de varias formas distintas — usar Modo Básico
        </button>
      </CardContent>

      <Dialog open={dialogoAbierto} onOpenChange={setDialogoAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Confirmás esta elección?</DialogTitle>
            <DialogDescription>
              Elegiste <span className="font-medium text-navy">
                {RUBROS.find((r) => r.nicho === pendiente)?.nombre}
              </span>
              . Una vez confirmado, no vas a poder cambiar el rubro de tu negocio — es una
              decisión de una sola vez.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogoAbierto(false)}>
              Volver
            </Button>
            <Button onClick={confirmar} disabled={asignando}>
              {asignando ? "Confirmando..." : "Sí, confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
