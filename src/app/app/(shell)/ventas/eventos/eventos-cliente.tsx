"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Calendar, Lock, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { eventoFormSchema } from "@/modules/ventas/validation";
import type { z } from "zod";
import { abrirEventoAction, cerrarEventoAction, reabrirEventoAction } from "../actions";

type EventoFormInput = z.infer<typeof eventoFormSchema>;

export interface EventoListado {
  id: string;
  nombre: string;
  sucursalNombre: string;
  canalNombre: string;
  porcentajeComision: string | null;
  fechaInicio: string;
  fechaFin: string;
  estado: "abierto" | "cerrado";
}

// fechaInicio/fechaFin son rangos de dias completos sin componente horario
// significativo (se cargan desde un <input type="date">) — se formatean en
// UTC para no correr un dia en husos horarios detras de UTC (ej. Bolivia,
// UTC-4), que es el mercado real del producto.
function formatFecha(fecha: string): string {
  return new Date(fecha).toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function NuevoEventoDialog({
  open,
  onOpenChange,
  canales,
  sucursales,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canales: { id: string; nombre: string; porcentajeComisionDefault: string | null }[];
  sucursales: { id: string; nombre: string }[];
  onSaved: () => void;
}) {
  const form = useForm<EventoFormInput>({
    resolver: zodResolver(eventoFormSchema),
    defaultValues: {
      sucursalId: sucursales.length === 1 ? sucursales[0].id : "",
      canalVentaId: "",
      nombre: "",
      porcentajeComision: undefined,
      fechaInicio: "",
      fechaFin: "",
    },
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function elegirCanal(canalVentaId: string) {
    form.setValue("canalVentaId", canalVentaId);
    const canal = canales.find((c) => c.id === canalVentaId);
    if (canal?.porcentajeComisionDefault) {
      form.setValue("porcentajeComision", Number(canal.porcentajeComisionDefault));
    }
  }

  async function onSubmit(values: EventoFormInput) {
    setGuardando(true);
    setError(null);
    const resultado = await abrirEventoAction(values);
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    onOpenChange(false);
    form.reset();
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo evento</DialogTitle>
          <DialogDescription>Cargá una feria o pop-up para vender ahí.</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" placeholder="Ej. Feria Gastronómica Centro" {...form.register("nombre")} />
            {form.formState.errors.nombre && (
              <p className="text-xs text-error-text">{form.formState.errors.nombre.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sucursalId">Sucursal</Label>
            <Select
              items={Object.fromEntries(sucursales.map((s) => [s.id, s.nombre]))}
              value={form.watch("sucursalId") || ""}
              onValueChange={(value) => form.setValue("sucursalId", value ?? "")}
            >
              <SelectTrigger id="sucursalId" className="w-full">
                <SelectValue placeholder="Elegí una sucursal" />
              </SelectTrigger>
              <SelectContent>
                {sucursales.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.sucursalId && (
              <p className="text-xs text-error-text">{form.formState.errors.sucursalId.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="canalVentaId">Canal de venta</Label>
              <Select
                items={Object.fromEntries(canales.map((c) => [c.id, c.nombre]))}
                value={form.watch("canalVentaId") || ""}
                onValueChange={(value) => value && elegirCanal(value)}
              >
                <SelectTrigger id="canalVentaId" className="w-full">
                  <SelectValue placeholder="Elegí un canal" />
                </SelectTrigger>
                <SelectContent>
                  {canales.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.canalVentaId && (
                <p className="text-xs text-error-text">{form.formState.errors.canalVentaId.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="porcentajeComision">Comisión %</Label>
              <Input
                id="porcentajeComision"
                type="number"
                step="0.01"
                min={0}
                max={100}
                placeholder="0.00"
                {...form.register("porcentajeComision", { valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fechaInicio">Inicio</Label>
              <Input id="fechaInicio" type="date" {...form.register("fechaInicio")} />
              {form.formState.errors.fechaInicio && (
                <p className="text-xs text-error-text">{form.formState.errors.fechaInicio.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fechaFin">Fin</Label>
              <Input id="fechaFin" type="date" {...form.register("fechaFin")} />
              {form.formState.errors.fechaFin && (
                <p className="text-xs text-error-text">{form.formState.errors.fechaFin.message}</p>
              )}
            </div>
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

export function EventosCliente({
  eventos,
  canales,
  sucursales,
}: {
  eventos: EventoListado[];
  canales: { id: string; nombre: string; porcentajeComisionDefault: string | null }[];
  sucursales: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function cerrar(eventoId: string) {
    setProcesandoId(eventoId);
    setError(null);
    const resultado = await cerrarEventoAction(eventoId);
    setProcesandoId(null);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    router.refresh();
  }

  async function reabrir(eventoId: string) {
    setProcesandoId(eventoId);
    setError(null);
    const resultado = await reabrirEventoAction(eventoId);
    setProcesandoId(null);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button onClick={() => setDialogoAbierto(true)}>
          <Plus className="size-4" />
          Nuevo evento
        </Button>
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-error-text">
          <Lock className="size-3.5" />
          {error}
        </p>
      )}

      {eventos.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="Todavía no cargaste ningún evento"
          description="Registrá ferias o pop-ups para vender con una comisión distinta a la habitual."
        />
      ) : (
        <div className="divide-y divide-gray-border rounded-2xl bg-card shadow-card">
          {eventos.map((evento) => (
            <div key={evento.id} className="flex items-center gap-3 p-4 text-sm">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-pastel-blue-bg text-primary">
                <Calendar className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-text-body">{evento.nombre}</p>
                <p className="truncate text-xs text-text-muted">
                  {evento.sucursalNombre} · {evento.canalNombre}
                </p>
              </div>
              <div className="w-40 shrink-0 text-xs text-text-muted">
                {formatFecha(evento.fechaInicio)} — {formatFecha(evento.fechaFin)}
              </div>
              <span className="w-16 shrink-0 text-right font-medium text-navy">
                {evento.porcentajeComision ? `${Number(evento.porcentajeComision).toFixed(1)}%` : "—"}
              </span>
              <Badge variant={evento.estado === "abierto" ? "success" : "outline"}>
                {evento.estado === "abierto" ? "Abierto" : "Cerrado"}
              </Badge>
              {evento.estado === "abierto" ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => cerrar(evento.id)}
                  disabled={procesandoId === evento.id}
                >
                  Cerrar
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => reabrir(evento.id)}
                  disabled={procesandoId === evento.id}
                >
                  Reabrir
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <NuevoEventoDialog
        open={dialogoAbierto}
        onOpenChange={setDialogoAbierto}
        canales={canales}
        sucursales={sucursales}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
