import {
  DefinirContrasenaForm,
  type MotivoDefinirContrasena,
} from "./definir-contrasena-form";

// Vive FUERA del route group (shell) a proposito, al lado de onboarding: el
// layout de (shell) manda al Owner con onboarding pendiente a /app/onboarding
// (ver src/app/app/(shell)/layout.tsx), y el dueño recien invitado es
// exactamente ese caso — quedaria rebotado a configurar el negocio antes de
// tener contraseña. El gate de "hay sesion" ya lo pone src/app/app/layout.tsx,
// y la sesion la acaba de crear /app/auth/callback.
export default async function DefinirContrasenaPage({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>;
}) {
  const { motivo } = await searchParams;
  // Por defecto "recuperacion": es el copy neutro. Solo el callback de una
  // invitacion promete "es el último paso para entrar a tu negocio".
  const motivoValido: MotivoDefinirContrasena =
    motivo === "invitacion" ? "invitacion" : "recuperacion";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <DefinirContrasenaForm motivo={motivoValido} />
    </div>
  );
}
