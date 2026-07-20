"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Extraido de los selectores tipo "radio visual" reimplementados a mano en
// GastoForm (tipo de gasto, layout horizontal) y PasivoForm (activo
// relacionado, layout vertical con icono) — ver
// docs/ui/AUDITORIA-UI-UX.md UI-014. Es la tarjeta individual: el consumidor
// arma su propio grid (grid-cols-N) alrededor, porque la cantidad de
// columnas varia segun cuantas opciones haya.
export function OptionCard({
  selected,
  onSelect,
  label,
  description,
  icon: Icon,
  orientation = "horizontal",
  disabled = false,
  showSelectedBadge = false,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
  description?: string;
  icon?: LucideIcon;
  orientation?: "horizontal" | "vertical";
  disabled?: boolean;
  showSelectedBadge?: boolean;
}) {
  if (orientation === "vertical") {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={onSelect}
        aria-pressed={selected}
        className={cn(
          "relative flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-60",
          selected ? "border-primary bg-pastel-blue-bg" : "border-gray-border hover:border-primary/50"
        )}
      >
        {showSelectedBadge && selected && (
          <span className="absolute -top-2 right-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-white">
            Seleccionado
          </span>
        )}
        {Icon && (
          <span className="flex size-8 items-center justify-center rounded-lg bg-pastel-blue-bg text-primary">
            <Icon className="size-4" />
          </span>
        )}
        <span className="text-xs font-medium text-navy">{label}</span>
        {description && <span className="text-[11px] text-text-muted">{description}</span>}
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        selected ? "border-primary bg-pastel-blue-bg" : "border-gray-border hover:border-primary/50"
      )}
    >
      <div className="flex items-center gap-2">
        {Icon && <Icon className="size-4 shrink-0 text-primary" />}
        <p className="text-sm font-medium text-navy">{label}</p>
      </div>
      {description && <p className="mt-0.5 text-xs text-text-muted">{description}</p>}
    </button>
  );
}
