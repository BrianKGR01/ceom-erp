"use client";

import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ProductoParaVenta } from "./product-picker-card";

// Tipos locales a proposito: este componente es de cliente y no puede importar
// `operativo/actions.ts` (arrastra `db`). Son la misma forma que devuelve
// `listarModificadoresParaVenta`.
export interface OpcionModificador {
  id: string;
  nombre: string;
  tipo: "agrega" | "reemplaza" | "indicacion";
  esBase: boolean;
  precioExtra: number;
}

export interface GrupoModificadores {
  id: string;
  nombre: string;
  seleccion: "una" | "varias";
  opciones: OpcionModificador[];
}

export interface LineaConfigurada {
  producto: ProductoParaVenta;
  cantidad: number;
  modificadorIds: string[];
  /** Nombres de lo elegido (sin las opciones base), para mostrar en el carrito. */
  modificadoresTexto: string[];
  precioUnitario: number;
  observacion: string;
}

const bs = (n: number) => n.toFixed(2);

/**
 * Hoja de configuracion de un producto en el punto de venta: variante (los
 * productos que comparten `grupoVariantes`), modificadores por grupo, observacion
 * y cantidad. Solo arma la seleccion — el servidor vuelve a validar y a calcular
 * precio y receta al registrar la venta.
 */
export function ConfigurarProductoDialog({
  titulo,
  variantes,
  modificadoresPorProducto,
  onCerrar,
  onAgregar,
}: {
  titulo: string;
  variantes: ProductoParaVenta[];
  modificadoresPorProducto: Record<string, GrupoModificadores[]>;
  onCerrar: () => void;
  onAgregar: (linea: LineaConfigurada) => void;
}) {
  const [varianteId, setVarianteId] = useState(variantes[0]?.id ?? "");
  // Por grupo: ids elegidos. Se guarda por grupo para que cambiar de variante
  // no arrastre opciones de grupos que la nueva variante no tiene.
  const [elegidas, setElegidas] = useState<Record<string, string[]>>({});
  const [cantidad, setCantidad] = useState(1);
  const [observacion, setObservacion] = useState("");

  const variante = variantes.find((v) => v.id === varianteId) ?? variantes[0];
  const grupos = useMemo(
    () => modificadoresPorProducto[variante?.id ?? ""] ?? [],
    [modificadoresPorProducto, variante?.id]
  );

  function opcionesDe(grupo: GrupoModificadores): string[] {
    const propias = elegidas[grupo.id];
    if (propias) return propias;
    // Un grupo "elige 1" arranca en su opcion base, si tiene.
    const base = grupo.opciones.find((o) => o.esBase);
    return grupo.seleccion === "una" && base ? [base.id] : [];
  }

  function alternar(grupo: GrupoModificadores, opcionId: string) {
    setElegidas((prev) => {
      const actuales = prev[grupo.id] ?? opcionesDe(grupo);
      if (grupo.seleccion === "una") {
        const tieneBase = grupo.opciones.some((o) => o.esBase);
        // Sin opcion base, volver a tocar la elegida la desmarca (el grupo es opcional).
        if (!tieneBase && actuales.includes(opcionId)) return { ...prev, [grupo.id]: [] };
        return { ...prev, [grupo.id]: [opcionId] };
      }
      return {
        ...prev,
        [grupo.id]: actuales.includes(opcionId) ? actuales.filter((x) => x !== opcionId) : [...actuales, opcionId],
      };
    });
  }

  const seleccion = grupos.flatMap((g) =>
    opcionesDe(g).flatMap((id) => {
      const opcion = g.opciones.find((o) => o.id === id);
      return opcion ? [opcion] : [];
    })
  );
  const reales = seleccion.filter((o) => !o.esBase);
  const precioUnitario = Number(variante?.precioVenta ?? 0) + reales.reduce((s, o) => s + o.precioExtra, 0);

  if (!variante) return null;

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {variantes.length > 1 && (
            <div className="space-y-2">
              <Label>Variante</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {variantes.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVarianteId(v.id)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                      variante.id === v.id
                        ? "border-primary bg-pastel-blue-bg"
                        : "border-gray-border hover:border-primary/50"
                    )}
                  >
                    <span className="block font-medium text-navy">{v.etiquetaVariante ?? v.nombre}</span>
                    <span className="block text-xs text-text-muted">Bs {bs(Number(v.precioVenta))}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {grupos.map((grupo) => {
            const marcadas = opcionesDe(grupo);
            return (
              <div key={grupo.id} className="space-y-2">
                <Label>
                  {grupo.nombre}{" "}
                  <span className="font-normal text-text-muted">
                    · {grupo.seleccion === "una" ? "elige 1" : "elige los que quieras"}
                  </span>
                </Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {grupo.opciones.map((o) => {
                    const activa = marcadas.includes(o.id);
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => alternar(grupo, o.id)}
                        aria-pressed={activa}
                        className={cn(
                          "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                          activa
                            ? "border-primary bg-pastel-blue-bg text-primary"
                            : "border-gray-border text-text-body hover:border-primary/50"
                        )}
                      >
                        <span>
                          {o.nombre}
                          {o.esBase && <span className="text-xs text-text-muted"> (base)</span>}
                        </span>
                        {o.precioExtra > 0 && (
                          <span className="text-xs font-medium">+Bs {bs(o.precioExtra)}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="space-y-2">
            <Label htmlFor="observacion-linea">Observación (opcional)</Label>
            <Input
              id="observacion-linea"
              placeholder="Ej. para llevar"
              maxLength={300}
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>Cantidad</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon-xs"
                onClick={() => setCantidad((c) => Math.max(1, c - 1))}
                aria-label="Menos"
              >
                <Minus className="size-3" />
              </Button>
              <span className="w-8 text-center text-sm font-medium text-navy">{cantidad}</span>
              <Button
                type="button"
                variant="outline"
                size="icon-xs"
                onClick={() => setCantidad((c) => c + 1)}
                aria-label="Más"
              >
                <Plus className="size-3" />
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            onClick={() =>
              onAgregar({
                producto: variante,
                cantidad,
                modificadorIds: reales.map((o) => o.id),
                modificadoresTexto: reales.map((o) => o.nombre),
                precioUnitario,
                observacion: observacion.trim(),
              })
            }
          >
            Agregar · Bs {bs(precioUnitario * cantidad)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
