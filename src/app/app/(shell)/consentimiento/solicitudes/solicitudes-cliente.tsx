"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/page-header";
import { SwitchRow } from "@/components/ui/switch-row";
import { NavConsentimiento, MODULOS_VEEDOR_INFO } from "../generar-cliente";
import { aprobarSolicitudAction, rechazarSolicitudAction } from "../actions";

type ModuloVeedor = "financiero" | "operativo" | "inventario_operativo";

interface FilaSolicitud {
  id: string;
  institucionNombre: string;
  modulosSolicitados: ModuloVeedor[];
  estado: "pendiente" | "aprobada" | "rechazada";
  creadoEn: string | Date;
}

const BADGE_ESTADO: Record<FilaSolicitud["estado"], { label: string; variant: "warning" | "success" | "error" }> = {
  pendiente: { label: "Pendiente", variant: "warning" },
  aprobada: { label: "Aprobada", variant: "success" },
  rechazada: { label: "Rechazada", variant: "error" },
};

function formatoFecha(fecha: string | Date): string {
  return new Date(fecha).toLocaleDateString("es-BO", { day: "2-digit", month: "short", year: "numeric" });
}

export function SolicitudesCliente({ filas }: { filas: FilaSolicitud[] }) {
  const router = useRouter();
  const [solicitudAprobando, setSolicitudAprobando] = useState<FilaSolicitud | null>(null);
  const [rechazandoId, setRechazandoId] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmarRechazar(solicitudId: string) {
    setProcesando(true);
    setError(null);
    const resultado = await rechazarSolicitudAction(solicitudId);
    setProcesando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    setRechazandoId(null);
    router.refresh();
  }

  const pendientes = filas.filter((f) => f.estado === "pendiente");
  const resueltas = filas.filter((f) => f.estado !== "pendiente");

  return (
    <div className="space-y-4">
      <PageHeader
        title="Solicitudes de Seguimiento entrantes"
        description="Instituciones que pidieron seguimiento de tu negocio — vos decidís qué módulos aprobar."
      />
      <NavConsentimiento activo="solicitudes" />

      {error && <p className="text-xs text-error-text">{error}</p>}

      <div className="divide-y divide-gray-border rounded-2xl bg-card shadow-card">
        {pendientes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center">
            <span className="flex size-9 items-center justify-center rounded-lg bg-pastel-blue-bg text-primary">
              <Inbox className="size-4" />
            </span>
            <p className="text-sm text-text-muted">No tenés solicitudes pendientes.</p>
          </div>
        ) : (
          pendientes.map((fila) => (
            <div key={fila.id} className="flex items-center gap-3 p-4 text-sm">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-navy">{fila.institucionNombre}</p>
                  <Badge variant="warning">Pendiente</Badge>
                </div>
                <p className="mt-0.5 text-xs text-text-muted">
                  Solicita: {fila.modulosSolicitados.map((m) => MODULOS_VEEDOR_INFO[m].label).join(", ")} ·{" "}
                  {formatoFecha(fila.creadoEn)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {rechazandoId === fila.id ? (
                  <>
                    <Button variant="destructive" size="sm" onClick={() => confirmarRechazar(fila.id)} disabled={procesando}>
                      Sí, rechazar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setRechazandoId(null)}>
                      Cancelar
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setRechazandoId(fila.id)}>
                      Rechazar
                    </Button>
                    <Button size="sm" onClick={() => setSolicitudAprobando(fila)}>
                      Aprobar
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {resueltas.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-text-muted uppercase">Historial</p>
          <div className="divide-y divide-gray-border rounded-2xl bg-card shadow-card">
            {resueltas.map((fila) => {
              const badge = BADGE_ESTADO[fila.estado];
              return (
                <div key={fila.id} className="flex items-center gap-3 p-4 text-sm opacity-70">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-navy">{fila.institucionNombre}</p>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-text-muted">
                      Solicitó: {fila.modulosSolicitados.map((m) => MODULOS_VEEDOR_INFO[m].label).join(", ")} ·{" "}
                      {formatoFecha(fila.creadoEn)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {solicitudAprobando && (
        <AprobarSolicitudDialog
          solicitud={solicitudAprobando}
          onOpenChange={(v) => !v && setSolicitudAprobando(null)}
          onAprobado={() => {
            setSolicitudAprobando(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function AprobarSolicitudDialog({
  solicitud,
  onOpenChange,
  onAprobado,
}: {
  solicitud: FilaSolicitud;
  onOpenChange: (open: boolean) => void;
  onAprobado: () => void;
}) {
  const [seleccionados, setSeleccionados] = useState<ModuloVeedor[]>(solicitud.modulosSolicitados);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(modulo: ModuloVeedor) {
    setSeleccionados((prev) => (prev.includes(modulo) ? prev.filter((m) => m !== modulo) : [...prev, modulo]));
  }

  async function confirmar() {
    if (seleccionados.length === 0) {
      setError("Elegí al menos un módulo para aprobar.");
      return;
    }
    setGuardando(true);
    setError(null);
    const resultado = await aprobarSolicitudAction(solicitud.id, { modulosAprobados: seleccionados });
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    onAprobado();
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aprobar solicitud de {solicitud.institucionNombre}</DialogTitle>
          <DialogDescription>
            Elegí qué módulos aprobar — podés otorgar menos de lo solicitado, nunca más.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {solicitud.modulosSolicitados.map((modulo) => {
            const info = MODULOS_VEEDOR_INFO[modulo];
            return (
              <SwitchRow
                key={modulo}
                checked={seleccionados.includes(modulo)}
                onCheckedChange={() => toggle(modulo)}
                label={info.label}
                description={info.descripcion}
                icon={info.icon}
              />
            );
          })}
        </div>

        {error && <p className="text-xs text-error-text">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={guardando}>
            {guardando ? "Guardando..." : "Aprobar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
