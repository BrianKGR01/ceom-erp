import { CanjearCliente } from "./canjear-cliente";

// /portal es publica (sin sesion Supabase) — Modulo_11 seccion 3.4: primera
// vez via Codigo de Acceso, sin cuenta CEOM. El resto del Portal (Mi
// Cartera + magic link) es roadmap item #11, no esta pantalla.
export default function PortalCanjearPage() {
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

      <div className="flex flex-1 items-center justify-center bg-background p-6">
        <CanjearCliente />
      </div>
    </div>
  );
}
