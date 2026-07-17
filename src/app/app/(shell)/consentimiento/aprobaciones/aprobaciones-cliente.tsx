"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { NavConsentimiento, MODULOS_VEEDOR_INFO } from "../generar-cliente";
import { revocarConsentimientoAction } from "../actions";

interface FilaAprobacion {
  id: string;
  institucionId: string;
  institucionNombre: string;
  modulosAprobados: ("financiero" | "operativo" | "inventario_operativo")[];
  fechaAprobacion: string | Date;
  revocadoEn: string | Date | null;
  esLaMasReciente: boolean;
}

function formatoFecha(fecha: string | Date): string {
  return new Date(fecha).toLocaleDateString("es-BO", { day: "2-digit", month: "short", year: "numeric" });
}

export function AprobacionesCliente({ filas: filasIniciales }: { filas: FilaAprobacion[] }) {
  const router = useRouter();
  const [revocandoId, setRevocandoId] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmarRevocar(aprobacionId: string) {
    setProcesando(true);
    setError(null);
    const resultado = await revocarConsentimientoAction(aprobacionId);
    setProcesando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    setRevocandoId(null);
    router.refresh();
  }

  // Mas recientes primero, agrupado visualmente por fecha de aprobacion.
  const filas = [...filasIniciales].sort(
    (a, b) => new Date(b.fechaAprobacion).getTime() - new Date(a.fechaAprobacion).getTime()
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Aprobaciones/Consentimientos vigentes"
        description="Quién tiene acceso hoy a datos de tu negocio, y el historial de accesos anteriores."
      />
      <NavConsentimiento activo="aprobaciones" />

      {error && <p className="text-xs text-error-text">{error}</p>}

      <div className="divide-y divide-gray-border rounded-2xl bg-card shadow-card">
        {filas.length === 0 ? (
          <p className="p-8 text-center text-sm text-text-muted">
            Todavía nadie canjeó un código de acceso a tu negocio.
          </p>
        ) : (
          filas.map((fila) => {
            const vigente = fila.esLaMasReciente && !fila.revocadoEn;
            const estado = fila.revocadoEn
              ? { label: "Revocada", variant: "error" as const }
              : fila.esLaMasReciente
                ? { label: "Vigente", variant: "success" as const }
                : { label: "Histórica", variant: "outline" as const };
            return (
              <div key={fila.id} className="flex items-center gap-3 p-4 text-sm">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-pastel-blue-bg text-primary">
                  <ShieldCheck className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-navy">{fila.institucionNombre}</p>
                    <Badge variant={estado.variant}>{estado.label}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {fila.modulosAprobados.map((m) => MODULOS_VEEDOR_INFO[m].label).join(", ")} · aprobado{" "}
                    {formatoFecha(fila.fechaAprobacion)}
                    {fila.revocadoEn && ` · revocado ${formatoFecha(fila.revocadoEn)}`}
                  </p>
                </div>
                {vigente &&
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
