"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Beaker, Gauge, Info, Plus, RefreshCw, Wrench } from "lucide-react";
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
import { PageHeader } from "@/components/shared/page-header";
import { Textarea } from "@/components/ui/textarea";
import { registrarProduccionDeAjusteAction } from "./actions";

export interface ProduccionListado {
  id: string;
  productoNombre: string;
  fechaProduccion: string | Date;
  cantidadRealObtenida: string;
  mermaCantidad: string;
  costoOperativoCalculado: string;
}

function formatFecha(fecha: string | Date): string {
  return new Date(fecha).toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function AjusteDialog({
  produccionId,
  open,
  onOpenChange,
  onConfirmado,
}: {
  produccionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmado: () => void;
}) {
  const [costoOperativoCorregido, setCostoOperativoCorregido] = useState("");
  const [cantidadRealObtenidaCorregida, setCantidadRealObtenidaCorregida] = useState("");
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmar() {
    setGuardando(true);
    setError(null);
    const resultado = await registrarProduccionDeAjusteAction(produccionId, {
      costoOperativoCorregido: costoOperativoCorregido ? Number(costoOperativoCorregido) : undefined,
      cantidadRealObtenidaCorregida: cantidadRealObtenidaCorregida
        ? Number(cantidadRealObtenidaCorregida)
        : undefined,
      motivo,
    });
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    onOpenChange(false);
    onConfirmado();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-warning-bg text-warning-text">
              <Wrench className="size-4" />
            </span>
            <DialogTitle>Producción de Ajuste</DialogTitle>
          </div>
          <DialogDescription>
            Nunca edita la producción original — queda registrada como una corrección aparte, con
            referencia a la producción original.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg bg-info-bg p-3 text-xs text-info-text">
            <Info className="mt-0.5 size-4 shrink-0" />
            <p>
              No revierte movimientos de stock ni de insumo — es una corrección contable/de
              trazabilidad. Completá solo lo que necesitás corregir.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="costoCorregido">Costo operativo corregido (opcional)</Label>
              <Input
                id="costoCorregido"
                type="number"
                step="0.0001"
                min="0"
                placeholder="Dejalo vacío si no corresponde"
                value={costoOperativoCorregido}
                onChange={(e) => setCostoOperativoCorregido(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cantidadCorregida">Cantidad obtenida corregida (opcional)</Label>
              <Input
                id="cantidadCorregida"
                type="number"
                step="0.01"
                min="0"
                placeholder="Dejalo vacío si no corresponde"
                value={cantidadRealObtenidaCorregida}
                onChange={(e) => setCantidadRealObtenidaCorregida(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="motivo">Motivo</Label>
            <Textarea
              id="motivo"
              placeholder="Describí el motivo de la corrección..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="text-xs text-error-text">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirmar} disabled={guardando || !motivo.trim()}>
            {guardando ? "Guardando..." : "Confirmar ajuste"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProduccionesCliente({ producciones }: { producciones: ProduccionListado[] }) {
  const router = useRouter();
  const [dialogoAjuste, setDialogoAjuste] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Producción"
        description="Registro de lotes producidos y su costo operativo."
        action={
          <div className="flex items-center gap-2">
            <Button render={<Link href="/app/produccion/insumos" />} nativeButton={false} variant="outline">
              <Beaker className="size-4" />
              Insumos
            </Button>
            <Button render={<Link href="/app/produccion/recetas" />} nativeButton={false} variant="outline">
              <RefreshCw className="size-4" />
              Recetas
            </Button>
            <Button render={<Link href="/app/produccion/capacidad" />} nativeButton={false} variant="outline">
              <Gauge className="size-4" />
              Capacidad
            </Button>
            <Button render={<Link href="/app/produccion/nuevo" />} nativeButton={false}>
              <Plus className="size-4" />
              Nueva producción
            </Button>
          </div>
        }
      />

      {producciones.length === 0 ? (
        <EmptyState
          icon={Beaker}
          title="Todavía no registraste ninguna producción"
          description="Registrá tu primer lote para llevar el control de costos y merma."
          action={{ label: "Registrar producción", href: "/app/produccion/nuevo" }}
        />
      ) : (
        <div className="divide-y divide-gray-border rounded-2xl bg-card shadow-card">
          {producciones.map((produccion) => {
            const merma = Number(produccion.mermaCantidad);
            return (
              <div key={produccion.id} className="flex items-center gap-3 p-4 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="text-text-body">{produccion.productoNombre}</p>
                  <p className="text-xs text-text-muted">{formatFecha(produccion.fechaProduccion)}</p>
                </div>
                <span className="w-24 shrink-0 text-right text-text-muted">
                  {Number(produccion.cantidadRealObtenida)} un.
                </span>
                {merma > 0 && (
                  <Badge variant="warning">
                    <AlertTriangle className="size-3" />
                    Merma {merma}
                  </Badge>
                )}
                <span className="w-28 shrink-0 text-right font-semibold text-navy">
                  {Number(produccion.costoOperativoCalculado).toFixed(4)} /un.
                </span>
                <Button variant="ghost" size="icon-sm" onClick={() => setDialogoAjuste(produccion.id)} aria-label="Ajustar producción">
                  <Wrench className="size-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {dialogoAjuste && (
        <AjusteDialog
          produccionId={dialogoAjuste}
          open={Boolean(dialogoAjuste)}
          onOpenChange={(open) => !open && setDialogoAjuste(null)}
          onConfirmado={() => router.refresh()}
        />
      )}
    </div>
  );
}
