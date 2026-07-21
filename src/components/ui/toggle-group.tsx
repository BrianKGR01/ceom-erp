"use client";

import { cn } from "@/lib/utils";

// Extraido de las pills de filtro reimplementadas a mano en Historial de
// Ventas, Compras, Catalogo de Productos, criterio de Ranking, etc. — ver
// docs/ui/AUDITORIA-UI-UX.md UI-014. Un solo valor seleccionado entre N
// opciones (filtros, criterios) — para "elegir una entidad relacionada" con
// icono/descripcion usar OptionCard en su lugar.
export interface ToggleGroupOption<T extends string = string> {
  value: T;
  label: string;
}

export function ToggleGroup<T extends string = string>({
  value,
  onValueChange,
  options,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: ToggleGroupOption<T>[];
}) {
  return (
    <div role="group" className="flex flex-wrap gap-2">
      {options.map((option) => {
        const activo = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={activo}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              activo
                ? "bg-primary text-white"
                : "bg-pastel-blue-bg text-text-body hover:bg-pastel-blue-bg/70"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
