"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Calculator, History, Info, Percent, Scale, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/page-header";
import { cn } from "@/lib/utils";
import { actualizarUmbralAlertaAction } from "../actions";

type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

interface FilaComparativo {
  productoId: string;
  nombre: string;
  costo: number | null;
  precioVenta: number;
  margenPct: number | null;
  precioSugerido: number | null;
  alerta: boolean;
}

interface DatosComparativo {
  umbralMargenAlertaPct: number;
  margenPromedioCatalogo: number | null;
  productos: FilaComparativo[];
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

export function ComparativoCliente({ datosIniciales }: { datosIniciales: Resultado<DatosComparativo> }) {
  const router = useRouter();
  const [umbralAbierto, setUmbralAbierto] = useState(false);

  const datos = datosIniciales.ok ? datosIniciales.data : null;
  const filas = datos?.productos ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Comparativo Multi-SKU"
        description="Análisis de márgenes y precios sugeridos, contra el promedio del catálogo."
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <NavSimulaciones activo="comparativo" />
        {datos && (
          <button
            type="button"
            onClick={() => setUmbralAbierto(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-pastel-blue-bg px-3 py-1 text-xs font-medium text-primary"
          >
            <Info className="size-3.5" />
            Umbral de alerta: {datos.umbralMargenAlertaPct}%
          </button>
        )}
      </div>

      {!datosIniciales.ok || !datos ? (
        <p className="text-sm text-error-text">
          {!datosIniciales.ok ? datosIniciales.error : "No pudimos cargar el comparativo."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-card shadow-card">
          {datos.margenPromedioCatalogo !== null && (
            <p className="border-b border-gray-border px-5 py-3 text-xs text-text-muted">
              Margen promedio del catálogo: <span className="font-medium text-navy">{datos.margenPromedioCatalogo.toFixed(0)}%</span> — se
              resaltan los productos que se alejan más de {datos.umbralMargenAlertaPct} puntos porcentuales de este promedio.
            </p>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-border text-left text-[11px] tracking-wide text-text-muted uppercase">
                <th className="px-5 py-3 font-medium">Producto</th>
                <th className="px-5 py-3 text-right font-medium">Costo</th>
                <th className="px-5 py-3 text-right font-medium">Precio Actual</th>
                <th className="px-5 py-3 text-right font-medium">Margen %</th>
                <th className="px-5 py-3 text-right font-medium">Precio Sugerido</th>
              </tr>
            </thead>
            <tbody>
              {filas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-text-muted">
                    No hay productos cargados todavía.
                  </td>
                </tr>
              ) : (
                filas.map((fila) => (
                  <tr
                    key={fila.productoId}
                    className={cn("border-b border-gray-border last:border-0", fila.alerta && "bg-warning-bg/40")}
                  >
                    <td className="px-5 py-3 font-medium text-navy">
                      {fila.nombre}
                      {fila.alerta && (
                        <AlertTriangle className="ml-1.5 inline size-3.5 text-warning-text" />
                      )}
                    </td>
                    <td className="px-5 py-3 text-right text-text-body">
                      {fila.costo !== null ? formatoMoneda(fila.costo) : "Sin costo"}
                    </td>
                    <td className="px-5 py-3 text-right text-text-body">{formatoMoneda(fila.precioVenta)}</td>
                    <td className="px-5 py-3 text-right">
                      {fila.margenPct !== null ? (
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                            fila.alerta ? "bg-warning-bg text-warning-text" : "bg-success-bg text-success-text"
                          )}
                        >
                          {fila.margenPct.toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-xs text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-navy">
                      {fila.precioSugerido !== null ? (
                        <span className="inline-flex items-center gap-1">
                          {fila.precioSugerido > fila.precioVenta && (
                            <TrendingUp className="size-3.5 text-success-text" />
                          )}
                          {formatoMoneda(fila.precioSugerido)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <UmbralAlertaDialog
        open={umbralAbierto}
        onOpenChange={setUmbralAbierto}
        umbralActual={datos?.umbralMargenAlertaPct ?? 15}
        onGuardado={() => {
          setUmbralAbierto(false);
          router.refresh();
        }}
      />
    </div>
  );
}

function UmbralAlertaDialog({
  open,
  onOpenChange,
  umbralActual,
  onGuardado,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  umbralActual: number;
  onGuardado: () => void;
}) {
  const [valor, setValor] = useState(String(umbralActual));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    const numero = Number(valor);
    if (!Number.isFinite(numero) || numero <= 0 || numero > 100) {
      setError("Ingresá un porcentaje entre 1 y 100.");
      return;
    }
    setGuardando(true);
    setError(null);
    const resultado = await actualizarUmbralAlertaAction(numero);
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    onGuardado();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) setValor(String(umbralActual));
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Umbral de alerta del comparativo</DialogTitle>
          <DialogDescription>
            Productos cuyo margen se aleje más de este porcentaje del promedio del catálogo se
            resaltan como &ldquo;atención requerida&rdquo;.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="umbral">Umbral (puntos porcentuales)</Label>
          <div className="relative">
            <Input
              id="umbral"
              type="number"
              step="1"
              min="1"
              max="100"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-text-muted">
              %
            </span>
          </div>
          {error && <p className="text-xs text-error-text">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
