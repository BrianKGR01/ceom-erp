"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Banknote, Boxes, Factory, Lock, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PortalTopbar } from "@/components/shared/portal-topbar";
import { calcularRangoPreset, PERIODOS_PRESET, type PeriodoPresetId } from "@/app/app/(shell)/periodo-presets";
import { cn } from "@/lib/utils";
import {
  detalleFinancieroAction,
  detalleInventarioOperativoAction,
  detalleOperativoAction,
  tendenciaVentasAction,
} from "../../actions";

type ConAutorizacion<T> = { autorizado: true; detalle: T } | { autorizado: false };

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

type TabId = "ventas" | "financiero" | "operativo" | "inventario";

const TABS: { id: TabId; label: string; icono: typeof TrendingUp }[] = [
  { id: "ventas", label: "Tendencia de Ventas", icono: TrendingUp },
  { id: "financiero", label: "Financiero", icono: Banknote },
  { id: "operativo", label: "Operativo", icono: Factory },
  { id: "inventario", label: "Inventario Operativo", icono: Boxes },
];

const ESTADO_INFO: Record<string, { label: string; variant: "success" | "warning" | "error" }> = {
  activo: { label: "Activo", variant: "success" },
  solo_lectura: { label: "Solo lectura", variant: "warning" },
  bloqueado: { label: "Bloqueado", variant: "error" },
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

function NoAutorizado({ modulo }: { modulo: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl bg-card py-16 text-center shadow-card">
      <span className="flex size-12 items-center justify-center rounded-full bg-gray-bg text-text-muted">
        <Lock className="size-5" />
      </span>
      <p className="font-heading text-sm font-semibold text-navy">No autorizado</p>
      <p className="max-w-xs text-xs text-text-muted">
        Este tenant no aprobó el módulo {modulo} para tu institución todavía.
      </p>
    </div>
  );
}

export function FichaTenantCliente({
  tenantId,
  tenant,
}: {
  tenantId: string;
  tenant: { nombreNegocio: string; estadoAcceso: string };
}) {
  const [tabActivo, setTabActivo] = useState<TabId>("ventas");
  const [presetId, setPresetId] = useState<PeriodoPresetId>("mes");
  const periodo = calcularRangoPreset(presetId);

  const [ventas, setVentas] = useState<ConAutorizacion<{ ingresos: number }> | null>(null);
  const [financiero, setFinanciero] = useState<ConAutorizacion<{
    flujoCaja: number;
    estadoResultados: number;
    costoFijoTotal: number;
  }> | null>(null);
  const [operativo, setOperativo] = useState<ConAutorizacion<{
    producciones: Produccion[];
    mermaCostoTotal: number;
  }> | null>(null);
  const [inventario, setInventario] = useState<ConAutorizacion<{ insumos: Insumo[] }> | null>(null);

  useEffect(() => {
    let vigente = true;
    tendenciaVentasAction(tenantId, periodo).then((r) => {
      if (vigente && r.ok) setVentas(r.data);
    });
    detalleFinancieroAction(tenantId, periodo).then((r) => {
      if (vigente && r.ok) setFinanciero(r.data);
    });
    detalleOperativoAction(tenantId, periodo).then((r) => {
      if (vigente && r.ok) setOperativo(r.data as ConAutorizacion<{ producciones: Produccion[]; mermaCostoTotal: number }>);
    });
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, presetId]);

  useEffect(() => {
    let vigente = true;
    detalleInventarioOperativoAction(tenantId).then((r) => {
      if (vigente && r.ok) setInventario(r.data as ConAutorizacion<{ insumos: Insumo[] }>);
    });
    return () => {
      vigente = false;
    };
  }, [tenantId]);

  const estado = ESTADO_INFO[tenant.estadoAcceso] ?? ESTADO_INFO.bloqueado;
  const bloqueado: Record<TabId, boolean> = {
    ventas: ventas !== null && !ventas.autorizado,
    financiero: financiero !== null && !financiero.autorizado,
    operativo: operativo !== null && !operativo.autorizado,
    inventario: inventario !== null && !inventario.autorizado,
  };

  return (
    <div className="min-h-screen bg-gray-bg">
      <PortalTopbar />

      <div className="p-6">
        <Link
          href="/portal"
          className="flex w-fit items-center gap-1.5 text-xs font-medium text-text-muted hover:text-navy"
        >
          <ArrowLeft className="size-3.5" />
          Volver a Mi Cartera
        </Link>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-semibold text-navy">{tenant.nombreNegocio}</h1>
            <p className="text-sm text-text-muted">Ficha de Tenant</p>
          </div>
          <Badge variant={estado.variant}>{estado.label}</Badge>
        </div>

        <div className="mt-6 rounded-2xl bg-card shadow-card">
          <div className="flex items-center gap-1 overflow-x-auto border-b border-gray-border px-4">
            {TABS.map((tab) => {
              const Icono = tab.icono;
              const activo = tabActivo === tab.id;
              const locked = bloqueado[tab.id];
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTabActivo(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 border-b-2 px-3 py-3.5 text-sm font-medium whitespace-nowrap transition-colors",
                    activo
                      ? "border-primary text-primary"
                      : "border-transparent text-text-muted hover:text-navy",
                    locked && !activo && "text-text-muted/60"
                  )}
                >
                  {locked ? <Lock className="size-3.5" /> : <Icono className="size-3.5" />}
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
                    presetId === p.id
                      ? "bg-primary text-white"
                      : "bg-gray-bg text-text-muted hover:bg-pastel-blue-bg"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          <div className="p-4">
            {tabActivo === "ventas" &&
              (ventas === null ? (
                <p className="py-10 text-center text-sm text-text-muted">Cargando...</p>
              ) : !ventas.autorizado ? (
                <NoAutorizado modulo="Financiero" />
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <StatCard label="Ingresos del período" valor={formatoMoneda(ventas.detalle.ingresos)} />
                </div>
              ))}

            {tabActivo === "financiero" &&
              (financiero === null ? (
                <p className="py-10 text-center text-sm text-text-muted">Cargando...</p>
              ) : !financiero.autorizado ? (
                <NoAutorizado modulo="Financiero" />
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <StatCard label="Flujo de Caja" valor={formatoMoneda(financiero.detalle.flujoCaja)} />
                  <StatCard label="Estado de Resultados" valor={formatoMoneda(financiero.detalle.estadoResultados)} />
                  <StatCard label="Costo Fijo Total" valor={formatoMoneda(financiero.detalle.costoFijoTotal)} />
                </div>
              ))}

            {tabActivo === "operativo" &&
              (operativo === null ? (
                <p className="py-10 text-center text-sm text-text-muted">Cargando...</p>
              ) : !operativo.autorizado ? (
                <NoAutorizado modulo="Operativo" />
              ) : (
                <div className="space-y-4">
                  <StatCard label="Costo de Merma del período" valor={formatoMoneda(operativo.detalle.mermaCostoTotal)} />
                  {operativo.detalle.producciones.length === 0 ? (
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
                          {operativo.detalle.producciones.map((p) => (
                            <tr key={p.id}>
                              <td className="px-3 py-2 text-navy">
                                {new Date(p.fechaProduccion).toLocaleDateString("es-BO")}
                              </td>
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
                <p className="py-10 text-center text-sm text-text-muted">Cargando...</p>
              ) : !inventario.autorizado ? (
                <NoAutorizado modulo="Inventario Operativo" />
              ) : inventario.detalle.insumos.length === 0 ? (
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
                      {inventario.detalle.insumos.map((i) => (
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
      </div>
    </div>
  );
}
