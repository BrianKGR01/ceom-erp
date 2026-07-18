import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

// Patron nuevo (no existia en el proyecto) — resuelve a la vez la
// navegacion jerarquica y el "volver atras" que faltaba en Catalogo. El
// ultimo item es siempre la pagina actual, sin link.
export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
      {items.map((item, index) => {
        const esUltimo = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="flex items-center gap-1.5">
            {index > 0 && <ChevronRight className="size-3.5 text-text-muted" />}
            {esUltimo || !item.href ? (
              <span className={esUltimo ? "font-medium text-navy" : "text-text-muted"}>
                {item.label}
              </span>
            ) : (
              <Link href={item.href} className="text-text-muted hover:text-primary">
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
