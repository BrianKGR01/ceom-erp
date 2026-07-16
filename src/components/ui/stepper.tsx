import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

// No existe en el catalogo de shadcn — construido a mano sobre los tokens
// de docs/design-system.md seccion 5.4 (wizard/stepper): numero + linea
// conectora, activo en azul primario, completado en verde de estado.

export interface StepperStep {
  label: string;
}

export function Stepper({
  steps,
  currentStep,
  className,
}: {
  steps: StepperStep[];
  /** Indice 0-based del paso activo. */
  currentStep: number;
  className?: string;
}) {
  return (
    <ol className={cn("flex items-start", className)}>
      {steps.map((step, index) => {
        const estado =
          index < currentStep ? "completado" : index === currentStep ? "activo" : "pendiente";

        return (
          <li key={step.label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-medium",
                  estado === "completado" && "bg-success-text text-white",
                  estado === "activo" && "bg-primary text-primary-foreground",
                  estado === "pendiente" && "bg-gray-bg text-text-muted"
                )}
              >
                {estado === "completado" ? <Check className="size-4" /> : index + 1}
              </span>
              <span
                className={cn(
                  "text-xs whitespace-nowrap",
                  estado === "pendiente" ? "text-text-muted" : "font-medium text-navy"
                )}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "mx-2 h-px flex-1",
                  index < currentStep ? "bg-success-text" : "bg-gray-border"
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
