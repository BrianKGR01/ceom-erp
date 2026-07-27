"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, PackageCheck, Plus, Receipt, Wrench } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  consultarSaldoCompraAction,
  recibirCompraAction,
  registrarCompraDeAjusteAction,
  registrarPagoCompraAction,
} from "../actions";

type EstadoCompra = "pedido" | "recibido";
type EstadoPagoCompra = "pendiente" | "parcial" | "pagado";

const BADGE_ESTADO: Record<EstadoCompra, { variant: "warning" | "success"; label: string }> = {
  pedido: { variant: "warning", label: "Pedido" },
  recibido: { variant: "success", label: "Recibido" },
};

const BADGE_PAGO: Record<EstadoPagoCompra, { variant: "error" | "warning" | "success"; label: string }> = {
  pendiente: { variant: "error", label: "Pendiente" },
  parcial: { variant: "warning", label: "Parcial" },
  pagado: { variant: "success", label: "Pagado" },
};

type TipoAjusteCompra = "correccion" | "devolucion_a_proveedor" | "anulacion_total";

const TIPOS_AJUSTE: { value: TipoAjusteCompra; label: string }[] = [
  { value: "correccion", label: "Corrección" },
  { value: "devolucion_a_proveedor", label: "Devolución a proveedor" },
  { value: "anulacion_total", label: "Anulación total" },
];

const LABEL_TIPO_AJUSTE: Record<TipoAjusteCompra, string> = Object.fromEntries(
  TIPOS_AJUSTE.map((t) => [t.value, t.label])
) as Record<TipoAjusteCompra, string>;

// Devolución y anulación solo pueden ir a favor del negocio; corrección es la
// única de las tres que puede ir en las dos direcciones. Misma regla que
// esTipoAjusteCompraAFavor() en proveedores/validation.ts — acá sirve para que
// el formulario ni siquiera ofrezca la dirección imposible, en vez de dejar al
// usuario elegir el signo y rechazarlo después (lección de H-30).
const TIPOS_AJUSTE_SOLO_A_FAVOR: TipoAjusteCompra[] = [
  "devolucion_a_proveedor",
  "anulacion_total",
];

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

export interface AjusteCompraFila {
  id: string;
  tipo: TipoAjusteCompra;
  montoAjuste: string;
  motivo: string;
}

export interface CompraListado {
  id: string;
  itemNombre: string;
  proveedorNombre: string | null;
  cantidad: string;
  montoTotal: string;
  /** montoTotal + Σ ajustes — lo que la compra vale hoy (H-31). */
  montoTotalEfectivo: number;
  ajustes: AjusteCompraFila[];
  fechaCompra: string;
  estado: EstadoCompra;
  estadoPago: EstadoPagoCompra;
}

