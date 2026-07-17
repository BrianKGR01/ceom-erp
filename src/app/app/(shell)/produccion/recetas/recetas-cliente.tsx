"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus, Search, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { actualizarComposicionRecetaAction, actualizarRecetaAction, crearRecetaAction, eliminarRecetaAction } from "../actions";

type UnidadMedidaInsumo = "litros" | "ml" | "kg" | "g" | "unidad" | "metros";

const LABEL_UNIDAD_CORTA: Record<UnidadMedidaInsumo, string> = {
  litros: "L",
  ml: "ml",
  kg: "kg",
  g: "g",
  unidad: "un",
  metros: "m",
};

export interface RecetaListado {
  id: string;
  nombre: string;
  rendimientoPorLote: string;
  unidadRendimiento: string;
  composicion: { insumoId: string; cantidadPorLote: string; insumoNombre: string }[];
}

export interface InsumoOpcion {
  id: string;
  nombre: string;
  unidadMedida: UnidadMedidaInsumo;
}

function NuevaRecetaDialog({
  open,
  onOpenChange,
  onCreada,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreada: (recetaId: string) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [rendimientoPorLote, setRendimientoPorLote] = useState("");
  const [unidadRendimiento, setUnidadRendimiento] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmar() {
    setGuardando(true);
    setError(null);
    const resultado = await crearRecetaAction({
      nombre,
      rendimientoPorLote: Number(rendimientoPorLote),
      unidadRendimiento,
    });
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    onOpenChange(false);
    setNombre("");
    setRendimientoPorLote("");
    setUnidadRendimiento("");
    onCreada(resultado.data.recetaId);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva receta</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="nombreReceta">Nombre de la receta</Label>
            <Input
              id="nombreReceta"
              placeholder="Ej. Masa Brioche"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="rendimientoPorLote">Rendimiento por lote</Label>
              <Input
                id="rendimientoPorLote"
                type="number"
                step="0.01"
                min="0"
                value={rendimientoPorLote}
                onChange={(e) => setRendimientoPorLote(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unidadRendimiento">Unidad</Label>
              <Input
                id="unidadRendimiento"
                placeholder="Ej. Unidades, kg, L"
                value={unidadRendimiento}
                onChange={(e) => setUnidadRendimiento(e.target.value)}
              />
            </div>
          </div>
        </div>
        {error && <p className="text-xs text-error-text">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={confirmar}
            disabled={guardando || !nombre.trim() || !rendimientoPorLote || !unidadRendimiento.trim()}
          >
            {guardando ? "Creando..." : "Crear receta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecetaDetalle({
  receta,
  insumos,
  onGuardado,
  onEliminada,
}: {
  receta: RecetaListado;
  insumos: InsumoOpcion[];
  onGuardado: () => void;
  onEliminada: () => void;
}) {
  const [nombre, setNombre] = useState(receta.nombre);
  const [rendimientoPorLote, setRendimientoPorLote] = useState(receta.rendimientoPorLote);
  const [unidadRendimiento, setUnidadRendimiento] = useState(receta.unidadRendimiento);
  const [composicion, setComposicion] = useState(
    receta.composicion.map((c) => ({ insumoId: c.insumoId, cantidadPorLote: c.cantidadPorLote }))
  );
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [confirmandoBaja, setConfirmandoBaja] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const insumoPorId = new Map(insumos.map((i) => [i.id, i]));

  function agregarLinea() {
    const disponible = insumos.find((i) => !composicion.some((c) => c.insumoId === i.id));
    setComposicion((prev) => [
      ...prev,
      { insumoId: disponible?.id ?? insumos[0]?.id ?? "", cantidadPorLote: "" },
    ]);
  }

  function quitarLinea(index: number) {
    setComposicion((prev) => prev.filter((_, i) => i !== index));
  }

  function actualizarLinea(index: number, cambios: Partial<{ insumoId: string; cantidadPorLote: string }>) {
    setComposicion((prev) => prev.map((linea, i) => (i === index ? { ...linea, ...cambios } : linea)));
  }

  async function guardar() {
    setGuardando(true);
    setError(null);

    const datosReceta = await actualizarRecetaAction(receta.id, {
      nombre,
      rendimientoPorLote: Number(rendimientoPorLote),
      unidadRendimiento,
    });
    if (!datosReceta.ok) {
      setGuardando(false);
      setError(datosReceta.error);
      return;
    }

    const lineasValidas = composicion.filter((c) => c.insumoId && Number(c.cantidadPorLote) > 0);
    const resultado = await actualizarComposicionRecetaAction(
      receta.id,
      lineasValidas.map((c) => ({ insumoId: c.insumoId, cantidadPorLote: Number(c.cantidadPorLote) }))
    );
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    onGuardado();
  }

  async function confirmarEliminar() {
    setEliminando(true);
    setError(null);
    const resultado = await eliminarRecetaAction(receta.id);
    setEliminando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    onEliminada();
  }

  return (
    <div className="rounded-2xl bg-card p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between border-b border-gray-border pb-4">
        <h2 className="font-heading text-lg font-semibold text-navy">{receta.nombre}</h2>
        {confirmandoBaja ? (
          <div className="flex items-center gap-1.5">
            <Button variant="destructive" size="sm" onClick={confirmarEliminar} disabled={eliminando}>
              Sí, eliminar
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmandoBaja(false)}>
              Cancelar
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="icon-sm" onClick={() => setConfirmandoBaja(true)} aria-label="Eliminar receta">
            <Trash2 className="size-4 text-error-text" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
        <div className="space-y-1.5">
          <Label htmlFor="nombreEdit">Nombre de la Receta</Label>
          <Input id="nombreEdit" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:w-56">
          <div className="space-y-1.5">
            <Label htmlFor="rendimientoEdit">Rendimiento por lote</Label>
            <Input
              id="rendimientoEdit"
              type="number"
              step="0.01"
              min="0"
              value={rendimientoPorLote}
              onChange={(e) => setRendimientoPorLote(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="unidadEdit">Unidad</Label>
            <Input id="unidadEdit" value={unidadRendimiento} onChange={(e) => setUnidadRendimiento(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-3 border-t border-gray-border pt-4">
        <h3 className="font-heading text-sm font-semibold text-navy">Composición de la Receta</h3>

        {composicion.length === 0 && (
          <p className="text-sm text-text-muted">Todavía no agregaste ningún insumo.</p>
        )}

        {composicion.map((linea, index) => {
          const insumoActual = insumoPorId.get(linea.insumoId);
          return (
            <div key={index} className="flex items-center gap-2">
              <Select
                items={Object.fromEntries(insumos.map((i) => [i.id, i.nombre]))}
                value={linea.insumoId}
                onValueChange={(v) => v && actualizarLinea(index, { insumoId: v })}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Elegí un insumo" />
                </SelectTrigger>
                <SelectContent>
                  {insumos.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                step="0.01"
                min="0"
                className="w-28"
                value={linea.cantidadPorLote}
                onChange={(e) => actualizarLinea(index, { cantidadPorLote: e.target.value })}
              />
              <span className="w-8 shrink-0 text-xs text-text-muted">
                {insumoActual ? LABEL_UNIDAD_CORTA[insumoActual.unidadMedida] : ""}
              </span>
              <button
                type="button"
                onClick={() => quitarLinea(index)}
                aria-label="Quitar insumo"
                className="text-text-muted hover:text-error-text"
              >
                <X className="size-4" />
              </button>
            </div>
          );
        })}

        <Button variant="outline" size="sm" onClick={agregarLinea} disabled={insumos.length === 0}>
          <Plus className="size-4" />
          Agregar insumo
        </Button>

        <div className="flex items-center justify-between rounded-xl bg-gray-bg p-3 text-sm">
          <span className="text-text-muted">Total de insumos:</span>
          <span className="font-semibold text-navy">{composicion.length}</span>
        </div>
      </div>

      {error && <p className="mt-3 text-xs text-error-text">{error}</p>}

      <div className="mt-4 flex justify-end gap-2 border-t border-gray-border pt-4">
        <Button onClick={guardar} disabled={guardando}>
          {guardando ? "Guardando..." : "Guardar Cambios"}
        </Button>
      </div>
    </div>
  );
}

export function RecetasCliente({
  recetas,
  insumos,
}: {
  recetas: RecetaListado[];
  insumos: InsumoOpcion[];
}) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState("");
  const [recetaSeleccionadaId, setRecetaSeleccionadaId] = useState<string | null>(
    recetas[0]?.id ?? null
  );
  const [dialogoNueva, setDialogoNueva] = useState(false);

  const filtradas = recetas.filter((r) => r.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()));
  const recetaSeleccionada = recetas.find((r) => r.id === recetaSeleccionadaId) ?? null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Gestión de Recetas"
        description="Administra las fórmulas y rendimientos de tus productos."
        action={
          <Button onClick={() => setDialogoNueva(true)}>
            <Plus className="size-4" />
            Nueva receta
          </Button>
        }
      />

      {recetas.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Todavía no cargaste ninguna receta"
          description="Creá tu primera receta para poder vincularla a un producto y registrar producción."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-muted" />
              <Input
                placeholder="Buscar recetas..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="space-y-2">
              {filtradas.map((receta) => (
                <button
                  key={receta.id}
                  type="button"
                  onClick={() => setRecetaSeleccionadaId(receta.id)}
                  className={`flex w-full items-center justify-between gap-2 rounded-2xl border p-3 text-left transition-colors ${
                    receta.id === recetaSeleccionadaId
                      ? "border-primary bg-pastel-blue-bg"
                      : "border-transparent bg-card shadow-card hover:border-primary/40"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-navy">{receta.nombre}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                      <Badge variant="outline">
                        {receta.rendimientoPorLote} {receta.unidadRendimiento}
                      </Badge>
                      <span>{receta.composicion.length} insumos</span>
                    </div>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-text-muted" />
                </button>
              ))}
            </div>
          </div>

          {recetaSeleccionada && (
            <RecetaDetalle
              key={recetaSeleccionada.id}
              receta={recetaSeleccionada}
              insumos={insumos}
              onGuardado={() => router.refresh()}
              onEliminada={() => {
                setRecetaSeleccionadaId(null);
                router.refresh();
              }}
            />
          )}
        </div>
      )}

      <NuevaRecetaDialog
        open={dialogoNueva}
        onOpenChange={setDialogoNueva}
        onCreada={(recetaId) => {
          setRecetaSeleccionadaId(recetaId);
          router.refresh();
        }}
      />
    </div>
  );
}
