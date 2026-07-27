"use client";

import { hoyLocal, ZONA_HORARIA_NEGOCIO } from "@/lib/periodo";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Banknote, CheckCircle2, CreditCard, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { PageHeader } from "@/components/shared/page-header";
import { registrarPagoPasivoAction } from "../../actions";

type EstadoPasivo = "activo" | "pagado" | "refinanciado";

const BADGE_ESTADO: Record<EstadoPasivo, { variant: "success" | "info" | "outline"; label: string }> = {
  activo: { variant: "success", label: "Activo" },
  pagado: { variant: "info", label: "Pagado" },
  refinanciado: { variant: "outline", label: "Refinanciado" },
};

const LABEL_FRECUENCIA: Record<string, string> = {
  mensual: "mensual",
  semanal: "semanal",
  quincenal: "quincenal",
  anual: "anual",
};

const LABEL_ORIGEN: Record<string, string> = {
  automatico: "Automático",
  manual: "Manual",
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

export interface PasivoFicha {
  id: string;
  estado: EstadoPasivo;
  montoTotal: string;
  cuotaPeriodica: string;
  frecuenciaCuota: string;
  plazoCuotas: number;
  fechaInicio: string;
  saldoPendiente: number;
  activoNombre: string | null;
}

export interface PagoListado {
  id: string;
  monto: string;
  fechaPago: string;
  origen: string;
  restante: number;
  numeroCuota: number;
}

function RegistrarPagoDialog({
  pasivoId,
  saldoActual,
  open,
  onOpenChange,
  onConfirmado,
}: {
  pasivoId: string;
  saldoActual: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmado: (avisoGasto: string | null) => void;
}) {
  const [monto, setMonto] = useState("");
  const [fechaPago, setFechaPago] = useState(() => hoyLocal(ZONA_HORARIA_NEGOCIO));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const montoNumero = Number(monto) || 0;
  const saldoDespues = saldoActual - montoNumero;

  async function confirmar() {
    setGuardando(true);
    setError(null);
    const resultado = await registrarPagoPasivoAction(pasivoId, { monto: montoNumero, fechaPago });
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    onOpenChange(false);
    setMonto("");
    // El pago ya quedo registrado aunque el Gasto de la cuota haya fallado
    // (H-27) — el aviso se muestra afuera, no bloquea el cierre del dialogo.
    onConfirmado(resultado.data.avisoGasto);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar pago de Pasivo</DialogTitle>
          <DialogDescription>
            Se suma al historial, actualiza el saldo pendiente y se registra como gasto del período
            —así la cuota resta en tu resultado.
          </DialogDescription>
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
          <Button onClick={confirmar} disabled={guardando || montoNumero <= 0 || !fechaPago}>
            <CheckCircle2 className="size-4" />
            {guardando ? "Registrando..." : "Confirmar pago"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FichaPasivoCliente({
  pasivo,
  pagos,
}: {
  pasivo: PasivoFicha;
  pagos: PagoListado[];
}) {
  const router = useRouter();
  const [dialogoPago, setDialogoPago] = useState(false);
  const [avisoGasto, setAvisoGasto] = useState<string | null>(null);
  const badge = BADGE_ESTADO[pasivo.estado];
  const puedeOperar = pasivo.estado === "activo";

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Patrimonio", href: "/app/patrimonio" },
          { label: "Pasivos", href: "/app/patrimonio/pasivos" },
          { label: pasivo.activoNombre ?? "Pasivo" },
        ]}
      />
      <PageHeader
        title={pasivo.activoNombre ?? "Pasivo sin activo asociado"}
        description={`Cuota ${LABEL_FRECUENCIA[pasivo.frecuenciaCuota]} · ${pasivo.plazoCuotas} cuotas`}
        action={
          <div className="flex items-center gap-2">
            <Badge variant={badge.variant}>{badge.label}</Badge>
            {puedeOperar && (
              <>
                <Button
                  variant="outline"
                  render={<Link href={`/app/patrimonio/pasivos/${pasivo.id}/refinanciar`} />}
                  nativeButton={false}
                >
                  <RefreshCw className="size-4" />
                  Refinanciar
                </Button>
                <Button onClick={() => setDialogoPago(true)}>
                  <CreditCard className="size-4" />
                  Registrar pago
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* El pago quedo registrado igual — lo que fallo es el Gasto de la cuota
          (H-27). Se avisa para que el dueno sepa que ese egreso no esta en el
          resultado del periodo y lo pueda cargar a mano. */}
      {avisoGasto && (
        <div className="flex items-start gap-3 rounded-2xl bg-warning-bg p-4 shadow-card">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-card text-warning-text">
            <AlertTriangle className="size-4" />
          </span>
          <div className="text-sm">
            <p className="font-medium text-warning-text">
              El pago se registró, pero no se pudo crear el gasto de la cuota.
            </p>
            <p className="mt-0.5 text-text-muted">
              {avisoGasto} Esta cuota todavía no resta en tu resultado del período — cargala como
              gasto a mano desde Egresos y Gastos.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-pastel-blue-bg text-primary">
              <Banknote className="size-4" />
            </span>
            <div>
              <p className="text-[11px] tracking-wide text-text-muted uppercase">Monto original</p>
              <p className="font-heading text-lg font-semibold text-navy">{formatMoneda(pasivo.montoTotal)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-[11px] tracking-wide text-text-muted uppercase">Cuota {LABEL_FRECUENCIA[pasivo.frecuenciaCuota]}</p>
            <p className="font-heading text-lg font-semibold text-navy">{formatMoneda(pasivo.cuotaPeriodica)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-[11px] tracking-wide text-text-muted uppercase">Saldo pendiente</p>
            <p className="font-heading text-lg font-semibold text-primary">{formatMoneda(pasivo.saldoPendiente)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-2xl bg-card shadow-card">
        <div className="flex items-center justify-between border-b border-gray-border p-4">
          <h2 className="font-heading text-base font-semibold text-navy">Historial de pagos</h2>
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
                <div className="min-w-0 flex-1">
                  <p className="text-text-body">
                    Cuota {pago.numeroCuota}/{pasivo.plazoCuotas}
                  </p>
                  <p className="text-xs text-text-muted">
                    {formatFecha(pago.fechaPago)} · {LABEL_ORIGEN[pago.origen] ?? pago.origen}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-navy">+{formatMoneda(pago.monto)}</p>
                  <p className="text-xs text-text-muted">Restante: {formatMoneda(Math.max(pago.restante, 0))}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <RegistrarPagoDialog
        pasivoId={pasivo.id}
        saldoActual={pasivo.saldoPendiente}
        open={dialogoPago}
        onOpenChange={setDialogoPago}
        onConfirmado={(aviso) => {
          setAvisoGasto(aviso);
          router.refresh();
        }}
      />
    </>
  );
}
