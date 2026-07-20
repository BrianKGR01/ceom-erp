"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  Calculator,
  ChefHat,
  KeyRound,
  LayoutGrid,
  LogOut,
  Menu,
  Package,
  Receipt,
  Settings,
  ShieldAlert,
  ShoppingCart,
  Truck,
  X,
} from "lucide-react";
import { Icono } from "@/components/brand/icono";
import { Logo } from "@/components/brand/logo";
import { cerrarSesion } from "@/lib/supabase/actions";
import { cn } from "@/lib/utils";

interface ItemNav {
  href: string;
  label: string;
  icono: typeof LayoutGrid;
}

function formatoFecha(fecha: string): string {
  return new Date(fecha).toLocaleDateString("es-BO", { day: "2-digit", month: "short", year: "numeric" });
}

// Señal visual únicamente — el bloqueo real de crear/editar ya lo hace
// tienePermiso() del lado del servidor (identidad/actions.ts): bloqueado
// deniega incluso "ver", solo_lectura deniega todo salvo "ver". Este banner
// no controla nada, solo informa lo que el servidor ya está aplicando.
function BannerEstadoTenant({
  estadoAcceso,
  fechaProximoPago,
}: {
  estadoAcceso: "activo" | "solo_lectura" | "bloqueado";
  fechaProximoPago: string | null;
}) {
  if (estadoAcceso === "activo") return null;

  if (estadoAcceso === "bloqueado") {
    return (
      <div className="flex items-center gap-2 bg-error-bg px-4 py-2.5 text-sm text-error-text">
        <ShieldAlert className="size-4 shrink-0" />
        <p>Acceso bloqueado — contactá a soporte para regularizar tu suscripción.</p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 bg-warning-bg px-4 py-2.5 text-sm text-warning-text">
      <AlertTriangle className="size-4 shrink-0" />
      <p>
        Tu suscripción está vencida — podés ver tus datos pero no crear ni editar hasta
        regularizar el pago
        {fechaProximoPago && `, fecha de próximo pago: ${formatoFecha(fechaProximoPago)}`}.
      </p>
    </div>
  );
}

// Sidebar navy con degradado (design-system.md seccion 5.1), colapsable en
// desktop (clic en el logo fija el estado; hover sobre el sidebar
// colapsado lo previsualiza expandido sin mover el contenido, como un
// flyout). En mobile funciona como drawer clasico, sin modo colapsado —
// ver nota de alcance en la conversacion, esa version se revisa aparte.
export function AppShell({
  nombreCompleto,
  rolNombre,
  tenantNombre,
  esOwner,
  estadoAcceso,
  fechaProximoPago,
  children,
}: {
  nombreCompleto: string;
  rolNombre: string;
  tenantNombre: string;
  esOwner: boolean;
  estadoAcceso: "activo" | "solo_lectura" | "bloqueado";
  fechaProximoPago: string | null;
  children: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const [colapsado, setColapsado] = useState(false);
  const [hovering, setHovering] = useState(false);
  const pathname = usePathname();
  const abrirBtnRef = useRef<HTMLButtonElement>(null);
  const asideRef = useRef<HTMLElement>(null);

  // Expandido "de verdad" (colapsado=false) o en preview por hover.
  const mostrarExpandido = !colapsado || hovering;

  // Drawer mobile: Escape cierra, foco atrapado dentro mientras está
  // abierto, scroll del body bloqueado, y el foco vuelve al botón que lo
  // abrió al cerrarse — mismo contrato que cualquier panel modal.
  useEffect(() => {
    if (!abierto) return;

    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const FOCUSABLES = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const primerFocusable = asideRef.current?.querySelector<HTMLElement>(FOCUSABLES);
    primerFocusable?.focus();

    function alTecla(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setAbierto(false);
        return;
      }
      if (e.key !== "Tab" || !asideRef.current) return;
      const focusables = asideRef.current.querySelectorAll<HTMLElement>(FOCUSABLES);
      if (focusables.length === 0) return;
      const primero = focusables[0];
      const ultimo = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    }

    document.addEventListener("keydown", alTecla);
    const botonQueAbrio = abrirBtnRef.current;
    return () => {
      document.removeEventListener("keydown", alTecla);
      document.body.style.overflow = overflowPrevio;
      botonQueAbrio?.focus();
    };
  }, [abierto]);

  const items: ItemNav[] = [
    { href: "/app", label: "Inicio", icono: LayoutGrid },
    { href: "/app/ventas", label: "Ventas", icono: ShoppingCart },
    { href: "/app/productos", label: "Catálogo", icono: Package },
    { href: "/app/patrimonio", label: "Patrimonio", icono: Building2 },
    { href: "/app/proveedores", label: "Proveedores", icono: Truck },
    ...(esOwner
      ? [{ href: "/app/mi-negocio/colaboradores", label: "Mi negocio", icono: Settings }]
      : []),
    { href: "/app/gastos", label: "Gastos", icono: Receipt },
    { href: "/app/produccion", label: "Producción", icono: ChefHat },
    { href: "/app/simulaciones", label: "Simulaciones", icono: Calculator },
    { href: "/app/consentimiento", label: "Compartir Datos", icono: KeyRound },
  ];

  function esActivo(href: string) {
    if (href === "/app") return pathname === "/app";
    // "Mi negocio" cubre tanto el hub nuevo (Colaboradores/Roles/
    // Capacidades, dentro del shell) como el asistente de Onboarding
    // (fuera del shell a propósito, ver src/app/app/(shell)/layout.tsx) —
    // ambos se resaltan como la misma sección.
    if (href.startsWith("/app/mi-negocio")) {
      return pathname.startsWith("/app/mi-negocio") || pathname.startsWith("/app/onboarding");
    }
    return pathname.startsWith(href);
  }

  return (
    <>
      <div className="app-mobile-bar items-center justify-between bg-navy px-4 py-3">
        <Icono className="h-7 w-auto" />
        <button
          ref={abrirBtnRef}
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
          className="fixed inset-0 z-40 bg-black/40"
        />
      )}

      <aside
        ref={asideRef}
        onMouseEnter={() => colapsado && setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        className={cn(
          "app-sidebar flex shrink-0 flex-col bg-gradient-to-b from-sidebar-from to-sidebar-to transition-[transform,width] duration-200",
          abierto && "app-sidebar--abierto",
          colapsado && "app-sidebar--colapsado",
          colapsado && hovering && "app-sidebar--hover"
        )}
      >
        <div className="relative">
          <button
            type="button"
            onClick={() => setColapsado((v) => !v)}
            aria-label={colapsado ? "Expandir menú" : "Contraer menú"}
            className="relative flex h-20 w-full shrink-0 items-center justify-center overflow-hidden"
          >
            <Logo
              className={cn(
                "h-9 w-auto brightness-0 invert transition-all duration-300",
                mostrarExpandido ? "scale-100 opacity-100" : "scale-75 opacity-0"
              )}
            />
            <Icono
              className={cn(
                "absolute h-10 w-auto transition-all duration-300",
                mostrarExpandido ? "scale-75 opacity-0" : "scale-100 opacity-100"
              )}
            />
          </button>
          <button
            type="button"
            onClick={() => setAbierto(false)}
            aria-label="Cerrar menú"
            className="app-mobile-close absolute top-6 right-3 text-white/70"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="mt-2 flex-1 space-y-1 px-3">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setAbierto(false)}
              title={mostrarExpandido ? undefined : item.label}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-white/80 transition-colors hover:bg-sidebar-accent hover:text-white",
                esActivo(item.href) && "bg-sidebar-accent text-white",
                !mostrarExpandido && "justify-center px-0"
              )}
            >
              <item.icono className="size-4 shrink-0" />
              <span
                className={cn(
                  "overflow-hidden whitespace-nowrap transition-all duration-200",
                  mostrarExpandido ? "max-w-[160px] opacity-100" : "max-w-0 opacity-0"
                )}
              >
                {item.label}
              </span>
            </Link>
          ))}
        </nav>

        <div className="space-y-3 border-t border-white/10 px-3 py-4">
          <div className={cn("flex items-center gap-2.5", !mostrarExpandido && "justify-center")}>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
              {nombreCompleto.charAt(0).toUpperCase()}
            </span>
            <div
              className={cn(
                "min-w-0 overflow-hidden transition-all duration-200",
                mostrarExpandido ? "max-w-[160px] opacity-100" : "max-w-0 opacity-0"
              )}
            >
              <p className="truncate text-xs font-medium text-white">{nombreCompleto}</p>
              <p className="truncate text-[11px] text-white/60">
                {rolNombre} · {tenantNombre}
              </p>
            </div>
          </div>
          <form action={cerrarSesion}>
            <button
              type="submit"
              title={mostrarExpandido ? undefined : "Cerrar sesión"}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/15 py-1.5 text-xs font-medium text-white/80 hover:bg-white/5 hover:text-white"
            >
              <LogOut className="size-3.5 shrink-0" />
              <span
                className={cn(
                  "overflow-hidden whitespace-nowrap transition-all duration-200",
                  mostrarExpandido ? "max-w-[120px] opacity-100" : "max-w-0 opacity-0"
                )}
              >
                Cerrar sesión
              </span>
            </button>
          </form>
        </div>
      </aside>

      <main
        className={cn(
          "app-shell-main min-w-0",
          colapsado && "app-shell-main--colapsado"
        )}
      >
        <BannerEstadoTenant estadoAcceso={estadoAcceso} fechaProximoPago={fechaProximoPago} />
        {children}
      </main>
    </>
  );
}
