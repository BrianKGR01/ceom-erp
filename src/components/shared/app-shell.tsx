"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  Calculator,
  ChefHat,
  ChevronDown,
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

interface SubItemNav {
  href: string;
  label: string;
}

interface ItemNav {
  href: string;
  label: string;
  icono: typeof LayoutGrid;
  // Prefijo contra el que se resalta el grupo entero como activo (ej. "Mi
  // negocio" navega a /app/mi-negocio/colaboradores pero el grupo se
  // resalta en cualquier /app/mi-negocio/* o /app/onboarding). Default: href.
  grupoBase?: string;
  // Submenu real de sidebar — reemplaza los 7 mecanismos ad-hoc distintos
  // que documentaba docs/ui/AUDITORIA-UI-UX.md UI-002 (sub-nav de texto
  // que solo vivía en la raíz, botón aislado, link suelto, etc.) para los
  // módulos cuyas secciones son de uso diario y heterogéneo entre sí —
  // decisión 6 del refactor de Fase A. Los módulos que ya resuelven bien
  // su navegación con un tab-bar persistente (Reportes, Simulaciones,
  // Consentimiento) quedan sin submenú a propósito: no se migran.
  subitems?: SubItemNav[];
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
  const [expandidosManual, setExpandidosManual] = useState<Set<string>>(new Set());
  const pathname = usePathname();
  const abrirBtnRef = useRef<HTMLButtonElement>(null);
  const asideRef = useRef<HTMLElement>(null);

  // Expandido "de verdad" (colapsado=false) o en preview por hover/foco.
  const mostrarExpandido = !colapsado || hovering;

