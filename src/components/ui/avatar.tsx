import { cn } from "@/lib/utils";

// Extraido del circulo con inicial reimplementado con 3 tamaños distintos en
// Colaboradores (size-11), Capacidades Especiales (size-10) y el dialogo de
// invitar (size-8) — ver docs/ui/AUDITORIA-UI-UX.md UI-021. Los 3 tamaños ya
// existian en la practica, se preservan como variantes en vez de forzar un
// unico valor nuevo.
const TAMANOS = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-11 text-sm",
} as const;

export function Avatar({
  nombre,
  size = "md",
  className,
}: {
  nombre: string;
  size?: keyof typeof TAMANOS;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-pastel-blue-bg font-semibold text-primary",
        TAMANOS[size],
        className
      )}
    >
      {nombre.charAt(0).toUpperCase()}
    </span>
  );
}
