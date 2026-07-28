"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Banknote, Boxes, Factory, Lock, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PortalTopbar } from "@/components/shared/portal-topbar";
import { calcularRangoPreset, PERIODOS_PRESET, type PeriodoPresetId } from "@/lib/periodo";
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
  { id: "financiero", label: "Ventas y finanzas", icono: Banknote },
  { id: "operativo", label: "Producción", icono: Factory },
  { id: "inventario", label: "Insumos y stock", icono: Boxes },
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

/**
 * X-01 — el marcador de completitud de H-15, con al menos la misma prominencia
 * que tiene para el dueño (principio rector #9).
 *
 * El dueño ve exactamente esta advertencia en su Resumen Financiero
 * (`reportes/resumen-financiero-cliente.tsx`); hasta la tanda 3.3a la
 * institución veía el mismo `estadoResultados` **presentado como completo**,
 * porque el campo se descartaba en la capa de proyección. Y el error de lectura
 * no es simétrico: falta costo, nunca sobra, así que el número siempre se lee
 * mejor de lo que es.
 *
 * La diferencia con la versión del dueño es deliberada: **no hay enlace para
 * arreglarlo.** El dueño puede ir a cargar los costos; la institución no puede
 * hacer nada al respecto, y ofrecerle una acción que no tiene sería ruido. Lo
 * que sí necesita es saber cómo leer el número.
 */
function MarcadorSinCosto({ monto }: { monto: number }) {
  if (monto <= 0) return null;
  return (
    <div className="flex items-start gap-2 rounded-xl bg-warning-bg p-3">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-text" />
      <p className="text-xs text-text-body">
        <span className="font-medium text-warning-text">
          {formatoMoneda(monto)} de los ingresos de este período son de productos sin costo
          cargado.
        </span>{" "}
        Esa parte se está contando sin costo, así que el resultado real de este negocio es{" "}
        <strong>menor</strong> que el de arriba. Leelo como un techo, no como la ganancia.
      </p>
    </div>
  );
}

/**
 * X-02 — la cobertura del resumen, cuando el negocio tiene sucursales que ya no
 * pueden registrar (D-9, tanda 3.3a).
 *
 * **El encuadre importa y define qué dice este cartel.** Una sucursal congelada
 * no es una sucursal cerrada: el local puede seguir operando, lo que no puede
 * es registrarse en CEOM. Así que esto NO explica una caída de actividad — dice
 * **sobre qué parte del negocio está calculado todo lo que hay en esta ficha**.
 * Es un marcador de completitud, hermano del de H-15, sobre otro eje.
 *
 * Por eso no menciona el plan, ni el downgrade, ni el motivo: eso es
 * información comercial entre el negocio y CEOM. Lo único publicable a un
 * tercero es la cobertura del dato.
 *
 * Va arriba de las pestañas y no dentro de una: alcanza a las cuatro.
 */
function CoberturaDeSucursales({
  totales,
  operables,
}: {
  totales: number;
  operables: number;
}) {
  if (totales <= operables) return null;
  return (
    <div className="mt-4 flex items-start gap-2 rounded-xl bg-warning-bg p-3">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-text" />
      <p className="text-xs text-text-body">
        <span className="font-medium text-warning-text">
          Este negocio tiene {totales} sucursales y {operables === 1 ? "solo 1 está" : `solo ${operables} están`}{" "}
          registrando operaciones.
        </span>{" "}
        Todo lo que ves en esta ficha cubre esa parte: el histórico de las demás sigue contado, pero
        no suman actividad nueva. No quiere decir que hayan cerrado — quiere decir que su operación
        no se está registrando acá.
      </p>
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
  zona,
}: {
  tenantId: string;
  tenant: {
    nombreNegocio: string;
    estadoAcceso: string;
    /** X-02: cobertura del dato. */
    sucursalesTotales: number;
    sucursalesOperables: number;
  };
  /** Zona horaria del negocio OBSERVADO, no la de la institucion que mira. */
  zona: string;
}) {
  const [tabActivo, setTabActivo] = useState<TabId>("ventas");
  const [presetId, setPresetId] = useState<PeriodoPresetId>("mes");
  const periodo = calcularRangoPreset(presetId, zona);

  const [ventas, setVentas] = useState<ConAutorizacion<{ ingresos: number }> | null>(null);
  const [financiero, setFinanciero] = useState<ConAutorizacion<{
    flujoCaja: number;
    estadoResultados: number;
    costoFijoTotal: number;
    /** X-01: el marcador de completitud de H-15. */
    ingresosSinCostoConocido: number;
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

        <CoberturaDeSucursales
          totales={tenant.sucursalesTotales}
          operables={tenant.sucursalesOperables}
        />

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
                <NoAutorizado modulo="Ventas y finanzas" />
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <StatCard label="Ingresos del período" valor={formatoMoneda(ventas.detalle.ingresos)} />
                </div>
              ))}

            {tabActivo === "financiero" &&
              (financiero === null ? (
                <p className="py-10 text-center text-sm text-text-muted">Cargando...</p>
              ) : !financiero.autorizado ? (
                <NoAutorizado modulo="Ventas y finanzas" />
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <StatCard label="Flujo de Caja" valor={formatoMoneda(financiero.detalle.flujoCaja)} />
                    <StatCard label="Estado de Resultados" valor={formatoMoneda(financiero.detalle.estadoResultados)} />
                    <StatCard label="Costo Fijo Total" valor={formatoMoneda(financiero.detalle.costoFijoTotal)} />
                  </div>
                  <MarcadorSinCosto monto={financiero.detalle.ingresosSinCostoConocido} />
                </div>
              ))}

            {tabActivo === "operativo" &&
              (operativo === null ? (
                <p className="py-10 text-center text-sm text-text-muted">Cargando...</p>
              ) : !operativo.autorizado ? (
                <NoAutorizado modulo="Producción" />
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
                <NoAutorizado modulo="Insumos y stock" />
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
