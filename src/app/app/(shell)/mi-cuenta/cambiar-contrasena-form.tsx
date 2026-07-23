"use client";

import { Check } from "lucide-react";
import { useActionState } from "react";
import { CampoContrasena } from "@/components/shared/campo-contrasena";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-error";
import { LARGO_MINIMO_CONTRASENA } from "@/lib/contrasena";
import { cambiarContrasena } from "./actions";

export function CambiarContrasenaForm() {
  const [estado, formAction, pending] = useActionState(cambiarContrasena, null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cambiar mi contraseña</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="max-w-sm space-y-4">
          {/* Se pide la actual porque acá no hubo ningun enlace de correo que
              probara la identidad — la unica prueba es la sesion abierta. */}
          <CampoContrasena
            id="actual"
            name="actual"
            label="Contraseña actual"
            autoComplete="current-password"
          />
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
            label="Repetí la contraseña nueva"
            autoComplete="new-password"
          />

          {estado && !estado.ok && <FormError>{estado.error}</FormError>}
          {estado?.ok && (
            <p
              role="status"
              className="flex items-center gap-1.5 rounded-lg bg-success-bg px-3 py-2 text-xs text-success-text"
            >
              <Check className="size-3.5 shrink-0" />
              {estado.mensaje}
            </p>
          )}

          <Button type="submit" disabled={pending}>
            {pending ? "Guardando..." : "Guardar contraseña"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
