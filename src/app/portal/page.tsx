import { AlertTriangle } from "lucide-react";
import { obtenerInstitucionActual } from "@/modules/consentimiento/actions";
import { listarPlanes } from "@/modules/suscripcion/actions";
import { listarCarteraAction } from "./actions";
import { CanjearCliente } from "./canjear-cliente";
import { CarteraCliente } from "./cartera-cliente";

const MENSAJE_ERROR: Record<string, string> = {
  enlace_invalido: "Ese enlace ya no es válido — puede haber expirado o ya haberse usado. Pedí uno nuevo.",
  sin_institucion: "No encontramos una cuenta asociada a ese enlace.",
};

// /portal es publica (sin sesion Supabase requerida para entrar) — Modulo_11
// seccion 3.4: primera vez via Codigo de Acceso, reingresos via magic link
// (CEOM_Arquitectura.md seccion 8.3). Institucion autenticada -> Mi Cartera
// (Modulo 11, Monitoreo Institucional); sin sesion -> canje de Codigo/reingreso.
export default async function PortalCanjearPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const institucion = await obtenerInstitucionActual();
  const { error } = await searchParams;
  const mensajeError = error ? (MENSAJE_ERROR[error] ?? "Algo salió mal — intentá de nuevo.") : null;

  if (institucion) {
    const [carteraRes, planes] = await Promise.all([listarCarteraAction(), listarPlanes()]);
    return (
      <CarteraCliente
        nombreInstitucion={institucion.nombre}
        cartera={carteraRes.ok ? carteraRes.data : []}
        planes={planes.map((p) => ({ id: p.id, nombre: p.nombre }))}
      />
    );
  }

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
        {mensajeError && (
          <div className="flex w-full max-w-sm items-start gap-2 rounded-xl bg-warning-bg p-3 text-sm text-warning-text">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>{mensajeError}</p>
          </div>
        )}
        <CanjearCliente />
      </div>
    </div>
  );
}
