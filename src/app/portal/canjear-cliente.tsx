"use client";

import { useState } from "react";
import { CheckCircle2, KeyRound, Lock } from "lucide-react";
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
import { canjearCodigoAccesoAction } from "./actions";

const TIPOS_INSTITUCION: { value: "universidad" | "incubadora" | "organizacion"; label: string }[] = [
  { value: "universidad", label: "Universidad" },
  { value: "incubadora", label: "Incubadora" },
  { value: "organizacion", label: "Organización" },
];

export function CanjearCliente() {
  const [paso, setPaso] = useState<"codigo" | "institucion" | "listo">("codigo");
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<"universidad" | "incubadora" | "organizacion">("organizacion");
  const [contacto, setContacto] = useState("");
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
    setEnviando(true);
    setError(null);
    const resultado = await canjearCodigoAccesoAction({
      codigo: codigo.trim(),
      institucionNueva: { nombre: nombre.trim(), tipo, contacto: contacto.trim() || undefined },
    });
    setEnviando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    setPaso("listo");
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
          compartidos está por construirse — mientras tanto, guardá este código, te va a servir
          para volver a entrar.
        </p>
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

          <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-text-muted">
            <Lock className="size-3.5 text-success-text" />
            Acceso seguro y encriptado.
          </p>
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
              <Label htmlFor="contacto">Contacto (opcional)</Label>
              <Input
                id="contacto"
                value={contacto}
                onChange={(e) => setContacto(e.target.value)}
                placeholder="Email o teléfono"
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
