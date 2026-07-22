"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Banknote, Boxes, CreditCard, Factory, RefreshCw } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { calcularRangoPreset, PERIODOS_PRESET, type PeriodoPresetId } from "@/app/app/(shell)/periodo-presets";
import { cn } from "@/lib/utils";
import {
  cambiarEstadoSuscripcionAction,
  cambiarPlanTenantAction,
  consultarFinancieroTenantAction,
  consultarInventarioOperativoTenantAction,
  consultarOperativoTenantAction,
} from "../actions";

interface Produccion {
  id: string;
  fechaProduccion: string | Date;
  cantidadRealObtenida: string;
}

interface Insumo {
  id: string;
  nombre: string;
  unidadMedida: string;
  costoUnitarioVigente: string | null;
}

interface TenantDetalle {
  nombreNegocio: string;
  ciudadBase: string | null;
  monedaPrincipal: string;
  canalesVenta: string[];
  planId: string | null;
  estadoSuscripcion: string;
  estadoAcceso: string;
  fechaInicioSuscripcion: string;
  fechaProximoPago: string | null;
}

interface Plan {
  id: string;
  nombre: string;
  activo: boolean;
}

const ESTADOS_SUSCRIPCION: { id: "activa" | "pausada" | "vencida"; label: string }[] = [
  { id: "activa", label: "Activa" },
  { id: "pausada", label: "Pausada" },
  { id: "vencida", label: "Vencida" },
];

type TabId = "financiero" | "operativo" | "inventario";

const TABS: { id: TabId; label: string; icono: typeof Banknote }[] = [
  { id: "financiero", label: "Ventas y finanzas", icono: Banknote },
  { id: "operativo", label: "Producción", icono: Factory },
  { id: "inventario", label: "Insumos y stock", icono: Boxes },
];

const ESTADO_INFO: Record<string, { label: string; variant: "success" | "warning" | "error" }> = {
  activo: { label: "Activo", variant: "success" },
  solo_lectura: { label: "Solo lectura", variant: "warning" },
  bloqueado: { label: "Bloqueado", variant: "error" },
  activa: { label: "Activa", variant: "success" },
  pausada: { label: "Pausada", variant: "warning" },
  vencida: { label: "Vencida", variant: "error" },
};

function formatoMoneda(valor: number): string {
  return valor.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function StatCard({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-card">
      <p className="text-[11px] font-medium tracking-wide text-text-muted uppercase">{label}</p>
      <p className="mt-1 font-heading text-xl font-semibold text-navy">{valor}</p>
    </div>
  );
}

// Placeholders de carga de cada tab. Reproducen la forma del contenido real
// (card de dato, fila de tabla) para que el layout no salte cuando llegan los
// datos. `role="status"` + `aria-label` preservan el anuncio que antes daba el
// texto plano "Cargando..." — un skeleton solo, sin eso, es invisible para un
// lector de pantalla.
function SkeletonStatCard() {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-card">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-1.5 h-6 w-32" />
    </div>
  );
}

