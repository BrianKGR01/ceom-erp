import { AlertTriangle, LayoutDashboard } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { obtenerInstitucionActual } from "@/modules/consentimiento/actions";
import { cerrarSesionInstitucionAction } from "./actions";
import { CanjearCliente } from "./canjear-cliente";

const MENSAJE_ERROR: Record<string, string> = {
  enlace_invalido: "Ese enlace ya no es válido — puede haber expirado o ya haberse usado. Pedí uno nuevo.",
  sin_institucion: "No encontramos una cuenta asociada a ese enlace.",
};

// /portal es publica (sin sesion Supabase requerida para entrar) — Modulo_11
// seccion 3.4: primera vez via Codigo de Acceso, reingresos via magic link
// (CEOM_Arquitectura.md seccion 8.3). "Mi Cartera" real (el contenido que
// una Institucion ve una vez logueada) es roadmap item #11, no esta
// pantalla — acá solo se cierra el mecanismo de entrada/reingreso.
export default async function PortalCanjearPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const institucion = await obtenerInstitucionActual();
  const { error } = await searchParams;
  const mensajeError = error ? (MENSAJE_ERROR[error] ?? "Algo salió mal — intentá de nuevo.") : null;

  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-1/2 flex-col overflow-hidden bg-gradient-to-b from-sidebar-from to-sidebar-to text-white lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-pastel-blue/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/3 -left-16 size-72 rounded-full bg-primary/25 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 right-10 size-96 rounded-full bg-pastel-blue/10 blur-3xl"
        />

        <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-8 py-12">
          <h2 className="font-heading text-3xl leading-tight font-semibold xl:text-4xl">
            Accedé al seguimiento de un emprendimiento.
          </h2>
          <p className="mt-4 max-w-sm text-base text-white/70">
            Visualizá datos compartidos de forma segura. Ingresá el código proporcionado por el
            negocio que te invitó a hacer seguimiento.
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-background p-6">
        {mensajeError && !institucion && (
          <div className="flex w-full max-w-sm items-start gap-2 rounded-xl bg-warning-bg p-3 text-sm text-warning-text">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>{mensajeError}</p>
          </div>
        )}
        {institucion ? (
          <div className="w-full max-w-sm rounded-2xl bg-card p-8 text-center shadow-card">
            <Logo className="mx-auto mb-6 h-10 w-auto" />
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-pastel-blue-bg text-primary">
              <LayoutDashboard className="size-7" />
            </span>
            <h1 className="mt-4 font-heading text-lg font-semibold text-navy">
              Hola, {institucion.nombre}
            </h1>
            <p className="mt-2 text-sm text-text-muted">
              Ya iniciaste sesión. Tu panel de seguimiento (Mi Cartera) todavía se está
              construyendo — por ahora esto solo confirma que tu acceso funciona.
            </p>
            <form action={cerrarSesionInstitucionAction} className="mt-6">
              <Button type="submit" variant="outline" className="w-full justify-center">
                Cerrar sesión
              </Button>
            </form>
          </div>
        ) : (
          <CanjearCliente />
        )}
      </div>
    </div>
  );
}
