"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  ChefHat,
  Minus,
  Package,
  Pencil,
  Plus,
  Store,
  Tag,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";
import { signoMovimiento } from "@/modules/productos/signo-movimiento";
import {
  ajustarStockAction,
  desvincularProductoDeRecetaAction,
  eliminarProductoAction,
  listarMovimientosStockAction,
  transferirStockAction,
  vincularProductoARecetaAction,
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

interface PrecioDeCompra {
  id: string;
  fechaCompra: string;
  costoUnitario: string;
  cantidad: string;
  proveedorNombre: string | null;
}

function formatFechaCompra(fecha: string): string {
  return new Date(fecha).toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
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

const UNIDADES_LABEL: Record<string, string> = {
  unidad: "Unidad",
  kg: "Kilogramo (kg)",
  g: "Gramo (g)",
  l: "Litro (l)",
  ml: "Mililitro (ml)",
  docena: "Docena",
};

const ORIGEN_COSTO_LABEL: Record<string, string> = {
  nicho_sugerido: "Sugerido por tu rubro",
  proveedor_reventa: "Precio de tu proveedor",
};

interface RecetaOpcion {
  id: string;
  nombre: string;
}

interface RecetaVinculada {
  recetaId: string;
  recetaNombre: string;
  cantidadBaseConsumidaPorUnidad: string;
}

export function FichaCliente({
  productoId,
  imagenUrl,
  categoriaNombre,
  unidadVenta,
  origenCosto,
  ultimaActualizacion,
  precio,
  costo,
  margenPct,
  costoBloqueado,
  stockPorSucursal,
  sucursales,
  recetas,
  recetaVinculada,
  historialPrecios,
}: {
  productoId: string;
  imagenUrl: string | null;
  categoriaNombre?: string;
  unidadVenta: string;
  origenCosto: string;
  ultimaActualizacion: string;
  precio: number;
  costo: number | null;
  margenPct: number | null;
  costoBloqueado: boolean;
  stockPorSucursal: StockFila[];
  sucursales: { id: string; nombre: string }[];
  recetas: RecetaOpcion[];
  recetaVinculada: RecetaVinculada | null;
  historialPrecios: PrecioDeCompra[];
}) {
  const router = useRouter();
  const [stock, setStock] = useState(stockPorSucursal);
  const sucursalPorId = new Map(sucursales.map((s) => [s.id, s.nombre]));
  const sucursalItems = Object.fromEntries(sucursales.map((s) => [s.id, s.nombre]));

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

  function abrirAjuste(sucursalId?: string) {
    setAjusteError(null);
    setAjusteCantidad("");
    setAjusteMotivo("");
    setAjusteTipo("entrada_ajuste_manual");
    if (sucursalId) setAjusteSucursalId(sucursalId);
    setAjusteAbierto(true);
  }

  const cantidadActualAjuste = Number(
    stock.find((f) => f.sucursalId === ajusteSucursalId)?.cantidadActual ?? 0
  );
  const cantidadIngresada = Number(ajusteCantidad) || 0;
  const nuevoStockPreview =
    ajusteTipo === "entrada_ajuste_manual"
      ? cantidadActualAjuste + cantidadIngresada
      : cantidadActualAjuste - cantidadIngresada;

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
    setStock((prev) => {
      const actualizado = prev.map((f) => {
        if (f.sucursalId === origenId)
          return { ...f, cantidadActual: String(resultado.data.cantidadActualOrigen) };
        if (f.sucursalId === destinoId)
          return { ...f, cantidadActual: String(resultado.data.cantidadActualDestino) };
        return f;
      });
      // El destino puede no tener fila propia todavia (primera vez que
      // recibe stock) — a diferencia del origen, que siempre existe (no se
      // puede transferir desde una sucursal sin stock).
      if (!prev.some((f) => f.sucursalId === destinoId)) {
        actualizado.push({
          sucursalId: destinoId,
          cantidadActual: String(resultado.data.cantidadActualDestino),
          stockMinimo: null,
        });
      }
      return actualizado;
    });
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

  // --- Vincular a proceso operativo ---
  const [vinculoAbierto, setVinculoAbierto] = useState(false);
  const [vinculo, setVinculo] = useState(recetaVinculada);
  const [vinculoRecetaId, setVinculoRecetaId] = useState(recetas[0]?.id ?? "");
  const [vinculoCantidad, setVinculoCantidad] = useState("");
  const [vinculoError, setVinculoError] = useState<string | null>(null);
  const [vinculando, setVinculando] = useState(false);
  const [desvinculando, setDesvinculando] = useState(false);

  function abrirVinculo() {
    setVinculoError(null);
    setVinculoRecetaId(vinculo?.recetaId ?? recetas[0]?.id ?? "");
    setVinculoCantidad("");
    setVinculoAbierto(true);
  }

  async function confirmarVinculo() {
    if (!vinculoRecetaId) {
      setVinculoError("Elegí una receta.");
      return;
    }
    if (!vinculoCantidad || Number(vinculoCantidad) <= 0) {
      setVinculoError("Ingresá cuánto de esta receta consume cada unidad vendida.");
      return;
    }
    setVinculando(true);
    setVinculoError(null);
    const resultado = await vincularProductoARecetaAction({
      productoId,
      recetaId: vinculoRecetaId,
      cantidadBaseConsumidaPorUnidad: Number(vinculoCantidad),
    });
    setVinculando(false);
    if (!resultado.ok) {
      setVinculoError(resultado.error);
      return;
    }
    setVinculo({
      recetaId: vinculoRecetaId,
      recetaNombre: recetas.find((r) => r.id === vinculoRecetaId)?.nombre ?? "",
      cantidadBaseConsumidaPorUnidad: String(vinculoCantidad),
    });
    setVinculoAbierto(false);
  }

  async function confirmarDesvinculo() {
    setDesvinculando(true);
    setVinculoError(null);
    const resultado = await desvincularProductoDeRecetaAction(productoId);
    setDesvinculando(false);
    if (!resultado.ok) {
      setVinculoError(resultado.error);
      return;
    }
    setVinculo(null);
    setVinculoAbierto(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          render={<Link href={`/app/productos/${productoId}/editar`} />}
          nativeButton={false}
        >
          <Pencil className="size-4" />
          Editar
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
            Transferir stock
          </Button>
        )}
        <Button variant="outline" onClick={() => abrirAjuste()}>
          Ajustar stock
        </Button>
        <Button variant="outline" onClick={abrirVinculo}>
          <ChefHat className="size-4" />
          {vinculo ? `Receta: ${vinculo.recetaNombre}` : "Vincular a proceso operativo"}
        </Button>
        <Button variant="destructive" onClick={() => setEliminarAbierto(true)}>
          <Trash2 className="size-4" />
          Eliminar
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-pastel-blue-bg">
          {imagenUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imagenUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Package className="size-12 text-primary" />
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Información general</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-text-muted uppercase">Categoría</p>
              <p className="mt-0.5 text-text-body">{categoriaNombre ?? "Sin categoría"}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted uppercase">Unidad de venta</p>
              <p className="mt-0.5 text-text-body">{UNIDADES_LABEL[unidadVenta] ?? unidadVenta}</p>
            </div>
            {origenCosto !== "manual" && (
              <div>
                <p className="text-xs text-text-muted uppercase">Origen del costo</p>
                <p className="mt-0.5 text-text-body">{ORIGEN_COSTO_LABEL[origenCosto] ?? origenCosto}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-text-muted uppercase">Última actualización</p>
              <p className="mt-0.5 text-text-body">{ultimaActualizacion}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="relative overflow-hidden">
          <div className="pointer-events-none absolute -top-6 -right-6 size-24 rounded-full bg-pastel-blue-bg" />
          <CardContent className="relative space-y-1 pt-6">
            <p className="text-xs text-text-muted uppercase">Precio de venta</p>
            <p className="text-2xl font-semibold text-navy">
              {precio.toFixed(2)}{" "}
              <span className="text-sm font-normal text-text-muted">/ {unidadVenta}</span>
            </p>
            {margenPct !== null && (
              <Badge variant={margenPct >= 0 ? "success" : "error"}>
                Margen estimado: {margenPct.toFixed(0)}%
              </Badge>
            )}
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden">
          <div className="pointer-events-none absolute -top-6 -right-6 size-24 rounded-full bg-pastel-blue-bg" />
          <CardContent className="relative space-y-1 pt-6">
            <p className="text-xs text-text-muted uppercase">Costo operativo</p>
            <p className="text-2xl font-semibold text-navy">
              {costo !== null ? costo.toFixed(2) : "—"}
            </p>
            {costoBloqueado ? (
              <p className="text-xs text-text-muted">Actualizado por tu proceso de producción.</p>
            ) : (
              <p className="text-xs text-text-muted">
                {costo !== null ? "Cargado a mano." : "Todavía no cargaste un costo."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stock por sucursal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {stock.length === 0 && (
            <p className="text-sm text-text-muted">Todavía no hay stock cargado.</p>
          )}
          {stock.length > 0 && (
            <div className="hidden text-xs font-medium text-text-muted uppercase sm:flex sm:items-center sm:gap-3 sm:px-1 sm:pb-1">
              <span className="flex-1">Sucursal</span>
              <span className="w-16 text-right">Stock actual</span>
              <span className="w-16 text-right">Stock mínimo</span>
              <span className="w-24 text-right">Estado</span>
              <span className="w-16 text-right">Acción</span>
            </div>
          )}
          {stock.map((fila) => {
            const cantidad = Number(fila.cantidadActual);
            const minimo = fila.stockMinimo !== null ? Number(fila.stockMinimo) : null;
            const bajoMinimo = minimo !== null && cantidad <= minimo;
            return (
              <div
                key={fila.sucursalId}
                className="flex items-center gap-3 rounded-lg border border-gray-border px-3 py-2"
              >
                <span className="flex flex-1 items-center gap-2 text-sm text-text-body">
                  <Store className="size-4 text-text-muted" />
                  {sucursalPorId.get(fila.sucursalId) ?? "Sucursal"}
                </span>
                <span className="w-16 text-right text-sm font-medium text-navy">{cantidad}</span>
                <span className="w-16 text-right text-sm text-text-muted">{minimo ?? "—"}</span>
                <span className="w-24 text-right">
                  {bajoMinimo && <Badge variant="warning">Stock bajo</Badge>}
                </span>
                <span className="w-16 text-right">
                  <button
                    type="button"
                    onClick={() => abrirAjuste(fila.sucursalId)}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Ajustar
                  </button>
                </span>
              </div>
            );
          })}
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
                className="flex items-center gap-3 border-b border-gray-border py-2 text-sm last:border-0"
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full",
                    signo > 0 ? "bg-success-bg text-success-text" : "bg-error-bg text-error-text"
                  )}
                >
                  {signo > 0 ? (
                    <ArrowUpRight className="size-4" />
                  ) : (
                    <ArrowDownRight className="size-4" />
                  )}
                </span>
                <div className="flex-1">
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

      {historialPrecios.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Historial de precios de compra</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {historialPrecios.map((fila) => (
              <div
                key={fila.id}
                className="flex items-center gap-3 border-b border-gray-border py-2 text-sm last:border-0"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-pastel-blue-bg text-primary">
                  <Tag className="size-4" />
                </span>
                <div className="flex-1">
                  <p className="text-text-body">{formatFechaCompra(fila.fechaCompra)}</p>
                  <p className="text-xs text-text-muted">{fila.proveedorNombre ?? "Sin proveedor"}</p>
                </div>
                <span className="font-medium text-navy">
                  {Number(fila.costoUnitario).toFixed(2)} / unidad
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAjusteTipo("entrada_ajuste_manual")}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-colors",
                    ajusteTipo === "entrada_ajuste_manual"
                      ? "border-primary bg-pastel-blue-bg"
                      : "border-gray-border hover:border-primary/50"
                  )}
                >
                  <span className="flex size-8 items-center justify-center rounded-full bg-success-bg text-success-text">
                    <Plus className="size-4" />
                  </span>
                  <span className="text-xs font-medium text-navy">Entrada</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAjusteTipo("salida_ajuste_manual")}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-colors",
                    ajusteTipo === "salida_ajuste_manual"
                      ? "border-primary bg-pastel-blue-bg"
                      : "border-gray-border hover:border-primary/50"
                  )}
                >
                  <span className="flex size-8 items-center justify-center rounded-full bg-error-bg text-error-text">
                    <Minus className="size-4" />
                  </span>
                  <span className="text-xs font-medium text-navy">Salida</span>
                </button>
              </div>
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
              {ajusteCantidad && (
                <p className="text-xs text-text-muted">
                  El nuevo stock será: <span className="font-medium text-navy">{nuevoStockPreview}</span>
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Motivo</Label>
              <Textarea
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
              {ajustando ? "Guardando..." : "Guardar ajuste"}
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

      {/* Vincular a proceso operativo */}
      <Dialog open={vinculoAbierto} onOpenChange={setVinculoAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular a proceso operativo</DialogTitle>
            <DialogDescription>
              Conectá este producto con una Receta de Producción — el costo operativo y el stock
              van a actualizarse automáticamente con cada lote producido.
            </DialogDescription>
          </DialogHeader>

          {recetas.length === 0 ? (
            <p className="text-sm text-text-muted">
              Todavía no creaste ninguna Receta. Cargá una primero desde Producción.
            </p>
          ) : vinculo ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-gray-border p-3 text-sm">
                <p className="text-xs text-text-muted uppercase">Receta vinculada</p>
                <p className="mt-0.5 font-medium text-navy">{vinculo.recetaNombre}</p>
                <p className="text-xs text-text-muted">
                  Consume {vinculo.cantidadBaseConsumidaPorUnidad} por unidad vendida.
                </p>
              </div>
              {vinculoError && <p className="text-xs text-error-text">{vinculoError}</p>}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Receta</Label>
                <Select
                  items={Object.fromEntries(recetas.map((r) => [r.id, r.nombre]))}
                  value={vinculoRecetaId}
                  onValueChange={(v) => v && setVinculoRecetaId(v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {recetas.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Cantidad de receta consumida por unidad vendida</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Ej. 1"
                  value={vinculoCantidad}
                  onChange={(e) => setVinculoCantidad(e.target.value)}
                />
              </div>
              {vinculoError && <p className="text-xs text-error-text">{vinculoError}</p>}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setVinculoAbierto(false)}>
              Cerrar
            </Button>
            {vinculo ? (
              <Button variant="destructive" onClick={confirmarDesvinculo} disabled={desvinculando}>
                {desvinculando ? "Desvinculando..." : "Desvincular"}
              </Button>
            ) : (
              recetas.length > 0 && (
                <Button onClick={confirmarVinculo} disabled={vinculando}>
                  {vinculando ? "Vinculando..." : "Vincular"}
                </Button>
              )
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
