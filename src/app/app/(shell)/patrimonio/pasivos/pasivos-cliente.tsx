"use client";

import Link from "next/link";
import { Landmark, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";

type EstadoPasivo = "activo" | "pagado" | "refinanciado";

const BADGE_ESTADO: Record<EstadoPasivo, { variant: "success" | "info" | "outline"; label: string }> = {
  activo: { variant: "success", label: "Activo" },
  pagado: { variant: "info", label: "Pagado" },
  refinanciado: { variant: "outline", label: "Refinanciado" },
};

export interface PasivoListado {
  id: string;
  estado: EstadoPasivo;
  montoTotal: string;
  saldoPendiente: number;
  fechaInicio: string;
  activoNombre: string | null;
}

function formatMoneda(valor: number | string): string {
  return Number(valor).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatFecha(fecha: string): string {
  return new Date(fecha).toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function PasivosCliente({ pasivos }: { pasivos: PasivoListado[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button render={<Link href="/app/patrimonio/pasivos/nuevo" />} nativeButton={false}>
          <Plus className="size-4" />
          Nuevo pasivo
        </Button>
      </div>

      {pasivos.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="Todavía no cargaste ningún pasivo"
          description="Registrá las deudas u obligaciones financieras del negocio, estén o no atadas a un activo."
          action={{ label: "Cargar pasivo", href: "/app/patrimonio/pasivos/nuevo" }}
        />
      ) : (
        <div className="divide-y divide-gray-border rounded-2xl bg-card shadow-card">
          {pasivos.map((pasivo) => {
            const badge = BADGE_ESTADO[pasivo.estado];
            return (
              <Link
                key={pasivo.id}
                href={`/app/patrimonio/pasivos/${pasivo.id}`}
                className="flex items-center gap-3 p-4 text-sm hover:bg-gray-bg"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-pastel-blue-bg text-primary">
                  <Landmark className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-text-body">{pasivo.activoNombre ?? "Sin activo asociado"}</p>
                  <p className="truncate text-xs text-text-muted">
                    Monto original {formatMoneda(pasivo.montoTotal)} · Desde {formatFecha(pasivo.fechaInicio)}
                  </p>
                </div>
                <div className="w-32 shrink-0 text-right">
                  <p className="text-xs text-text-muted">Saldo pendiente</p>
                  <p className="font-semibold text-navy">{formatMoneda(pasivo.saldoPendiente)}</p>
                </div>
                <Badge variant={badge.variant}>{badge.label}</Badge>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
