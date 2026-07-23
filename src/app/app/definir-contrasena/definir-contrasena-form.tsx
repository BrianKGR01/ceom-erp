"use client";

import { ArrowRight } from "lucide-react";
import { useActionState } from "react";
import { Logo } from "@/components/brand/logo";
import { CampoContrasena } from "@/components/shared/campo-contrasena";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { LARGO_MINIMO_CONTRASENA } from "@/lib/contrasena";
import { definirContrasena } from "./actions";

export type MotivoDefinirContrasena = "invitacion" | "recuperacion";

// Una sola pieza para los dos casos que llegan con un token de correo: el
// dueño recien invitado (no tiene contraseña) y quien la olvido (la tiene
// pero no la recuerda). Mecanicamente son identicos — cambia el copy, no el
// formulario.
const COPY: Record<MotivoDefinirContrasena, { titulo: string; bajada: string; boton: string }> = {
  invitacion: {
    titulo: "Creá tu contraseña",
    bajada: "Es el último paso para entrar a tu negocio.",
    boton: "Crear contraseña y entrar",
  },
  recuperacion: {
    titulo: "Elegí una contraseña nueva",
    bajada: "Confirmamos que sos vos. Ahora elegí con qué vas a entrar.",
    boton: "Guardar y entrar",
  },
};

export function DefinirContrasenaForm({ motivo }: { motivo: MotivoDefinirContrasena }) {
  const [estado, formAction, pending] = useActionState(definirContrasena, null);
  const copy = COPY[motivo];

  return (
    <div className="w-full max-w-sm rounded-2xl bg-card p-8 shadow-card">
      <Logo className="mx-auto mb-6 h-10 w-auto" />

      <h1 className="text-center font-heading text-lg font-semibold text-navy">{copy.titulo}</h1>
      <p className="mt-1 text-center text-sm text-text-muted">{copy.bajada}</p>

      <form action={formAction} className="mt-6 space-y-4">
        <CampoContrasena
          id="contrasena"
          name="contrasena"
          label="Contraseña nueva"
          autoComplete="new-password"
          ayuda={`Al menos ${LARGO_MINIMO_CONTRASENA} caracteres.`}
        />
        <CampoContrasena
          id="confirmacion"
          name="confirmacion"
          label="Repetí la contraseña"
          autoComplete="new-password"
        />

        {estado && !estado.ok && <FormError>{estado.error}</FormError>}

        <Button type="submit" disabled={pending} className="w-full justify-center gap-2">
          {pending ? "Guardando..." : copy.boton}
          <ArrowRight className="size-4" />
        </Button>
      </form>
    </div>
  );
}
