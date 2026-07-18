"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownRight,
  ArrowUpRight,
  Beaker,
  Minus,
  Pencil,
  Plus,
  ShoppingCart,
  Trash2,
} from "lucide-react";
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
import {
  eliminarInsumoAction,
  listarMovimientosInsumoAction,
  registrarAjusteManualInsumoAction,
  registrarEntradaCompraInsumoAction,
  registrarMermaAlmacenamientoAction,
} from "../../actions";

type UnidadMedidaInsumo = "litros" | "ml" | "kg" | "g" | "unidad" | "metros";
type TipoMovimientoInsumo =
  | "entrada_compra"
  | "salida_produccion"
  | "entrada_ajuste_manual"
  | "salida_ajuste_manual"
  | "salida_merma_almacenamiento";

const LABEL_UNIDAD: Record<UnidadMedidaInsumo, string> = {
  litros: "Litros",
  ml: "Mililitros (ml)",
  kg: "Kilogramos (kg)",
  g: "Gramos (g)",
  unidad: "Unidad",
  metros: "Metros",
};

const ETIQUETAS_TIPO: Record<TipoMovimientoInsumo, string> = {
  entrada_compra: "Compra",
  salida_produccion: "Producción",
  entrada_ajuste_manual: "Ajuste manual",
  salida_ajuste_manual: "Ajuste manual",
  salida_merma_almacenamiento: "Merma de almacenamiento",
};

const TIPOS_ENTRADA = new Set<TipoMovimientoInsumo>(["entrada_compra", "entrada_ajuste_manual"]);

interface StockFila {
  sucursalId: string;
  cantidadActual: string;
}

interface Movimiento {
  id: string;
  tipo: TipoMovimientoInsumo;
  cantidad: string;
  motivo: string | null;
  creadoEn: string | Date;
}

