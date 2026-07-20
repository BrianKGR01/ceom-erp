"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

// Extraido del tab-bar persistente que ya usaban Consentimiento/Simulaciones
// (NavConsentimiento/NavSimulaciones, ver docs/ui/AUDITORIA-UI-UX.md UI-002) —
// mismo lenguaje visual (Button default/outline en fila), generalizado para
// no depender de un prop `activo` pasado a mano por archivo.
//
// Dos modos, segun si el item trae `href`:
// - Navegacion por ruta (familia de vistas, ej. Consentimiento/Simulaciones/
//   Reportes): el activo se deriva de usePathname(), cada item es un link real.
// - Vista controlada (tabs sobre un mismo recurso ya elegido, ej. Ficha de
//   Proveedor, Ficha de Tenant): el activo se deriva de `value`, cada item
//   dispara `onValueChange` sin cambiar de URL.
export interface TabItem {
  key: string;
  label: string;
  icon?: LucideIcon;
  href?: string;
}

export function Tabs({
  items,
  value,
  onValueChange,
}: {
  items: TabItem[];
  value?: string;
  onValueChange?: (key: string) => void;
}) {
  const pathname = usePathname();

  return (
    <div role="tablist" className="flex flex-wrap gap-2">
      {items.map((item) => {
        const activo = item.href ? pathname === item.href : value === item.key;
        const contenido = (
          <>
            {item.icon && <item.icon className="size-4" />}
            {item.label}
          </>
        );

        if (item.href) {
          return (
            <Button
              key={item.key}
              role="tab"
              aria-selected={activo}
              render={<Link href={item.href} />}
              nativeButton={false}
              variant={activo ? "default" : "outline"}
            >
              {contenido}
            </Button>
          );
        }

        return (
          <Button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={activo}
            variant={activo ? "default" : "outline"}
            onClick={() => onValueChange?.(item.key)}
          >
            {contenido}
          </Button>
        );
      })}
    </div>
  );
}
