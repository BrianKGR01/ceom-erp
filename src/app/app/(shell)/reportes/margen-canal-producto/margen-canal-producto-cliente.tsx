"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Award, BarChart3, Landmark, ListOrdered, MessageSquare, TrendingUp } from "lucide-react";
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
import { obtenerMargenPorCanalYProductoAction } from "../actions";
import { calcularRangoPreset, PERIODOS_PRESET, type PeriodoPresetId } from "../../periodo-presets";

type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

interface FilaMargen {
  canalVentaId: string;
  productoId: string;
  ingresos: number;
  costos: number;
  margenPct: number | null;
}

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

// margenPct por celda ya viene calculado del servidor (reportes/actions.ts
// evita el ciclo de imports Ventas<->Financiero) — pero los agregados por
// fila/columna (Total Ponderado, Promedio por Canal) no existen como
// funcion propia: se derivan acá sumando ingresos/costos crudos (ya
// incluidos en cada fila) antes de dividir, nunca promediando porcentajes
// ya calculados — mismo motivo de fondo que evitar promediar promedios.
function margenDe(ingresos: number, costos: number): number | null {
  return ingresos > 0 ? ((ingresos - costos) / ingresos) * 100 : null;
}

function colorCelda(pct: number | null): string {
  if (pct === null) return "";
  if (pct > 40) return "bg-success-bg text-success-text";
  if (pct < 15) return "bg-warning-bg text-warning-text";
  return "";
}

