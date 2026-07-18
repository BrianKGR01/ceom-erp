import type { ReactNode } from "react";

// Titulo de pagina + subtitulo + accion principal — design-system.md
// seccion 3: H1 18-20px Poppins 600 navy, subtitulo 12-13px gris.
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <h1 className="font-heading text-xl font-semibold text-navy">{title}</h1>
        {description && <p className="mt-1 text-sm text-text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
