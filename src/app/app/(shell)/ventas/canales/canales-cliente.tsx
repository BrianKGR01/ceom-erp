"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Store, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { canalVentaFormSchema } from "@/modules/ventas/validation";
import type { z } from "zod";
import {
  actualizarCanalVentaAction,
  crearCanalVentaAction,
  eliminarCanalVentaAction,
  toggleCanalVentaActivoAction,
} from "../actions";

type CanalFormInput = z.infer<typeof canalVentaFormSchema>;

export interface CanalListado {
  id: string;
  nombre: string;
  porcentajeComisionDefault: string | null;
  activo: boolean;
}

function CanalFormDialog({
  open,
  onOpenChange,
  canal,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canal?: CanalListado;
  onSaved: () => void;
}) {
  const form = useForm<CanalFormInput>({
    resolver: zodResolver(canalVentaFormSchema),
    values: {
      nombre: canal?.nombre ?? "",
      porcentajeComisionDefault: canal?.porcentajeComisionDefault
        ? Number(canal.porcentajeComisionDefault)
        : undefined,
    },
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(values: CanalFormInput) {
    setGuardando(true);
    setError(null);
    const resultado = canal
      ? await actualizarCanalVentaAction(canal.id, values)
      : await crearCanalVentaAction(values);
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
          <DialogTitle>{canal ? "Editar canal" : "Nuevo canal"}</DialogTitle>
          <DialogDescription>
            {canal ? "Actualizá el nombre o la comisión por defecto." : "Agregá una plataforma de venta."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" placeholder="Ej. PedidosYa" {...form.register("nombre")} />
            {form.formState.errors.nombre && (
              <p className="text-xs text-error-text">{form.formState.errors.nombre.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="porcentajeComisionDefault">Comisión por defecto % (opcional)</Label>
            <Input
              id="porcentajeComisionDefault"
              type="number"
              step="0.01"
              min={0}
              max={100}
              placeholder="0.00"
              {...form.register("porcentajeComisionDefault", { valueAsNumber: true })}
            />
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

export function CanalesCliente({ canales }: { canales: CanalListado[] }) {
  const router = useRouter();
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [canalEditando, setCanalEditando] = useState<CanalListado | undefined>(undefined);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function abrirNuevo() {
    setCanalEditando(undefined);
    setDialogoAbierto(true);
  }

  function abrirEdicion(canal: CanalListado) {
    setCanalEditando(canal);
    setDialogoAbierto(true);
  }

  async function toggleActivo(canal: CanalListado) {
    setError(null);
    const resultado = await toggleCanalVentaActivoAction(canal.id, !canal.activo);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    router.refresh();
  }

  async function confirmarEliminar(canalId: string) {
    setEliminando(true);
    setError(null);
    const resultado = await eliminarCanalVentaAction(canalId);
    setEliminando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    setEliminandoId(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button onClick={abrirNuevo}>
          <Plus className="size-4" />
          Nuevo canal
        </Button>
      </div>

      {error && <p className="text-xs text-error-text">{error}</p>}

      {canales.length === 0 ? (
        <EmptyState
          icon={Store}
          title="Todavía no tenés canales de venta cargados"
          description="Agregá dónde vendés (local físico, delivery, redes) para poder elegirlo al registrar una venta."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {canales.map((canal) => (
            <Card key={canal.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-pastel-blue-bg text-primary">
                      <Store className="size-4" />
                    </span>
                    <p className="font-heading text-sm font-semibold text-navy">{canal.nombre}</p>
                  </div>
                  <Switch checked={canal.activo} onCheckedChange={() => toggleActivo(canal)} />
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between border-t border-gray-border pt-3 text-sm">
                <span className="text-text-muted">Comisión por defecto</span>
                <div className="flex items-center gap-1">
                  <span className="font-medium text-navy">
                    {canal.porcentajeComisionDefault
                      ? `${Number(canal.porcentajeComisionDefault).toFixed(2)}%`
                      : "—"}
                  </span>
                  {eliminandoId === canal.id ? (
                    <div className="ml-2 flex items-center gap-1">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => confirmarEliminar(canal.id)}
                        disabled={eliminando}
                      >
                        Sí, eliminar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setEliminandoId(null)}>
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => abrirEdicion(canal)}
                        aria-label="Editar canal"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          setError(null);
                          setEliminandoId(canal.id);
                        }}
                        aria-label="Eliminar canal"
                      >
                        <Trash2 className="size-4 text-error-text" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CanalFormDialog
        open={dialogoAbierto}
        onOpenChange={setDialogoAbierto}
        canal={canalEditando}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
