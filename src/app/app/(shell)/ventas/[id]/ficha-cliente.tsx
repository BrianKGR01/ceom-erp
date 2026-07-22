"use client";

import { useState } from "react";
import { Info, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ToggleGroup } from "@/components/ui/toggle-group";
import { formatMoneda } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MetodoPagoIcon } from "@/modules/ventas/components/metodo-pago-icon";
import { registrarAjusteVentaAction, registrarPagoVentaAction } from "../actions";

type EstadoPago = "pendiente" | "parcial" | "pagado";
type TipoAjuste = "correccion" | "devolucion" | "descuento_posterior" | "anulacion_total";

const BADGE_ESTADO: Record<EstadoPago, "success" | "warning" | "info"> = {
  pagado: "success",
  parcial: "warning",
  pendiente: "info",
};
const LABEL_ESTADO: Record<EstadoPago, string> = {
  pagado: "Pagado",
  parcial: "Pago parcial",
  pendiente: "Pendiente de cobro",
};
const LABEL_TIPO_AJUSTE: Record<TipoAjuste, string> = {
  correccion: "Corrección",
  devolucion: "Devolución",
  descuento_posterior: "Descuento posterior",
  anulacion_total: "Anulación total",
};

export interface DetalleLinea {
  id: string;
  productoNombre: string;
  productoImagenUrl: string | null;
  cantidad: string;
  precioVentaSnapshot: string;
  subtotal: string;
}
export interface PagoFila {
  id: string;
  monto: string;
  metodoPagoNombre: string;
  fechaPago: string;
}
export interface AjusteFila {
  id: string;
  tipo: TipoAjuste;
  montoAjuste: string;
  motivo: string;
  creadoEn: string;
}

