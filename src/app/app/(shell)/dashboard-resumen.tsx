"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Archive,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  MapPin,
  Package,
  Trash2,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  obtenerDashboardAction,
  type CapacidadAlmacenamientoWidget,
  type DatosDashboard,
} from "./inicio-actions";
import { calcularRangoPreset, PERIODOS_PRESET, type PeriodoPresetId } from "./periodo-presets";

// Primera vez que la app necesita una paleta de graficas — el design
// system no define una (docs/design-system.md no tiene seccion de
// dataviz). Validada con la skill de dataviz contra la superficie real de
// las cards (--card: #ffffff): CVD ΔE minimo 16.2, banda de lightness y
// chroma OK. Orden fijo, se asigna por orden estable de categoria, nunca
// por rank de valor.
const COLORES_CATEGORIA = ["#2176bd", "#1baf7a", "#eda100", "#4a3aa7", "#e34948", "#eb6834"];

function formatoMoneda(valor: number): string {
  return valor.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function DashboardResumen({
  sucursales,
  datosIniciales,
  capacidadAlmacenamiento,
}: {
  sucursales: { id: string; nombre: string }[];
  datosIniciales: DatosDashboard;
  capacidadAlmacenamiento: CapacidadAlmacenamientoWidget | null;
}) {
  const [periodoId, setPeriodoId] = useState<PeriodoPresetId>("mes");
  const [sucursalId, setSucursalId] = useState<string>("todas");
  const [datos, setDatos] = useState(datosIniciales);
  const [cargando, setCargando] = useState(false);
  const [criterioRanking, setCriterioRanking] = useState<"rotacion" | "margen">("rotacion");

  async function recargar(nuevoPeriodoId: PeriodoPresetId, nuevaSucursalId: string) {
    setCargando(true);
    const periodo = calcularRangoPreset(nuevoPeriodoId);
    const resultado = await obtenerDashboardAction(
      periodo,
      nuevaSucursalId !== "todas" ? nuevaSucursalId : undefined
    );
    setCargando(false);
    if (resultado.ok) setDatos(resultado.data);
  }

  const resumen = datos.resumen.ok ? datos.resumen.data : null;
  const resumenAnterior = datos.resumenAnterior.ok ? datos.resumenAnterior.data : null;
  const deltaPct =
    resumen && resumenAnterior && resumenAnterior.estadoResultados !== 0
      ? ((resumen.estadoResultados - resumenAnterior.estadoResultados) /
          Math.abs(resumenAnterior.estadoResultados)) *
        100
      : null;

  const flujo = datos.flujo.ok ? datos.flujo.data : null;
  const salidas = flujo ? flujo.pagosCompra + flujo.pagosGasto : 0;

  const rankingResultado = criterioRanking === "rotacion" ? datos.rankingRotacion : datos.rankingMargen;
  const ranking = (rankingResultado.ok ? rankingResultado.data : []).slice(0, 5);
  const maxRanking = Math.max(
    1,
    ...ranking.map((r) => (criterioRanking === "rotacion" ? r.unidadesVendidas : (r.margenPct ?? 0)))
  );

  const gastos = datos.gastos.ok ? datos.gastos.data : [];
  const totalGastos = gastos.reduce((acc, g) => acc + g.total, 0);

  const mermaCostoTotal = datos.merma.ok ? datos.merma.data.mermaCostoTotal : 0;
  const pctMerma = resumen && resumen.costos > 0 ? (mermaCostoTotal / resumen.costos) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button render={<Link href="/app/reportes" />} nativeButton={false} variant="outline">
          <BarChart3 className="size-4" />
          Ver reportes detallados
        </Button>
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
            items={{
              todas: "Todas las sucursales",
              ...Object.fromEntries(sucursales.map((s) => [s.id, s.nombre])),
            }}
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
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Resumen del período</CardTitle>
            </CardHeader>
            <CardContent>
              {!resumen ? (
                <p className="text-sm text-text-muted">No pudimos cargar el resumen del período.</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-text-muted uppercase">Ingresos</p>
                      <p className="mt-0.5 font-medium text-navy">{formatoMoneda(resumen.ingresos)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-text-muted uppercase">Costos</p>
                      <p className="mt-0.5 font-medium text-navy">{formatoMoneda(resumen.costos)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-text-muted uppercase">Gastos</p>
                      <p className="mt-0.5 font-medium text-navy">{formatoMoneda(resumen.gastos)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-text-muted uppercase">Resultado neto</p>
                      <p className="mt-0.5 text-2xl font-semibold text-navy">
                        {formatoMoneda(resumen.estadoResultados)}
                      </p>
                      {deltaPct !== null && (
                        <span
                          className={cn(
                            "inline-flex items-center gap-0.5 text-xs font-medium",
                            deltaPct >= 0 ? "text-success-text" : "text-error-text"
                          )}
                        >
                          {deltaPct >= 0 ? (
                            <ArrowUpRight className="size-3.5" />
                          ) : (
                            <ArrowDownRight className="size-3.5" />
                          )}
                          {Math.abs(deltaPct).toFixed(0)}% vs período anterior
                        </span>
                      )}
                    </div>
                  </div>
                  <BarraComparativa
                    segmentos={[
                      { label: "Ingresos", valor: resumen.ingresos, color: COLORES_CATEGORIA[0] },
                      { label: "Costos", valor: resumen.costos, color: COLORES_CATEGORIA[1] },
                      { label: "Gastos", valor: resumen.gastos, color: COLORES_CATEGORIA[2] },
                    ]}
                  />
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Flujo de caja</CardTitle>
            </CardHeader>
            <CardContent>
              {!flujo ? (
                <p className="text-sm text-text-muted">No pudimos cargar el flujo de caja.</p>
              ) : (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex-1 space-y-2 text-sm">
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
                        { label: "Entradas", valor: flujo.pagosVenta, colorClase: "bg-success-text" },
                        { label: "Salidas", valor: salidas, colorClase: "bg-error-text" },
                      ]}
                      compacta
                    />
                  </div>
                  <div className="flex items-center gap-3 rounded-xl bg-pastel-blue-bg p-4">
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

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Productos más vendidos</CardTitle>
              <div className="flex rounded-lg border border-gray-border p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setCriterioRanking("rotacion")}
                  className={cn(
                    "rounded-md px-2 py-1 font-medium",
                    criterioRanking === "rotacion" ? "bg-primary text-white" : "text-text-muted"
                  )}
                >
                  Por cantidad
                </button>
                <button
                  type="button"
                  onClick={() => setCriterioRanking("margen")}
                  className={cn(
                    "rounded-md px-2 py-1 font-medium",
                    criterioRanking === "margen" ? "bg-primary text-white" : "text-text-muted"
                  )}
                >
                  Por margen
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {ranking.length === 0 ? (
                <p className="text-sm text-text-muted">Sin ventas en este período.</p>
              ) : (
                ranking.map((fila, index) => {
                  const valor = criterioRanking === "rotacion" ? fila.unidadesVendidas : (fila.margenPct ?? 0);
                  return (
                    <div key={fila.productoId} className="flex items-center gap-2 text-sm">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-pastel-blue-bg text-[11px] font-semibold text-primary">
                        {index + 1}
                      </span>
                      <span className="line-clamp-1 w-28 shrink-0 text-text-body">
                        {datos.productoPorId[fila.productoId] ?? "Producto"}
                      </span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-bg">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.max(4, (Math.abs(valor) / maxRanking) * 100)}%` }}
                        />
                      </div>
                      <span className="w-14 shrink-0 text-right text-xs font-medium text-navy">
                        {criterioRanking === "rotacion" ? `${valor} un.` : `${valor.toFixed(0)}%`}
                      </span>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Gastos por categoría</CardTitle>
            </CardHeader>
            <CardContent>
              {gastos.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-4 text-center">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-pastel-blue-bg text-primary">
                    <Package className="size-4" />
                  </span>
                  <p className="text-sm text-text-muted">Todavía no registraste gastos.</p>
                </div>
              ) : (
                <DonaGastos
                  datos={gastos}
                  total={totalGastos}
                  nombrePorId={datos.categoriaGastoPorId}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Merma registrada</CardTitle>
              <span className="flex size-8 items-center justify-center rounded-lg bg-pastel-blue-bg text-primary">
                <Trash2 className="size-4" />
              </span>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-text-muted uppercase">Costo total de merma</p>
              <p className="text-2xl font-semibold text-navy">{formatoMoneda(mermaCostoTotal)}</p>
              <div className="h-1.5 overflow-hidden rounded-full bg-gray-bg">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(100, pctMerma)}%` }}
                />
              </div>
              <p className="text-xs text-text-muted">
                {mermaCostoTotal === 0
                  ? "Sin producción registrada en este período."
                  : `Representa ~${pctMerma.toFixed(1)}% del costo total.`}
              </p>
            </CardContent>
          </Card>

          {capacidadAlmacenamiento && (
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>Capacidad de Almacenamiento Usada</CardTitle>
                <span className="flex size-8 items-center justify-center rounded-lg bg-pastel-blue-bg text-primary">
                  <Archive className="size-4" />
                </span>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-text-muted uppercase">{capacidadAlmacenamiento.activoNombre}</p>
                {capacidadAlmacenamiento.capacidadAlmacenamientoCantidad === null ? (
                  <p className="text-sm text-text-muted">
                    Sin capacidad definida — cargala desde la Ficha del Activo en Patrimonio.
                  </p>
                ) : (
                  <>
                    <p className="text-2xl font-semibold text-navy">
                      {Math.min(100, Math.round((capacidadAlmacenamiento.porcentajeUsado ?? 0) * 100))}%
                    </p>
                    <div className="h-1.5 overflow-hidden rounded-full bg-gray-bg">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: `${Math.min(100, Math.round((capacidadAlmacenamiento.porcentajeUsado ?? 0) * 100))}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-text-muted">
                      {capacidadAlmacenamiento.stockActualTotal} / {capacidadAlmacenamiento.capacidadAlmacenamientoCantidad} unidades
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function BarraComparativa({
  segmentos,
  compacta,
}: {
  segmentos: { label: string; valor: number; color?: string; colorClase?: string }[];
  compacta?: boolean;
}) {
  const max = Math.max(1, ...segmentos.map((s) => Math.abs(s.valor)));
  return (
    <div className={cn("space-y-1.5", compacta ? "mt-1" : "mt-4")}>
      {segmentos.map((s) => (
        <div key={s.label} className="flex items-center gap-2 text-xs">
          {!compacta && <span className="w-14 shrink-0 text-text-muted">{s.label}</span>}
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-bg">
            <div
              className={cn("h-full rounded-full", s.colorClase)}
              style={{
                width: `${(Math.abs(s.valor) / max) * 100}%`,
                backgroundColor: s.color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function DonaGastos({
  datos,
  total,
  nombrePorId,
}: {
  datos: { categoriaId: string; total: number }[];
  total: number;
  nombrePorId: Record<string, string>;
}) {
  const radio = 40;
  const circunferencia = 2 * Math.PI * radio;
  const gap = circunferencia * 0.01;

  // Offsets acumulados calculados una sola vez, fuera del map que arma el
  // JSX — evita reasignar una variable capturada dentro del callback de
  // render (regla del compilador de React).
  const fracciones = datos.map((g) => (total > 0 ? g.total / total : 0));
  const offsets = fracciones.map((_, index) =>
    fracciones.slice(0, index).reduce((suma, f) => suma + f * circunferencia, 0)
  );

  return (
    <div className="flex items-center gap-4">
      <div className="relative flex size-28 shrink-0 items-center justify-center">
        <svg viewBox="0 0 100 100" className="size-28 -rotate-90">
          <circle cx="50" cy="50" r={radio} fill="none" stroke="var(--gray-bg)" strokeWidth="14" />
          {datos.map((g, index) => {
            const largo = Math.max(0, fracciones[index] * circunferencia - gap);
            return (
              <circle
                key={g.categoriaId}
                cx="50"
                cy="50"
                r={radio}
                fill="none"
                stroke={COLORES_CATEGORIA[index % COLORES_CATEGORIA.length]}
                strokeWidth="14"
                strokeDasharray={`${largo} ${circunferencia - largo}`}
                strokeDashoffset={-offsets[index]}
              />
            );
          })}
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-[10px] text-text-muted uppercase">Total</span>
          <span className="text-sm font-semibold text-navy">{formatoMoneda(total)}</span>
        </div>
      </div>
      <div className="flex-1 space-y-1.5">
        {datos.map((g, index) => (
          <div key={g.categoriaId} className="flex items-center gap-2 text-xs">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: COLORES_CATEGORIA[index % COLORES_CATEGORIA.length] }}
            />
            <span className="line-clamp-1 flex-1 text-text-body">
              {nombrePorId[g.categoriaId] ?? "Categoría"}
            </span>
            <span className="font-medium text-navy">
              {total > 0 ? `${((g.total / total) * 100).toFixed(0)}%` : "0%"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
