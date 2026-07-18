"use client";

import { useEffect, useState } from "react";
import { Archive, Factory } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/shared/empty-state";
import { consultarCapacidadAction } from "../actions";

interface Capacidad {
  produccion: { capacidadPeriodo: number | null; produccionReal: number; porcentajeUsado: number | null };
  almacenamiento: {
    capacidadAlmacenamientoCantidad: number | null;
    stockActualTotal: number;
    porcentajeUsado: number | null;
  };
}

function primerDiaDelMes(): string {
  const hoy = new Date();
  return new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function BarraCapacidad({ porcentaje }: { porcentaje: number | null }) {
  if (porcentaje === null) {
    return <p className="text-xs text-text-muted">Sin datos suficientes para calcular el % usado.</p>;
  }
  const pct = Math.min(100, Math.round(porcentaje * 100));
  return (
    <div className="space-y-1">
      <div className="h-1.5 overflow-hidden rounded-full bg-gray-bg">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <p className="text-xs text-text-muted">{pct}% usado</p>
    </div>
  );
}

export function CapacidadCliente({ activos }: { activos: { id: string; nombre: string }[] }) {
  const [activoId, setActivoId] = useState(activos[0]?.id ?? "");
  const [desde, setDesde] = useState(primerDiaDelMes());
  const [hasta, setHasta] = useState(hoyISO());
  const [capacidad, setCapacidad] = useState<Capacidad | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activoId) return;
    let cancelado = false;
    async function cargar() {
      setCargando(true);
      setError(null);
      const resultado = await consultarCapacidadAction(activoId, { desde, hasta });
      if (cancelado) return;
      setCargando(false);
      if (!resultado.ok) {
        setError(resultado.error);
        setCapacidad(null);
        return;
      }
      setCapacidad(resultado.data);
    }
    cargar();
    return () => {
      cancelado = true;
    };
  }, [activoId, desde, hasta]);

  if (activos.length === 0) {
    return (
      <EmptyState
        icon={Factory}
        title="Ningún equipo tiene capacidad cargada"
        description="Cargá la capacidad de producción o almacenamiento de un Activo desde Patrimonio para ver esta pantalla."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 rounded-2xl bg-card p-4 shadow-card sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Equipo</Label>
          <Select
            items={Object.fromEntries(activos.map((a) => [a.id, a.nombre]))}
            value={activoId}
            onValueChange={(v) => v && setActivoId(v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
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
          <Label htmlFor="desde">Desde</Label>
          <Input id="desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hasta">Hasta</Label>
          <Input id="hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
      </div>

      {cargando && <p className="text-sm text-text-muted">Cargando...</p>}
      {error && <p className="text-xs text-error-text">{error}</p>}

      {capacidad && !cargando && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-card p-5 shadow-card">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-lg bg-pastel-blue-bg text-primary">
                <Factory className="size-4" />
              </span>
              <p className="font-heading text-sm font-semibold text-navy">Capacidad de producción</p>
            </div>
            <div className="mb-2 flex items-baseline justify-between text-sm">
              <span className="text-text-muted">Producción real del período</span>
              <span className="font-semibold text-navy">{capacidad.produccion.produccionReal}</span>
            </div>
            <div className="mb-3 flex items-baseline justify-between text-sm">
              <span className="text-text-muted">Capacidad del período</span>
              <span className="font-semibold text-navy">
                {capacidad.produccion.capacidadPeriodo !== null
                  ? capacidad.produccion.capacidadPeriodo.toFixed(0)
                  : "Sin datos de ciclo cargados"}
              </span>
            </div>
            <BarraCapacidad porcentaje={capacidad.produccion.porcentajeUsado} />
          </div>

          <div className="rounded-2xl bg-card p-5 shadow-card">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-lg bg-pastel-blue-bg text-primary">
                <Archive className="size-4" />
              </span>
              <p className="font-heading text-sm font-semibold text-navy">Capacidad de almacenamiento</p>
            </div>
            <div className="mb-2 flex items-baseline justify-between text-sm">
              <span className="text-text-muted">Stock actual total</span>
              <span className="font-semibold text-navy">{capacidad.almacenamiento.stockActualTotal}</span>
            </div>
            <div className="mb-3 flex items-baseline justify-between text-sm">
              <span className="text-text-muted">Capacidad de almacenamiento</span>
              <span className="font-semibold text-navy">
                {capacidad.almacenamiento.capacidadAlmacenamientoCantidad ?? "Sin definir"}
              </span>
            </div>
            <BarraCapacidad porcentaje={capacidad.almacenamiento.porcentajeUsado} />
          </div>
        </div>
      )}
    </div>
  );
}