export function FichaVentaCliente({
  ventaId,
  estadoPagoInicial,
  totalVenta,
  detalles,
  pagosIniciales,
  ajustesIniciales,
  metodos,
  productos,
}: {
  ventaId: string;
  estadoPagoInicial: EstadoPago;
  totalVenta: number;
  detalles: DetalleLinea[];
  pagosIniciales: PagoFila[];
  ajustesIniciales: AjusteFila[];
  metodos: { id: string; nombre: string }[];
  productos: { id: string; nombre: string }[];
}) {
  const [estadoPago, setEstadoPago] = useState(estadoPagoInicial);
  const [pagos, setPagos] = useState(pagosIniciales);
  const [ajustes, setAjustes] = useState(ajustesIniciales);
  const totalPagado = pagos.reduce((acc, p) => acc + Number(p.monto), 0);
  const saldoPendiente = Math.max(0, totalVenta - totalPagado);

  // --- Registrar pago ---
  const [pagoAbierto, setPagoAbierto] = useState(false);
  const [pagoMonto, setPagoMonto] = useState("");
  const [pagoMetodoId, setPagoMetodoId] = useState(metodos[0]?.id ?? "");
  const [pagoFecha, setPagoFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [pagoError, setPagoError] = useState<string | null>(null);
  const [registrandoPago, setRegistrandoPago] = useState(false);

  function abrirPago() {
    setPagoError(null);
    setPagoMonto(saldoPendiente > 0 ? saldoPendiente.toFixed(2) : "");
    setPagoFecha(new Date().toISOString().slice(0, 10));
    setPagoAbierto(true);
  }

  async function confirmarPago() {
    setRegistrandoPago(true);
    setPagoError(null);
    const resultado = await registrarPagoVentaAction(ventaId, {
      monto: Number(pagoMonto),
      metodoPagoId: pagoMetodoId,
      fechaPago: pagoFecha,
    });
    setRegistrandoPago(false);
    if (!resultado.ok) {
      setPagoError(resultado.error);
      return;
    }
    setEstadoPago(resultado.data.estadoPago as EstadoPago);
    setPagos((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        monto: pagoMonto,
        metodoPagoNombre: metodos.find((m) => m.id === pagoMetodoId)?.nombre ?? "",
        fechaPago: pagoFecha,
      },
    ]);
    setPagoAbierto(false);
    setPagoMonto("");
  }

  // --- Ajuste de venta ---
  const [ajusteAbierto, setAjusteAbierto] = useState(false);
  const [ajusteTipo, setAjusteTipo] = useState<TipoAjuste>("correccion");
  // El usuario carga siempre una MAGNITUD positiva; el signo lo deriva la
  // pantalla a partir del tipo (H-30). Antes se pedía el número con signo y
  // la única guía era un placeholder que desaparecía al escribir, así que una
  // anulación de 500 cargada como "500" le sumaba 500 al estado de
  // resultados en vez de restarlos.
  const [ajusteMonto, setAjusteMonto] = useState("");
  // Solo aplica a "correccion", el único tipo bidireccional (Modulo_03 1.3:
  // el monto puede ser positivo cuando se cobró de menos). Los otros tres
  // tipos solo pueden reducir, y para ellos esto no se muestra ni se usa.
  const [correccionSuma, setCorreccionSuma] = useState(false);
  const [ajusteProductoId, setAjusteProductoId] = useState<string>("ninguno");
  const [ajusteCantidad, setAjusteCantidad] = useState("");
  const [ajusteMotivo, setAjusteMotivo] = useState("");
  const [ajusteError, setAjusteError] = useState<string | null>(null);
  const [registrandoAjuste, setRegistrandoAjuste] = useState(false);

  const ajusteSuma = ajusteTipo === "correccion" && correccionSuma;
  const magnitudAjuste = Math.abs(Number(ajusteMonto) || 0);
  const montoAjusteFirmado = ajusteSuma ? magnitudAjuste : -magnitudAjuste;

  async function confirmarAjuste() {
    setRegistrandoAjuste(true);
    setAjusteError(null);
    const resultado = await registrarAjusteVentaAction(ventaId, {
      tipo: ajusteTipo,
      montoAjuste: montoAjusteFirmado,
      productoId: ajusteProductoId !== "ninguno" ? ajusteProductoId : undefined,
      cantidadProductoAjustada:
        ajusteProductoId !== "ninguno" && ajusteCantidad ? Number(ajusteCantidad) : undefined,
      motivo: ajusteMotivo,
    });
    setRegistrandoAjuste(false);
    if (!resultado.ok) {
      setAjusteError(resultado.error);
      return;
    }
    setAjustes((prev) => [
      ...prev,
      {
        id: resultado.data.ajusteId,
        tipo: ajusteTipo,
        montoAjuste: String(montoAjusteFirmado),
        motivo: ajusteMotivo,
        creadoEn: new Date().toISOString(),
      },
    ]);
    setAjusteAbierto(false);
    setAjusteMonto("");
    setCorreccionSuma(false);
    setAjusteMotivo("");
    setAjusteProductoId("ninguno");
    setAjusteCantidad("");
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Artículos</CardTitle>
            <CardDescription>{detalles.length} items</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {detalles.map((linea) => (
              <div key={linea.id} className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-pastel-blue-bg">
                  {linea.productoImagenUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={linea.productoImagenUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Package className="size-4 text-primary" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm text-text-body">{linea.productoNombre}</p>
                  <p className="text-xs text-text-muted">
                    {linea.cantidad} × {Number(linea.precioVentaSnapshot).toFixed(2)}
                  </p>
                </div>
                <span className="font-medium text-navy">{Number(linea.subtotal).toFixed(2)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Historial de pagos</CardTitle>
            <CardDescription>
              {totalPagado.toFixed(2)} de {totalVenta.toFixed(2)} cobrado
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {pagos.length === 0 && <p className="text-sm text-text-muted">Sin pagos registrados.</p>}
            {pagos.map((pago) => (
              <div key={pago.id} className="flex items-center gap-3 text-sm">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-pastel-blue-bg text-primary">
                  <MetodoPagoIcon nombre={pago.metodoPagoNombre} className="size-4" />
                </span>
                <span className="flex-1 text-text-body">
                  {pago.metodoPagoNombre} — {new Date(pago.fechaPago).toLocaleDateString("es-BO")}
                </span>
                <span
                  className={
                    Number(pago.monto) < 0
                      ? "font-medium text-error-text"
                      : "font-medium text-success-text"
                  }
                >
                  {Number(pago.monto).toFixed(2)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        {ajustes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Ajustes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {ajustes.map((ajuste) => (
                <div key={ajuste.id} className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-text-body">{LABEL_TIPO_AJUSTE[ajuste.tipo]}</span>
                    <span className="font-medium text-navy">
                      {Number(ajuste.montoAjuste).toFixed(2)}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted">{ajuste.motivo}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Resumen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">Subtotal</span>
              <span className="text-text-body">{totalVenta.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-gray-border pt-3 text-base font-semibold">
              <span className="text-navy">Total</span>
              <span className="text-navy">{totalVenta.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">Pagado</span>
              <span className="text-success-text">{totalPagado.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">Saldo pendiente</span>
              <span className={saldoPendiente > 0 ? "text-error-text" : "text-text-body"}>
                {saldoPendiente.toFixed(2)}
              </span>
            </div>
            <Badge variant={BADGE_ESTADO[estadoPago]}>{LABEL_ESTADO[estadoPago]}</Badge>
          </CardContent>
        </Card>

        <div className="space-y-2">
          <Button onClick={abrirPago} className="w-full justify-center">
            Registrar pago
          </Button>
          <Button variant="outline" onClick={() => setAjusteAbierto(true)} className="w-full justify-center">
            Ajustar venta
          </Button>
        </div>
      </div>

      <Dialog open={pagoAbierto} onOpenChange={setPagoAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pago</DialogTitle>
            {saldoPendiente > 0 && (
              <DialogDescription>Monto restante de esta venta: {saldoPendiente.toFixed(2)}</DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Monto a pagar</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={pagoMonto}
                onChange={(e) => setPagoMonto(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Método de pago</Label>
              {metodos.length > 0 ? (
                <div className="grid grid-cols-3 gap-1.5">
                  {metodos.map((metodo) => (
                    <button
                      key={metodo.id}
                      type="button"
                      onClick={() => setPagoMetodoId(metodo.id)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-colors",
                        pagoMetodoId === metodo.id
                          ? "border-primary bg-pastel-blue-bg"
                          : "border-gray-border hover:border-primary/50"
                      )}
                    >
                      <MetodoPagoIcon
                        nombre={metodo.nombre}
                        className={cn(
                          "size-4",
                          pagoMetodoId === metodo.id ? "text-primary" : "text-text-muted"
                        )}
                      />
                      <span className="line-clamp-1 text-[11px] font-medium text-navy">
                        {metodo.nombre}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <Select
                  items={Object.fromEntries(metodos.map((m) => [m.id, m.nombre]))}
                  value={pagoMetodoId}
                  onValueChange={(v) => v && setPagoMetodoId(v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {metodos.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Fecha de pago</Label>
              <Input type="date" value={pagoFecha} onChange={(e) => setPagoFecha(e.target.value)} />
            </div>
            {pagoError && <p className="text-xs text-error-text">{pagoError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPagoAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmarPago} disabled={registrandoPago || !pagoMonto}>
              {registrandoPago ? "Guardando..." : "Confirmar pago"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={ajusteAbierto} onOpenChange={setAjusteAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajuste de venta</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg bg-info-bg p-3 text-xs text-info-text">
              <Info className="mt-0.5 size-4 shrink-0" />
              <p>
                Ninguna venta se edita directamente — este ajuste queda registrado como un
                movimiento aparte, con motivo obligatorio.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select
                items={LABEL_TIPO_AJUSTE}
                value={ajusteTipo}
                onValueChange={(v) => v && setAjusteTipo(v as TipoAjuste)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(LABEL_TIPO_AJUSTE) as TipoAjuste[]).map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>
                      {LABEL_TIPO_AJUSTE[tipo]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Solo "Corrección" puede ir en las dos direcciones (Modulo_03
                1.3). Para los otros tres tipos no se pregunta nada: reducen
                siempre, y el signo lo pone la pantalla. */}
            {ajusteTipo === "correccion" && (
              <div className="space-y-1.5">
                <Label>¿Qué corrige?</Label>
                <ToggleGroup
                  value={correccionSuma ? "suma" : "resta"}
                  onValueChange={(v) => setCorreccionSuma(v === "suma")}
                  options={[
                    { value: "resta", label: "Cobré de más" },
                    { value: "suma", label: "Cobré de menos" },
                  ]}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="ajuste-monto">
                {ajusteSuma ? "Monto a sumar a la venta" : "Monto a descontar de la venta"}
              </Label>
              <Input
                id="ajuste-monto"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                placeholder="0.00"
                value={ajusteMonto}
                onChange={(e) => setAjusteMonto(e.target.value)}
              />
              <p className="text-xs text-text-muted">
                {magnitudAjuste > 0 ? (
                  <>
                    Se va a registrar como{" "}
                    <span
                      className={cn(
                        "font-medium",
                        ajusteSuma ? "text-success-text" : "text-error-text"
                      )}
                    >
                      {ajusteSuma ? "+" : "−"}
                      {formatMoneda(magnitudAjuste)}
                    </span>{" "}
                    {ajusteSuma ? "y va a aumentar" : "y va a reducir"} el resultado del período.
                  </>
                ) : (
                  "Ingresá el monto en positivo — el signo lo aplica el sistema según el tipo de ajuste."
                )}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>¿Devuelve stock? (opcional)</Label>
              <Select
                items={{
                  ninguno: "No devuelve stock",
                  ...Object.fromEntries(productos.map((p) => [p.id, p.nombre])),
                }}
                value={ajusteProductoId}
                onValueChange={(v) => v && setAjusteProductoId(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ninguno">No devuelve stock</SelectItem>
                  {productos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {ajusteProductoId !== "ninguno" && (
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Cantidad a devolver"
                  value={ajusteCantidad}
                  onChange={(e) => setAjusteCantidad(e.target.value)}
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Motivo</Label>
              <Textarea
                placeholder="Describí brevemente la razón del ajuste (obligatorio)"
                value={ajusteMotivo}
                onChange={(e) => setAjusteMotivo(e.target.value)}
              />
            </div>
            {ajusteError && <p className="text-xs text-error-text">{ajusteError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAjusteAbierto(false)}>
              Cancelar
            </Button>
            <Button
              onClick={confirmarAjuste}
              disabled={registrandoAjuste || magnitudAjuste <= 0 || !ajusteMotivo.trim()}
            >
              {registrandoAjuste ? "Guardando..." : "Confirmar ajuste"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
