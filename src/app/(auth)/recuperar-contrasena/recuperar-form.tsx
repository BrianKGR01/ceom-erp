"use client";

import { ArrowLeft, ArrowRight, MailCheck } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { solicitarRecuperacion } from "./actions";

export function RecuperarForm() {
  const [estado, formAction, pending] = useActionState(solicitarRecuperacion, null);

  // Enviado el pedido, el formulario se reemplaza por el acuse: volver a
  // mostrarlo invitaria a reintentar y a chocar contra el cupo de envios.
  if (estado?.ok) {
    return (
      <div className="w-full max-w-sm rounded-2xl bg-card p-8 shadow-card">
        <Logo className="mx-auto mb-6 h-10 w-auto" />
        <div className="flex flex-col items-center text-center">
          <span className="mb-4 flex size-11 items-center justify-center rounded-full bg-success-bg">
            <MailCheck className="size-5 text-success-text" />
          </span>
          <h1 className="font-heading text-lg font-semibold text-navy">Revisá tu correo</h1>
          <p className="mt-2 text-sm text-text-muted">{estado.mensaje}</p>
        </div>
        <Link
          href="/login"
          className="mt-6 flex items-center justify-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          Volver a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-2xl bg-card p-8 shadow-card">
      <Logo className="mx-auto mb-6 h-10 w-auto" />

      <h1 className="text-center font-heading text-lg font-semibold text-navy">
        ¿Olvidaste tu contraseña?
      </h1>
      <p className="mt-1 text-center text-sm text-text-muted">
        Escribí tu correo y te mandamos un enlace para crear una nueva.
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

        {estado && !estado.ok && <FormError>{estado.error}</FormError>}

        <Button type="submit" disabled={pending} className="w-full justify-center gap-2">
          {pending ? "Enviando..." : "Enviarme el enlace"}
          <ArrowRight className="size-4" />
        </Button>
      </form>

      <Link
        href="/login"
        className="mt-6 flex items-center justify-center gap-1.5 text-xs font-medium text-primary hover:underline"
      >
        <ArrowLeft className="size-3.5" />
        Volver a iniciar sesión
      </Link>
    </div>
  );
}