function EntradaCompraDialog({
  insumoId,
  sucursales,
  sucursalIdInicial,
  open,
  onOpenChange,
  onConfirmado,
}: {
  insumoId: string;
  sucursales: { id: string; nombre: string }[];
  sucursalIdInicial: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmado: (sucursalId: string) => void;
}) {
  const [sucursalId, setSucursalId] = useState(sucursalIdInicial);
  const [cantidad, setCantidad] = useState("");
  const [costoCompra, setCostoCompra] = useState("");
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmar() {
    setGuardando(true);
    setError(null);
    const resultado = await registrarEntradaCompraInsumoAction(insumoId, {
      sucursalId,
      cantidad: Number(cantidad),
      costoCompra: Number(costoCompra),
      fechaVencimiento: fechaVencimiento || undefined,
    });
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    onOpenChange(false);
    setCantidad("");
    setCostoCompra("");
    setFechaVencimiento("");
    onConfirmado(sucursalId);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-success-bg text-success-text">
              <ShoppingCart className="size-4" />
            </span>
            <DialogTitle>Registrar entrada de compra</DialogTitle>
          </div>
          <DialogDescription>Recalcula el costo promedio ponderado del insumo.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {sucursales.length > 1 && (
            <div className="space-y-1.5">
              <Label>Sucursal</Label>
              <Select
                items={Object.fromEntries(sucursales.map((s) => [s.id, s.nombre]))}
                value={sucursalId}
                onValueChange={(v) => v && setSucursalId(v)}
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cantidad">Cantidad</Label>
              <Input
                id="cantidad"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="costoCompra">Costo de compra</Label>
              <Input
                id="costoCompra"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={costoCompra}
                onChange={(e) => setCostoCompra(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fechaVencimiento">Fecha de vencimiento (opcional)</Label>
            <Input
              id="fechaVencimiento"
              type="date"
              value={fechaVencimiento}
              onChange={(e) => setFechaVencimiento(e.target.value)}
            />
            <p className="text-xs text-text-muted">
              Si lo dejás vacío, se calcula sola desde la vida útil del insumo.
            </p>
          </div>
        </div>

        {error && <p className="text-xs text-error-text">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={confirmar}
            disabled={guardando || !cantidad || !costoCompra || !sucursalId}
          >
            {guardando ? "Guardando..." : "Registrar entrada"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AjusteDialog({
  insumoId,
  sucursales,
  sucursalIdInicial,
  open,
  onOpenChange,
  onConfirmado,
}: {
  insumoId: string;
  sucursales: { id: string; nombre: string }[];
  sucursalIdInicial: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmado: (sucursalId: string) => void;
}) {
  const [sucursalId, setSucursalId] = useState(sucursalIdInicial);
  const [tipo, setTipo] = useState<"entrada_ajuste_manual" | "salida_ajuste_manual">(
    "entrada_ajuste_manual"
  );
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmar() {
    setGuardando(true);
    setError(null);
    const resultado = await registrarAjusteManualInsumoAction(insumoId, {
      sucursalId,
      tipo,
      cantidad: Number(cantidad),
      motivo,
    });
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    onOpenChange(false);
    onConfirmado(sucursalId);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustar stock de insumo</DialogTitle>
          <DialogDescription>
            Para corregir por conteo físico u otro motivo — el motivo queda registrado.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {sucursales.length > 1 && (
            <div className="space-y-1.5">
              <Label>Sucursal</Label>
              <Select
                items={Object.fromEntries(sucursales.map((s) => [s.id, s.nombre]))}
                value={sucursalId}
                onValueChange={(v) => v && setSucursalId(v)}
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
                onClick={() => setTipo("entrada_ajuste_manual")}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-colors",
                  tipo === "entrada_ajuste_manual"
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
                onClick={() => setTipo("salida_ajuste_manual")}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-colors",
                  tipo === "salida_ajuste_manual"
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
            <Label htmlFor="cantidadAjuste">Cantidad</Label>
            <Input
              id="cantidadAjuste"
              type="number"
              min="0"
              step="0.01"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="motivoAjuste">Motivo</Label>
            <Textarea
              id="motivoAjuste"
              placeholder="Ej. Conteo físico — diferencia detectada"
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
          <Button onClick={confirmar} disabled={guardando || !cantidad || !motivo.trim()}>
            {guardando ? "Guardando..." : "Guardar ajuste"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MermaDialog({
  insumoId,
  sucursales,
  sucursalIdInicial,
  open,
  onOpenChange,
  onConfirmado,
}: {
  insumoId: string;
  sucursales: { id: string; nombre: string }[];
  sucursalIdInicial: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmado: (sucursalId: string) => void;
}) {
  const [sucursalId, setSucursalId] = useState(sucursalIdInicial);
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmar() {
    setGuardando(true);
    setError(null);
    const resultado = await registrarMermaAlmacenamientoAction(insumoId, {
      sucursalId,
      cantidad: Number(cantidad),
      motivo,
    });
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    onOpenChange(false);
    onConfirmado(sucursalId);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar merma de almacenamiento</DialogTitle>
          <DialogDescription>
            Para un insumo perecedero que se venció sin llegar a producción.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {sucursales.length > 1 && (
            <div className="space-y-1.5">
              <Label>Sucursal</Label>
              <Select
                items={Object.fromEntries(sucursales.map((s) => [s.id, s.nombre]))}
                value={sucursalId}
                onValueChange={(v) => v && setSucursalId(v)}
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
            <Label htmlFor="cantidadMerma">Cantidad</Label>
            <Input
              id="cantidadMerma"
              type="number"
              min="0"
              step="0.01"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="motivoMerma">Motivo</Label>
            <Textarea
              id="motivoMerma"
              placeholder="Ej. Vencido antes de usarse"
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
          <Button variant="destructive" onClick={confirmar} disabled={guardando || !cantidad || !motivo.trim()}>
            {guardando ? "Guardando..." : "Registrar merma"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FichaInsumoCliente({
  insumoId,
  nombre,
  unidadMedida,
  vidaUtilDias,
  costoUnitarioVigente,
  stockMinimo,
  stockPorSucursal,
  sucursales,
}: {
  insumoId: string;
  nombre: string;
  unidadMedida: UnidadMedidaInsumo;
  vidaUtilDias: number | null;
  costoUnitarioVigente: string | null;
  stockMinimo: string | null;
  stockPorSucursal: StockFila[];
  sucursales: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const primeraSucursal = sucursales[0]?.id ?? "";

  const [sucursalHistorial, setSucursalHistorial] = useState(primeraSucursal);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);

  useEffect(() => {
    if (!sucursalHistorial) return;
    let cancelado = false;
    async function cargarHistorial() {
      setCargandoHistorial(true);
      const resultado = await listarMovimientosInsumoAction(insumoId, sucursalHistorial);
      if (cancelado) return;
      setCargandoHistorial(false);
      if (resultado.ok) setMovimientos((resultado.data as Movimiento[]) ?? []);
    }
    cargarHistorial();
    return () => {
      cancelado = true;
    };
  }, [insumoId, sucursalHistorial]);

  // Las mutaciones (compra/ajuste/merma) refrescan la Ficha via
  // router.refresh(), pero eso no repite el effect de arriba porque
  // sucursalHistorial no cambia — mismo motivo por el que Ficha de
  // Producto vuelve a pedir el historial a mano tras un ajuste.
  function refrescarHistorialSiAplica(sucursalId: string) {
    if (sucursalId !== sucursalHistorial) return;
    listarMovimientosInsumoAction(insumoId, sucursalHistorial).then((resultado) => {
      if (resultado.ok) setMovimientos((resultado.data as Movimiento[]) ?? []);
    });
  }

  const [dialogoCompra, setDialogoCompra] = useState<string | null>(null);
  const [dialogoAjuste, setDialogoAjuste] = useState<string | null>(null);
  const [dialogoMerma, setDialogoMerma] = useState<string | null>(null);
  const [confirmandoBaja, setConfirmandoBaja] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmarEliminar() {
    setEliminando(true);
    setError(null);
    const resultado = await eliminarInsumoAction(insumoId);
    setEliminando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    router.push("/app/produccion/insumos");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-pastel-blue-bg text-primary">
            <Beaker className="size-5" />
          </span>
          <h1 className="font-heading text-lg font-semibold text-navy">{nombre}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setDialogoCompra(primeraSucursal)}>
            <ShoppingCart className="size-4" />
            Registrar compra
          </Button>
          <Button
            variant="outline"
            render={<Link href={`/app/produccion/insumos/${insumoId}/editar`} />}
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
      </div>

      {error && <p className="text-xs text-error-text">{error}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Información general</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-text-muted uppercase">Unidad de medida</p>
              <p className="mt-0.5 text-text-body">{LABEL_UNIDAD[unidadMedida]}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted uppercase">Vida útil</p>
              <p className="mt-0.5 text-text-body">
                {vidaUtilDias ? `${vidaUtilDias} días` : "No vence"}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted uppercase">Stock mínimo</p>
              <p className="mt-0.5 text-text-body">
                {stockMinimo !== null ? Number(stockMinimo) : "Sin definir"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden">
          <div className="pointer-events-none absolute -top-6 -right-6 size-24 rounded-full bg-pastel-blue-bg" />
          <CardContent className="relative space-y-1 pt-6">
            <p className="text-xs text-text-muted uppercase">Costo unitario vigente</p>
            <p className="text-2xl font-semibold text-navy">
              {costoUnitarioVigente !== null ? Number(costoUnitarioVigente).toFixed(4) : "—"}{" "}
              <span className="text-sm font-normal text-text-muted">
                / {LABEL_UNIDAD[unidadMedida]}
              </span>
            </p>
            <p className="text-xs text-text-muted">Promedio ponderado — se recalcula solo.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stock por sucursal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {stockPorSucursal.length === 0 && (
            <p className="text-sm text-text-muted">Todavía no hay stock cargado.</p>
          )}
          {stockPorSucursal.length > 0 && (
            <div className="hidden text-xs font-medium text-text-muted uppercase sm:flex sm:items-center sm:gap-3 sm:px-1 sm:pb-1">
              <span className="flex-1">Sucursal</span>
              <span className="w-24 text-right">Stock actual</span>
              <span className="w-40 text-right">Acción</span>
            </div>
          )}
          {stockPorSucursal.map((fila) => {
            const sucursalNombre =
              sucursales.find((s) => s.id === fila.sucursalId)?.nombre ?? "Sucursal";
            return (
              <div
                key={fila.sucursalId}
                className="flex items-center gap-3 rounded-lg border border-gray-border px-3 py-2"
              >
                <span className="flex-1 text-sm text-text-body">{sucursalNombre}</span>
                <span className="w-24 text-right text-sm font-medium text-navy">
                  {Number(fila.cantidadActual)}
                </span>
                <span className="flex w-40 items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setDialogoAjuste(fila.sucursalId)}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Ajustar
                  </button>
                  <button
                    type="button"
                    onClick={() => setDialogoMerma(fila.sucursalId)}
                    className="text-xs font-medium text-error-text hover:underline"
                  >
                    Merma
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
              items={Object.fromEntries(sucursales.map((s) => [s.id, s.nombre]))}
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
            const signo = TIPOS_ENTRADA.has(mov.tipo) ? 1 : -1;
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
                  <p className="text-text-body">{ETIQUETAS_TIPO[mov.tipo]}</p>
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

      {dialogoCompra && (
        <EntradaCompraDialog
          insumoId={insumoId}
          sucursales={sucursales}
          sucursalIdInicial={dialogoCompra}
          open={Boolean(dialogoCompra)}
          onOpenChange={(open) => !open && setDialogoCompra(null)}
          onConfirmado={(sucursalId) => {
            router.refresh();
            refrescarHistorialSiAplica(sucursalId);
          }}
        />
      )}
      {dialogoAjuste && (
        <AjusteDialog
          insumoId={insumoId}
          sucursales={sucursales}
          sucursalIdInicial={dialogoAjuste}
          open={Boolean(dialogoAjuste)}
          onOpenChange={(open) => !open && setDialogoAjuste(null)}
          onConfirmado={(sucursalId) => {
            router.refresh();
            refrescarHistorialSiAplica(sucursalId);
          }}
        />
      )}
      {dialogoMerma && (
        <MermaDialog
          insumoId={insumoId}
          sucursales={sucursales}
          sucursalIdInicial={dialogoMerma}
          open={Boolean(dialogoMerma)}
          onOpenChange={(open) => !open && setDialogoMerma(null)}
          onConfirmado={(sucursalId) => {
            router.refresh();
            refrescarHistorialSiAplica(sucursalId);
          }}
        />
      )}
    </div>
  );
}
