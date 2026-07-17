"use client";

import { useState } from "react";
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
import { obtenerRankingProductosAction } from "../actions";
import { calcularRangoPreset, PERIODOS_PRESET, type PeriodoPresetId } from "../../periodo-presets";

type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

interface FilaRanking {
  productoId: string;
  unidadesVendidas: number;
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

export function RankingProductosCliente({
  datosIniciales,
  canales,
  productos,
}: {
  datosIniciales: Resultado<FilaRanking[]>;
  canales: { id: string; nombre: string }[];
  productos: { id: string; nombre: string }[];
}) {
  const [periodoId, setPeriodoId] = useState<PeriodoPresetId>("mes");
  const [canalId, setCanalId] = useState("todos");
  const [criterio, setCriterio] = useState<"rotacion" | "margen">("rotacion");
  const [datos, setDatos] = useState(datosIniciales);
  const [cargando, setCargando] = useState(false);

  async function recargar(
    nuevoPeriodoId: PeriodoPresetId,
    nuevoCanalId: string,
    nuevoCriterio: "rotacion" | "margen"
  ) {
    setCargando(true);
    const periodo = calcularRangoPreset(nuevoPeriodoId);
    const resultado = await obtenerRankingProductosAction(periodo, {
      canalVentaId: nuevoCanalId !== "todos" ? nuevoCanalId : undefined,
      criterio: nuevoCriterio,
    });
    setCargando(false);
    setDatos(resultado);
  }

  const productoNombre = new Map(productos.map((p) => [p.id, p.nombre]));
  const filas = datos.ok ? datos.data : [];
  const maxValor = Math.max(1, ...filas.map((f) => (criterio === "rotacion" ? f.unidadesVendidas : (f.margenPct ?? 0))));

  return (
    <div className="space-y-4">
      <PageHeader title="Ranking de Productos" description="Todos los productos, ordenados por rotación o margen." />
      <NavReportes activo="ranking" />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-lg border border-gray-border p-0.5 text-xs">
          <button
            type="button"
            onClick={() => {
              setCriterio("rotacion");
              recargar(periodoId, canalId, "rotacion");
            }}
            className={cn(
              "rounded-md px-3 py-1.5 font-medium",
              criterio === "rotacion" ? "bg-primary text-white" : "text-text-muted"
            )}
          >
            Por rotación
          </button>
          <button
            type="button"
            onClick={() => {
              setCriterio("margen");
              recargar(periodoId, canalId, "margen");
            }}
            className={cn(
              "rounded-md px-3 py-1.5 font-medium",
              criterio === "margen" ? "bg-primary text-white" : "text-text-muted"
            )}
          >
            Por margen
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {canales.length > 0 && (
            <Select
              items={{ todos: "Todos los canales", ...Object.fromEntries(canales.map((c) => [c.id, c.nombre])) }}
              value={canalId}
              onValueChange={(v) => {
                if (!v) return;
                setCanalId(v);
                recargar(periodoId, v, criterio);
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los canales</SelectItem>
                {canales.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select
            items={Object.fromEntries(PERIODOS_PRESET.map((p) => [p.id, p.label]))}
            value={periodoId}
            onValueChange={(v) => {
              if (!v) return;
              setPeriodoId(v as PeriodoPresetId);
              recargar(v as PeriodoPresetId, canalId, criterio);
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
      </div>

      <div className={cn("rounded-2xl bg-card p-5 shadow-card transition-opacity", cargando && "pointer-events-none opacity-60")}>
        {filas.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-muted">Sin ventas en este período.</p>
        ) : (
          <div className="space-y-3">
            {filas.map((fila, index) => {
              const valor = criterio === "rotacion" ? fila.unidadesVendidas : (fila.margenPct ?? 0);
              return (
                <div key={fila.productoId} className="flex items-center gap-3 text-sm">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-pastel-blue-bg text-xs font-semibold text-primary">
                    {index + 1}
                  </span>
                  <span className="line-clamp-1 w-40 shrink-0 text-text-body">
                    {productoNombre.get(fila.productoId) ?? "Producto"}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-bg">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(4, (Math.abs(valor) / maxValor) * 100)}%` }}
                    />
                  </div>
                  <span className="w-20 shrink-0 text-right text-xs font-medium text-navy">
                    {criterio === "rotacion" ? `${valor} un.` : `${valor.toFixed(0)}%`}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
