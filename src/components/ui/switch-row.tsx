"use client";

import { useId, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

// Fila "opcion con interruptor": el patron con el que se elige un subconjunto
// de opciones (los Modulos Veedor, los booleanos de un Plan) — ver
// docs/ui/AUDITORIA-UI-UX.md UI-019/UI-020/UI-035.
//
// La fila es un <div>, nunca un <button>: el unico control interactivo es el
// Switch. Envolver la fila en un <button> con el Switch adentro es HTML
// invalido (control interactivo anidado) y hacia que un clic exactamente
// sobre el switch disparara el toggle dos veces — una por onCheckedChange y
// otra por el onClick del padre al burbujear — anulandose a si mismo. Ese era
// el bug UI-019.
//
// Para no perder area de clic al sacar el <button>, el texto es un <label>
// asociado al Switch por id: clickear el label activa el control (un
// <button> es un elemento etiquetable segun HTML), sin anidar nada.
export function SwitchRow({
  checked,
  onCheckedChange,
  label,
  description,
  icon: Icon,
  disabled = false,
  trailing,
  className,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description?: string;
  icon?: LucideIcon;
  disabled?: boolean;
  /** Contenido opcional a la derecha, antes del Switch (ej. un badge de estado). */
  trailing?: ReactNode;
  className?: string;
}) {
  const id = useId();

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors",
        disabled && "border-gray-border bg-gray-bg opacity-60",
        !disabled && checked && "border-primary bg-pastel-blue-bg",
        !disabled && !checked && "border-gray-border",
        className
      )}
    >
      <label
        htmlFor={id}
        className={cn("flex min-w-0 items-center gap-2.5", disabled ? "cursor-not-allowed" : "cursor-pointer")}
      >
        {Icon && <Icon className="size-4 shrink-0 text-primary" />}
        <span className="min-w-0">
          <span className="block text-sm font-medium text-navy">{label}</span>
          {description && <span className="block text-xs text-text-muted">{description}</span>}
        </span>
      </label>
      <div className="flex shrink-0 items-center gap-2">
        {trailing}
        <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
      </div>
    </div>
  );
}
