"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Menu, Package, Settings, ShoppingCart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Icono } from "@/components/brand/icono";
import { Logo } from "@/components/brand/logo";
import { cerrarSesion } from "@/lib/supabase/actions";
import { cn } from "@/lib/utils";

interface ItemNav {
  href: string;
  label: string;
  icono: typeof LayoutGrid;
}

// Sidebar navy con degradado (design-system.md seccion 5.1). En mobile se
// comporta como drawer (requisito del brief original: "muchos usuarios
// entran desde el celular en el local") — la identidad de sesion vive acá
// al pie, no en una barra superior aparte, que el doc no especifica.
export function AppSidebar({
  nombreCompleto,
  rolNombre,
  tenantNombre,
  esOwner,
}: {
  nombreCompleto: string;
  rolNombre: string;
  tenantNombre: string;
  esOwner: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const pathname = usePathname();

  const items: ItemNav[] = [
    { href: "/app", label: "Inicio", icono: LayoutGrid },
    { href: "/app/ventas", label: "Vender", icono: ShoppingCart },
    { href: "/app/productos", label: "Catálogo", icono: Package },
    ...(esOwner
      ? [{ href: "/app/onboarding", label: "Mi negocio", icono: Settings }]
      : []),
  ];

  function esActivo(href: string) {
    if (href === "/app") return pathname === "/app";
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* Franja mobile: solo el toggle del drawer, la identidad de sesion
          sigue viviendo unicamente en el sidebar (evita duplicarla). */}
      <div className="flex items-center justify-between bg-navy px-4 py-3 lg:hidden">
        <Icono className="h-7 w-auto" />
        <button
          type="button"
          onClick={() => setAbierto(true)}
          aria-label="Abrir menú"
          className="text-white"
        >
          <Menu className="size-6" />
        </button>
      </div>

      {abierto && (
        <div
          role="button"
          aria-label="Cerrar menú"
          tabIndex={0}
          onClick={() => setAbierto(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      <aside
        className={cn(
          // Posicion/transform del drawer via .app-sidebar en globals.css,
          // no utilidades responsive de Tailwind (max-lg:/lg:) — ese
          // combo genero una regla duplicada sin @media en el build de
          // Turbopack en dev que pisaba siempre el estado "cerrado".
          "app-sidebar fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col bg-gradient-to-b from-sidebar-from to-sidebar-to transition-transform duration-200",
          abierto && "app-sidebar--abierto"
        )}
      >
        <div className="flex items-center justify-between px-5 pt-6 pb-4">
          <Logo className="h-8 w-auto" />
          <button
            type="button"
            onClick={() => setAbierto(false)}
            aria-label="Cerrar menú"
            className="text-white lg:hidden"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="px-4">
          <Button
            render={<Link href="/app/ventas" />}
            nativeButton={false}
            className="w-full justify-center"
          >
            + Nueva venta
          </Button>
        </div>

        <nav className="mt-6 flex-1 space-y-1 px-3">
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
              <item.icono className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="space-y-3 border-t border-white/10 px-4 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
              {nombreCompleto.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-white">{nombreCompleto}</p>
              <p className="truncate text-[11px] text-white/60">
                {rolNombre} · {tenantNombre}
              </p>
            </div>
          </div>
          <form action={cerrarSesion}>
            <button
              type="submit"
              className="w-full rounded-lg border border-white/15 py-1.5 text-xs font-medium text-white/80 hover:bg-white/5 hover:text-white"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
