"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, CheckCircle2, Eye, Plus, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";

interface Tenant {
  id: string;
  nombreNegocio: string;
  planId: string | null;
  nichoId: string | null;
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

const ESTADO_INFO: Record<string, { label: string; variant: "success" | "warning" | "error" }> = {
  activo: { label: "Activo", variant: "success" },
  solo_lectura: { label: "Solo lectura", variant: "warning" },
  bloqueado: { label: "Bloqueado", variant: "error" },
};

export function TenantsCliente({
  tenants,
  planes,
  porEstadoAcceso,
  porPlan,
  porNicho,
}: {
  tenants: Tenant[];
  planes: Plan[];
  porEstadoAcceso: Record<string, number>;
  porPlan: { planId: string; nombrePlan: string; cantidad: number }[];
  porNicho: { nichoId: string | null; cantidad: number }[];
}) {
  const [busqueda, setBusqueda] = useState("");
  const nombrePlan = useMemo(() => new Map(planes.map((p) => [p.id, p.nombre])), [planes]);

  const filtrados = tenants.filter((t) =>
    t.nombreNegocio.toLowerCase().includes(busqueda.trim().toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-navy">Negocios</h1>
          <p className="mt-1 text-sm text-text-muted">Salud agregada de la plataforma.</p>
        </div>
        <div className="flex items-center gap-2">
          <SearchInput
            className="sm:w-64"
            placeholder="Buscar negocio..."
            value={busqueda}
            onChange={setBusqueda}
          />
          <Link href="/admin/tenants/nuevo">
            <Button>
              <Plus className="size-4" />
              Nuevo Tenant
            </Button>
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-card">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-pastel-blue-bg text-primary">
            <Building2 className="size-5" />
          </span>
          <div>
            <p className="text-[11px] font-medium tracking-wide text-text-muted uppercase">Total de negocios</p>
            <p className="font-heading text-xl font-semibold text-navy">{tenants.length}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-card">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-success-bg text-success-text">
            <CheckCircle2 className="size-5" />
          </span>
          <div>
            <p className="text-[11px] font-medium tracking-wide text-text-muted uppercase">Activos</p>
            <p className="font-heading text-xl font-semibold text-navy">{porEstadoAcceso.activo ?? 0}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-card">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-warning-bg text-warning-text">
            <Eye className="size-5" />
          </span>
          <div>
            <p className="text-[11px] font-medium tracking-wide text-text-muted uppercase">Solo lectura</p>
            <p className="font-heading text-xl font-semibold text-navy">{porEstadoAcceso.solo_lectura ?? 0}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-card">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-error-bg text-error-text">
            <ShieldAlert className="size-5" />
          </span>
          <div>
            <p className="text-[11px] font-medium tracking-wide text-text-muted uppercase">Bloqueados</p>
            <p className="font-heading text-xl font-semibold text-navy">{porEstadoAcceso.bloqueado ?? 0}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-4">
        {porPlan.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-card px-4 py-3 shadow-card">
            <span className="text-xs font-medium text-text-muted">Por plan:</span>
            {porPlan.map((p) => (
              <Badge key={p.planId} variant="info">
                {p.nombrePlan} ({p.cantidad})
              </Badge>
            ))}
          </div>
        )}
        {porNicho.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-card px-4 py-3 shadow-card">
            <span className="text-xs font-medium text-text-muted">Por rubro:</span>
            {porNicho.map((n) => (
              <Badge key={n.nichoId ?? "sin_nicho"} variant="outline">
                {n.nichoId ? (NICHO_LABEL[n.nichoId] ?? "Sin especificar") : "Modo Básico"} ({n.cantidad})
              </Badge>
            ))}
          </div>
        )}
      </div>

      {filtrados.length === 0 ? (
        <p className="mt-10 text-center text-sm text-text-muted">Ningún negocio coincide con esta búsqueda.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl bg-card shadow-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-bg text-xs text-text-muted uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Negocio</th>
                <th className="px-4 py-3 font-medium">Rubro</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-border">
              {filtrados.map((t) => {
                const estado = ESTADO_INFO[t.estadoAcceso] ?? ESTADO_INFO.bloqueado;
                return (
                  <tr key={t.id} className="cursor-pointer hover:bg-gray-bg">
                    <td className="px-4 py-3">
                      <Link href={`/admin/tenants/${t.id}`} className="font-medium text-navy hover:underline">
                        {t.nombreNegocio}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {t.nichoId ? (NICHO_LABEL[t.nichoId] ?? "Sin especificar") : "Modo Básico"}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {t.planId ? (nombrePlan.get(t.planId) ?? "—") : "Sin plan"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={estado.variant}>{estado.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
