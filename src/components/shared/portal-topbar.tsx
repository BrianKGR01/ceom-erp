import { LogOut } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { cerrarSesionInstitucionAction } from "@/app/portal/actions";

// Header horizontal de /portal (Institucion autenticada) — a diferencia de
// AppShell/AdminShell (sidebar), Modulo 11 seccion 3.3 no necesita
// navegacion multi-item: solo "Mi Cartera" como raiz y la Ficha de Tenant
// como detalle con boton "Volver", asi que un top bar simple alcanza.
export function PortalTopbar({ children }: { children?: React.ReactNode }) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-border bg-card px-6">
      <div className="flex items-center gap-6">
        <Logo className="h-7 w-auto" />
        {children}
      </div>
      <form action={cerrarSesionInstitucionAction}>
        <button
          type="submit"
          className="flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-navy"
        >
          Cerrar sesión
          <LogOut className="size-4" />
        </button>
      </form>
    </header>
  );
}
