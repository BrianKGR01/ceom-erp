"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, Landmark, ListOrdered, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { obtenerHistoricoVentasAction } from "../actions";
import { calcularRangoPreset, PERIODOS_PRESET, type PeriodoPresetId } from "../../periodo-presets";

type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

interface FilaVenta {
  ventaId: string;
  fechaVenta: string | Date;
  canalVentaId: string;
  eventoId: string | null;
  montoTotal: number;
}

// Misma paleta categorica validada para daltonismo del Dashboard
// (dashboard-resumen.tsx) — regulares = primer color, eventos = quinto
// (mismo par usado ahi para contrastar dos series).
const COLOR_REGULAR = "#2176bd";
const COLOR_EVENTO = "#e34948";

function NavReportes({ activo }: { activo: "financiero" | "margen" | "historico" | "ranking" }) {
  const items = [
    { href: "/app/reportes", key: "financiero", label: "Resumen Financiero", icon: Landmark },
    { href: "/app/reportes/margen-canal-producto", key: "margen", label: "Margen por Canal", icon: BarChart3 },
    { href: "/app/reportes/historico-ventas", key: "historico", label: "Histórico de Ventas", icon: TrendingUp },
    { href: "/app/reportes/ranking-productos", key: "ranking", label: "Ranking de Productos", icon: ListOrdered },
  ] as const;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Button
          key={item.key}
          render={<Link href={item.href} />}
          nativeButton={false}
          variant={activo === item.key ? "default" : "outline"}
        >
          <item.icon className="size-4" />
          {item.label}
        </Button>
      ))}
    </div>
  );
}

function formatoMoneda(valor: number): string {
  return valor.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function claveBucket(fecha: Date, granularidad: "dia" | "mes"): string {
  if (granularidad === "mes") return fecha.toISOString().slice(0, 7);
  return fecha.toISOString().slice(0, 10);
}

function etiquetaBucket(clave: string, granularidad: "dia" | "mes"): string {
  if (granularidad === "mes") {
    return new Date(`${clave}-01T00:00:00Z`).toLocaleDateString("es-BO", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  return new Date(`${clave}T00:00:00Z`).toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

export function HistoricoVentasCliente({ datosIniciales }: { datosIniciales: Resultado<FilaVenta[]> }) {
  const [periodoId, setPeriodoId] = useState<PeriodoPresetId>("mes");
  const [incluirEventos, setIncluirEventos] = useState(true);
  const [datos, setDatos] = useState(datosIniciales);
  const [cargando, setCargando] = useState(false);

  async function recargar(nuevoPeriodoId: PeriodoPresetId, nuevoIncluirEventos: boolean) {
    setCargando(true);
    const periodo = calcularRangoPreset(nuevoPeriodoId);
    const resultado = await obtenerHistoricoVentasAction(periodo, { incluirEventos: nuevoIncluirEventos });
    setCargando(false);
    setDatos(resultado);
  }

  const granularidad: "dia" | "mes" = periodoId === "anio" ? "mes" : "dia";

  const buckets = useMemo(() => {
    const filas = datos.ok ? datos.data : [];
    const mapa = new Map<string, { regular: number; evento: number }>();
    for (const fila of filas) {
      const fecha = new Date(fila.fechaVenta);
      const clave = claveBucket(fecha, granularidad);
      const actual = mapa.get(clave) ?? { regular: 0, evento: 0 };
      if (fila.eventoId) actual.evento += fila.montoTotal;
      else actual.regular += fila.montoTotal;
      mapa.set(clave, actual);
    }
    return [...mapa.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([clave, valores]) => ({ clave, etiqueta: etiquetaBucket(clave, granularidad), ...valores }));
  }, [datos, granularidad]);

  const totalRegular = buckets.reduce((acc, b) => acc + b.regular, 0);
  const totalEvento = buckets.reduce((acc, b) => acc + b.evento, 0);
  const maxValor = Math.max(1, ...buckets.map((b) => b.regular + b.evento));

  return (
    <div className="space-y-4">
      <PageHeader title="Histórico de Ventas" description="Serie temporal, diferenciando ventas de eventos/ferias." />
      <NavReportes activo="historico" />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm text-text-body">
          <input
            type="checkbox"
            checked={incluirEventos}
            onChange={(e) => {
              setIncluirEventos(e.target.checked);
              recargar(periodoId, e.target.checked);
            }}
            className="size-4 rounded border-gray-border accent-primary"
          />
          Incluir ventas de eventos/ferias
        </label>
        <Select
          items={Object.fromEntries(PERIODOS_PRESET.map((p) => [p.id, p.label]))}
          value={periodoId}
          onValueChange={(v) => {
            if (!v) return;
            setPeriodoId(v as PeriodoPresetId);
            recargar(v as PeriodoPresetId, incluirEventos);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODOS_PRESET.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className={cn("rounded-2xl bg-card p-5 shadow-card transition-opacity", cargando && "pointer-events-none opacity-60")}>
        <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-text-muted">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: COLOR_REGULAR }} />
            Ventas regulares — {formatoMoneda(totalRegular)}
          </span>
          {incluirEventos && (
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: COLOR_EVENTO }} />
              Ventas de evento — {formatoMoneda(totalEvento)}
            </span>
          )}
        </div>

        {buckets.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-muted">Sin ventas en este período.</p>
        ) : (
          <div className="flex items-end gap-1.5 overflow-x-auto pb-2" style={{ minHeight: 180 }}>
            {buckets.map((b) => {
              const alturaRegular = (b.regular / maxValor) * 140;
              const alturaEvento = (b.evento / maxValor) * 140;
              return (
                <div key={b.clave} className="flex shrink-0 flex-col items-center gap-1" style={{ width: 36 }}>
                  <div className="flex h-[140px] w-5 flex-col justify-end overflow-hidden rounded-t">
                    {incluirEventos && b.evento > 0 && (
                      <div style={{ height: alturaEvento, backgroundColor: COLOR_EVENTO }} />
                    )}
                    <div style={{ height: Math.max(alturaRegular, b.regular > 0 ? 2 : 0), backgroundColor: COLOR_REGULAR }} />
                  </div>
                  <span className="text-center text-[10px] whitespace-nowrap text-text-muted">{b.etiqueta}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
