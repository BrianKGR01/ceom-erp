"use client";

import { useState } from "react";
import Link from "next/link";
import { BarChart3, Landmark, ListOrdered, MapPin, Minus, Plus, Sigma, TrendingUp, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { obtenerEstadoResultadosAction, obtenerFlujoCajaAction } from "./actions";
import { calcularRangoPreset, PERIODOS_PRESET, type PeriodoPresetId } from "../periodo-presets";

type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

interface DatosResumenFinanciero {
  estado: Resultado<{ estadoResultados: number; ingresos: number; costos: number; gastos: number; ajustesVenta: number }>;
  flujo: Resultado<{ flujoCaja: number; pagosVenta: number; pagosCompra: number; pagosGasto: number }>;
  patrimonio: Resultado<{ valorPatrimonialTotal: number }>;
}

function formatoMoneda(valor: number): string {
  return valor.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Mismos botones de navegacion en las 4 pantallas de Reportes Detallados —
// mismo criterio que los botones de Insumos/Recetas/Capacidad en Produccion.
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

export function ResumenFinancieroCliente({
  datosIniciales,
  sucursales,
}: {
  datosIniciales: DatosResumenFinanciero;
  sucursales: { id: string; nombre: string }[];
}) {
  const [periodoId, setPeriodoId] = useState<PeriodoPresetId>("mes");
  const [sucursalId, setSucursalId] = useState("todas");
  const [datos, setDatos] = useState(datosIniciales);
  const [cargando, setCargando] = useState(false);

  async function recargar(nuevoPeriodoId: PeriodoPresetId, nuevaSucursalId: string) {
    setCargando(true);
    const periodo = calcularRangoPreset(nuevoPeriodoId);
    const opts = nuevaSucursalId !== "todas" ? nuevaSucursalId : undefined;
    const [estado, flujo] = await Promise.all([
      obtenerEstadoResultadosAction(periodo, opts),
      obtenerFlujoCajaAction(periodo, opts),
    ]);
    setCargando(false);
    setDatos((prev) => ({ ...prev, estado, flujo }));
  }

  const estado = datos.estado.ok ? datos.estado.data : null;
  const flujo = datos.flujo.ok ? datos.flujo.data : null;
  const patrimonio = datos.patrimonio.ok ? datos.patrimonio.data : null;
  const salidas = flujo ? flujo.pagosCompra + flujo.pagosGasto : 0;

  return (
    <div className="space-y-4">
      <PageHeader title="Reportes Detallados" description="Vista formal del desempeño financiero del negocio." />
      <NavReportes activo="financiero" />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Select
          items={Object.fromEntries(PERIODOS_PRESET.map((p) => [p.id, p.label]))}
          value={periodoId}
          onValueChange={(v) => {
            if (!v) return;
            setPeriodoId(v as PeriodoPresetId);
            recargar(v as PeriodoPresetId, sucursalId);
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
        {sucursales.length > 0 && (
          <Select
            items={{ todas: "Todas las sucursales", ...Object.fromEntries(sucursales.map((s) => [s.id, s.nombre])) }}
            value={sucursalId}
            onValueChange={(v) => {
              if (!v) return;
              setSucursalId(v);
              recargar(periodoId, v);
            }}
          >
            <SelectTrigger className="w-52">
              <MapPin className="size-4 text-text-muted" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las sucursales</SelectItem>
              {sucursales.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className={cn("space-y-4 transition-opacity", cargando && "pointer-events-none opacity-60")}>
        <Card className="relative overflow-hidden">
          <div className="pointer-events-none absolute -top-8 -right-8 size-32 rounded-full bg-pastel-blue-bg" />
          <CardContent className="relative flex items-center gap-4 pt-6">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
              <Landmark className="size-6" />
            </span>
            <div>
              <p className="text-xs text-text-muted uppercase">Valor patrimonial total</p>
              <p className="text-2xl font-semibold text-navy">
                {patrimonio ? formatoMoneda(patrimonio.valorPatrimonialTotal) : "—"}
              </p>
              <p className="text-xs text-text-muted">Activos (valor actual) menos saldo pendiente de pasivos.</p>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Estado de Resultados</CardTitle>
            </CardHeader>
            <CardContent>
              {!estado ? (
                <p className="text-sm text-text-muted">No pudimos cargar el estado de resultados.</p>
              ) : (
                <div className="space-y-1">
                  <FilaResultado icono={Plus} label="Ingresos totales" valor={estado.ingresos} tono="success" />
                  <FilaResultado icono={Minus} label="Costos" valor={-estado.costos} tono="error" />
                  <FilaResultado icono={Minus} label="Gastos" valor={-estado.gastos} tono="error" />
                  <FilaResultado
                    icono={estado.ajustesVenta >= 0 ? Plus : Minus}
                    label="Ajustes de venta"
                    valor={estado.ajustesVenta}
                    tono={estado.ajustesVenta >= 0 ? "success" : "error"}
                  />
                  <div className="mt-2 flex items-center gap-3 rounded-xl bg-navy p-3 text-white">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10">
                      <Sigma className="size-4" />
                    </span>
                    <span className="text-xs text-white/70">Utilidad real</span>
                    <span className="ml-auto text-lg font-semibold">{formatoMoneda(estado.estadoResultados)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Flujo de Caja</CardTitle>
            </CardHeader>
            <CardContent>
              {!flujo ? (
                <p className="text-sm text-text-muted">No pudimos cargar el flujo de caja.</p>
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-success-text" />
                    <span className="text-text-muted">Entradas</span>
                    <span className="ml-auto font-medium text-navy">{formatoMoneda(flujo.pagosVenta)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-error-text" />
                    <span className="text-text-muted">Salidas</span>
                    <span className="ml-auto font-medium text-navy">{formatoMoneda(salidas)}</span>
                  </div>
                  <BarraComparativa
                    segmentos={[
                      { valor: flujo.pagosVenta, colorClase: "bg-success-text" },
                      { valor: salidas, colorClase: "bg-error-text" },
                    ]}
                  />
                  <div className="mt-3 flex items-center gap-3 rounded-xl bg-pastel-blue-bg p-3">
                    <span className="flex size-9 items-center justify-center rounded-full bg-card text-primary">
                      <Wallet className="size-4" />
                    </span>
                    <div>
                      <p className="text-xs text-text-muted uppercase">Saldo neto</p>
                      <p className="text-lg font-semibold text-navy">{formatoMoneda(flujo.flujoCaja)}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function FilaResultado({
  icono: Icono,
  label,
  valor,
  tono,
}: {
  icono: typeof Plus;
  label: string;
  valor: number;
  tono: "success" | "error";
}) {
  return (
    <div className="flex items-center gap-3 py-1.5 text-sm">
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full",
          tono === "success" ? "bg-success-bg text-success-text" : "bg-error-bg text-error-text"
        )}
      >
        <Icono className="size-3.5" />
      </span>
      <span className="text-text-muted">{label}</span>
      <span className={cn("ml-auto font-medium", tono === "success" ? "text-success-text" : "text-error-text")}>
        {valor >= 0 ? "+" : "-"}
        {formatoMoneda(Math.abs(valor))}
      </span>
    </div>
  );
}

function BarraComparativa({ segmentos }: { segmentos: { valor: number; colorClase: string }[] }) {
  const max = Math.max(1, ...segmentos.map((s) => Math.abs(s.valor)));
  return (
    <div className="space-y-1.5">
      {segmentos.map((s, i) => (
        <div key={i} className="h-2 overflow-hidden rounded-full bg-gray-bg">
          <div
            className={cn("h-full rounded-full", s.colorClase)}
            style={{ width: `${(Math.abs(s.valor) / max) * 100}%` }}
          />
        </div>
      ))}
    </div>
  );
}
