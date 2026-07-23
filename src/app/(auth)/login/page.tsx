import { ArrowLeft, Boxes, Target, TrendingUp } from "lucide-react";
import Link from "next/link";
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
    // Este bullet anunciaba "Tuki IA te asesora 24/7 con tus datos"
    // (hallazgos.md H-06). No existe ninguna funcionalidad de asistente en
    // el producto: la unica otra mencion de Tuki en el repo es una idea a
    // futuro en simulaciones/ANCLA.md. Se reemplaza por Produccion, que si
    // existe y ya esta nombrada en el subtitulo de al lado.
    icon: Boxes,
    texto: "Seguí tu producción y el stock de tus insumos",
    detalle: "De la receta al producto terminado, en un solo flujo.",
  },
];

// Mensajes de los enlaces de correo que no pudieron canjearse
// (/app/auth/callback redirige acá con el motivo) — mismo patron que
// /portal/page.tsx para el magic link de Instituciones.
const MENSAJE_ERROR: Record<string, string> = {
  enlace_vencido:
    "Ese enlace ya no sirve — vencen al rato y son de un solo uso. Pedí uno nuevo abajo.",
  enlace_invalido: "Ese enlace no es válido. Revisá que lo hayas copiado completo.",
  cuenta_incompleta:
    "Tu contraseña quedó guardada, pero tu cuenta todavía no está configurada del todo. Contactá a soporte.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const aviso = error ? (MENSAJE_ERROR[error] ?? "Algo salió mal — intentá de nuevo.") : null;

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
            {/* Siempre apegado a la izquierda arriba del panel. */}
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-white/80 hover:text-white"
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

      <div className="flex flex-1 items-center justify-center bg-background p-6">
        <LoginForm aviso={aviso} />
      </div>
    </div>
  );
}
