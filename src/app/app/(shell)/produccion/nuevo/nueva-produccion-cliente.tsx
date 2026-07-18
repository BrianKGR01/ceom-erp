"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, BarChart3, Calendar, CheckCircle2, Package, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { registrarProduccionAction } from "../actions";

// Formulas puras duplicadas de src/modules/operativo/nichos/nicho-1/actions.ts
// a proposito — ese archivo no es "use server" pero importa `db` y no puede
// entrar al bundle de cliente, asi que el resumen en vivo replica la misma
// aritmetica en vez de cruzar el limite servidor/cliente.
function calcularRendimientoTeorico(
  rendimientoPorLote: number,
  cantidadLotesProducidos: number,
  cantidadBaseConsumidaPorUnidad: number
): number {
  if (cantidadBaseConsumidaPorUnidad === 0) return 0;
  return (rendimientoPorLote * cantidadLotesProducidos) / cantidadBaseConsumidaPorUnidad;
}

function calcularMerma(rendimientoTeorico: number, cantidadRealObtenida: number): number {
  return Math.max(0, rendimientoTeorico - cantidadRealObtenida);
}

function calcularCostoOperativoProduccion(costoTotalInsumos: number, cantidadRealObtenida: number): number {
  if (cantidadRealObtenida <= 0) return 0;
  return costoTotalInsumos / cantidadRealObtenida;
}

export interface ProductoConReceta {
  id: string;
  nombre: string;
  imagenUrl: string | null;
  vidaUtilDias: number | null;
  recetaNombre: string;
  rendimientoPorLote: string;
  cantidadBaseConsumidaPorUnidad: string;
  composicion: { cantidadPorLote: string; costoUnitarioVigente: string | null }[];
}

