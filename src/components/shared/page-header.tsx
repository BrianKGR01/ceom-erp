import type { ReactNode } from "react";

// Titulo de pagina + subtitulo + accion principal — design system v1.0
// seccion 03: H1 26px / Gogh 800 / -0.6px, subtitulo 13px gris (token body).
// `title` acepta ReactNode (no solo string) para poder poner un <Badge> de
// estado junto al nombre en fichas de detalle (Producto, Gasto, Tenant) sin
// tener que reimplementar el header a mano — ver
// docs/ui/AUDITORIA-UI-UX.md UI-023.
export function PageHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="flex items-center gap-2 font-heading text-xl font-extrabold tracking-[-0.6px] text-navy">
          {title}
        </h1>
        {description && <p className="mt-1 text-sm text-text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
