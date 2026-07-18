"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Info, Pencil, Receipt, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/shared/breadcrumb";
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
import { eliminarGastoAction, registrarPagoGastoAction } from "../actions";

type TipoGasto = "fijo" | "variable_no_productivo" | "unico";
type EstadoPagoGasto = "pendiente" | "parcial" | "pagado";
type OrigenGasto = "manual" | "comision_venta_automatica" | "cuota_pasivo_automatica";

const LABEL_TIPO: Record<TipoGasto, string> = {
  fijo: "Fijo",
  variable_no_productivo: "Variable no productivo",
  unico: "Único",
};

const LABEL_ORIGEN: Record<OrigenGasto, string> = {
  manual: "Manual",
  comision_venta_automatica: "Comisión de venta (automático)",
  cuota_pasivo_automatica: "Cuota de pasivo (automático)",
};

const BADGE_PAGO: Record<EstadoPagoGasto, { variant: "error" | "warning" | "success"; label: string }> = {
  pendiente: { variant: "error", label: "Pendiente" },
  parcial: { variant: "warning", label: "Parcial" },
  pagado: { variant: "success", label: "Pagado" },
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

export interface GastoFicha {
  id: string;
  tipo: TipoGasto;
  categoriaNombre: string;
  monto: string;
  fechaGasto: string;
  proveedorNombre: string | null;
  origen: OrigenGasto;
  estadoPago: EstadoPagoGasto;
  descripcion: string | null;
}

export interface PagoGastoListado {
  id: string;
  monto: string;
  fechaPago: string;
}

function RegistrarPagoDialog({
  gastoId,
  saldoActual,
  open,
  onOpenChange,
  onConfirmado,
}: {
  gastoId: string;
  saldoActual: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmado: () => void;
}) {
  const [monto, setMonto] = useState("");
  const [fechaPago, setFechaPago] = useState(() => new Date().toISOString().slice(0, 10));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const montoNumero = Number(monto) || 0;
  const saldoDespues = saldoActual - montoNumero;

  async function confirmar() {
    setGuardando(true);
    setError(null);
    const resultado = await registrarPagoGastoAction(gastoId, { monto: montoNumero, fechaPago });
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    onOpenChange(false);
    setMonto("");
    onConfirmado();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar pago de Gasto</DialogTitle>
          <DialogDescription>Se suma al historial y actualiza el saldo pendiente.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="monto">Monto a pagar</Label>
            <Input
              id="monto"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fechaPago">Fecha de pago</Label>
            <Input id="fechaPago" type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} />
          </div>

          <div className="space-y-1.5 rounded-xl bg-gray-bg p-3 text-sm">
            <p className="text-[11px] tracking-wide text-text-muted uppercase">Resumen financiero</p>
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Saldo actual</span>
              <span className="text-text-body">{formatMoneda(saldoActual)}</span>
            </div>
            <div className="flex items-center justify-between text-error-text">
              <span>Pago a registrar</span>
              <span>-{formatMoneda(montoNumero)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-gray-border pt-1.5 font-semibold text-navy">
              <span>Saldo después del pago</span>
              <span>{formatMoneda(Math.max(saldoDespues, 0))}</span>
            </div>
          </div>
        </div>

        {error && <p className="text-xs text-error-text">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={guardando || montoNumero <= 0 || montoNumero > saldoActual}>
            <CheckCircle2 className="size-4" />
            {guardando ? "Registrando..." : "Confirmar pago"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FichaGastoCliente({
  gasto,
  pagos,
  totalPagado,
}: {
  gasto: GastoFicha;
  pagos: PagoGastoListado[];
  totalPagado: number;
}) {
  const router = useRouter();
  const [dialogoPago, setDialogoPago] = useState(false);
  const [confirmandoBaja, setConfirmandoBaja] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const esManual = gasto.origen === "manual";
  const saldoPendiente = Number(gasto.monto) - totalPagado;
  const codigo = `#G-${gasto.id.slice(0, 8).toUpperCase()}`;

  async function confirmarEliminar() {
    setEliminando(true);
    setError(null);
    const resultado = await eliminarGastoAction(gasto.id);
    setEliminando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    router.push("/app/gastos");
  }

  return (
    <div className="space-y-4">
      <Breadcrumb items={[{ label: "Gastos", href: "/app/gastos" }, { label: codigo }]} />

      <div className="flex items-center justify-between gap-3">
        <h1 className="font-heading text-xl font-semibold text-navy">Detalle de Gasto {codigo}</h1>
        {esManual && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              render={<Link href={`/app/gastos/${gasto.id}/editar`} />}
              nativeButton={false}
            >
              <Pencil className="size-4" />
              Editar
            </Button>
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
              <Button variant="destructive" onClick={() => setConfirmandoBaja(true)}>
                <Trash2 className="size-4" />
                Eliminar
              </Button>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-error-text">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-card p-5 shadow-card">
        <div className="flex items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-pastel-blue-bg text-primary">
            <Receipt className="size-5" />
          </span>
          <div>
            <p className="text-[11px] tracking-wide text-text-muted uppercase">Monto total</p>
            <p className="font-heading text-2xl font-semibold text-navy">{formatMoneda(gasto.monto)}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-6 text-sm">
          <div>
            <p className="text-[11px] tracking-wide text-text-muted uppercase">Categoría</p>
            <p className="mt-0.5 text-text-body">{gasto.categoriaNombre}</p>
          </div>
          <div>
            <p className="text-[11px] tracking-wide text-text-muted uppercase">Fecha</p>
            <p className="mt-0.5 text-text-body">{formatFecha(gasto.fechaGasto)}</p>
          </div>
          <div>
            <p className="text-[11px] tracking-wide text-text-muted uppercase">Estado</p>
            <Badge variant={BADGE_PAGO[gasto.estadoPago].variant}>{BADGE_PAGO[gasto.estadoPago].label}</Badge>
          </div>
        </div>
      </div>

      {!esManual && (
        <div className="flex items-start gap-2 rounded-xl bg-info-bg p-3 text-sm text-info-text">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p>
            <span className="font-medium">Gasto automático.</span> Este gasto se generó automáticamente
            desde otro módulo y no se puede editar ni eliminar manualmente acá.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-card p-5 shadow-card">
          <h2 className="mb-3 font-heading text-base font-semibold text-navy">Detalles de la operación</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-text-muted uppercase">Proveedor</p>
              <p className="mt-0.5 text-text-body">{gasto.proveedorNombre ?? "Sin proveedor"}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted uppercase">Tipo de gasto</p>
              <p className="mt-0.5 text-text-body">{LABEL_TIPO[gasto.tipo]}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-text-muted uppercase">Método de registro</p>
              <p className="mt-0.5 text-text-body">{LABEL_ORIGEN[gasto.origen]}</p>
            </div>
            {gasto.descripcion && (
              <div className="col-span-2 border-t border-gray-border pt-3">
                <p className="text-xs text-text-muted uppercase">Descripción</p>
                <p className="mt-0.5 text-text-body">{gasto.descripcion}</p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-card shadow-card">
          <div className="flex items-center justify-between border-b border-gray-border p-4">
            <h2 className="font-heading text-base font-semibold text-navy">Historial de pagos</h2>
            {esManual && gasto.estadoPago !== "pagado" && (
              <Button size="sm" onClick={() => setDialogoPago(true)}>
                Registrar pago
              </Button>
            )}
          </div>
          {pagos.length === 0 ? (
            <p className="p-6 text-center text-sm text-text-muted">Todavía no se registró ningún pago.</p>
          ) : (
            <div className="divide-y divide-gray-border">
              {pagos.map((pago) => (
                <div key={pago.id} className="flex items-center gap-3 p-4 text-sm">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-success-bg text-success-text">
                    <CheckCircle2 className="size-4" />
                  </span>
                  <span className="flex-1 text-text-muted">{formatFecha(pago.fechaPago)}</span>
                  <span className="font-semibold text-navy">-{formatMoneda(pago.monto)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between border-t border-gray-border p-4 text-sm">
            <span className="text-text-muted">Total pagado</span>
            <span className="font-semibold text-navy">{formatMoneda(totalPagado)}</span>
          </div>
        </div>
      </div>

      <RegistrarPagoDialog
        gastoId={gasto.id}
        saldoActual={saldoPendiente}
        open={dialogoPago}
        onOpenChange={setDialogoPago}
        onConfirmado={() => router.refresh()}
      />
    </div>
  );
}
