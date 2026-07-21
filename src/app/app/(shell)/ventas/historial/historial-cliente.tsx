"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup } from "@/components/ui/toggle-group";

type EstadoPago = "pendiente" | "parcial" | "pagado";

export interface VentaListado {
  id: string;
  fechaVenta: string;
  clienteNombre: string;
  canalId: string;
  canalNombre: string;
  estadoPago: EstadoPago;
  total: number;
}

const BADGE_ESTADO: Record<EstadoPago, "success" | "warning" | "info"> = {
  pagado: "success",
  parcial: "warning",
  pendiente: "info",
};

const LABEL_ESTADO: Record<EstadoPago, string> = {
  pagado: "Pagado",
  parcial: "Pago parcial",
  pendiente: "Pendiente de cobro",
};

const POR_PAGINA = 10;

export function HistorialCliente({
  ventas,
  canales,
}: {
  ventas: VentaListado[];
  canales: { id: string; nombre: string }[];
}) {
  const [busqueda, setBusqueda] = useState("");
  const [canalId, setCanalId] = useState<string>("todos");
  const [estado, setEstado] = useState<"todas" | EstadoPago>("todas");
  const [pagina, setPagina] = useState(1);

  const filtradas = ventas
    .filter((v) => estado === "todas" || v.estadoPago === estado)
    .filter((v) => canalId === "todos" || v.canalId === canalId)
    .filter((v) => v.clienteNombre.toLowerCase().includes(busqueda.trim().toLowerCase()));

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = filtradas.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);

  function actualizarFiltro<T>(setter: (v: T) => void, valor: T) {
    setter(valor);
    setPagina(1);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <ToggleGroup
            value={estado}
            onValueChange={(v) => actualizarFiltro(setEstado, v)}
            options={[
              { value: "todas", label: "Todas" },
              ...((Object.keys(LABEL_ESTADO) as EstadoPago[]).map((e) => ({
                value: e,
                label: LABEL_ESTADO[e],
              }))),
            ]}
          />
          {canales.length > 0 && (
            <Select
              items={{
                todos: "Todos los canales",
                ...Object.fromEntries(canales.map((c) => [c.id, c.nombre])),
              }}
              value={canalId}
              onValueChange={(v) => v && actualizarFiltro(setCanalId, v)}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los canales</SelectItem>
                {canales.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="relative sm:w-56">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-muted" />
          <Input
            placeholder="Buscar cliente..."
            value={busqueda}
            onChange={(e) => actualizarFiltro(setBusqueda, e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <div className="divide-y divide-gray-border rounded-2xl bg-card shadow-card">
        {visibles.length === 0 && (
          <p className="p-6 text-center text-sm text-text-muted">No hay ventas para mostrar.</p>
        )}
        {visibles.map((venta) => (
          <Link
            key={venta.id}
            href={`/app/ventas/${venta.id}`}
            className="flex items-center gap-3 p-4 text-sm hover:bg-gray-bg"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-pastel-blue-bg text-xs font-semibold text-primary">
              {venta.clienteNombre.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-text-body">{venta.clienteNombre}</p>
              <p className="text-xs text-text-muted">
                {new Date(venta.fechaVenta).toLocaleDateString("es-BO")} · {venta.canalNombre}
              </p>
            </div>
            <Badge variant={BADGE_ESTADO[venta.estadoPago]}>{LABEL_ESTADO[venta.estadoPago]}</Badge>
            <span className="w-20 text-right font-medium text-navy">
              {venta.total.toFixed(2)}
            </span>
          </Link>
        ))}
      </div>

      {filtradas.length > POR_PAGINA && (
        <div className="flex items-center justify-between text-sm text-text-muted">
          <span>
            Mostrando {(paginaActual - 1) * POR_PAGINA + 1}-
            {Math.min(paginaActual * POR_PAGINA, filtradas.length)} de {filtradas.length} ventas
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={paginaActual === 1}
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              className="rounded-lg px-2 py-1 hover:bg-gray-bg disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="px-2 font-medium text-navy">
              {paginaActual} / {totalPaginas}
            </span>
            <button
              type="button"
              disabled={paginaActual === totalPaginas}
              onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
              className="rounded-lg px-2 py-1 hover:bg-gray-bg disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
