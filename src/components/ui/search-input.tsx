import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Extraido del bloque icono+Input reimplementado con valores ligeramente
// distintos en Tenants (/admin, pl-8/left-2.5) e Instituciones (/admin,
// pl-9/left-3, sin pointer-events-none) — ver
// docs/ui/AUDITORIA-UI-UX.md UI-014/resumen del clúster admin. El ancho
// (ej. sm:w-64) queda a criterio del consumidor via `className`.
export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-muted" />
      <Input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-8"
      />
    </div>
  );
}
