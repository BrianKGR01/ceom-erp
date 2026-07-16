"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, ArrowRight, Pencil, Trash2 } from "lucide-react";
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
import { signoMovimiento } from "@/modules/productos/signo-movimiento";
import {
  ajustarStockAction,
  eliminarProductoAction,
  listarMovimientosStockAction,
  transferirStockAction,
} from "../actions";

interface StockFila {
  sucursalId: string;
  cantidadActual: string;
  stockMinimo: string | null;
}

interface Movimiento {
  id: string;
  tipo: string;
  cantidad: string;
  motivo: string | null;
  creadoEn: string | Date;
}

const ETIQUETAS_TIPO: Record<string, string> = {
  entrada_produccion: "Producción",
  entrada_compra_reventa: "Compra",
  entrada_ajuste_manual: "Ajuste manual",
  entrada_transferencia: "Transferencia recibida",
  salida_venta: "Venta",
  salida_merma: "Merma",
  salida_ajuste_manual: "Ajuste manual",
  salida_transferencia: "Transferencia enviada",
};

export function FichaCliente({
  productoId,
  stockPorSucursal,
  sucursales,
}: {
  productoId: string;
  stockPorSucursal: StockFila[];
  sucursales: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [stock, setStock] = useState(stockPorSucursal);
  const sucursalPorId = new Map(sucursales.map((s) => [s.id, s.nombre]));
  // Sin esto, Select.Value muestra el value crudo (uuid) en vez del nombre.
  const sucursalItems = Object.fromEntries(sucursales.map((s) => [s.id, s.nombre]));
  const tipoAjusteItems = {
    entrada_ajuste_manual: "Sumar stock",
    salida_ajuste_manual: "Restar stock",
  };

  const [sucursalHistorial, setSucursalHistorial] = useState(sucursales[0]?.id ?? "");
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);

  useEffect(() => {
    if (!sucursalHistorial) return;
    let cancelado = false;
    async function cargarHistorial() {
      setCargandoHistorial(true);
      const resultado = await listarMovimientosStockAction(productoId, sucursalHistorial);
      if (cancelado) return;
      setCargandoHistorial(false);
      if (resultado.ok) setMovimientos(resultado.data ?? []);
    }
    cargarHistorial();
    return () => {
      cancelado = true;
    };
  }, [productoId, sucursalHistorial]);

  // --- Ajuste manual ---
  const [ajusteAbierto, setAjusteAbierto] = useState(false);
  const [ajusteSucursalId, setAjusteSucursalId] = useState(sucursales[0]?.id ?? "");
  const [ajusteTipo, setAjusteTipo] = useState<"entrada_ajuste_manual" | "salida_ajuste_manual">(
    "entrada_ajuste_manual"
  );
  const [ajusteCantidad, setAjusteCantidad] = useState("");
  const [ajusteMotivo, setAjusteMotivo] = useState("");
  const [ajusteError, setAjusteError] = useState<string | null>(null);
  const [ajustando, setAjustando] = useState(false);

  async function confirmarAjuste() {
    setAjustando(true);
    setAjusteError(null);
    const resultado = await ajustarStockAction({
      productoId,
      sucursalId: ajusteSucursalId,
      tipo: ajusteTipo,
      cantidad: Number(ajusteCantidad),
      motivo: ajusteMotivo,
    });
    setAjustando(false);
    if (!resultado.ok) {
      setAjusteError(resultado.error);
      return;
    }
    setStock((prev) =>
      prev.some((f) => f.sucursalId === ajusteSucursalId)
        ? prev.map((f) =>
            f.sucursalId === ajusteSucursalId
              ? { ...f, cantidadActual: String(resultado.data.cantidadActual) }
              : f
          )
        : [...prev, { sucursalId: ajusteSucursalId, cantidadActual: String(resultado.data.cantidadActual), stockMinimo: null }]
    );
    setAjusteAbierto(false);
    setAjusteCantidad("");
    setAjusteMotivo("");
    if (sucursalHistorial === ajusteSucursalId) {
      listarMovimientosStockAction(productoId, ajusteSucursalId).then((r) => {
        if (r.ok) setMovimientos(r.data ?? []);
      });
    }
  }

  // --- Transferencia ---
  const [transferenciaAbierta, setTransferenciaAbierta] = useState(false);
  const [origenId, setOrigenId] = useState(sucursales[0]?.id ?? "");
  const [destinoId, setDestinoId] = useState(sucursales[1]?.id ?? "");
  const [transferenciaCantidad, setTransferenciaCantidad] = useState("");
  const [transferenciaError, setTransferenciaError] = useState<string | null>(null);
  const [transfiriendo, setTransfiriendo] = useState(false);

  async function confirmarTransferencia() {
    setTransfiriendo(true);
    setTransferenciaError(null);
    const resultado = await transferirStockAction({
      productoId,
      sucursalOrigenId: origenId,
      sucursalDestinoId: destinoId,
      cantidad: Number(transferenciaCantidad),
    });
    setTransfiriendo(false);
    if (!resultado.ok) {
      setTransferenciaError(resultado.error);
      return;
    }
    setStock((prev) =>
      prev.map((f) => {
        if (f.sucursalId === origenId)
          return { ...f, cantidadActual: String(resultado.data.cantidadActualOrigen) };
        if (f.sucursalId === destinoId)
          return { ...f, cantidadActual: String(resultado.data.cantidadActualDestino) };
        return f;
      })
    );
    setTransferenciaAbierta(false);
    setTransferenciaCantidad("");
  }

  // --- Eliminar ---
  const [eliminarAbierto, setEliminarAbierto] = useState(false);
  const [eliminarError, setEliminarError] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const stockTotal = stock.reduce((acc, f) => acc + Number(f.cantidadActual), 0);

  async function confirmarEliminar() {
    setEliminando(true);
    setEliminarError(null);
    const resultado = await eliminarProductoAction(productoId, true);
    setEliminando(false);
    if (!resultado.ok) {
      setEliminarError(resultado.error);
      return;
    }
    router.push("/app/productos");
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <Button
          variant="outline"
          render={<Link href={`/app/productos/${productoId}/editar`} />}
          nativeButton={false}
        >
          <Pencil className="size-4" />
          Editar
        </Button>
        <Button variant="destructive" onClick={() => setEliminarAbierto(true)}>
          <Trash2 className="size-4" />
          Eliminar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stock por sucursal</CardTitle>
          <CardDescription>Cada sucursal tiene su propia cantidad disponible.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {stock.length === 0 && (
            <p className="text-sm text-text-muted">Todavía no hay stock cargado.</p>
          )}
          {stock.map((fila) => {
            const cantidad = Number(fila.cantidadActual);
            const minimo = fila.stockMinimo !== null ? Number(fila.stockMinimo) : null;
            const bajoMinimo = minimo !== null && cantidad <= minimo;
            return (
              <div
                key={fila.sucursalId}
                className="flex items-center justify-between rounded-lg border border-gray-border px-3 py-2"
              >
                <span className="text-sm text-text-body">
                  {sucursalPorId.get(fila.sucursalId) ?? "Sucursal"}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-navy">{cantidad}</span>
                  {bajoMinimo && <Badge variant="warning">Stock bajo</Badge>}
                </div>
              </div>
            );
          })}

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setAjusteError(null);
                setAjusteAbierto(true);
              }}
            >
              Ajustar stock
            </Button>
            {sucursales.length > 1 && (
              <Button
                variant="outline"
                onClick={() => {
                  setTransferenciaError(null);
                  setTransferenciaAbierta(true);
                }}
              >
                <ArrowLeftRight className="size-4" />
                Transferir
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial de movimientos</CardTitle>
          {sucursales.length > 1 && (
            <Select
              items={sucursalItems}
              value={sucursalHistorial}
              onValueChange={(v) => v && setSucursalHistorial(v)}
            >
              <SelectTrigger className="mt-2 w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sucursales.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {cargandoHistorial && <p className="text-sm text-text-muted">Cargando...</p>}
          {!cargandoHistorial && movimientos.length === 0 && (
            <p className="text-sm text-text-muted">Todavía no hay movimientos registrados.</p>
          )}
          {movimientos.map((mov) => {
            const signo = signoMovimiento(mov.tipo as Parameters<typeof signoMovimiento>[0]);
            return (
              <div
                key={mov.id}
                className="flex items-center justify-between border-b border-gray-border py-2 text-sm last:border-0"
              >
                <div>
                  <p className="text-text-body">{ETIQUETAS_TIPO[mov.tipo] ?? mov.tipo}</p>
                  {mov.motivo && <p className="text-xs text-text-muted">{mov.motivo}</p>}
                </div>
                <span className={signo > 0 ? "font-medium text-success-text" : "font-medium text-error-text"}>
                  {signo > 0 ? "+" : "-"}
                  {mov.cantidad}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Ajuste manual */}
      <Dialog open={ajusteAbierto} onOpenChange={setAjusteAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar stock</DialogTitle>
            <DialogDescription>
              Para corregir por conteo físico, merma no registrada, u otro motivo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {sucursales.length > 1 && (
              <div className="space-y-1.5">
                <Label>Sucursal</Label>
                <Select
                  items={sucursalItems}
                  value={ajusteSucursalId}
                  onValueChange={(v) => v && setAjusteSucursalId(v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sucursales.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Tipo de ajuste</Label>
              <Select
                items={tipoAjusteItems}
                value={ajusteTipo}
                onValueChange={(v) => v && setAjusteTipo(v as typeof ajusteTipo)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada_ajuste_manual">Sumar stock</SelectItem>
                  <SelectItem value="salida_ajuste_manual">Restar stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cantidad</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={ajusteCantidad}
                onChange={(e) => setAjusteCantidad(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Motivo</Label>
              <Input
                placeholder="Ej. Conteo físico — diferencia por merma"
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
            <Button onClick={confirmarAjuste} disabled={ajustando}>
              {ajustando ? "Guardando..." : "Confirmar ajuste"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transferencia */}
      <Dialog open={transferenciaAbierta} onOpenChange={setTransferenciaAbierta}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transferir stock entre sucursales</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 space-y-1.5">
                <Label>Desde</Label>
                <Select items={sucursalItems} value={origenId} onValueChange={(v) => v && setOrigenId(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sucursales.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <ArrowRight className="mt-5 size-4 text-text-muted" />
              <div className="flex-1 space-y-1.5">
                <Label>Hacia</Label>
                <Select items={sucursalItems} value={destinoId} onValueChange={(v) => v && setDestinoId(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sucursales.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Cantidad</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={transferenciaCantidad}
                onChange={(e) => setTransferenciaCantidad(e.target.value)}
              />
            </div>
            {transferenciaError && <p className="text-xs text-error-text">{transferenciaError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferenciaAbierta(false)}>
              Cancelar
            </Button>
            <Button
              onClick={confirmarTransferencia}
              disabled={transfiriendo || origenId === destinoId}
            >
              {transfiriendo ? "Transfiriendo..." : "Confirmar transferencia"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Eliminar */}
      <Dialog open={eliminarAbierto} onOpenChange={setEliminarAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar este producto?</DialogTitle>
            <DialogDescription>
              {stockTotal > 0
                ? `Todavía tiene ${stockTotal} unidades en stock. Se va a ocultar del catálogo, pero las ventas pasadas que lo mencionan van a seguir intactas.`
                : "Se va a ocultar del catálogo. Podés recuperarlo si hace falta."}
            </DialogDescription>
          </DialogHeader>
          {eliminarError && <p className="text-xs text-error-text">{eliminarError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEliminarAbierto(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmarEliminar} disabled={eliminando}>
              {eliminando ? "Eliminando..." : "Sí, eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
