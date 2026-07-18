"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Banknote, Boxes, Factory } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { calcularRangoPreset, PERIODOS_PRESET, type PeriodoPresetId } from "@/app/app/(shell)/periodo-presets";
import { cn } from "@/lib/utils";
import {
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
  estadoSuscripcion: string;
  estadoAcceso: string;
  fechaInicioSuscripcion: string;
  fechaProximoPago: string | null;
}

type TabId = "financiero" | "operativo" | "inventario";

const TABS: { id: TabId; label: string; icono: typeof Banknote }[] = [
  { id: "financiero", label: "Financiero", icono: Banknote },
  { id: "operativo", label: "Operativo", icono: Factory },
  { id: "inventario", label: "Inventario Operativo", icono: Boxes },
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

export function FichaTenantAdminCliente({ tenantId, tenant }: { tenantId: string; tenant: TenantDetalle }) {
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
        Volver a Tenants
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-navy">{tenant.nombreNegocio}</h1>
          <p className="text-sm text-text-muted">Ficha de Tenant</p>
        </div>
        <div className="flex gap-2">
          <Badge variant={estadoSuscripcion.variant}>{estadoSuscripcion.label}</Badge>
          <Badge variant={estadoAcceso.variant}>{estadoAcceso.label}</Badge>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 rounded-2xl bg-card p-4 shadow-card sm:grid-cols-4">
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
              <p className="py-10 text-center text-sm text-text-muted">Cargando...</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard label="Flujo de Caja" valor={formatoMoneda(financiero.flujoCaja)} />
                <StatCard label="Estado de Resultados" valor={formatoMoneda(financiero.estadoResultados)} />
                <StatCard label="Costo Fijo Total" valor={formatoMoneda(financiero.costoFijoTotal)} />
              </div>
            ))}

          {tabActivo === "operativo" &&
            (operativo === null ? (
              <p className="py-10 text-center text-sm text-text-muted">Cargando...</p>
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
              <p className="py-10 text-center text-sm text-text-muted">Cargando...</p>
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
    </div>
  );
}
