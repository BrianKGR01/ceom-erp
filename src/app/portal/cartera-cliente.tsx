"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, CheckCircle2, Eye, Search, ShieldAlert, Store, UtensilsCrossed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PortalTopbar } from "@/components/shared/portal-topbar";
import { cn } from "@/lib/utils";

type EstadoAcceso = "activo" | "solo_lectura" | "bloqueado";

interface FilaCartera {
  tenantId: string;
  cohorte: string | null;
  fechaInicio: string;
  nombreNegocio: string;
  nichoId: string | null;
  planId: string | null;
  // string, no EstadoAcceso — monitoreo-institucional/actions.ts devuelve el
  // tipo ancho (no importa EstadoAcceso de Identidad). Siempre es uno de los
  // 3 valores reales en runtime; ESTADO_INFO abajo tiene fallback igual.
  estadoAcceso: string;
}

interface Plan {
  id: string;
  nombre: string;
}

const NICHO_LABEL: Record<string, string> = {
  nicho_1: "Alimentos y bebidas por lotes",
  nicho_4: "Comercio minorista y distribución",
};

const NICHO_ICONO: Record<string, typeof UtensilsCrossed> = {
  nicho_1: UtensilsCrossed,
  nicho_4: Store,
};

const ESTADO_INFO: Record<
  EstadoAcceso,
  { label: string; variant: "success" | "warning" | "error"; borde: string; icono: typeof CheckCircle2 }
> = {
  activo: { label: "Activo", variant: "success", borde: "bg-success-text", icono: CheckCircle2 },
  solo_lectura: { label: "Solo lectura", variant: "warning", borde: "bg-warning-text", icono: Eye },
  bloqueado: { label: "Bloqueado", variant: "error", borde: "bg-error-text", icono: ShieldAlert },
};

function formatCohorte(fila: FilaCartera): string {
  if (fila.cohorte) return fila.cohorte;
  const fecha = new Date(fila.fechaInicio);
  return fecha.toLocaleDateString("es-BO", { month: "short", year: "numeric" });
}

export function CarteraCliente({
  nombreInstitucion,
  cartera,
  planes,
}: {
  nombreInstitucion: string;
  cartera: FilaCartera[];
  planes: Plan[];
}) {
  const [busqueda, setBusqueda] = useState("");
  const nombrePlan = useMemo(() => new Map(planes.map((p) => [p.id, p.nombre])), [planes]);

  const conteos = useMemo(() => {
    const c: Record<EstadoAcceso, number> = { activo: 0, solo_lectura: 0, bloqueado: 0 };
    for (const fila of cartera) {
      if (fila.estadoAcceso in c) c[fila.estadoAcceso as EstadoAcceso]++;
    }
    return c;
  }, [cartera]);

  const filtrados = cartera.filter((f) =>
    f.nombreNegocio.toLowerCase().includes(busqueda.trim().toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-bg">
      <PortalTopbar>
        <span className="text-sm text-text-muted">{nombreInstitucion}</span>
        <span className="flex h-16 items-center border-b-2 border-primary text-sm font-medium text-primary">
          Mi Cartera
        </span>
      </PortalTopbar>

      <div className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl font-semibold text-navy">Mi cartera de negocios</h1>
            <p className="mt-1 text-sm text-text-muted">Seguí el estado de los negocios en tu cartera.</p>
          </div>
          <div className="relative sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-muted" />
            <Input
              placeholder="Buscar negocio..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-card">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-pastel-blue-bg text-primary">
              <Building2 className="size-5" />
            </span>
            <div>
              <p className="text-[11px] font-medium tracking-wide text-text-muted uppercase">Total de negocios</p>
              <p className="font-heading text-xl font-semibold text-navy">{cartera.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-card">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-success-bg text-success-text">
              <CheckCircle2 className="size-5" />
            </span>
            <div>
              <p className="text-[11px] font-medium tracking-wide text-text-muted uppercase">Activos</p>
              <p className="font-heading text-xl font-semibold text-navy">{conteos.activo}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-card">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-warning-bg text-warning-text">
              <Eye className="size-5" />
            </span>
            <div>
              <p className="text-[11px] font-medium tracking-wide text-text-muted uppercase">Solo lectura</p>
              <p className="font-heading text-xl font-semibold text-navy">{conteos.solo_lectura}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-card">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-error-bg text-error-text">
              <ShieldAlert className="size-5" />
            </span>
            <div>
              <p className="text-[11px] font-medium tracking-wide text-text-muted uppercase">Bloqueados</p>
              <p className="font-heading text-xl font-semibold text-navy">{conteos.bloqueado}</p>
            </div>
          </div>
        </div>

        {cartera.length === 0 ? (
          <p className="mt-10 text-center text-sm text-text-muted">
            Todavía no tenés ningún negocio en tu cartera.
          </p>
        ) : filtrados.length === 0 ? (
          <p className="mt-10 text-center text-sm text-text-muted">Ningún negocio coincide con esta búsqueda.</p>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtrados.map((fila) => {
              const estado = ESTADO_INFO[fila.estadoAcceso as EstadoAcceso] ?? ESTADO_INFO.bloqueado;
              const IconoNicho = (fila.nichoId && NICHO_ICONO[fila.nichoId]) || Building2;
              return (
                <Link
                  key={fila.tenantId}
                  href={`/portal/cartera/${fila.tenantId}`}
                  className="block overflow-hidden rounded-2xl bg-card shadow-card transition-shadow hover:shadow-md"
                >
                  <div className={cn("h-1.5 w-full", estado.borde)} />
                  <div className="p-5">
                    <div className="flex items-start justify-between">
                      <span className="flex size-11 items-center justify-center rounded-lg bg-pastel-blue-bg text-primary">
                        <IconoNicho className="size-5" />
                      </span>
                      <Badge variant={estado.variant}>{estado.label}</Badge>
                    </div>
                    <h2 className="mt-3 font-heading text-base font-semibold text-navy">{fila.nombreNegocio}</h2>
                    <p className="text-xs text-text-muted">
                      Rubro: {fila.nichoId ? (NICHO_LABEL[fila.nichoId] ?? "Sin especificar") : "Modo Básico"}
                    </p>
                    <div className="mt-4 flex items-center justify-between border-t border-gray-border pt-3 text-xs">
                      <span className="text-text-muted uppercase">Plan actual</span>
                      <Badge variant="info">
                        {fila.planId ? (nombrePlan.get(fila.planId) ?? "—") : "Sin plan"}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-text-muted uppercase">Cohorte</span>
                      <span className="font-medium text-navy">{formatCohorte(fila)}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