export function MargenCanalProductoCliente({
  datosIniciales,
  canales,
  productos,
}: {
  datosIniciales: Resultado<FilaMargen[]>;
  canales: { id: string; nombre: string }[];
  productos: { id: string; nombre: string }[];
}) {
  const [periodoId, setPeriodoId] = useState<PeriodoPresetId>("mes");
  const [datos, setDatos] = useState(datosIniciales);
  const [cargando, setCargando] = useState(false);

  async function recargar(nuevoPeriodoId: PeriodoPresetId) {
    setCargando(true);
    const periodo = calcularRangoPreset(nuevoPeriodoId);
    const resultado = await obtenerMargenPorCanalYProductoAction(periodo);
    setCargando(false);
    setDatos(resultado);
  }

  const productoNombre = new Map(productos.map((p) => [p.id, p.nombre]));
  const canalNombre = new Map(canales.map((c) => [c.id, c.nombre]));

  const analisis = useMemo(() => {
    const filas = datos.ok ? datos.data : [];
    const celda = new Map<string, FilaMargen>();
    const productosConVentas = new Set<string>();
    const canalesConVentas = new Set<string>();
    for (const fila of filas) {
      celda.set(`${fila.productoId}|${fila.canalVentaId}`, fila);
      productosConVentas.add(fila.productoId);
      canalesConVentas.add(fila.canalVentaId);
    }

    const filasProducto = [...productosConVentas].map((productoId) => {
      let ingresos = 0;
      let costos = 0;
      let mejorCanal: { id: string; pct: number } | null = null;
      for (const canalId of canalesConVentas) {
        const f = celda.get(`${productoId}|${canalId}`);
        if (!f) continue;
        ingresos += f.ingresos;
        costos += f.costos;
        if (f.margenPct !== null && (!mejorCanal || f.margenPct > mejorCanal.pct)) {
          mejorCanal = { id: canalId, pct: f.margenPct };
        }
      }
      return { productoId, totalPonderado: margenDe(ingresos, costos), mejorCanal };
    });

    const columnasCanal = [...canalesConVentas].map((canalId) => {
      let ingresos = 0;
      let costos = 0;
      for (const productoId of productosConVentas) {
        const f = celda.get(`${productoId}|${canalId}`);
        if (!f) continue;
        ingresos += f.ingresos;
        costos += f.costos;
      }
      return { canalId, promedio: margenDe(ingresos, costos) };
    });

    const totalGeneral = margenDe(
      filas.reduce((acc, f) => acc + f.ingresos, 0),
      filas.reduce((acc, f) => acc + f.costos, 0)
    );

    const conMargen = filasProducto.filter((f) => f.totalPonderado !== null);
    const productoEstrella = conMargen.length
      ? conMargen.reduce((a, b) => (b.totalPonderado! > a.totalPonderado! ? b : a))
      : null;
    const productoAtencion = conMargen.length
      ? conMargen.reduce((a, b) => (b.totalPonderado! < a.totalPonderado! ? b : a))
      : null;
    const canalesConProm = columnasCanal.filter((c) => c.promedio !== null);
    const mejorCanalGlobal = canalesConProm.length
      ? canalesConProm.reduce((a, b) => (b.promedio! > a.promedio! ? b : a))
      : null;

    return {
      productos: [...productosConVentas],
      canales: [...canalesConVentas],
      celda,
      filasProducto,
      columnasCanal,
      totalGeneral,
      productoEstrella,
      productoAtencion,
      mejorCanalGlobal,
    };
  }, [datos]);

  return (
    <div className="space-y-4">
      <PageHeader title="Cruce Canal × Producto × Margen" description="Análisis de rentabilidad por canal de venta." />
      <NavReportes activo="margen" />

      <div className="flex justify-end">
        <Select
          items={Object.fromEntries(PERIODOS_PRESET.map((p) => [p.id, p.label]))}
          value={periodoId}
          onValueChange={(v) => {
            if (!v) return;
            setPeriodoId(v as PeriodoPresetId);
            recargar(v as PeriodoPresetId);
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

      <div className={cn("space-y-4 transition-opacity", cargando && "pointer-events-none opacity-60")}>
        <div className="rounded-2xl bg-card p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-heading text-sm font-semibold text-navy">
              <BarChart3 className="size-4 text-primary" />
              Margen Bruto (%)
            </h2>
            <div className="flex items-center gap-3 text-xs text-text-muted">
              <span className="flex items-center gap-1">
                <span className="size-2.5 rounded-full bg-success-text" /> &gt; 40% (Alto)
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2.5 rounded-full bg-warning-text" /> &lt; 15% (Bajo)
              </span>
            </div>
          </div>

          {analisis.productos.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-muted">Sin ventas en este período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-border text-left text-xs text-text-muted">
                    <th className="py-2 pr-3 font-medium">Producto</th>
                    {analisis.canales.map((canalId) => (
                      <th key={canalId} className="px-3 py-2 text-center font-medium">
                        {canalNombre.get(canalId) ?? "Canal"}
                      </th>
                    ))}
                    <th className="py-2 pl-3 text-right font-semibold text-navy">Total Ponderado</th>
                  </tr>
                </thead>
                <tbody>
                  {analisis.filasProducto.map(({ productoId, totalPonderado }) => (
                    <tr key={productoId} className="border-b border-gray-border last:border-0">
                      <td className="py-2.5 pr-3 text-text-body">{productoNombre.get(productoId) ?? "Producto"}</td>
                      {analisis.canales.map((canalId) => {
                        const f = analisis.celda.get(`${productoId}|${canalId}`);
                        return (
                          <td
                            key={canalId}
                            className={cn("px-3 py-2.5 text-center", colorCelda(f?.margenPct ?? null))}
                          >
                            {f?.margenPct !== null && f?.margenPct !== undefined
                              ? `${f.margenPct.toFixed(1)}%`
                              : "—"}
                          </td>
                        );
                      })}
                      <td className="py-2.5 pl-3 text-right font-semibold text-navy">
                        {totalPonderado !== null ? `${totalPonderado.toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-border bg-gray-bg font-semibold text-navy">
                    <td className="py-2.5 pr-3">Promedio por Canal</td>
                    {analisis.columnasCanal.map(({ canalId, promedio }) => (
                      <td key={canalId} className={cn("px-3 py-2.5 text-center", colorCelda(promedio))}>
                        {promedio !== null ? `${promedio.toFixed(1)}%` : "—"}
                      </td>
                    ))}
                    <td className="py-2.5 pl-3 text-right bg-pastel-blue-bg text-primary">
                      {analisis.totalGeneral !== null ? `${analisis.totalGeneral.toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {analisis.productos.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-card p-4 shadow-card">
              <span className="flex size-9 items-center justify-center rounded-lg bg-success-bg text-success-text">
                <Award className="size-4" />
              </span>
              <p className="mt-2 text-[11px] tracking-wide text-text-muted uppercase">Producto Estrella</p>
              {analisis.productoEstrella ? (
                <>
                  <p className="font-heading text-sm font-semibold text-navy">
                    {productoNombre.get(analisis.productoEstrella.productoId) ?? "Producto"}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    Margen promedio de{" "}
                    <span className="font-medium text-navy">
                      {analisis.productoEstrella.totalPonderado?.toFixed(1)}%
                    </span>
                    {analisis.productoEstrella.mejorCanal &&
                      `, impulsado fuertemente por ventas vía ${
                        canalNombre.get(analisis.productoEstrella.mejorCanal.id) ?? "canal"
                      }.`}
                  </p>
                </>
              ) : (
                <p className="text-xs text-text-muted">Sin datos suficientes.</p>
              )}
            </div>
            <div className="rounded-2xl bg-card p-4 shadow-card">
              <span className="flex size-9 items-center justify-center rounded-lg bg-warning-bg text-warning-text">
                <AlertTriangle className="size-4" />
              </span>
              <p className="mt-2 text-[11px] tracking-wide text-text-muted uppercase">Atención Requerida</p>
              {analisis.productoAtencion ? (
                <>
                  <p className="font-heading text-sm font-semibold text-navy">
                    {productoNombre.get(analisis.productoAtencion.productoId) ?? "Producto"}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    Margen crítico de{" "}
                    <span className="font-medium text-navy">
                      {analisis.productoAtencion.totalPonderado?.toFixed(1)}%
                    </span>
                    . Revisar estructura de costos o ajustar precio.
                  </p>
                </>
              ) : (
                <p className="text-xs text-text-muted">Sin datos suficientes.</p>
              )}
            </div>
            <div className="rounded-2xl bg-card p-4 shadow-card">
              <span className="flex size-9 items-center justify-center rounded-lg bg-pastel-blue-bg text-primary">
                <MessageSquare className="size-4" />
              </span>
              <p className="mt-2 text-[11px] tracking-wide text-text-muted uppercase">Mejor Canal</p>
              {analisis.mejorCanalGlobal ? (
                <>
                  <p className="font-heading text-sm font-semibold text-navy">
                    {canalNombre.get(analisis.mejorCanalGlobal.canalId) ?? "Canal"}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    Rentabilidad promedio de{" "}
                    <span className="font-medium text-navy">
                      {analisis.mejorCanalGlobal.promedio?.toFixed(1)}%
                    </span>{" "}
                    entre los canales activos este período.
                  </p>
                </>
              ) : (
                <p className="text-xs text-text-muted">Sin datos suficientes.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
