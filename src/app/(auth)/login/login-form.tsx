"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { iniciarSesion } from "./actions";

export function LoginForm() {
  const [estado, formAction, pending] = useActionState(iniciarSesion, null);
  const [mostrarPassword, setMostrarPassword] = useState(false);

  return (
    <div className="w-full max-w-sm rounded-2xl bg-card p-8 shadow-card">
      {/* Logo oficial en su color natural (sin filtro) — regla del
          design-system: usar public/logo-CEOM.svg tal cual existe. */}
      <Logo className="mx-auto mb-6 h-10 w-auto" />

      <h1 className="text-center font-heading text-lg font-semibold text-navy">
        ¡Bienvenid@ de vuelta!
      </h1>
      <p className="mt-1 text-center text-sm text-text-muted">
        Ingresá tus datos para acceder a tu cuenta
      </p>

      <form action={formAction} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label
            htmlFor="email"
            className="text-[11px] font-normal tracking-wide text-text-muted uppercase"
          >
            Correo electrónico
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="tu@correo.com"
            required
            autoComplete="email"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label
              htmlFor="password"
              className="text-[11px] font-normal tracking-wide text-text-muted uppercase"
            >
              Contraseña
            </Label>
            <a href="#" className="text-xs font-medium text-primary hover:underline">
              ¿Olvidaste tu contraseña?
            </a>
          </div>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={mostrarPassword ? "text" : "password"}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="pr-9"
            />
            <button
              type="button"
              onClick={() => setMostrarPassword((v) => !v)}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 text-text-muted"
              aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {mostrarPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
        </div>

        {estado && !estado.ok && (
          <p role="alert" className="text-xs text-error-text">
            {estado.error}
          </p>
        )}

        <Button type="submit" disabled={pending} className="w-full justify-center gap-2">
          {pending ? "Ingresando..." : "Iniciar Sesión"}
          <ArrowRight className="size-4" />
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-text-muted">
        ¿No tenés cuenta?{" "}
        <a href="#" className="font-medium text-primary hover:underline">
          Crear cuenta gratis
        </a>
      </p>
    </div>
  );
}
