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
      <div className="relative hidden w-1/2 flex-col justify-between bg-gradient-to-b from-sidebar-from to-sidebar-to p-10 text-white lg:flex">
        <div>
          {/* Logo oficial (public/logo-CEOM.svg) sin recrear — se fuerza a
              blanco con un filtro CSS para que se lea sobre el navy, la
              referencia aprobada por el cliente lo muestra en blanco. */}
          <Logo className="h-7 w-auto brightness-0 invert" />
          <Link
            href="/"
            className="mt-10 inline-flex items-center gap-2 text-sm text-white/80 hover:text-white"
          >
            <ArrowLeft className="size-4" />
            Volver al inicio
          </Link>
        </div>

        <div>
          <h2 className="font-heading text-3xl leading-tight font-semibold">
            Tu negocio,
            <br />
            bajo <span className="text-pastel-blue">control.</span>
          </h2>
          <p className="mt-3 max-w-sm text-sm text-white/70">
            Gestioná ventas, costos y producción desde un solo lugar. Diseñado
            para emprendedores.
          </p>

          <ul className="mt-8 space-y-4">
            {bullets.map(({ icon: Icon, texto, detalle }) => (
              <li key={texto} className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10">
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

      <div className="flex flex-1 items-center justify-center bg-background p-6">
        <LoginForm />
      </div>
    </div>
  );
}
