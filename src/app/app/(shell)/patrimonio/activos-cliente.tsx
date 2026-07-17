"use client";

import { useState } from "react";
import Link from "next/link";
import { Archive, Armchair, Boxes, Plus, Search, Settings2, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Input } from "@/components/ui/input";

type TipoActivo = "equipo_productivo" | "mobiliario" | "vehiculo" | "otro";
type EstadoActivo = "activo" | "en_mantenimiento" | "dado_de_baja";

export interface ActivoListado {
  id: string;
  nombre: string;
  tipo: TipoActivo;
  estado: EstadoActivo;
  valorActual: number;
  sucursalNombre: string;
}

const ICONO_TIPO: Record<TipoActivo, typeof Settings2> = {
  equipo_productivo: Settings2,
  mobiliario: Armchair,
  vehiculo: Truck,
  otro: Boxes,
};

const LABEL_TIPO: Record<TipoActivo, string> = {
  equipo_productivo: "Equipo productivo",
  mobiliario: "Mobiliario",
  vehiculo: "Vehículo",
  otro: "Otro",
};

const BADGE_ESTADO: Record<EstadoActivo, { variant: "success" | "warning" | "outline"; label: string }> = {
  activo: { variant: "success", label: "Activo" },
  en_mantenimiento: { variant: "warning", label: "En mantenimiento" },
  dado_de_baja: { variant: "outline", label: "Dado de baja" },
};

const FILTROS_ESTADO: { value: EstadoActivo | "todos"; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "activo", label: "Activos" },
  { value: "en_mantenimiento", label: "En mantenimiento" },
  { value: "dado_de_baja", label: "Dados de baja" },
];

function formatMoneda(valor: number): string {
  return valor.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ActivosCliente({
  activos,
  valorPatrimonialTotal,
}: {
  activos: ActivoListado[];
  valorPatrimonialTotal: number;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<EstadoActivo | "todos">("todos");

  const filtrados = activos.filter((a) => {
    if (filtroEstado !== "todos" && a.estado !== filtroEstado) return false;
    const q = busqueda.trim().toLowerCase();
    if (!q) return true;
    return (
      a.nombre.toLowerCase().includes(q) ||
      LABEL_TIPO[a.tipo].toLowerCase().includes(q) ||
      a.sucursalNombre.toLowerCase().includes(q)
    );
  });

  const totalOperativos = activos.filter((a) => a.estado !== "dado_de_baja").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-muted" />
          <Input
            placeholder="Buscar por nombre, tipo o sucursal..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button render={<Link href="/app/patrimonio/nuevo" />} nativeButton={false}>
          <Plus className="size-4" />
          Nuevo activo
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTROS_ESTADO.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFiltroEstado(f.value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              filtroEstado === f.value
                ? "border-primary bg-pastel-blue-bg text-primary"
                : "border-gray-border text-text-muted hover:border-primary/50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {activos.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="Todavía no cargaste ningún activo"
          description="Registrá el equipamiento, mobiliario o vehículos de tu negocio para ver su valor patrimonial."
          action={{ label: "Cargar activo", href: "/app/patrimonio/nuevo" }}
        />
      ) : (
        <>
          {filtrados.length === 0 ? (
            <p className="rounded-2xl bg-card p-6 text-center text-sm text-text-muted shadow-card">
              Ningún activo coincide con esta búsqueda.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtrados.map((activo) => {
                const Icono = ICONO_TIPO[activo.tipo];
                const badge = BADGE_ESTADO[activo.estado];
                return (
                  <Card key={activo.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-pastel-blue-bg text-primary">
                          <Icono className="size-4" />
                        </span>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </div>
                      <p className="mt-2 font-heading text-sm font-semibold text-navy">{activo.nombre}</p>
                      <p className="text-xs text-text-muted">{LABEL_TIPO[activo.tipo]}</p>
                    </CardHeader>
                    <CardContent className="space-y-2 border-t border-gray-border pt-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-text-muted">Valor actual</span>
                        <span className="font-medium text-navy">{formatMoneda(activo.valorActual)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-text-muted">Sucursal</span>
                        <span className="text-text-body">{activo.sucursalNombre}</span>
                      </div>
                      <Link
                        href={`/app/patrimonio/${activo.id}`}
                        className="block pt-1 text-right text-xs font-medium text-primary hover:underline"
                      >
                        Ver detalles →
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-card">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-pastel-blue-bg text-primary">
                <Archive className="size-4" />
              </span>
              <div>
                <p className="text-[11px] tracking-wide text-text-muted uppercase">Activos operativos</p>
                <p className="font-heading text-lg font-semibold text-navy">{totalOperativos}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-card">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-success-bg text-success-text">
                <Boxes className="size-4" />
              </span>
              <div>
                <p className="text-[11px] tracking-wide text-text-muted uppercase">Valor patrimonial total</p>
                <p className="font-heading text-lg font-semibold text-navy">
                  {formatMoneda(valorPatrimonialTotal)}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
