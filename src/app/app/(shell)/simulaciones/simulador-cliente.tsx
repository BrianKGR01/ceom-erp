"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Calculator,
  DollarSign,
  History,
  Package,
  Percent,
  RefreshCcw,
  Scale,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  calcularPuntoEquilibrioAction,
  obtenerDatosPreviaAction,
  simularPrecioAction,
} from "./actions";
import { calcularRangoPreset, PERIODOS_PRESET, type PeriodoPresetId } from "../periodo-presets";

const FRECUENCIAS: { value: "semanal" | "mensual"; label: string }[] = [
  { value: "semanal", label: "Semanal" },
  { value: "mensual", label: "Mensual" },
];

const SUFIJO_PERIODO: Record<PeriodoPresetId, string> = {
  hoy: "/día",
  "7dias": "/semana",
  mes: "/mes",
  anio: "/año",
};

// Formulas puras duplicadas de src/modules/simulaciones/actions.ts — ese
// archivo importa `db` y no es "use server", un Client Component no puede
// importarlo (mismo criterio ya usado en el wizard de Producción).
function calcularPrecioSugeridoLocal(costoProduccion: number, margenDeseadoPct: number): number {
  return costoProduccion / (1 - margenDeseadoPct / 100);
}
function calcularImpactoProyectadoLocal(
  precioSugerido: number,
  precioVentaActual: number,
  rotacionHistorica: number
): number {
  return (precioSugerido - precioVentaActual) * rotacionHistorica;
}
function calcularMargenPorcentajeLocal(ingresos: number, costos: number): number | null {
  if (ingresos === 0) return null;
  return ((ingresos - costos) / ingresos) * 100;
}