  // La expansion manual es para "espiar" un grupo sin navegar — no debe
  // sobrevivir a una navegacion real. Sin este reset, un grupo expandido a
  // mano mientras estaba inactivo podia quedar marcado como expandido para
  // siempre (incluso mucho despues de dejar de ser el grupo activo), porque
  // expandidosManual nunca se limpiaba solo. Encontrado por revision
  // adversarial del diff de A.4, no en la verificacion manual original.
  // Ajustado durante el render (patron oficial de React para "resetear
  // estado cuando cambia una prop/valor"), no con useEffect + setState —
  // eso dispara un render en cascada que el propio linter marca como error.
  const [pathnamePrevio, setPathnamePrevio] = useState(pathname);
  if (pathname !== pathnamePrevio) {
    setPathnamePrevio(pathname);
    if (expandidosManual.size > 0) setExpandidosManual(new Set());
  }

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
    {
      href: "/app/ventas",
      label: "Ventas",
      icono: ShoppingCart,
      subitems: [
        { href: "/app/ventas", label: "Vender" },
        { href: "/app/ventas/historial", label: "Historial" },
        { href: "/app/ventas/clientes", label: "Clientes" },
        { href: "/app/ventas/canales", label: "Canales de venta" },
        { href: "/app/ventas/metodos-pago", label: "Métodos de pago" },
        { href: "/app/ventas/eventos", label: "Eventos" },
        { href: "/app/ventas/importar", label: "Importar histórico" },
      ],
    },
    { href: "/app/productos", label: "Catálogo", icono: Package },
    {
      href: "/app/patrimonio",
      label: "Bienes y deudas",
      icono: Building2,
      subitems: [
        { href: "/app/patrimonio", label: "Bienes" },
        { href: "/app/patrimonio/pasivos", label: "Deudas" },
      ],
    },
    {
      href: "/app/proveedores",
      label: "Proveedores",
      icono: Truck,
      subitems: [
        { href: "/app/proveedores", label: "Directorio" },
        { href: "/app/proveedores/compras", label: "Compras" },
      ],
    },
    ...(esOwner
      ? [
          {
            href: "/app/mi-negocio/colaboradores",
            label: "Mi negocio",
            icono: Settings,
            grupoBase: "/app/mi-negocio",
            subitems: [
              { href: "/app/onboarding", label: "Negocio" },
              { href: "/app/mi-negocio/colaboradores", label: "Colaboradores" },
              { href: "/app/mi-negocio/roles", label: "Roles" },
              { href: "/app/mi-negocio/capacidades", label: "Permisos especiales" },
              { href: "/app/mi-negocio/plan", label: "Mi Plan" },
            ],
          } satisfies ItemNav,
        ]
      : []),
    {
      href: "/app/gastos",
      label: "Gastos",
      icono: Receipt,
      subitems: [
        { href: "/app/gastos", label: "Gastos" },
        { href: "/app/gastos/recurrentes", label: "Recurrentes" },
      ],
    },
    {
      href: "/app/produccion",
      label: "Producción",
      icono: ChefHat,
      subitems: [
        { href: "/app/produccion", label: "Producciones" },
        { href: "/app/produccion/insumos", label: "Insumos" },
        { href: "/app/produccion/recetas", label: "Recetas" },
        { href: "/app/produccion/capacidad", label: "Capacidad" },
      ],
    },
    { href: "/app/simulaciones", label: "Simulador", icono: Calculator },
    { href: "/app/reportes", label: "Reportes", icono: BarChart3 },
    { href: "/app/consentimiento", label: "Compartir Datos", icono: KeyRound },
  ];

  function grupoActivo(item: ItemNav) {
    const base = item.grupoBase ?? item.href;
    if (base === "/app") return pathname === "/app";
    // "Mi negocio" cubre tanto el hub nuevo (Colaboradores/Roles/
    // Capacidades, dentro del shell) como el asistente de Onboarding
    // (fuera del shell a propósito, ver src/app/app/(shell)/layout.tsx) —
    // ambos se resaltan como la misma sección.
    if (base === "/app/mi-negocio") {
      return pathname.startsWith("/app/mi-negocio") || pathname.startsWith("/app/onboarding");
    }
    return pathname.startsWith(base);
  }

  function subitemActivo(sub: SubItemNav) {
    return pathname === sub.href;
  }

  function estaExpandido(item: ItemNav) {
    if (!item.subitems) return false;
    // El grupo activo siempre se muestra expandido — no se puede colapsar
    // la sección en la que ya estás parado. Los demás grupos se expanden
    // manualmente para "espiar" sin navegar.
    return grupoActivo(item) || expandidosManual.has(item.href);
  }

  function toggleExpandido(href: string) {
    setExpandidosManual((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(href)) {
        siguiente.delete(href);
      } else {
        siguiente.add(href);
      }
      return siguiente;
    });
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
        onFocus={() => colapsado && setHovering(true)}
        onBlur={(e) => {
          // Sin este guard, tabular ENTRE dos elementos del propio sidebar
          // dispara onBlur/onFocus intercalados y hace parpadear
          // mostrarExpandido — solo apagamos el preview cuando el foco sale
          // del aside por completo. Sin este onFocus/onBlur, un usuario de
          // teclado con el sidebar colapsado no tenia forma de revelar los
          // submenus (solo el mouse disparaba el preview) — encontrado por
          // revision adversarial del diff de A.4.
          if (!e.currentTarget.contains(e.relatedTarget)) setHovering(false);
        }}
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
          {items.map((item) => {
            const activo = grupoActivo(item);
            const tieneSubitems = !!item.subitems && item.subitems.length > 0;
            const expandido = tieneSubitems && mostrarExpandido && estaExpandido(item);
            const idSubmenu = `submenu-${item.href.replace(/^\//, "").replace(/\//g, "-")}`;
            return (
              <div key={item.href}>
                <div className="flex items-center gap-1">
                  <Link
                    href={item.href}
                    onClick={() => setAbierto(false)}
                    title={mostrarExpandido ? undefined : item.label}
                    className={cn(
                      "flex flex-1 items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-white/80 transition-colors hover:bg-sidebar-accent hover:text-white",
                      activo && "bg-sidebar-accent text-white",
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
                  {/* El grupo activo no muestra chevron: ya esta forzado a
                      expandido (estaExpandido) y no se puede colapsar
                      mientras se este parado ahi, asi que un boton que
                      pareciera "Contraer" pero no hiciera nada seria
                      enganoso — encontrado por revision adversarial del
                      diff de A.4. */}
                  {tieneSubitems && mostrarExpandido && !activo && (
                    <button
                      type="button"
                      onClick={() => toggleExpandido(item.href)}
                      aria-expanded={expandido}
                      aria-controls={idSubmenu}
                      aria-label={expandido ? `Contraer ${item.label}` : `Expandir ${item.label}`}
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-sidebar-accent hover:text-white"
                    >
                      <ChevronDown
                        className={cn("size-4 transition-transform duration-200", expandido && "rotate-180")}
                      />
                    </button>
                  )}
                </div>

                {expandido && (
                  <div id={idSubmenu} className="mt-1 ml-4 space-y-0.5 border-l border-white/10 pl-3">
                    {item.subitems!.map((sub) => (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        onClick={() => setAbierto(false)}
                        className={cn(
                          "block rounded-lg px-3 py-1.5 text-sm text-white/70 transition-colors hover:bg-sidebar-accent hover:text-white",
                          subitemActivo(sub) && "bg-sidebar-accent text-white"
                        )}
                      >
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
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
