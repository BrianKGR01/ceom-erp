import { ArrowLeft, Bot, Target, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { LoginForm } from "./login-form";

const bullets = [
  {
    icon: Target,
    texto: "Calculá tu punto de equilibrio al instante",
    detalle: "Tomá decisiones con datos reales.",
  },
  {
    icon: TrendingUp,
    texto: "Controlá ventas y costos en tiempo real",
    detalle: "Monitoreá tu negocio en todo momento.",
  },
  {
    icon: Bot,
    texto: "Tuki IA te asesora 24/7 con tus datos",
    detalle: "Tu asistente inteligente siempre disponible.",
  },
];

export default function LoginPage() {
  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-1/2 flex-col overflow-hidden bg-gradient-to-b from-sidebar-from to-sidebar-to text-white lg:flex">
        {/* Circulos decorativos difuminados — parte de la composicion de
            referencia aprobada por el cliente (design-system.md 5.8: la
            estructura/composicion del login se mantiene tal cual). */}
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

        <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-between px-8 py-12">
          <div>
            {/* Logo oficial (public/logo-CEOM.svg) sin recrear — se fuerza a
                blanco con un filtro CSS para que se lea sobre el navy, la
                referencia aprobada por el cliente lo muestra en blanco. */}
            <Logo className="h-8 w-auto brightness-0 invert" />
            <Link
              href="/"
              className="mt-10 inline-flex items-center gap-2 text-sm text-white/80 hover:text-white"
            >
              <ArrowLeft className="size-4" />
              Volver al inicio
            </Link>
          </div>

          <div>
            <h2 className="font-heading text-4xl leading-tight font-semibold xl:text-5xl">
              Tu negocio,
              <br />
              bajo{" "}
              <span className="bg-gradient-to-r from-pastel-blue to-white bg-clip-text text-transparent">
                control.
              </span>
            </h2>
            <p className="mt-4 max-w-sm text-base text-white/70">
              Gestioná ventas, costos y producción desde un solo lugar.
              Diseñado para emprendedores.
            </p>

            <ul className="mt-10 space-y-5">
              {bullets.map(({ icon: Icon, texto, detalle }) => (
                <li key={texto} className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10">
                    <Icon className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">{texto}</p>
                    <p className="text-xs text-white/60">{detalle}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div aria-hidden />
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-background p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute top-10 right-10 size-40 rounded-full bg-pastel-blue-bg blur-2xl"
        />
        <LoginForm />
        <MiniChart className="pointer-events-none absolute right-10 bottom-14 hidden text-primary/70 sm:block" />
        <PottedPlant className="pointer-events-none absolute bottom-8 left-10 hidden text-pastel-blue sm:block" />
      </div>
    </div>
  );
}

// Ilustraciones decorativas propias del login (no son la marca CEOM, no
// aplica la regla de "usar los SVG oficiales tal cual") — replican los
// adornos de estadisticas/planta de la referencia aprobada.
function MiniChart({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 40" width="64" height="40" className={className} fill="none">
      <path
        d="M2 32 L16 22 L28 27 L42 10 L62 4"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="62" cy="4" r="4" fill="currentColor" />
    </svg>
  );
}

function PottedPlant({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 44" width="40" height="44" className={className} fill="none">
      <path
        d="M20 26V10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M20 18c0-6-8-6-8-12 6 0 8 4 8 8Z"
        fill="currentColor"
        opacity="0.5"
      />
      <path
        d="M20 14c0-6 8-6 8-12-6 0-8 4-8 8Z"
        fill="currentColor"
        opacity="0.8"
      />
      <path
        d="M10 26h20l-2.5 14a2 2 0 0 1-2 1.7H14.5a2 2 0 0 1-2-1.7L10 26Z"
        fill="currentColor"
        opacity="0.9"
      />
    </svg>
  );
}
