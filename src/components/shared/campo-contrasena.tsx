"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Mismo campo con ojito que ya tenia el login inline (login-form.tsx), sacado
// a un componente porque a partir de acá lo usan tres pantallas distintas
// (fijar contraseña desde invitacion, desde recuperacion, y cambiarla desde
// la sesion). El login no se toca: ya esta verificado y su markup es parte de
// la composicion aprobada del design-system.
export function CampoContrasena({
  id,
  name,
  label,
  autoComplete,
  ayuda,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: "current-password" | "new-password";
  ayuda?: string;
}) {
  const [mostrar, setMostrar] = useState(false);

  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={id}
        className="text-[11px] font-normal tracking-wide text-text-muted uppercase"
      >
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={mostrar ? "text" : "password"}
          placeholder="••••••••"
          required
          autoComplete={autoComplete}
          aria-describedby={ayuda ? `${id}-ayuda` : undefined}
          className="pr-9"
        />
        <button
          type="button"
          onClick={() => setMostrar((v) => !v)}
          className="absolute top-1/2 right-2.5 -translate-y-1/2 text-text-muted"
          aria-label={mostrar ? "Ocultar contraseña" : "Mostrar contraseña"}
        >
          {mostrar ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {ayuda && (
        <p id={`${id}-ayuda`} className="text-[11px] text-text-muted">
          {ayuda}
        </p>
      )}
    </div>
  );
}
