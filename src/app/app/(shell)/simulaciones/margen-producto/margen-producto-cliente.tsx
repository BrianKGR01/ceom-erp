"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Calculator, DollarSign, History, Package, Percent, Scale, TrendingUp } from "lucide-react";
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
import { margenPorProductoAction } from "../actions";
import { calcularRangoPreset, PERIODOS_PRESET, type PeriodoPresetId } from "../../periodo-presets";

type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

function formatoMoneda(valor: number): string {
  return valor.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function NavSimulaciones({ activo }: { activo: "simulador" | "comparativo" | "historial" | "margen" }) {
  const items = [
    { href: "/app/simulaciones", key: "simulador", label: "Simulador", icon: Calculator },
    { href: "/app/simulaciones/comparativo", key: "comparativo", label: "Comparar productos", icon: Scale },
    { href: "/app/simulaciones/historial", key: "historial", label: "Historial", icon: History },
    { href: "/app/simulaciones/margen-producto", key: "margen", label: "Margen por Producto", icon: Percent },
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

function KpiCard({
  icon: Icon,
  label,
  value,
  destacada,
}: {
  icon: typeof Package;
  label: string;
  value: string;
  destacada?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl p-4 shadow-card",
        destacada ? "bg-navy text-white" : "bg-card"
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl",
          destacada ? "bg-white/10 text-white" : "bg-pastel-blue-bg text-primary"
        )}
      >
        <Icon className="size-5" />
      </span>
      <div>
        <p className={cn("text-[11px] tracking-wide uppercase", destacada ? "text-white/60" : "text-text-muted")}>
          {label}
        </p>
        <p className="text-lg font-semibold">{value}</p>
      </div>
    </div>
  );
}

export function MargenProductoCliente({ productos }: { productos: { id: string; nombre: string }[] }) {
  const [productoId, setProductoId] = useState<string>(productos[0]?.id ?? "");
  const [periodoId, setPeriodoId] = useState<PeriodoPresetId>("mes");
  const [resultado, setResultado] = useState<Resultado<{
    margenPorcentaje: number | null;
    ingresosAjustados: number;
    costos: number;
  }> | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    async function cargar() {
      if (!productoId) {
        setResultado(null);
        return;
      }
      setCargando(true);
      const periodo = calcularRangoPreset(periodoId);
      const datos = await margenPorProductoAction(productoId, periodo);
      setCargando(false);
      setResultado(datos);
    }
    cargar();
  }, [productoId, periodoId]);

  return (
    <div className="space-y-4">
      <PageHeader title="Margen por Producto" description="Margen real de un producto en un período, con ajustes de venta incluidos." />
      <NavSimulaciones activo="margen" />

      <div className="grid grid-cols-1 gap-4 rounded-2xl bg-card p-5 shadow-card sm:grid-cols-2">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-text-body">Producto</p>
          <Select
            items={Object.fromEntries(productos.map((p) => [p.id, p.nombre]))}
            value={productoId}
            onValueChange={(v) => v && setProductoId(v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Elegí un producto" />
            </SelectTrigger>
            <SelectContent>
              {productos.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-text-body">Período</p>
          <Select
            items={Object.fromEntries(PERIODOS_PRESET.map((p) => [p.id, p.label]))}
            value={periodoId}
            onValueChange={(v) => v && setPeriodoId(v as PeriodoPresetId)}
          >
            <SelectTrigger className="w-full">
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

      {!productoId ? (
        <p className="text-sm text-text-muted">No hay productos cargados todavía.</p>
      ) : (
        <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-3 transition-opacity", cargando && "opacity-60")}>
          {resultado && !resultado.ok ? (
            <p className="col-span-3 text-sm text-error-text">{resultado.error}</p>
          ) : (
            <>
              <KpiCard
                icon={Percent}
                label="Margen %"
                value={
                  resultado?.ok && resultado.data.margenPorcentaje !== null
                    ? `${resultado.data.margenPorcentaje.toFixed(0)}%`
                    : "Sin ventas"
                }
                destacada
              />
              <KpiCard
                icon={TrendingUp}
                label="Ingresos ajustados"
                value={resultado?.ok ? formatoMoneda(resultado.data.ingresosAjustados) : "—"}
              />
              <KpiCard
                icon={DollarSign}
                label="Costos"
                value={resultado?.ok ? formatoMoneda(resultado.data.costos) : "—"}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
