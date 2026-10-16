"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type MotivoBonificacion = "consumo_personal" | "cortesia";

export interface BonificacionVenta {
  motivo: MotivoBonificacion;
  porcentaje: number;
  beneficiario?: string;
  nota?: string;
}

export const ETIQUETA_MOTIVO_BONIFICACION: Record<MotivoBonificacion, string> = {
  consumo_personal: "Consumo del personal",
  cortesia: "Cortesía",
};

/**
 * Hoja para bonificar una venta: Cafiatto asume el precio. No es un descuento ni una baja —
 * la venta se registra completa, con su consumo de insumos y su costo. Solo arma la
 * seleccion; el servidor vuelve a exigir la capacidad del motivo y a validar todo.
 * Los motivos que el usuario NO puede usar ni se ofrecen.
 */
export function BonificarDialog({
  puede,
  inicial,
  total,
  onAplicar,
  onCerrar,
}: {
  puede: { consumoPersonal: boolean; cortesia: boolean };
  inicial: BonificacionVenta | null;
  total: number;
  onAplicar: (b: BonificacionVenta) => void;
  onCerrar: () => void;
}) {
  const motivoInicial: MotivoBonificacion =
    inicial?.motivo ?? (puede.consumoPersonal ? "consumo_personal" : "cortesia");
  const [motivo, setMotivo] = useState<MotivoBonificacion>(motivoInicial);
  const [porcentaje, setPorcentaje] = useState(String(inicial?.porcentaje ?? 100));
  const [beneficiario, setBeneficiario] = useState(inicial?.beneficiario ?? "");
  const [nota, setNota] = useState(inicial?.nota ?? "");
  const [error, setError] = useState<string | null>(null);

  const pct = motivo === "consumo_personal" ? 100 : Number(porcentaje);
  const descuento = Number.isFinite(pct) ? Math.round(total * pct) / 100 : 0;

  function aplicar() {
    if (motivo === "consumo_personal") {
      if (!beneficiario.trim()) return setError("Indicá quién consume.");
    } else {
      if (!(pct > 0 && pct <= 100)) return setError("El porcentaje tiene que estar entre 1 y 100.");
      if (!beneficiario.trim() && !nota.trim()) {
        return setError("Contá a quién se le regala o por qué, para dejarlo registrado.");
      }
    }
    onAplicar({
      motivo,
      porcentaje: pct,
      beneficiario: beneficiario.trim() || undefined,
      nota: nota.trim() || undefined,
    });
  }

  const opciones: Array<{ id: MotivoBonificacion; titulo: string; detalle: string; permitido: boolean }> = [
    {
      id: "consumo_personal",
      titulo: ETIQUETA_MOTIVO_BONIFICACION.consumo_personal,
      detalle: "100 % · lo consume alguien del equipo",
      permitido: puede.consumoPersonal,
    },
    {
      id: "cortesia",
      titulo: ETIQUETA_MOTIVO_BONIFICACION.cortesia,
      detalle: "Para un cliente · podés bonificar una parte o todo",
      permitido: puede.cortesia,
    },
  ];

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bonificar venta</DialogTitle>
          <DialogDescription>
            Cafiatto asume el precio. No es un descuento ni una baja: la venta se registra completa, con su
            consumo de insumos y su costo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Motivo</Label>
            <div className="grid grid-cols-1 gap-2">
              {opciones
                .filter((o) => o.permitido)
                .map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => {
                      setMotivo(o.id);
                      setError(null);
                    }}
                    aria-pressed={motivo === o.id}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                      motivo === o.id
                        ? "border-primary bg-pastel-blue-bg"
                        : "border-gray-border hover:border-primary/50"
                    )}
                  >
                    <span className="block font-medium text-navy">{o.titulo}</span>
                    <span className="block text-xs text-text-muted">{o.detalle}</span>
                  </button>
                ))}
            </div>
          </div>

          {motivo === "cortesia" && (
            <div className="space-y-2">
              <Label htmlFor="bonif-pct">Porcentaje bonificado</Label>
              <Input
                id="bonif-pct"
                type="number"
                min="1"
                max="100"
                step="1"
                value={porcentaje}
                onChange={(e) => setPorcentaje(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="bonif-quien">
              {motivo === "consumo_personal" ? "¿Quién lo consume?" : "¿A quién? (opcional si explicás por qué)"}
            </Label>
            <Input
              id="bonif-quien"
              placeholder={motivo === "consumo_personal" ? "Nombre de la persona del equipo" : "Nombre del cliente"}
              value={beneficiario}
              onChange={(e) => setBeneficiario(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bonif-nota">Nota (opcional)</Label>
            <Input id="bonif-nota" value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} />
          </div>

          <p className="text-sm text-text-body">
            Se bonifican <span className="font-semibold text-navy">Bs {descuento.toFixed(2)}</span> de Bs{" "}
            {total.toFixed(2)}.
          </p>
          {error && <p className="text-xs text-error-text">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button onClick={aplicar}>Aplicar bonificación</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
