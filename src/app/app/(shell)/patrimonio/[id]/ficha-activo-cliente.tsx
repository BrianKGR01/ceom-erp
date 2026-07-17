"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeftRight, Landmark, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/shared/breadcrumb";
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
import { PageHeader } from "@/components/shared/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { darDeBajaActivoAction, transferirActivoAction } from "../actions";

type TipoActivo = "equipo_productivo" | "mobiliario" | "vehiculo" | "otro";
type EstadoActivo = "activo" | "en_mantenimiento" | "dado_de_baja";

const LABEL_TIPO: Record<TipoActivo, string> = {
  equipo_productivo: "Equipo productivo",
  mobiliario: "Mobiliario",
  vehiculo: "Vehículo",
  otro: "Otro",
};

const BADGE_ESTADO: Record<EstadoActivo, { variant: "success" | "warning" | "outline"; label: string }> = {
  activo: { variant: "success", label: "Activo" },
  en_mantenimiento: { variant: "warning", label: "En mantenimiento" },
  dado_de_baja: { variant: "outline", label: "Dado de baja" },
};

const LABEL_FRECUENCIA: Record<string, string> = {
  mensual: "mensual",
  semanal: "semanal",
  quincenal: "quincenal",
  anual: "anual",
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

export interface ActivoFicha {
  id: string;
  nombre: string;
  tipo: TipoActivo;
  estado: EstadoActivo;
  valorActual: number;
  valorCompra: string;
  fechaAdquisicion: string;
  vidaUtilMeses: string | null;
  sucursalNombre: string;
  proveedorNombre: string | null;
  numeroSerie: string | null;
  vencimientoGarantia: string | null;
  capacidadProduccionCantidad: string | null;
  capacidadProduccionUnidad: string | null;
  capacidadAlmacenamientoCantidad: string | null;
  capacidadAlmacenamientoUnidad: string | null;
  motivoBaja: string | null;
}

export interface PasivoResumen {
  id: string;
  estado: string;
  montoTotal: string;
  cuotaPeriodica: string;
  frecuenciaCuota: string;
  saldoPendiente: number;
}

function DarDeBajaDialog({
  activoId,
  open,
  onOpenChange,
  onConfirmado,
}: {
  activoId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmado: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmar() {
    setGuardando(true);
    setError(null);
    const resultado = await darDeBajaActivoAction(activoId, { motivo });
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    onOpenChange(false);
    setMotivo("");
    onConfirmado();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-error-bg text-error-text">
              <AlertTriangle className="size-4" />
            </span>
            <DialogTitle>Dar de baja activo</DialogTitle>
          </div>
          <DialogDescription>
            ¿Estás seguro de que querés dar de baja este activo? Sigue existiendo en el histórico
            patrimonial, pero deja de contar como operativo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <label htmlFor="motivo" className="text-sm text-text-body">
            Motivo de la baja
          </label>
          <Textarea
            id="motivo"
            placeholder="Describí el motivo..."
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </div>

        {error && <p className="text-xs text-error-text">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirmar} disabled={guardando || !motivo.trim()}>
            {guardando ? "Confirmando..." : "Confirmar baja"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TransferirDialog({
  activoId,
  sucursales,
  open,
  onOpenChange,
  onConfirmado,
}: {
  activoId: string;
  sucursales: { id: string; nombre: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmado: () => void;
}) {
  const [nuevaSucursalId, setNuevaSucursalId] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmar() {
    setGuardando(true);
    setError(null);
    const resultado = await transferirActivoAction(activoId, { nuevaSucursalId });
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    onOpenChange(false);
    setNuevaSucursalId("");
    onConfirmado();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-pastel-blue-bg text-primary">
              <ArrowLeftRight className="size-4" />
            </span>
            <DialogTitle>Transferir activo</DialogTitle>
          </div>
          <DialogDescription>Seleccioná la sucursal de destino para reasignar este activo.</DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <label htmlFor="nuevaSucursalId" className="text-sm text-text-body">
            Nueva sucursal destino
          </label>
          <Select
            items={Object.fromEntries(sucursales.map((s) => [s.id, s.nombre]))}
            value={nuevaSucursalId}
            onValueChange={(value) => setNuevaSucursalId(value ?? "")}
          >
            <SelectTrigger id="nuevaSucursalId" className="w-full">
              <SelectValue placeholder="Seleccione una sucursal..." />
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

        {error && <p className="text-xs text-error-text">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={guardando || !nuevaSucursalId}>
            {guardando ? "Transfiriendo..." : "Transferir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FichaActivoCliente({
  activo,
  pasivos,
  sucursales,
}: {
  activo: ActivoFicha;
  pasivos: PasivoResumen[];
  sucursales: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [dialogoBaja, setDialogoBaja] = useState(false);
  const [dialogoTransferir, setDialogoTransferir] = useState(false);

  const badge = BADGE_ESTADO[activo.estado];
  const yaDadoDeBaja = activo.estado === "dado_de_baja";

  return (
    <>
      <Breadcrumb items={[{ label: "Patrimonio", href: "/app/patrimonio" }, { label: activo.nombre }]} />
      <PageHeader
        title={activo.nombre}
        description={LABEL_TIPO[activo.tipo]}
        action={
          <div className="flex items-center gap-2">
            <Badge variant={badge.variant}>{badge.label}</Badge>
            <Button
              variant="outline"
              render={<Link href={`/app/patrimonio/${activo.id}/editar`} />}
              nativeButton={false}
            >
              <Pencil className="size-4" />
              Editar
            </Button>
            {!yaDadoDeBaja && (
              <>
                <Button variant="outline" onClick={() => setDialogoTransferir(true)}>
                  <ArrowLeftRight className="size-4" />
                  Transferir
                </Button>
                <Button variant="destructive" onClick={() => setDialogoBaja(true)}>
                  <AlertTriangle className="size-4" />
                  Dar de baja
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Detalles técnicos y financieros</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl bg-pastel-blue-bg p-4">
                <div>
                  <p className="text-[11px] tracking-wide text-text-muted uppercase">Valor actual estimado</p>
                  <p className="font-heading text-xl font-semibold text-navy">
                    {formatMoneda(activo.valorActual)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-text-muted">Categoría</p>
                  <p className="text-text-body">{LABEL_TIPO[activo.tipo]}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Sucursal de asignación</p>
                  <p className="text-text-body">{activo.sucursalNombre}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Valor de adquisición</p>
                  <p className="text-text-body">{formatMoneda(activo.valorCompra)}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Fecha de adquisición</p>
                  <p className="text-text-body">{formatFecha(activo.fechaAdquisicion)}</p>
                </div>
                {activo.proveedorNombre && (
                  <div>
                    <p className="text-xs text-text-muted">Proveedor</p>
                    <p className="text-text-body">{activo.proveedorNombre}</p>
                  </div>
                )}
                {activo.numeroSerie && (
                  <div>
                    <p className="text-xs text-text-muted">Número de serie</p>
                    <p className="text-text-body">{activo.numeroSerie}</p>
                  </div>
                )}
                {activo.vencimientoGarantia && (
                  <div>
                    <p className="text-xs text-text-muted">Vencimiento de garantía</p>
                    <p className="text-text-body">{formatFecha(activo.vencimientoGarantia)}</p>
                  </div>
                )}
                {activo.vidaUtilMeses && (
                  <div>
                    <p className="text-xs text-text-muted">Vida útil</p>
                    <p className="text-text-body">{activo.vidaUtilMeses} meses</p>
                  </div>
                )}
              </div>

              {(activo.capacidadProduccionCantidad || activo.capacidadAlmacenamientoCantidad) && (
                <div className="grid grid-cols-2 gap-4 border-t border-gray-border pt-4 text-sm">
                  {activo.capacidadProduccionCantidad && (
                    <div>
                      <p className="text-xs text-text-muted">Capacidad de producción</p>
                      <p className="text-text-body">
                        {activo.capacidadProduccionCantidad} {activo.capacidadProduccionUnidad}
                      </p>
                    </div>
                  )}
                  {activo.capacidadAlmacenamientoCantidad && (
                    <div>
                      <p className="text-xs text-text-muted">Capacidad de almacenamiento</p>
                      <p className="text-text-body">
                        {activo.capacidadAlmacenamientoCantidad} {activo.capacidadAlmacenamientoUnidad}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {yaDadoDeBaja && activo.motivoBaja && (
                <div className="rounded-lg bg-gray-bg p-3 text-sm">
                  <p className="text-xs font-medium text-text-muted">Motivo de la baja</p>
                  <p className="text-text-body">{activo.motivoBaja}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {pasivos.length > 0 &&
            pasivos.map((pasivo) => (
              <Card key={pasivo.id}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Landmark className="size-4 text-primary" />
                    <CardTitle>Pasivo asociado</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Saldo pendiente</span>
                    <span className="font-semibold text-navy">{formatMoneda(pasivo.saldoPendiente)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Cuota {LABEL_FRECUENCIA[pasivo.frecuenciaCuota]}</span>
                    <span className="text-text-body">{formatMoneda(pasivo.cuotaPeriodica)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Estado</span>
                    <span className="text-text-body capitalize">{pasivo.estado}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      </div>

      <DarDeBajaDialog
        activoId={activo.id}
        open={dialogoBaja}
        onOpenChange={setDialogoBaja}
        onConfirmado={() => router.refresh()}
      />
      <TransferirDialog
        activoId={activo.id}
        sucursales={sucursales}
        open={dialogoTransferir}
        onOpenChange={setDialogoTransferir}
        onConfirmado={() => router.refresh()}
      />
    </>
  );
}
