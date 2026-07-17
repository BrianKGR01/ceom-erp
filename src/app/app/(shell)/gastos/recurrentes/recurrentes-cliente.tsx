"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Bell, Calendar, PlayCircle, Plus, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  gastoRecurrenteFormSchema,
  type GastoRecurrenteFormInput,
} from "@/modules/gastos/validation";
import {
  crearGastoRecurrenteAction,
  desactivarGastoRecurrenteAction,
  generarGastoDesdeRecurrenteAction,
} from "../actions";

type Frecuencia = "mensual" | "semanal" | "quincenal" | "anual";

const LABEL_FRECUENCIA: Record<Frecuencia, string> = {
  mensual: "Mensual",
  semanal: "Semanal",
  quincenal: "Quincenal",
  anual: "Anual",
};

// Factor de normalizacion a "por mes" — solo para la proyeccion en pantalla,
// no persiste en ningun lado ni es un calculo de negocio del modulo.
const FACTOR_MENSUAL: Record<Frecuencia, number> = {
  mensual: 1,
  quincenal: 2,
  semanal: 52 / 12,
  anual: 1 / 12,
};

function formatMoneda(valor: number | string): string {
  return Number(valor).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatFecha(fecha: string): string {
  return new Date(fecha).toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Proxima fecha de generacion, calculada en cliente por simple aritmetica de
// calendario desde fecha_inicio — el modulo no tiene scheduler ni una
// funcion de "proxima fecha" propia (ANCLA.md: "sin scheduler real"), esto
// es solo una previsualizacion, cada gasto se sigue generando a mano con el
// boton "Generar gasto de este período".
function calcularProximaFecha(fechaInicio: string, frecuencia: Frecuencia, fechaFin: string | null): Date | null {
  const hoy = new Date();
  hoy.setUTCHours(0, 0, 0, 0);
  const proxima = new Date(`${fechaInicio}T00:00:00Z`);
  const limite = fechaFin ? new Date(`${fechaFin}T00:00:00Z`) : null;

  let guardas = 0;
  while (proxima < hoy && guardas < 1000) {
    if (frecuencia === "semanal") proxima.setUTCDate(proxima.getUTCDate() + 7);
    else if (frecuencia === "quincenal") proxima.setUTCDate(proxima.getUTCDate() + 15);
    else if (frecuencia === "mensual") proxima.setUTCMonth(proxima.getUTCMonth() + 1);
    else proxima.setUTCFullYear(proxima.getUTCFullYear() + 1);
    guardas++;
  }

  if (limite && proxima > limite) return null;
  return proxima;
}

export interface GastoRecurrenteListado {
  id: string;
  categoriaNombre: string;
  monto: string;
  frecuencia: Frecuencia;
  fechaInicio: string;
  fechaFin: string | null;
  activo: boolean;
}

function NuevaPlantillaDialog({
  open,
  onOpenChange,
  categorias,
  onCreada,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categorias: { id: string; nombre: string }[];
  onCreada: () => void;
}) {
  const form = useForm<GastoRecurrenteFormInput>({
    resolver: zodResolver(gastoRecurrenteFormSchema),
    defaultValues: {
      categoriaId: "",
      monto: undefined,
      frecuencia: "mensual",
      fechaInicio: "",
      fechaFin: "",
    },
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(values: GastoRecurrenteFormInput) {
    setGuardando(true);
    setError(null);
    const resultado = await crearGastoRecurrenteAction(values);
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    form.reset();
    onOpenChange(false);
    onCreada();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva plantilla de gasto recurrente</DialogTitle>
          <DialogDescription>
            Cada período tenés que generar el gasto a mano con el botón &ldquo;Generar&rdquo; de la tarjeta.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="categoriaId">Categoría</Label>
            <Select
              items={Object.fromEntries(categorias.map((c) => [c.id, c.nombre]))}
              value={form.watch("categoriaId")}
              onValueChange={(value) => value && form.setValue("categoriaId", value)}
            >
              <SelectTrigger id="categoriaId" className="w-full">
                <SelectValue placeholder="Selecciona una categoría" />
              </SelectTrigger>
              <SelectContent>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.categoriaId && (
              <p className="text-xs text-error-text">{form.formState.errors.categoriaId.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="monto">Monto</Label>
              <Input
                id="monto"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                {...form.register("monto", { valueAsNumber: true })}
              />
              {form.formState.errors.monto && (
                <p className="text-xs text-error-text">{form.formState.errors.monto.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="frecuencia">Frecuencia</Label>
              <Select
                items={LABEL_FRECUENCIA}
                value={form.watch("frecuencia")}
                onValueChange={(value) => value && form.setValue("frecuencia", value as Frecuencia)}
              >
                <SelectTrigger id="frecuencia" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(LABEL_FRECUENCIA) as Frecuencia[]).map((f) => (
                    <SelectItem key={f} value={f}>
                      {LABEL_FRECUENCIA[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="fechaInicio">Fecha de inicio</Label>
              <Input id="fechaInicio" type="date" {...form.register("fechaInicio")} />
              {form.formState.errors.fechaInicio && (
                <p className="text-xs text-error-text">{form.formState.errors.fechaInicio.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fechaFin">Fecha de fin (opcional)</Label>
              <Input id="fechaFin" type="date" {...form.register("fechaFin")} />
            </div>
          </div>

          {error && <p className="text-xs text-error-text">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando ? "Guardando..." : "Crear plantilla"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function GenerarGastoDialog({
  gastoRecurrenteId,
  open,
  onOpenChange,
  onGenerado,
}: {
  gastoRecurrenteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerado: () => void;
}) {
  const [fechaGasto, setFechaGasto] = useState(() => new Date().toISOString().slice(0, 10));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmar() {
    setGuardando(true);
    setError(null);
    const resultado = await generarGastoDesdeRecurrenteAction(gastoRecurrenteId, { fechaPago: fechaGasto });
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    onOpenChange(false);
    onGenerado();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generar gasto de este período</DialogTitle>
          <DialogDescription>Crea un nuevo Gasto manual a partir de esta plantilla.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="fechaGasto">Fecha del gasto</Label>
          <Input id="fechaGasto" type="date" value={fechaGasto} onChange={(e) => setFechaGasto(e.target.value)} />
        </div>
        {error && <p className="text-xs text-error-text">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={guardando}>
            {guardando ? "Generando..." : "Generar gasto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RecurrentesCliente({
  recurrentes,
  categorias,
}: {
  recurrentes: GastoRecurrenteListado[];
  categorias: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [dialogoNueva, setDialogoNueva] = useState(false);
  const [dialogoGenerar, setDialogoGenerar] = useState<string | null>(null);
  const [desactivando, setDesactivando] = useState<string | null>(null);

  const activas = recurrentes.filter((r) => r.activo);
  const proyeccionMensual = activas.reduce(
    (acc, r) => acc + Number(r.monto) * FACTOR_MENSUAL[r.frecuencia],
    0
  );
  const proximas = activas
    .map((r) => ({ r, proxima: calcularProximaFecha(r.fechaInicio, r.frecuencia, r.fechaFin) }))
    .filter((x): x is { r: GastoRecurrenteListado; proxima: Date } => x.proxima !== null);
  const en7Dias = proximas.filter((x) => {
    const limite = new Date();
    limite.setUTCHours(0, 0, 0, 0);
    limite.setUTCDate(limite.getUTCDate() + 7);
    return x.proxima <= limite;
  }).length;
  const proximaFechaPorId = new Map(proximas.map((x) => [x.r.id, x.proxima]));

  async function desactivar(id: string) {
    setDesactivando(id);
    await desactivarGastoRecurrenteAction(id);
    setDesactivando(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialogoNueva(true)}>
          <Plus className="size-4" />
          Nueva plantilla
        </Button>
      </div>

      {recurrentes.length === 0 ? (
        <EmptyState
          icon={RefreshCw}
          title="Todavía no configuraste ninguna plantilla"
          description="Creá plantillas para tus gastos fijos (alquiler, sueldos, servicios) y generá el gasto de cada período con un clic — usá el botón 'Nueva plantilla' de arriba."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="flex items-center gap-3 pt-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-pastel-blue-bg text-primary">
                  <RefreshCw className="size-4" />
                </span>
                <div>
                  <p className="text-[11px] tracking-wide text-text-muted uppercase">Plantillas activas</p>
                  <p className="font-heading text-lg font-semibold text-navy">{activas.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 pt-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-pastel-blue-bg text-primary">
                  <Calendar className="size-4" />
                </span>
                <div>
                  <p className="text-[11px] tracking-wide text-text-muted uppercase">Proyección mensual</p>
                  <p className="font-heading text-lg font-semibold text-navy">{formatMoneda(proyeccionMensual)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 pt-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning-bg text-warning-text">
                  <Bell className="size-4" />
                </span>
                <div>
                  <p className="text-[11px] tracking-wide text-text-muted uppercase">Próximos 7 días</p>
                  <p className="font-heading text-lg font-semibold text-navy">{en7Dias} por vencer</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recurrentes.map((r) => {
              const proxima = proximaFechaPorId.get(r.id);
              return (
                <Card key={r.id} className={r.activo ? undefined : "opacity-70"}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-pastel-blue-bg text-primary">
                        <RefreshCw className="size-4" />
                      </span>
                      {r.activo ? (
                        <Switch
                          checked={r.activo}
                          disabled={desactivando === r.id}
                          onCheckedChange={() => desactivar(r.id)}
                        />
                      ) : (
                        <Switch checked={false} disabled />
                      )}
                    </div>
                    <p className="mt-2 font-heading text-lg font-semibold text-navy">{formatMoneda(r.monto)}</p>
                    <p className="text-xs text-text-muted">{r.categoriaNombre}</p>
                  </CardHeader>
                  <CardContent className="space-y-2 border-t border-gray-border pt-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted">Frecuencia</span>
                      <Badge variant="info">{LABEL_FRECUENCIA[r.frecuencia]}</Badge>
                    </div>
                    {r.activo ? (
                      <div className="flex items-center justify-between">
                        <span className="text-text-muted">Próx. fecha</span>
                        <span className="text-text-body">{proxima ? formatFecha(proxima.toISOString()) : "—"}</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-text-muted">Estado</span>
                        <Badge variant="outline">Pausado</Badge>
                      </div>
                    )}
                    {r.activo && (
                      <button
                        type="button"
                        onClick={() => setDialogoGenerar(r.id)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-border py-1.5 text-xs font-medium text-primary hover:border-primary/50"
                      >
                        <PlayCircle className="size-3.5" />
                        Generar gasto
                      </button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <p className="text-center text-xs text-text-muted">
            Mostrando {recurrentes.length} de {recurrentes.length} plantillas configuradas.
          </p>
        </>
      )}

      <NuevaPlantillaDialog
        open={dialogoNueva}
        onOpenChange={setDialogoNueva}
        categorias={categorias}
        onCreada={() => router.refresh()}
      />
      {dialogoGenerar && (
        <GenerarGastoDialog
          gastoRecurrenteId={dialogoGenerar}
          open={Boolean(dialogoGenerar)}
          onOpenChange={(open) => !open && setDialogoGenerar(null)}
          onGenerado={() => router.refresh()}
        />
      )}
    </div>
  );
}
