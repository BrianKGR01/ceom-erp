"use client";

import { useState } from "react";
import { CheckCircle2, KeyRound, Lock, Mail } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { canjearCodigoAccesoAction, solicitarMagicLinkInstitucionAction } from "./actions";

const TIPOS_INSTITUCION: { value: "universidad" | "incubadora" | "organizacion"; label: string }[] = [
  { value: "universidad", label: "Universidad" },
  { value: "incubadora", label: "Incubadora" },
  { value: "organizacion", label: "Organización" },
];

type Paso = "codigo" | "reingreso" | "reingreso_enviado" | "institucion" | "listo";

export function CanjearCliente() {
  const [paso, setPaso] = useState<Paso>("codigo");
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<"universidad" | "incubadora" | "organizacion">("organizacion");
  const [contacto, setContacto] = useState("");
  const [email, setEmail] = useState("");
  const [emailReingreso, setEmailReingreso] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function continuarConCodigo() {
    if (!codigo.trim()) {
      setError("Ingresá el código de acceso.");
      return;
    }
    setError(null);
    setPaso("institucion");
  }

  async function confirmarCanje() {
    if (!nombre.trim()) {
      setError("Ponele un nombre a tu institución.");
      return;
    }
    if (!email.trim()) {
      setError("Ingresá tu email — es lo que te va a permitir volver a entrar más adelante.");
      return;
    }
    setEnviando(true);
    setError(null);
    const resultado = await canjearCodigoAccesoAction({
      codigo: codigo.trim(),
      institucionNueva: {
        nombre: nombre.trim(),
        tipo,
        contacto: contacto.trim() || undefined,
        email: email.trim(),
      },
    });
    setEnviando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    setPaso("listo");
  }

  async function enviarMagicLink() {
    if (!emailReingreso.trim()) {
      setError("Ingresá tu email.");
      return;
    }
    setEnviando(true);
    setError(null);
    await solicitarMagicLinkInstitucionAction(emailReingreso.trim());
    setEnviando(false);
    setPaso("reingreso_enviado");
  }

  if (paso === "listo") {
    return (
      <div className="w-full max-w-sm rounded-2xl bg-card p-8 text-center shadow-card">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-success-bg text-success-text">
          <CheckCircle2 className="size-7" />
        </span>
        <h1 className="mt-4 font-heading text-lg font-semibold text-navy">Acceso otorgado</h1>
        <p className="mt-2 text-sm text-text-muted">
          Ya podés hacer seguimiento de este negocio. El panel donde vas a ver los datos
          compartidos está por construirse — mientras tanto, guardá tu email: la próxima vez podés
          volver a entrar desde &ldquo;¿Ya tenés acceso?&rdquo; sin el código.
        </p>
      </div>
    );
  }

  if (paso === "reingreso_enviado") {
    return (
      <div className="w-full max-w-sm rounded-2xl bg-card p-8 text-center shadow-card">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-pastel-blue-bg text-primary">
          <Mail className="size-7" />
        </span>
        <h1 className="mt-4 font-heading text-lg font-semibold text-navy">Revisá tu correo</h1>
        <p className="mt-2 text-sm text-text-muted">
          Si existe una cuenta con ese email, te enviamos un enlace para entrar. Puede tardar
          unos minutos en llegar.
        </p>
        <Button variant="outline" onClick={() => setPaso("codigo")} className="mt-6 w-full justify-center">
          Volver
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-2xl bg-card p-8 shadow-card">
      <Logo className="mx-auto mb-6 h-10 w-auto" />

      {paso === "codigo" ? (
        <>
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-pastel-blue-bg text-primary">
            <KeyRound className="size-5" />
          </span>
          <h1 className="mt-3 text-center font-heading text-lg font-semibold text-navy">
            Ingresar Código
          </h1>
          <p className="mt-1 text-center text-sm text-text-muted">
            Ingresá el código de acceso único para continuar.
          </p>

          <div className="mt-6 space-y-1.5">
            <Label
              htmlFor="codigo"
              className="text-[11px] font-normal tracking-wide text-text-muted uppercase"
            >
              Código de acceso
            </Label>
            <Input
              id="codigo"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="Ej: ABC-123-XYZ"
              className="text-center font-heading tracking-widest uppercase"
              onKeyDown={(e) => e.key === "Enter" && continuarConCodigo()}
            />
          </div>

          {error && (
            <p role="alert" className="mt-2 text-xs text-error-text">
              {error}
            </p>
          )}

          <Button onClick={continuarConCodigo} className="mt-4 w-full justify-center gap-2">
            Ingresar
          </Button>

          <button
            type="button"
            onClick={() => {
              setError(null);
              setPaso("reingreso");
            }}
            className="mt-4 w-full text-center text-xs font-medium text-primary hover:underline"
          >
            ¿Ya tenés acceso? Iniciá con tu email
          </button>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-text-muted">
            <Lock className="size-3.5 text-success-text" />
            Acceso seguro y encriptado.
          </p>
        </>
      ) : paso === "reingreso" ? (
        <>
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-pastel-blue-bg text-primary">
            <Mail className="size-5" />
          </span>
          <h1 className="mt-3 text-center font-heading text-lg font-semibold text-navy">
            Iniciar con tu email
          </h1>
          <p className="mt-1 text-center text-sm text-text-muted">
            Te enviamos un enlace de acceso único a tu correo — sin contraseña.
          </p>

          <div className="mt-6 space-y-1.5">
            <Label
              htmlFor="email-reingreso"
              className="text-[11px] font-normal tracking-wide text-text-muted uppercase"
            >
              Email
            </Label>
            <Input
              id="email-reingreso"
              type="email"
              value={emailReingreso}
              onChange={(e) => setEmailReingreso(e.target.value)}
              placeholder="tu@correo.com"
              onKeyDown={(e) => e.key === "Enter" && enviarMagicLink()}
              autoFocus
            />
          </div>

          {error && (
            <p role="alert" className="mt-2 text-xs text-error-text">
              {error}
            </p>
          )}

          <Button onClick={enviarMagicLink} disabled={enviando} className="mt-4 w-full justify-center">
            {enviando ? "Enviando..." : "Enviar enlace"}
          </Button>

          <button
            type="button"
            onClick={() => {
              setError(null);
              setPaso("codigo");
            }}
            className="mt-4 w-full text-center text-xs font-medium text-primary hover:underline"
          >
            Volver a ingresar código
          </button>
        </>
      ) : (
        <>
          <h1 className="text-center font-heading text-lg font-semibold text-navy">
            Contanos quién sos
          </h1>
          <p className="mt-1 text-center text-sm text-text-muted">
            No encontramos una cuenta con este código todavía — completá estos datos para crear tu
            perfil de institución.
          </p>

          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nombre">Nombre de la institución</Label>
              <Input
                id="nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Universidad del Valle"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tipo">Tipo</Label>
              <Select
                items={Object.fromEntries(TIPOS_INSTITUCION.map((t) => [t.value, t.label]))}
                value={tipo}
                onValueChange={(v) => v && setTipo(v as typeof tipo)}
              >
                <SelectTrigger id="tipo" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_INSTITUCION.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
              />
              <p className="text-[11px] text-text-muted">
                Lo vas a usar para volver a entrar más adelante, sin el código.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contacto">Otro contacto (opcional)</Label>
              <Input
                id="contacto"
                value={contacto}
                onChange={(e) => setContacto(e.target.value)}
                placeholder="Teléfono, por ejemplo"
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="mt-2 text-xs text-error-text">
              {error}
            </p>
          )}

          <div className="mt-6 flex gap-2">
            <Button variant="outline" onClick={() => setPaso("codigo")} className="flex-1 justify-center">
              Atrás
            </Button>
            <Button onClick={confirmarCanje} disabled={enviando} className="flex-1 justify-center">
              {enviando ? "Confirmando..." : "Confirmar"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
