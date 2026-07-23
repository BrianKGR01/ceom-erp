"use client";

import { Check, Mail } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-error";
import { solicitarCambioDeContrasena } from "./actions";

export function CambiarContrasenaForm() {
  const [estado, formAction, pending] = useActionState(solicitarCambioDeContrasena, null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cambiar mi contraseña</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="max-w-prose text-sm text-text-muted">
          Te mandamos un enlace a tu correo para que elijas una contraseña nueva. Es el mismo
          camino que usás si te la olvidás, y sirve para confirmar que sos vos aunque alguien
          haya dejado esta sesión abierta.
        </p>

        <form action={formAction} className="mt-4">
          {estado && !estado.ok && <FormError className="mb-3">{estado.error}</FormError>}
          {estado?.ok ? (
            <p
              role="status"
              className="flex items-center gap-1.5 rounded-lg bg-success-bg px-3 py-2 text-xs text-success-text"
            >
              <Check className="size-3.5 shrink-0" />
              {estado.mensaje}
            </p>
          ) : (
            <Button type="submit" disabled={pending} className="gap-2">
              <Mail className="size-4" />
              {pending ? "Enviando..." : "Mandarme el enlace"}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