function SkeletonTabla({ columnas, filas = 3 }: { columnas: number; filas?: number }) {
  return (
    <div className="divide-y divide-gray-border rounded-xl border border-gray-border">
      {Array.from({ length: filas }, (_, fila) => (
        <div key={fila} className="flex gap-3 px-3 py-2.5">
          {Array.from({ length: columnas }, (_, columna) => (
            <Skeleton key={columna} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

function CambiarPlanDialog({
  open,
  onOpenChange,
  tenantId,
  planActualId,
  planes,
  onCambiado,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  planActualId: string | null;
  planes: Plan[];
  onCambiado: () => void;
}) {
  const [planId, setPlanId] = useState(planActualId ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmar() {
    if (!planId) {
      setError("Elegí un plan.");
      return;
    }
    setGuardando(true);
    setError(null);
    const resultado = await cambiarPlanTenantAction(tenantId, planId);
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    onOpenChange(false);
    onCambiado();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-pastel-blue-bg text-primary">
              <CreditCard className="size-4" />
            </span>
            <DialogTitle>Cambiar Plan</DialogTitle>
          </div>
          <DialogDescription>Subir o bajar el plan de este negocio.</DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="nuevo-plan">Plan</Label>
          <Select
            items={Object.fromEntries(planes.map((p) => [p.id, p.nombre]))}
            value={planId}
            onValueChange={(v) => v && setPlanId(v)}
          >
            <SelectTrigger id="nuevo-plan" className="w-full">
              <SelectValue placeholder="Elegí un plan" />
            </SelectTrigger>
            <SelectContent>
              {planes.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nombre}
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
          <Button onClick={confirmar} disabled={guardando}>
            {guardando ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CambiarEstadoSuscripcionDialog({
  open,
  onOpenChange,
  tenantId,
  estadoActual,
  fechaProximoPagoActual,
  onCambiado,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  estadoActual: string;
  fechaProximoPagoActual: string | null;
  onCambiado: () => void;
}) {
  const estadoValido = (["activa", "pausada", "vencida"] as const).includes(
    estadoActual as "activa" | "pausada" | "vencida"
  )
    ? (estadoActual as "activa" | "pausada" | "vencida")
    : "activa";
  const [nuevoEstado, setNuevoEstado] = useState<"activa" | "pausada" | "vencida">(estadoValido);
  const [fechaProximoPago, setFechaProximoPago] = useState(fechaProximoPagoActual ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmar() {
    setGuardando(true);
    setError(null);
    const resultado = await cambiarEstadoSuscripcionAction(tenantId, {
      nuevoEstado,
      fechaProximoPago: fechaProximoPago || undefined,
    });
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    onOpenChange(false);
    onCambiado();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-pastel-blue-bg text-primary">
              <RefreshCw className="size-4" />
            </span>
            <DialogTitle>Cambiar Estado de Suscripción</DialogTitle>
          </div>
          <DialogDescription>
            Gestión manual desde soporte/cobranza — no reemplaza el ciclo automático de facturación
            (todavía no existe).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="nuevo-estado">Estado</Label>
            <Select
              items={Object.fromEntries(ESTADOS_SUSCRIPCION.map((e) => [e.id, e.label]))}
              value={nuevoEstado}
              onValueChange={(v) => v && setNuevoEstado(v as "activa" | "pausada" | "vencida")}
            >
              <SelectTrigger id="nuevo-estado" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ESTADOS_SUSCRIPCION.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {nuevoEstado === "vencida" && (
            <div className="space-y-1.5">
              <Label htmlFor="fecha-proximo-pago">Fecha de próximo pago</Label>
              <Input
                id="fecha-proximo-pago"
                type="date"
                value={fechaProximoPago}
                onChange={(e) => setFechaProximoPago(e.target.value)}
              />
              <p className="text-[11px] text-text-muted">
                Ancla desde donde se mide la etapa de gracia (solo lectura) antes del bloqueo total.
              </p>
            </div>
          )}

          {error && <p className="text-xs text-error-text">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={guardando}>
            {guardando ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FichaTenantAdminCliente({
  tenantId,
  tenant,
  planes,
}: {
  tenantId: string;
  tenant: TenantDetalle;
  planes: Plan[];
}) {
  const router = useRouter();
  const [dialogoPlan, setDialogoPlan] = useState(false);
  const [dialogoEstado, setDialogoEstado] = useState(false);
  const [tabActivo, setTabActivo] = useState<TabId>("financiero");
  const [presetId, setPresetId] = useState<PeriodoPresetId>("mes");
  const periodo = calcularRangoPreset(presetId);

  const [financiero, setFinanciero] = useState<{
    flujoCaja: number;
    estadoResultados: number;
    costoFijoTotal: number;
  } | null>(null);
  const [operativo, setOperativo] = useState<{ producciones: Produccion[]; mermaCostoTotal: number } | null>(null);
  const [inventario, setInventario] = useState<{ insumos: Insumo[] } | null>(null);

  useEffect(() => {
    let vigente = true;
    consultarFinancieroTenantAction(tenantId, periodo).then((r) => {
      if (vigente && r.ok) setFinanciero(r.data);
    });
    consultarOperativoTenantAction(tenantId, periodo).then((r) => {
      if (vigente && r.ok) setOperativo(r.data as { producciones: Produccion[]; mermaCostoTotal: number });
    });
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, presetId]);

  useEffect(() => {
    let vigente = true;
    consultarInventarioOperativoTenantAction(tenantId).then((r) => {
      if (vigente && r.ok) setInventario(r.data as { insumos: Insumo[] });
    });
    return () => {
      vigente = false;
    };
  }, [tenantId]);

  const estadoAcceso = ESTADO_INFO[tenant.estadoAcceso] ?? ESTADO_INFO.bloqueado;
  const estadoSuscripcion = ESTADO_INFO[tenant.estadoSuscripcion] ?? ESTADO_INFO.bloqueado;

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <Link href="/admin/tenants" className="flex w-fit items-center gap-1.5 text-xs font-medium text-text-muted hover:text-navy">
        <ArrowLeft className="size-3.5" />
        Volver a Negocios
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-navy">{tenant.nombreNegocio}</h1>
          <p className="text-sm text-text-muted">Ficha de Tenant</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={estadoSuscripcion.variant}>{estadoSuscripcion.label}</Badge>
          <Badge variant={estadoAcceso.variant}>{estadoAcceso.label}</Badge>
          <Button variant="outline" size="sm" onClick={() => setDialogoPlan(true)}>
            <CreditCard className="size-3.5" />
            Cambiar Plan
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDialogoEstado(true)}>
            <RefreshCw className="size-3.5" />
            Cambiar Estado de Suscripción
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 rounded-2xl bg-card p-4 shadow-card sm:grid-cols-4">
        <div>
          <p className="text-[11px] font-medium tracking-wide text-text-muted uppercase">Plan</p>
          <p className="text-sm text-navy">
            {tenant.planId ? (planes.find((p) => p.id === tenant.planId)?.nombre ?? "—") : "Sin plan"}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium tracking-wide text-text-muted uppercase">Ciudad</p>
          <p className="text-sm text-navy">{tenant.ciudadBase ?? "—"}</p>
        </div>
        <div>
          <p className="text-[11px] font-medium tracking-wide text-text-muted uppercase">Moneda</p>
          <p className="text-sm text-navy">{tenant.monedaPrincipal}</p>
        </div>
        <div>
          <p className="text-[11px] font-medium tracking-wide text-text-muted uppercase">Inicio de suscripción</p>
          <p className="text-sm text-navy">{new Date(tenant.fechaInicioSuscripcion).toLocaleDateString("es-BO")}</p>
        </div>
        <div>
          <p className="text-[11px] font-medium tracking-wide text-text-muted uppercase">Próximo pago</p>
          <p className="text-sm text-navy">
            {tenant.fechaProximoPago ? new Date(tenant.fechaProximoPago).toLocaleDateString("es-BO") : "—"}
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-card shadow-card">
        <div className="flex items-center gap-1 overflow-x-auto border-b border-gray-border px-4">
          {TABS.map((tab) => {
            const Icono = tab.icono;
            const activo = tabActivo === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTabActivo(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 px-3 py-3.5 text-sm font-medium whitespace-nowrap transition-colors",
                  activo ? "border-primary text-primary" : "border-transparent text-text-muted hover:text-navy"
                )}
              >
                <Icono className="size-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {tabActivo !== "inventario" && (
          <div className="flex flex-wrap gap-1.5 px-4 pt-4">
            {PERIODOS_PRESET.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPresetId(p.id)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  presetId === p.id ? "bg-primary text-white" : "bg-gray-bg text-text-muted hover:bg-pastel-blue-bg"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        <div className="p-4">
          {tabActivo === "financiero" &&
            (financiero === null ? (
              <div role="status" aria-label="Cargando datos financieros" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <SkeletonStatCard />
                <SkeletonStatCard />
                <SkeletonStatCard />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard label="Flujo de Caja" valor={formatoMoneda(financiero.flujoCaja)} />
                <StatCard label="Estado de Resultados" valor={formatoMoneda(financiero.estadoResultados)} />
                <StatCard label="Costo Fijo Total" valor={formatoMoneda(financiero.costoFijoTotal)} />
              </div>
            ))}

          {tabActivo === "operativo" &&
            (operativo === null ? (
              <div role="status" aria-label="Cargando datos operativos" className="space-y-4">
                <SkeletonStatCard />
                <SkeletonTabla columnas={2} />
              </div>
            ) : (
              <div className="space-y-4">
                <StatCard label="Costo de Merma del período" valor={formatoMoneda(operativo.mermaCostoTotal)} />
                {operativo.producciones.length === 0 ? (
                  <p className="py-6 text-center text-sm text-text-muted">Sin producciones registradas.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-gray-border">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-bg text-xs text-text-muted uppercase">
                        <tr>
                          <th className="px-3 py-2 font-medium">Fecha</th>
                          <th className="px-3 py-2 font-medium">Cantidad obtenida</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-border">
                        {operativo.producciones.map((p) => (
                          <tr key={p.id}>
                            <td className="px-3 py-2 text-navy">{new Date(p.fechaProduccion).toLocaleDateString("es-BO")}</td>
                            <td className="px-3 py-2 text-navy">{p.cantidadRealObtenida}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}

          {tabActivo === "inventario" &&
            (inventario === null ? (
              <div role="status" aria-label="Cargando inventario">
                <SkeletonTabla columnas={3} />
              </div>
            ) : inventario.insumos.length === 0 ? (
              <p className="py-10 text-center text-sm text-text-muted">Sin insumos cargados.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-bg text-xs text-text-muted uppercase">
                    <tr>
                      <th className="px-3 py-2 font-medium">Insumo</th>
                      <th className="px-3 py-2 font-medium">Unidad</th>
                      <th className="px-3 py-2 font-medium">Costo vigente</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-border">
                    {inventario.insumos.map((i) => (
                      <tr key={i.id}>
                        <td className="px-3 py-2 text-navy">{i.nombre}</td>
                        <td className="px-3 py-2 text-navy">{i.unidadMedida}</td>
                        <td className="px-3 py-2 text-navy">
                          {i.costoUnitarioVigente !== null ? formatoMoneda(Number(i.costoUnitarioVigente)) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
        </div>
      </div>

      <CambiarPlanDialog
        open={dialogoPlan}
        onOpenChange={setDialogoPlan}
        tenantId={tenantId}
        planActualId={tenant.planId}
        planes={planes.filter((p) => p.activo || p.id === tenant.planId)}
        onCambiado={() => router.refresh()}
      />
      <CambiarEstadoSuscripcionDialog
        open={dialogoEstado}
        onOpenChange={setDialogoEstado}
        tenantId={tenantId}
        estadoActual={tenant.estadoSuscripcion}
        fechaProximoPagoActual={tenant.fechaProximoPago}
        onCambiado={() => router.refresh()}
      />
    </div>
  );
}