function RecibirDialog({
  compraId,
  open,
  onOpenChange,
  onConfirmado,
}: {
  compraId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmado: () => void;
}) {
  const [fechaRecepcion, setFechaRecepcion] = useState(() => new Date().toISOString().slice(0, 10));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmar() {
    setGuardando(true);
    setError(null);
    const resultado = await recibirCompraAction(compraId, { fechaRecepcion });
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
            <span className="flex size-8 items-center justify-center rounded-full bg-success-bg text-success-text">
              <PackageCheck className="size-4" />
            </span>
            <DialogTitle>Confirmar recepción</DialogTitle>
          </div>
          <DialogDescription>La mercadería entra al inventario recién al confirmar.</DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="fechaRecepcion">Fecha de recepción</Label>
          <Input
            id="fechaRecepcion"
            type="date"
            value={fechaRecepcion}
            onChange={(e) => setFechaRecepcion(e.target.value)}
          />
        </div>

        {error && <p className="text-xs text-error-text">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={guardando}>
            {guardando ? "Confirmando..." : "Confirmar recepción"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RegistrarPagoDialog({
  compraId,
  saldoActual,
  open,
  onOpenChange,
  onConfirmado,
}: {
  compraId: string;
  saldoActual: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmado: () => void;
}) {
  const [monto, setMonto] = useState("");
  const [fechaPago, setFechaPago] = useState(() => new Date().toISOString().slice(0, 10));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const montoNumero = Number(monto) || 0;
  const saldoDespues = (saldoActual ?? 0) - montoNumero;

  async function confirmar() {
    setGuardando(true);
    setError(null);
    const resultado = await registrarPagoCompraAction(compraId, { monto: montoNumero, fechaPago });
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
          <DialogTitle>Registrar pago de Compra</DialogTitle>
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
              <span className="text-text-body">
                {saldoActual === null ? "Cargando..." : formatMoneda(saldoActual)}
              </span>
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
          <Button onClick={confirmar} disabled={guardando || montoNumero <= 0 || saldoActual === null}>
            <CheckCircle2 className="size-4" />
            {guardando ? "Registrando..." : "Confirmar pago"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AjusteDialog({
  compra,
  open,
  onOpenChange,
  onConfirmado,
}: {
  compra: CompraListado;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmado: () => void;
}) {
  const [tipo, setTipo] = useState<TipoAjusteCompra>("correccion");
  // El usuario carga SIEMPRE un monto positivo y la dirección se elige aparte
  // (o se deriva del tipo): así el signo no puede entrar mal desde la
  // pantalla. Antes el campo pedía un número con signo y la única guía era el
  // placeholder — el mismo diseño que causó H-30 del lado de las ventas.
  const [monto, setMonto] = useState("");
  const [direccion, setDireccion] = useState<"a_favor" | "costo_mayor">("a_favor");
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const soloAFavor = TIPOS_AJUSTE_SOLO_A_FAVOR.includes(tipo);
  const esAFavor = soloAFavor || direccion === "a_favor";
  const montoAbsoluto = Math.abs(Number(monto) || 0);
  const montoFirmado = esAFavor ? -montoAbsoluto : montoAbsoluto;
  const efectivoDespues = Math.max(0, compra.montoTotalEfectivo + montoFirmado);
  const dejariaEnNegativo = compra.montoTotalEfectivo + montoFirmado < 0;

  async function confirmar() {
    setGuardando(true);
    setError(null);
    const resultado = await registrarCompraDeAjusteAction(compra.id, {
      tipo,
      montoAjuste: montoFirmado,
      motivo,
    });
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    onOpenChange(false);
    setMonto("");
    setMotivo("");
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
            <DialogTitle>Ajustar compra</DialogTitle>
          </div>
          <DialogDescription>
            Nunca edita la compra original — queda registrada como una corrección aparte, y cambia
            lo que la compra vale hoy.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="tipo">Tipo de ajuste</Label>
            <Select
              items={Object.fromEntries(TIPOS_AJUSTE.map((t) => [t.value, t.label]))}
              value={tipo}
              onValueChange={(value) => value && setTipo(value as TipoAjusteCompra)}
            >
              <SelectTrigger id="tipo" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_AJUSTE.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {soloAFavor ? (
            <p className="rounded-xl bg-pastel-blue-bg p-3 text-xs text-text-body">
              Este tipo de ajuste siempre va <strong>a favor del negocio</strong>: baja lo que le
              debés al proveedor.
            </p>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="direccion">¿En qué dirección?</Label>
              <Select
                items={{
                  a_favor: "A favor del negocio (la compra costó menos)",
                  costo_mayor: "La compra costó más de lo cargado",
                }}
                value={direccion}
                onValueChange={(value) => value && setDireccion(value as typeof direccion)}
              >
                <SelectTrigger id="direccion" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a_favor">
                    A favor del negocio (la compra costó menos)
                  </SelectItem>
                  <SelectItem value="costo_mayor">La compra costó más de lo cargado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="monto">Monto del ajuste</Label>
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
            <Label htmlFor="motivo">Motivo</Label>
            <Textarea
              id="motivo"
              placeholder="Describí el motivo del ajuste..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>

          <div className="space-y-1 rounded-xl bg-gray-bg p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-text-muted">La compra vale hoy</span>
              <span className="text-text-body">{formatMoneda(compra.montoTotalEfectivo)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Después del ajuste</span>
              <span className={dejariaEnNegativo ? "text-error-text" : "font-semibold text-navy"}>
                {formatMoneda(efectivoDespues)}
              </span>
            </div>
            {!esAFavor && montoAbsoluto > 0 && (
              <p className="pt-1 text-xs text-text-muted">
                Los {formatMoneda(montoAbsoluto)} de más se descuentan del resultado del negocio.
              </p>
            )}
          </div>
        </div>

        {dejariaEnNegativo && (
          <p className="text-xs text-error-text">
            El ajuste no puede dejar la compra en negativo — como máximo{" "}
            {formatMoneda(compra.montoTotalEfectivo)}.
          </p>
        )}
        {error && <p className="text-xs text-error-text">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={confirmar}
            disabled={guardando || !motivo.trim() || montoAbsoluto === 0 || dejariaEnNegativo}
          >
            {guardando ? "Guardando..." : "Confirmar ajuste"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const FILTROS_ESTADO: { value: EstadoCompra | "todos"; label: string }[] = [
  { value: "todos", label: "Estado: Todos" },
  { value: "pedido", label: "Pedido" },
  { value: "recibido", label: "Recibido" },
];

const FILTROS_PAGO: { value: EstadoPagoCompra | "todos"; label: string }[] = [
  { value: "todos", label: "Pago: Todos" },
  { value: "pendiente", label: "Pendiente" },
  { value: "parcial", label: "Parcial" },
  { value: "pagado", label: "Pagado" },
];

export function ComprasCliente({ compras }: { compras: CompraListado[] }) {
  const router = useRouter();
  const [filtroEstado, setFiltroEstado] = useState<EstadoCompra | "todos">("todos");
  const [filtroPago, setFiltroPago] = useState<EstadoPagoCompra | "todos">("todos");
  const [dialogoRecibir, setDialogoRecibir] = useState<string | null>(null);
  const [dialogoPago, setDialogoPago] = useState<CompraListado | null>(null);
  const [saldoPago, setSaldoPago] = useState<number | null>(null);
  const [dialogoAjuste, setDialogoAjuste] = useState<CompraListado | null>(null);

  const filtradas = compras.filter((c) => {
    if (filtroEstado !== "todos" && c.estado !== filtroEstado) return false;
    if (filtroPago !== "todos" && c.estadoPago !== filtroPago) return false;
    return true;
  });

  function onConfirmado() {
    router.refresh();
  }

  async function abrirDialogoPago(compra: CompraListado) {
    setDialogoPago(compra);
    setSaldoPago(null);
    const resultado = await consultarSaldoCompraAction(compra.id);
    setSaldoPago(resultado.ok ? resultado.data.saldoPendiente : compra.montoTotalEfectivo);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {FILTROS_ESTADO.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFiltroEstado(f.value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                filtroEstado === f.value
                  ? "border-primary bg-pastel-blue-bg text-primary"
                  : "border-gray-border text-text-muted hover:border-primary/50"
              }`}
            >
              {f.label}
            </button>
          ))}
          {FILTROS_PAGO.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFiltroPago(f.value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                filtroPago === f.value
                  ? "border-primary bg-pastel-blue-bg text-primary"
                  : "border-gray-border text-text-muted hover:border-primary/50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Button render={<Link href="/app/proveedores/compras/nuevo" />} nativeButton={false}>
          <Plus className="size-4" />
          Nueva compra
        </Button>
      </div>

      {compras.length === 0 ? (
        <p className="rounded-2xl bg-card p-8 text-center text-sm text-text-muted shadow-card">
          Todavía no registraste ninguna compra.
        </p>
      ) : filtradas.length === 0 ? (
        <p className="rounded-2xl bg-card p-6 text-center text-sm text-text-muted shadow-card">
          Ninguna compra coincide con este filtro.
        </p>
      ) : (
        <div className="divide-y divide-gray-border rounded-2xl bg-card shadow-card">
          {filtradas.map((compra) => (
            <div key={compra.id} className="flex items-center gap-3 p-4 text-sm">
              <div className="min-w-0 flex-1">
                <p className="text-text-body">{compra.itemNombre}</p>
                <p className="truncate text-xs text-text-muted">
                  {formatFecha(compra.fechaCompra)}
                  {compra.proveedorNombre ? ` · ${compra.proveedorNombre}` : ""}
                </p>
                {/* H-31: los ajustes eran invisibles — ni siquiera en la fila
                    de la compra que ajustaste. */}
                {compra.ajustes.map((ajuste) => (
                  <p key={ajuste.id} className="truncate text-xs text-warning-text">
                    {LABEL_TIPO_AJUSTE[ajuste.tipo]} {Number(ajuste.montoAjuste) >= 0 ? "+" : "−"}
                    {formatMoneda(Math.abs(Number(ajuste.montoAjuste)))} · {ajuste.motivo}
                  </p>
                ))}
              </div>
              <span className="w-28 shrink-0 text-right font-semibold text-navy">
                {compra.montoTotalEfectivo !== Number(compra.montoTotal) ? (
                  <>
                    <span className="block text-xs font-normal text-text-muted line-through">
                      {formatMoneda(compra.montoTotal)}
                    </span>
                    {formatMoneda(compra.montoTotalEfectivo)}
                  </>
                ) : (
                  formatMoneda(compra.montoTotal)
                )}
              </span>
              <Badge variant={BADGE_ESTADO[compra.estado].variant}>{BADGE_ESTADO[compra.estado].label}</Badge>
              <Badge variant={BADGE_PAGO[compra.estadoPago].variant}>{BADGE_PAGO[compra.estadoPago].label}</Badge>

              <div className="flex shrink-0 items-center gap-1">
                {compra.estado === "pedido" ? (
                  <Button variant="outline" size="sm" onClick={() => setDialogoRecibir(compra.id)}>
                    <PackageCheck className="size-3.5" />
                    Recibir
                  </Button>
                ) : (
                  <>
                    {compra.estadoPago !== "pagado" && (
                      <Button variant="outline" size="sm" onClick={() => abrirDialogoPago(compra)}>
                        <Receipt className="size-3.5" />
                        Pagar
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDialogoAjuste(compra)}
                      aria-label="Ajustar compra"
                    >
                      <Wrench className="size-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {dialogoRecibir && (
        <RecibirDialog
          compraId={dialogoRecibir}
          open={Boolean(dialogoRecibir)}
          onOpenChange={(open) => !open && setDialogoRecibir(null)}
          onConfirmado={onConfirmado}
        />
      )}
      {dialogoPago && (
        <RegistrarPagoDialog
          compraId={dialogoPago.id}
          saldoActual={saldoPago}
          open={Boolean(dialogoPago)}
          onOpenChange={(open) => !open && setDialogoPago(null)}
          onConfirmado={onConfirmado}
        />
      )}
      {dialogoAjuste && (
        <AjusteDialog
          compra={dialogoAjuste}
          open={Boolean(dialogoAjuste)}
          onOpenChange={(open) => !open && setDialogoAjuste(null)}
          onConfirmado={onConfirmado}
        />
      )}
    </div>
  );
}
