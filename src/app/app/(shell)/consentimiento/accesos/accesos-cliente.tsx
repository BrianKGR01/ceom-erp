"use client";

import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { MODULOS_VEEDOR_INFO, NavConsentimiento } from "../generar-cliente";

interface FilaAcceso {
  id: string;
  institucion: string;
  modulo: "financiero" | "operativo" | "inventario_operativo";
  dia: string;
  consultas: number;
  ultimaConsultaEn: string;
}

function formatoDia(dia: string): string {
  // `dia` ya viene como día local del negocio (YYYY-MM-DD): se parsea a mano
  // para no re-interpretarlo en la zona del navegador y correrlo un día.
  const [a, m, d] = dia.split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * D-1 — "Quién miró": el registro de acceso institucional, del lado del negocio.
 *
 * **Para qué existe.** Hasta la tanda 3.3b el Owner revocaba un consentimiento
 * a ciegas: no sabía si la institución había mirado sus números alguna vez, ni
 * cuándo, ni qué. Y si preguntaba "¿qué vio la incubadora?", no había respuesta
 * posible. Esta pantalla es el dato que vuelve **informada** la revocación —
 * por eso vive al lado de Aprobaciones y no en un rincón de auditoría.
 */
export function AccesosCliente({ filas, error }: { filas: FilaAcceso[]; error?: string }) {
  const totalConsultas = filas.reduce((acc, f) => acc + f.consultas, 0);
  const instituciones = new Set(filas.map((f) => f.institucion)).size;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Quién miró tu información"
        description="Qué consultó cada institución de tu negocio, y cuándo."
      />
      <NavConsentimiento activo="accesos" />

      {error && <p className="text-xs text-error-text">{error}</p>}

      {filas.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-card p-4 shadow-card">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-pastel-blue-bg text-primary">
            <Eye className="size-5" />
          </span>
          <p className="text-sm text-text-body">
            <strong className="text-navy">{instituciones}</strong>{" "}
            {instituciones === 1 ? "institución consultó" : "instituciones consultaron"} tu
            información <strong className="text-navy">{totalConsultas}</strong>{" "}
            {totalConsultas === 1 ? "vez" : "veces"}.{" "}
            <span className="text-text-muted">
              Podés cortarle el acceso a cualquiera desde Aprobaciones, cuando quieras y sin avisar.
            </span>
          </p>
        </div>
      )}

      <div className="divide-y divide-gray-border rounded-2xl bg-card shadow-card">
        {filas.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-text-muted">
              Todavía ninguna institución consultó tu información.
            </p>
            {/* Que esté vacío puede significar dos cosas muy distintas, y el
                dueño necesita poder distinguirlas antes de sacar conclusiones. */}
            <p className="mt-1 text-xs text-text-muted">
              Si le diste acceso a alguna, esto quiere decir que todavía no entró a mirar — no que no
              pueda.
            </p>
          </div>
        ) : (
          filas.map((fila) => (
            <div key={fila.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-navy">{fila.institucion}</p>
                <p className="mt-0.5 text-xs text-text-muted">
                  {MODULOS_VEEDOR_INFO[fila.modulo].label} · {formatoDia(fila.dia)}
                </p>
              </div>
              <Badge variant="info">
                {fila.consultas} {fila.consultas === 1 ? "consulta" : "consultas"}
              </Badge>
            </div>
          ))
        )}
      </div>

      <p className="text-xs text-text-muted">
        Se registra <strong>qué tipo de información</strong> consultó cada institución y en qué día,
        no los números que vio. Varias consultas del mismo tipo en el mismo día se agrupan en una
        línea.
      </p>
    </div>
  );
}
