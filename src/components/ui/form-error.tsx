import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Centraliza el patron `<p className="text-xs text-error-text">{error}</p>`
// repetido en decenas de archivos, la mayoria sin `role="alert"` — ver
// docs/ui/AUDITORIA-UI-UX.md UI-027. Un lector de pantalla solo anuncia el
// error si esta presente.
export function FormError({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  if (!children) return null;
  return (
    <p role="alert" className={cn("text-xs text-error-text", className)}>
      {children}
    </p>
  );
}
