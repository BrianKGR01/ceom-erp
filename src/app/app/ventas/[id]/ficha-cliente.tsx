"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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

  // --- Registrar pago ---
  const [pagoAbierto, setPagoAbierto] = useState(false);
  const [pagoMonto, setPagoMonto] = useState("");
  const [pagoMetodoId, setPagoMetodoId] = useState(metodos[0]?.id ?? "");
  const [pagoError, setPagoError] = useState<string | null>(null);
  const [registrandoPago, setRegistrandoPago] = useState(false);

  async function confirmarPago() {
    setRegistrandoPago(true);
    setPagoError(null);
    const resultado = await registrarPagoVentaAction(ventaId, {
      monto: Number(pagoMonto),
      metodoPagoId: pagoMetodoId,
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
        fechaPago: new Date().toISOString(),
      },
    ]);
    setPagoAbierto(false);
    setPagoMonto("");
  }

  // --- Ajuste de venta ---
  const [ajusteAbierto, setAjusteAbierto] = useState(false);
  const [ajusteTipo, setAjusteTipo] = useState<TipoAjuste>("correccion");
  const [ajusteMonto, setAjusteMonto] = useState("");
  const [ajusteProductoId, setAjusteProductoId] = useState<string>("ninguno");
  const [ajusteCantidad, setAjusteCantidad] = useState("");
  const [ajusteMotivo, setAjusteMotivo] = useState("");
  const [ajusteError, setAjusteError] = useState<string | null>(null);
  const [registrandoAjuste, setRegistrandoAjuste] = useState(false);

  async function confirmarAjuste() {
    setRegistrandoAjuste(true);
    setAjusteError(null);
    const resultado = await registrarAjusteVentaAction(ventaId, {
      tipo: ajusteTipo,
      montoAjuste: Number(ajusteMonto),
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
        montoAjuste: ajusteMonto,
        motivo: ajusteMotivo,
        creadoEn: new Date().toISOString(),
      },
    ]);
    setAjusteAbierto(false);
    setAjusteMonto("");
    setAjusteMotivo("");
    setAjusteProductoId("ninguno");
    setAjusteCantidad("");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={BADGE_ESTADO[estadoPago]}>{LABEL_ESTADO[estadoPago]}</Badge>
        <span className="text-2xl font-semibold text-navy">{totalVenta.toFixed(2)}</span>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => setPagoAbierto(true)}>
            Registrar pago
          </Button>
          <Button variant="outline" onClick={() => setAjusteAbierto(true)}>
            Ajuste de venta
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Productos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {detalles.map((linea) => (
            <div key={linea.id} className="flex items-center justify-between text-sm">
              <span className="text-text-body">
                {linea.cantidad} × {linea.productoNombre}
              </span>
              <span className="font-medium text-navy">{Number(linea.subtotal).toFixed(2)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pagos</CardTitle>
          <CardDescription>
            {totalPagado.toFixed(2)} de {totalVenta.toFixed(2)} cobrado
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {pagos.length === 0 && <p className="text-sm text-text-muted">Sin pagos registrados.</p>}
          {pagos.map((pago) => (
            <div key={pago.id} className="flex items-center justify-between text-sm">
              <span className="text-text-body">
                {pago.metodoPagoNombre} — {new Date(pago.fechaPago).toLocaleDateString("es-BO")}
              </span>
              <span
                className={
                  Number(pago.monto) < 0 ? "font-medium text-error-text" : "font-medium text-success-text"
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
                  <span className="font-medium text-navy">{Number(ajuste.montoAjuste).toFixed(2)}</span>
                </div>
                <p className="text-xs text-text-muted">{ajuste.motivo}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={pagoAbierto} onOpenChange={setPagoAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pago</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Método de pago</Label>
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
            </div>
            <div className="space-y-1.5">
              <Label>Monto</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={pagoMonto}
                onChange={(e) => setPagoMonto(e.target.value)}
              />
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
            <div className="space-y-1.5">
              <Label>Monto del ajuste</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="Negativo si devolvés dinero"
                value={ajusteMonto}
                onChange={(e) => setAjusteMonto(e.target.value)}
              />
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
              <Input
                placeholder="Obligatorio"
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
              disabled={registrandoAjuste || !ajusteMonto || !ajusteMotivo.trim()}
            >
              {registrandoAjuste ? "Guardando..." : "Confirmar ajuste"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
