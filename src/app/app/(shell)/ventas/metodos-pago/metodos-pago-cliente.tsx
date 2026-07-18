"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreditCard, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { metodoPagoFormSchema } from "@/modules/ventas/validation";
import type { z } from "zod";
import {
  actualizarMetodoPagoAction,
  crearMetodoPagoAction,
  toggleMetodoPagoActivoAction,
} from "../actions";

type MetodoFormInput = z.infer<typeof metodoPagoFormSchema>;

export interface MetodoListado {
  id: string;
  nombre: string;
  activo: boolean;
}

function MetodoFormDialog({
  open,
  onOpenChange,
  metodo,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metodo?: MetodoListado;
  onSaved: () => void;
}) {
  const form = useForm<MetodoFormInput>({
    resolver: zodResolver(metodoPagoFormSchema),
    values: { nombre: metodo?.nombre ?? "" },
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(values: MetodoFormInput) {
    setGuardando(true);
    setError(null);
    const resultado = metodo
      ? await actualizarMetodoPagoAction(metodo.id, values)
      : await crearMetodoPagoAction(values);
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{metodo ? "Editar método de pago" : "Nuevo método de pago"}</DialogTitle>
          <DialogDescription>
            {metodo ? "Actualizá el nombre." : "Agregá una forma de cobro."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" placeholder="Ej. Transferencia bancaria" {...form.register("nombre")} />
            {form.formState.errors.nombre && (
              <p className="text-xs text-error-text">{form.formState.errors.nombre.message}</p>
            )}
          </div>

          {error && <p className="text-xs text-error-text">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MetodosPagoCliente({ metodos }: { metodos: MetodoListado[] }) {
  const router = useRouter();
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [metodoEditando, setMetodoEditando] = useState<MetodoListado | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  function abrirNuevo() {
    setMetodoEditando(undefined);
    setDialogoAbierto(true);
  }

  function abrirEdicion(metodo: MetodoListado) {
    setMetodoEditando(metodo);
    setDialogoAbierto(true);
  }

  async function toggleActivo(metodo: MetodoListado) {
    setError(null);
    const resultado = await toggleMetodoPagoActivoAction(metodo.id, !metodo.activo);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button onClick={abrirNuevo}>
          <Plus className="size-4" />
          Nuevo método
        </Button>
      </div>

      {error && <p className="text-xs text-error-text">{error}</p>}

      {metodos.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="Todavía no tenés métodos de pago cargados"
          description="Agregá cómo te pagan tus clientes (efectivo, transferencia, tarjeta) para poder elegirlo al registrar una venta."
        />
      ) : (
        <div className="divide-y divide-gray-border rounded-2xl bg-card shadow-card">
          {metodos.map((metodo) => (
            <div key={metodo.id} className="flex items-center gap-3 p-4 text-sm">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-pastel-blue-bg text-primary">
                <CreditCard className="size-4" />
              </span>
              <p className="flex-1 text-text-body">{metodo.nombre}</p>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => abrirEdicion(metodo)}
                aria-label="Editar método de pago"
              >
                <Pencil className="size-4" />
              </Button>
              <Switch checked={metodo.activo} onCheckedChange={() => toggleActivo(metodo)} />
            </div>
          ))}
        </div>
      )}

      <MetodoFormDialog
        open={dialogoAbierto}
        onOpenChange={setDialogoAbierto}
        metodo={metodoEditando}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
