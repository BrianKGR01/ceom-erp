"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Store, UtensilsCrossed, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Stepper } from "@/components/ui/stepper";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { PasoNegocio, type TenantActual } from "@/components/shared/paso-negocio";
import { elegirRubro, finalizarOnboarding } from "./actions";

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
