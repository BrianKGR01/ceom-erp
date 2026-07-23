import { RecuperarForm } from "./recuperar-form";

// Publica: quien llega acá justamente no puede entrar. Vive en el route group
// (auth) junto al login, sin el panel lateral de marca — es una pantalla de
// paso, no la puerta principal.
export default function RecuperarContrasenaPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <RecuperarForm />
    </div>
  );
}
