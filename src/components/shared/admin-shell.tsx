"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Landmark, ListChecks, LogOut, Menu, X } from "lucide-react";
import { Icono } from "@/components/brand/icono";
import { Logo } from "@/components/brand/logo";
import { cerrarSesion } from "@/lib/supabase/actions";
import { cn } from "@/lib/utils";

interface ItemNav {
  href: string;
  label: string;
  icono: typeof Landmark;
}

// Shell de /admin — primera vez que esta superficie tiene sidebar real
// (hasta ahora era una landing provisoria). Mismo lenguaje visual que
// AppShell (design-system.md seccion 5.1), version simplificada sin modo
// colapsado — el Panel Admin CEOM completo (Suscripciones/Configuración)
// es roadmap ítem #11, esos nav items no se agregan todavía.
export function AdminShell({
  nombreCompleto,
  children,
}: {
  nombreCompleto: string;
  children: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const pathname = usePathname();

  const items: ItemNav[] = [
    { href: "/admin/instituciones", label: "Instituciones", icono: Landmark },
    { href: "/admin/logs", label: "Logs de Acceso", icono: ListChecks },
  ];

  function esActivo(href: string) {
    return pathname.startsWith(href);
  }

  return (
    <>
      <div className="app-mobile-bar items-center justify-between bg-navy px-4 py-3">
        <Icono className="h-7 w-auto" />
        <button type="button" onClick={() => setAbierto(true)} aria-label="Abrir menú" className="text-white">
          <Menu className="size-6" />
        </button>
      </div>

      {abierto && (
        <div
          role="button"
          aria-label="Cerrar menú"
          tabIndex={0}
          onClick={() => setAbierto(false)}
          className="fixed inset-0 z-40 bg-black/40"
        />
      )}

      <aside
        className={cn(
          "app-sidebar flex shrink-0 flex-col bg-gradient-to-b from-sidebar-from to-sidebar-to transition-transform duration-200",
          abierto && "app-sidebar--abierto"
        )}
      >
        <div className="relative flex h-20 w-full shrink-0 items-center justify-center gap-2 px-4">
          <Logo className="h-9 w-auto brightness-0 invert" />
          <button
            type="button"
            onClick={() => setAbierto(false)}
            aria-label="Cerrar menú"
            className="app-mobile-close absolute top-6 right-3 text-white/70"
          >
            <X className="size-5" />
          </button>
        </div>
        <p className="px-6 text-[11px] tracking-wide text-white/50 uppercase">Panel de Administración</p>

        <nav className="mt-4 flex-1 space-y-1 px-3">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setAbierto(false)}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-white/80 transition-colors hover:bg-sidebar-accent hover:text-white",
                esActivo(item.href) && "bg-sidebar-accent text-white"
              )}
            >
              <item.icono className="size-4 shrink-0" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="space-y-3 border-t border-white/10 px-3 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
              {nombreCompleto.charAt(0).toUpperCase()}
            </span>
            <p className="truncate text-xs font-medium text-white">{nombreCompleto}</p>
          </div>
          <form action={cerrarSesion}>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/15 py-1.5 text-xs font-medium text-white/80 hover:bg-white/5 hover:text-white"
            >
              <LogOut className="size-3.5 shrink-0" />
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      <main className="app-shell-main min-w-0">{children}</main>
    </>
  );
}
