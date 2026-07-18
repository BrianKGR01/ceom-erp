"use client";

import { useState } from "react";
import { ListChecks } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { listarLogsAccesoAction } from "./actions";

type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

interface FilaLog {
  usuarioCeomId: string;
  tenantId: string;
  moduloConsultado: string;
  creadoEn: string | Date;
}

function formatoModulo(modulo: string): string {
  return modulo.charAt(0).toUpperCase() + modulo.slice(1).replaceAll("_", " ");
}

function formatoFechaHora(fecha: string | Date): string {
  return new Date(fecha).toLocaleString("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function LogsCliente({
  datosIniciales,
  tenants,
}: {
  datosIniciales: Resultado<FilaLog[]>;
  tenants: { id: string; nombreNegocio: string }[];
}) {
  const [tenantId, setTenantId] = useState("todos");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [datos, setDatos] = useState(datosIniciales);
  const [cargando, setCargando] = useState(false);

  async function recargar(nuevoTenantId: string, nuevoDesde: string, nuevoHasta: string) {
    setCargando(true);
    const resultado = await listarLogsAccesoAction({
      tenantId: nuevoTenantId !== "todos" ? nuevoTenantId : undefined,
      desde: nuevoDesde || undefined,
      hasta: nuevoHasta || undefined,
    });
    setCargando(false);
    setDatos(resultado);
  }

  const tenantNombre = new Map(tenants.map((t) => [t.id, t.nombreNegocio]));
  const filas = datos.ok ? datos.data : [];

  return (
    <div className="space-y-4">
      <PageHeader title="Logs de Acceso" description="Auditoría interna de consultas de ceom_admin a datos de un tenant. Nunca visible para el tenant." />

      <div className="flex flex-wrap items-center gap-2">
        {tenants.length > 0 && (
          <Select
            items={{ todos: "Todos los tenants", ...Object.fromEntries(tenants.map((t) => [t.id, t.nombreNegocio])) }}
            value={tenantId}
            onValueChange={(v) => {
              if (!v) return;
              setTenantId(v);
              recargar(v, desde, hasta);
            }}
          >
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los tenants</SelectItem>
              {tenants.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.nombreNegocio}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="flex items-center gap-1.5">
          <Label htmlFor="desde" className="text-xs text-text-muted">Desde</Label>
          <Input
            id="desde"
            type="date"
            value={desde}
            onChange={(e) => {
              setDesde(e.target.value);
              recargar(tenantId, e.target.value, hasta);
            }}
            className="w-40"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Label htmlFor="hasta" className="text-xs text-text-muted">Hasta</Label>
          <Input
            id="hasta"
            type="date"
            value={hasta}
            onChange={(e) => {
              setHasta(e.target.value);
              recargar(tenantId, desde, e.target.value);
            }}
            className="w-40"
          />
        </div>
      </div>

      <div className={cn("rounded-2xl bg-card shadow-card transition-opacity", cargando && "opacity-60")}>
        {!datos.ok ? (
          <p className="p-5 text-sm text-error-text">{datos.error}</p>
        ) : filas.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center">
            <span className="flex size-9 items-center justify-center rounded-lg bg-pastel-blue-bg text-primary">
              <ListChecks className="size-4" />
            </span>
            <p className="text-sm text-text-muted">Sin accesos registrados en este filtro.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-border text-left text-[11px] tracking-wide text-text-muted uppercase">
                <th className="px-5 py-3 font-medium">Tenant</th>
                <th className="px-5 py-3 font-medium">Módulo consultado</th>
                <th className="px-5 py-3 font-medium">Usuario CEOM</th>
                <th className="px-5 py-3 text-right font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((fila, index) => (
                <tr key={`${fila.tenantId}-${fila.creadoEn}-${index}`} className="border-b border-gray-border last:border-0">
                  <td className="px-5 py-3 font-medium text-navy">{tenantNombre.get(fila.tenantId) ?? "Tenant"}</td>
                  <td className="px-5 py-3 text-text-body">{formatoModulo(fila.moduloConsultado)}</td>
                  <td className="px-5 py-3 font-mono text-xs text-text-muted">{fila.usuarioCeomId.slice(0, 8)}…</td>
                  <td className="px-5 py-3 text-right text-text-muted">{formatoFechaHora(fila.creadoEn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