function formatoMoneda(valor: number): string {
  return valor.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function NavSimulaciones({ activo }: { activo: "simulador" | "comparativo" | "historial" | "margen" }) {
  const items = [
    { href: "/app/simulaciones", key: "simulador", label: "Simulador", icon: Calculator },
    { href: "/app/simulaciones/comparativo", key: "comparativo", label: "Comparativo Multi-SKU", icon: Scale },
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
}: {
  icon: typeof Package;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-card">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-pastel-blue-bg text-primary">
        <Icon className="size-5" />
      </span>
      <div>
        <p className="text-[11px] tracking-wide text-text-muted uppercase">{label}</p>
        <p className="text-lg font-semibold text-navy">{value}</p>
      </div>
    </div>
  );
}

interface DatosPrevia {
  costoOperativoVigente: number | null;
  precioVenta: number;
  unidadesVendidas: number;
  costoFijoTotalPeriodo: number;
}

export function SimuladorCliente({ productos }: { productos: { id: string; nombre: string }[] }) {
  const [productoId, setProductoId] = useState<string>(productos[0]?.id ?? "");
  const [frecuencia, setFrecuencia] = useState<"semanal" | "mensual">("mensual");
  const [periodoId, setPeriodoId] = useState<PeriodoPresetId>("mes");
  const [tab, setTab] = useState<"simular_precio" | "punto_equilibrio">("simular_precio");

  const [preview, setPreview] = useState<DatosPrevia | null>(null);
  const [cargandoPreview, setCargandoPreview] = useState(false);

  const [margenDeseadoPct, setMargenDeseadoPct] = useState(15);
  const [costoEsManual, setCostoEsManual] = useState(false);
  const [costoManualInput, setCostoManualInput] = useState("");

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  // Previa de solo lectura (Modulo_09 seccion 1.1) — nunca persiste, se
  // recalcula libremente al cambiar producto/periodo. Patron de funcion
  // async anidada declarada-e-invocada (pasa react-hooks/set-state-in-effect,
  // mismo criterio ya usado en la Ficha de Producto).
  useEffect(() => {
    async function cargar() {
      if (!productoId) {
        setPreview(null);
        return;
      }
      setCargandoPreview(true);
      setError(null);
      const periodo = calcularRangoPreset(periodoId);
      const resultado = await obtenerDatosPreviaAction(productoId, periodo);
      setCargandoPreview(false);
      if (resultado.ok) {
        setPreview(resultado.data);
      } else {
        setPreview(null);
        setError(resultado.error);
      }
    }
    cargar();
  }, [productoId, periodoId]);

  const costoUsado = costoEsManual
    ? Number(costoManualInput) || 0
    : (preview?.costoOperativoVigente ?? 0);
  const margenActualPct =
    preview && preview.costoOperativoVigente !== null
      ? calcularMargenPorcentajeLocal(preview.precioVenta, preview.costoOperativoVigente)
      : null;

  const precioSugerido =
    costoUsado > 0 && margenDeseadoPct < 100
      ? calcularPrecioSugeridoLocal(costoUsado, margenDeseadoPct)
      : null;
  const impactoProyectadoBs =
    preview && precioSugerido !== null && preview.unidadesVendidas > 0
      ? calcularImpactoProyectadoLocal(precioSugerido, preview.precioVenta, preview.unidadesVendidas)
      : null;

  const costoVariableUnitario = preview?.costoOperativoVigente ?? null;
  const margenContribucionUnitario =
    preview && costoVariableUnitario !== null ? preview.precioVenta - costoVariableUnitario : null;
  const puntoEquilibrioUnidades =
    preview && margenContribucionUnitario !== null && margenContribucionUnitario > 0
      ? preview.costoFijoTotalPeriodo / margenContribucionUnitario
      : null;
  const advertenciaPuntoEquilibrio =
    margenContribucionUnitario !== null && margenContribucionUnitario <= 0
      ? "A este precio y con este costo, nunca vas a cubrir tus costos fijos: el precio de venta no supera el costo variable."
      : null;

  async function guardarSimularPrecio() {
    setGuardando(true);
    setError(null);
    setMensajeExito(null);
    const periodo = calcularRangoPreset(periodoId);
    const resultado = await simularPrecioAction({
      productoId,
      frecuencia,
      periodo,
      margenDeseadoPct,
      costoManual: costoEsManual ? Number(costoManualInput) : undefined,
    });
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    setMensajeExito(
      `Simulación guardada — precio sugerido ${formatoMoneda(resultado.data.precioSugerido)}. Esto no cambia el precio real del producto.`
    );
  }

  async function guardarPuntoEquilibrio() {
    setGuardando(true);
    setError(null);
    setMensajeExito(null);
    const periodo = calcularRangoPreset(periodoId);
    const resultado = await calcularPuntoEquilibrioAction({ productoId, frecuencia, periodo });
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    setMensajeExito(
      resultado.data.puntoEquilibrioUnidades !== null
        ? `Simulación guardada — punto de equilibrio ${resultado.data.puntoEquilibrioUnidades.toFixed(0)} unidades.`
        : "Simulación guardada."
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Simulador de Precios"
        description="Costo automático por defecto — el ajuste manual es solo para esta simulación, nunca cambia el costo real del producto."
      />
      <NavSimulaciones activo="simulador" />

      <div>
        <p className="mb-2 text-sm font-medium text-navy">Seleccionar producto</p>
        {productos.length === 0 ? (
          <p className="text-sm text-text-muted">No hay productos cargados todavía.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {productos.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setProductoId(p.id);
                  setMensajeExito(null);
                }}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-2xl border-2 bg-card p-4 text-center shadow-card transition-colors",
                  productoId === p.id ? "border-primary" : "border-transparent hover:border-gray-border"
                )}
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-pastel-blue-bg text-primary">
                  <Package className="size-5" />
                </span>
                <span className="line-clamp-2 text-xs font-medium text-navy">{p.nombre}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {productoId && (
        <div className={cn("space-y-4 transition-opacity", cargandoPreview && "opacity-60")}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <KpiCard
              icon={RefreshCcw}
              label={`Rotación (${PERIODOS_PRESET.find((p) => p.id === periodoId)?.label.toLowerCase()})`}
              value={preview ? `${preview.unidadesVendidas} und` : "—"}
            />
            <KpiCard
              icon={Percent}
              label="Margen actual"
              value={margenActualPct !== null ? `${margenActualPct.toFixed(0)}%` : "Sin costo cargado"}
            />
            <KpiCard
              icon={DollarSign}
              label="Costo real"
              value={preview?.costoOperativoVigente !== null && preview !== null ? formatoMoneda(preview.costoOperativoVigente!) : "Sin costo cargado"}
            />
          </div>

          <div className="rounded-2xl bg-card shadow-card">
            <div className="flex border-b border-gray-border">
              <button
                type="button"
                onClick={() => setTab("simular_precio")}
                className={cn(
                  "flex-1 border-b-2 px-4 py-3 text-sm font-medium",
                  tab === "simular_precio" ? "border-primary text-navy" : "border-transparent text-text-muted"
                )}
              >
                Simular Precio
              </button>
              <button
                type="button"
                onClick={() => setTab("punto_equilibrio")}
                className={cn(
                  "flex-1 border-b-2 px-4 py-3 text-sm font-medium",
                  tab === "punto_equilibrio" ? "border-primary text-navy" : "border-transparent text-text-muted"
                )}
              >
                Punto de Equilibrio
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="frecuencia">Frecuencia</Label>
                    <Select
                      items={Object.fromEntries(FRECUENCIAS.map((f) => [f.value, f.label]))}
                      value={frecuencia}
                      onValueChange={(v) => v && setFrecuencia(v as "semanal" | "mensual")}
                    >
                      <SelectTrigger id="frecuencia" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FRECUENCIAS.map((f) => (
                          <SelectItem key={f.value} value={f.value}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="periodo">Período</Label>
                    <Select
                      items={Object.fromEntries(PERIODOS_PRESET.map((p) => [p.id, p.label]))}
                      value={periodoId}
                      onValueChange={(v) => v && setPeriodoId(v as PeriodoPresetId)}
                    >
                      <SelectTrigger id="periodo" className="w-full">
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

                {tab === "simular_precio" ? (
                  <>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="costoProduccion">Costo de Producción</Label>
                        {!costoEsManual && <Badge variant="info">auto</Badge>}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-text-muted">
                            $
                          </span>
                          <Input
                            id="costoProduccion"
                            className="pl-6"
                            type="number"
                            step="0.01"
                            min="0"
                            disabled={!costoEsManual}
                            value={costoEsManual ? costoManualInput : (preview?.costoOperativoVigente ?? "")}
                            onChange={(e) => setCostoManualInput(e.target.value)}
                          />
                        </div>
                        <button
                          type="button"
                          className="shrink-0 text-xs font-medium text-primary"
                          onClick={() => {
                            if (!costoEsManual) {
                              setCostoManualInput(String(preview?.costoOperativoVigente ?? ""));
                            }
                            setCostoEsManual((v) => !v);
                          }}
                        >
                          {costoEsManual ? "Usar automático" : "Ajustar manualmente"}
                        </button>
                      </div>
                      <p className="text-[11px] text-text-muted">
                        El ajuste manual es solo para esta simulación — nunca cambia el costo real del
                        producto en Catálogo.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="margenDeseado">Margen Deseado (%)</Label>
                      <div className="relative">
                        <Input
                          id="margenDeseado"
                          type="number"
                          step="1"
                          min="0"
                          max="99"
                          value={margenDeseadoPct}
                          onChange={(e) => setMargenDeseadoPct(Number(e.target.value))}
                        />
                        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-text-muted">
                          %
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between border-b border-gray-border py-1.5">
                      <span className="text-text-muted">Costo Fijo Total del período</span>
                      <span className="font-medium text-navy">
                        {preview ? formatoMoneda(preview.costoFijoTotalPeriodo) : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-gray-border py-1.5">
                      <span className="text-text-muted">Costo Variable Unitario</span>
                      <span className="font-medium text-navy">
                        {costoVariableUnitario !== null ? formatoMoneda(costoVariableUnitario) : "Sin costo cargado"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-gray-border py-1.5">
                      <span className="text-text-muted">Precio de Venta</span>
                      <span className="font-medium text-navy">{preview ? formatoMoneda(preview.precioVenta) : "—"}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-text-muted">Margen de Contribución Unitario</span>
                      <span className="font-medium text-navy">
                        {margenContribucionUnitario !== null ? formatoMoneda(margenContribucionUnitario) : "—"}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {tab === "simular_precio" ? (
                <div className="rounded-2xl bg-navy p-5 text-white">
                  <p className="text-sm font-semibold">Proyección de Precio</p>
                  <p className="mt-3 text-[11px] tracking-wide text-white/60 uppercase">Precio Sugerido</p>
                  <p className="text-3xl font-bold">
                    {precioSugerido !== null ? formatoMoneda(precioSugerido) : "—"}
                  </p>
                  <div className="mt-4 rounded-xl bg-white/10 p-3">
                    <p className="text-[11px] tracking-wide text-white/60 uppercase">Impacto Proyectado</p>
                    <p className="mt-1 flex items-center gap-1 text-lg font-semibold">
                      {impactoProyectadoBs !== null ? (
                        <>
                          {impactoProyectadoBs >= 0 ? (
                            <TrendingUp className="size-4 text-success-text" />
                          ) : (
                            <TrendingDown className="size-4 text-error-text" />
                          )}
                          {impactoProyectadoBs >= 0 ? "+" : ""}
                          {formatoMoneda(impactoProyectadoBs)}
                          {SUFIJO_PERIODO[periodoId]}
                        </>
                      ) : (
                        <span className="text-sm font-normal text-white/70">
                          No disponible — sin ventas de este producto en el período.
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-navy p-5 text-white">
                  <p className="text-sm font-semibold">Punto de Equilibrio</p>
                  {advertenciaPuntoEquilibrio ? (
                    <div className="mt-3 flex items-start gap-2 rounded-lg bg-warning-bg p-3 text-xs text-warning-text">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                      <p>{advertenciaPuntoEquilibrio}</p>
                    </div>
                  ) : (
                    <>
                      <p className="mt-3 text-[11px] tracking-wide text-white/60 uppercase">
                        Unidades a vender en el período
                      </p>
                      <p className="text-3xl font-bold">
                        {puntoEquilibrioUnidades !== null ? puntoEquilibrioUnidades.toFixed(0) : "—"}
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-gray-border p-5">
              {error && <p className="text-xs text-error-text">{error}</p>}
              {mensajeExito && <p className="text-xs text-success-text">{mensajeExito}</p>}
              <Button
                className="ml-auto"
                disabled={!productoId || cargandoPreview || guardando}
                onClick={tab === "simular_precio" ? guardarSimularPrecio : guardarPuntoEquilibrio}
              >
                {guardando ? "Guardando..." : "Guardar simulación"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
