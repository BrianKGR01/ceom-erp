"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { NavConsentimiento, MODULOS_VEEDOR_INFO } from "../generar-cliente";
import { revocarCodigoAccesoAction } from "../actions";

type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

interface FilaCodigo {
  id: string;
  codigo: string;
  modulosHabilitados: ("financiero" | "operativo" | "inventario_operativo")[];
  estado: "activo" | "canjeado" | "revocado";
  creadoEn: string | Date;
  canjeadoEn: string | Date | null;
  revocadoEn: string | Date | null;
}

const BADGE_ESTADO: Record<FilaCodigo["estado"], { label: string; variant: "success" | "info" | "error" }> = {
  activo: { label: "Activo", variant: "success" },
  canjeado: { label: "Canjeado", variant: "info" },
  revocado: { label: "Revocado", variant: "error" },
};

function formatoFecha(fecha: string | Date): string {
  return new Date(fecha).toLocaleDateString("es-BO", { day: "2-digit", month: "short", year: "numeric" });
}

export function CodigosCliente({ datosIniciales }: { datosIniciales: Resultado<FilaCodigo[]> }) {
  const router = useRouter();
  const [revocandoId, setRevocandoId] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filas = datosIniciales.ok ? datosIniciales.data : [];

  async function confirmarRevocar(codigoAccesoId: string) {
    setProcesando(true);
    setError(null);
    const resultado = await revocarCodigoAccesoAction(codigoAccesoId);
    setProcesando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    setRevocandoId(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Códigos de Acceso generados" description="Códigos temporales para compartir datos de tu negocio." />
      <NavConsentimiento activo="codigos" />

      {error && <p className="text-xs text-error-text">{error}</p>}

      <div className="divide-y divide-gray-border rounded-2xl bg-card shadow-card">
        {!datosIniciales.ok ? (
          <p className="p-5 text-sm text-error-text">{datosIniciales.error}</p>
        ) : filas.length === 0 ? (
          <p className="p-8 text-center text-sm text-text-muted">Todavía no generaste ningún código.</p>
        ) : (
          filas.map((fila) => {
            const badge = BADGE_ESTADO[fila.estado];
            return (
              <div key={fila.id} className="flex items-center gap-3 p-4 text-sm">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-pastel-blue-bg text-primary">
                  <KeyRound className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-heading font-semibold tracking-widest text-navy">{fila.codigo}</p>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {fila.modulosHabilitados.map((m) => MODULOS_VEEDOR_INFO[m].label).join(", ")} · generado{" "}
                    {formatoFecha(fila.creadoEn)}
                    {fila.canjeadoEn && ` · canjeado ${formatoFecha(fila.canjeadoEn)}`}
                    {fila.revocadoEn && ` · revocado ${formatoFecha(fila.revocadoEn)}`}
                  </p>
                </div>
                {fila.estado !== "revocado" &&
                  (revocandoId === fila.id ? (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button variant="destructive" size="sm" onClick={() => confirmarRevocar(fila.id)} disabled={procesando}>
                        Sí, revocar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setRevocandoId(null)}>
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-error-text"
                      onClick={() => {
                        setError(null);
                        setRevocandoId(fila.id);
                      }}
                    >
                      Revocar
                    </Button>
                  ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