function formatMoneda(valor: number): string {
  return valor.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function sumarDias(fechaISO: string, dias: number): string {
  const fecha = new Date(`${fechaISO}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

export function NuevaProduccionCliente({
  productos,
  activos,
  sucursales,
}: {
  productos: ProductoConReceta[];
  activos: { id: string; nombre: string }[];
  sucursales: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState("");
  const [productoId, setProductoId] = useState(productos[0]?.id ?? "");
  const [sucursalId, setSucursalId] = useState(sucursales.length === 1 ? sucursales[0].id : "");
  const [activoId, setActivoId] = useState("");
  const [fechaProduccion, setFechaProduccion] = useState(() => new Date().toISOString().slice(0, 10));
  const [cantidadLotesProducidos, setCantidadLotesProducidos] = useState(1);
  const [cantidadRealObtenida, setCantidadRealObtenida] = useState("");
  const [fechaVencimientoLote, setFechaVencimientoLote] = useState("");
  const [fechaVencimientoTocada, setFechaVencimientoTocada] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const productoSeleccionado = productos.find((p) => p.id === productoId) ?? null;

  const fechaVencimientoEstimada =
    productoSeleccionado?.vidaUtilDias && fechaProduccion
      ? sumarDias(fechaProduccion, productoSeleccionado.vidaUtilDias)
      : "";
  const fechaVencimientoMostrada = fechaVencimientoTocada ? fechaVencimientoLote : fechaVencimientoEstimada;

  const resumen = useMemo(() => {
    if (!productoSeleccionado) return null;
    const rendimientoTeorico = calcularRendimientoTeorico(
      Number(productoSeleccionado.rendimientoPorLote),
      cantidadLotesProducidos,
      Number(productoSeleccionado.cantidadBaseConsumidaPorUnidad)
    );
    const obtenida = Number(cantidadRealObtenida) || 0;
    const merma = calcularMerma(rendimientoTeorico, obtenida);
    const mermaPct = rendimientoTeorico > 0 ? (merma / rendimientoTeorico) * 100 : 0;
    const costoTotalInsumos = productoSeleccionado.composicion.reduce(
      (acc, c) => acc + Number(c.cantidadPorLote) * cantidadLotesProducidos * Number(c.costoUnitarioVigente ?? 0),
      0
    );
    const costoOperativo = calcularCostoOperativoProduccion(costoTotalInsumos, obtenida);
    return { rendimientoTeorico, obtenida, merma, mermaPct, costoOperativo };
  }, [productoSeleccionado, cantidadLotesProducidos, cantidadRealObtenida]);

  const filtrados = productos.filter((p) => p.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()));

  const puedeConfirmar =
    Boolean(productoId) &&
    Boolean(sucursalId) &&
    Boolean(activoId) &&
    Boolean(fechaProduccion) &&
    cantidadLotesProducidos > 0 &&
    Number(cantidadRealObtenida) > 0;

  async function confirmar() {
    setGuardando(true);
    setError(null);
    const resultado = await registrarProduccionAction({
      productoId,
      sucursalId,
      activoId,
      fechaProduccion,
      cantidadLotesProducidos,
      cantidadRealObtenida: Number(cantidadRealObtenida),
      fechaVencimientoLote: fechaVencimientoMostrada || undefined,
    });
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    router.push("/app/produccion");
  }

  if (productos.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-card p-10 text-center shadow-card">
        <span className="flex size-12 items-center justify-center rounded-xl bg-pastel-blue-bg text-primary">
          <Package className="size-6" />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-navy">Todavía no tenés productos vinculados a una receta</p>
          <p className="text-sm text-text-muted">
            Vinculá un producto a una receta desde su Ficha antes de registrar producción.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div className="rounded-2xl bg-card p-5 shadow-card">
          <div className="mb-5 flex items-center justify-center gap-8">
            {[
              { n: 1, label: "Producto" },
              { n: 2, label: "Equipo y Fecha" },
              { n: 3, label: "Resultados" },
            ].map((paso) => (
              <div key={paso.n} className="flex flex-col items-center gap-1">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
                  {paso.n}
                </span>
                <span className="text-xs font-medium text-navy">{paso.label}</span>
              </div>
            ))}
          </div>

          <div className="space-y-4 border-t border-gray-border pt-5">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-sm font-semibold text-navy">Selecciona el producto a producir</h3>
              <div className="relative w-56">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-muted" />
                <Input
                  placeholder="Buscar producto..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {filtrados.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProductoId(p.id)}
                  className={cn(
                    "overflow-hidden rounded-xl border text-left transition-colors",
                    p.id === productoId
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-gray-border hover:border-primary/40"
                  )}
                >
                  <div className="flex h-20 items-center justify-center bg-pastel-blue-bg">
                    {p.imagenUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imagenUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Package className="size-7 text-primary" />
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="truncate text-sm font-medium text-navy">{p.nombre}</p>
                    <p className="truncate text-xs text-text-muted">Usa receta: {p.recetaNombre}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-card p-5 shadow-card">
          <h3 className="mb-4 flex items-center gap-2 font-heading text-sm font-semibold text-navy">
            <Calendar className="size-4 text-primary" />
            Equipo y Fecha
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="activoId">Activo / Equipo de Producción</Label>
              <Select
                items={Object.fromEntries(activos.map((a) => [a.id, a.nombre]))}
                value={activoId}
                onValueChange={(v) => v && setActivoId(v)}
              >
                <SelectTrigger id="activoId" className="w-full">
                  <SelectValue placeholder="Elegí un equipo" />
                </SelectTrigger>
                <SelectContent>
                  {activos.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fechaProduccion">Fecha de Producción</Label>
              <Input
                id="fechaProduccion"
                type="date"
                value={fechaProduccion}
                onChange={(e) => setFechaProduccion(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cantidadLotes">Cantidad de lotes a iniciar</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setCantidadLotesProducidos((v) => Math.max(1, v - 1))}
                >
                  −
                </Button>
                <Input
                  id="cantidadLotes"
                  type="number"
                  min="1"
                  step="1"
                  className="text-center"
                  value={cantidadLotesProducidos}
                  onChange={(e) => setCantidadLotesProducidos(Number(e.target.value) || 1)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setCantidadLotesProducidos((v) => v + 1)}
                >
                  +
                </Button>
              </div>
            </div>
            {sucursales.length > 1 && (
              <div className="space-y-1.5">
                <Label htmlFor="sucursalId">Sucursal</Label>
                <Select
                  items={Object.fromEntries(sucursales.map((s) => [s.id, s.nombre]))}
                  value={sucursalId}
                  onValueChange={(v) => v && setSucursalId(v)}
                >
                  <SelectTrigger id="sucursalId" className="w-full">
                    <SelectValue placeholder="Elegí una sucursal" />
                  </SelectTrigger>
                  <SelectContent>
                    {sucursales.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-card p-5 shadow-card">
          <h3 className="mb-4 flex items-center gap-2 font-heading text-sm font-semibold text-navy">
            <BarChart3 className="size-4 text-primary" />
            Resultados
          </h3>
          <div className="max-w-xs space-y-1.5">
            <Label htmlFor="cantidadRealObtenida">Cantidad real obtenida</Label>
            <Input
              id="cantidadRealObtenida"
              type="number"
              min="0"
              step="0.01"
              value={cantidadRealObtenida}
              onChange={(e) => setCantidadRealObtenida(e.target.value)}
            />
            <p className="text-xs text-text-muted">Ingresá el conteo final tras descartes.</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-2xl bg-card p-5 shadow-card">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-pastel-blue-bg text-primary">
              <BarChart3 className="size-4" />
            </span>
            <div>
              <p className="font-heading text-sm font-semibold text-navy">Resumen</p>
              <p className="text-xs text-text-muted">Producción en tiempo real</p>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between rounded-lg bg-gray-bg px-3 py-2">
              <span className="text-text-muted">Rendimiento Teórico</span>
              <span className="font-semibold text-navy">
                {resumen ? resumen.rendimientoTeorico.toFixed(2) : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-gray-bg px-3 py-2">
              <span className="text-text-muted">Obtenido</span>
              <span className="font-semibold text-navy">{resumen ? resumen.obtenida.toFixed(2) : "—"}</span>
            </div>
            {resumen && resumen.merma > 0 && (
              <div className="flex items-center justify-between rounded-lg bg-error-bg px-3 py-2 text-error-text">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5" />
                  Merma
                </span>
                <span className="font-semibold">
                  {resumen.mermaPct.toFixed(0)}% · {resumen.merma.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between rounded-xl bg-navy px-3 py-3 text-white">
              <span className="text-xs text-white/70">Costo Operativo Resultante</span>
              <span className="font-semibold">
                {resumen ? formatMoneda(resumen.costoOperativo) : "—"} / unidad
              </span>
            </div>
          </div>

          <div className="mt-3 space-y-1.5">
            <Label htmlFor="fechaVencimientoLote">Fecha de Vencimiento Estimada</Label>
            <Input
              id="fechaVencimientoLote"
              type="date"
              value={fechaVencimientoMostrada}
              onChange={(e) => {
                setFechaVencimientoTocada(true);
                setFechaVencimientoLote(e.target.value);
              }}
            />
            {productoSeleccionado?.vidaUtilDias && (
              <p className="text-xs text-text-muted">
                Basado en vida útil ({productoSeleccionado.vidaUtilDias} días)
              </p>
            )}
          </div>
        </div>

        {error && <p className="text-xs text-error-text">{error}</p>}

        <Button className="w-full justify-center" onClick={confirmar} disabled={guardando || !puedeConfirmar}>
          <CheckCircle2 className="size-4" />
          {guardando ? "Confirmando..." : "Confirmar Producción"}
        </Button>
      </div>
    </div>
  );
}
