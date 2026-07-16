"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type EstadoPago = "pendiente" | "parcial" | "pagado";

export interface VentaListado {
  id: string;
  fechaVenta: string;
  clienteNombre: string;
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

export function HistorialCliente({ ventas }: { ventas: VentaListado[] }) {
  const [filtro, setFiltro] = useState<"todas" | EstadoPago>("todas");

  const filtradas = filtro === "todas" ? ventas : ventas.filter((v) => v.estadoPago === filtro);

  return (
    <div className="space-y-4">
      <Select
        items={{
          todas: "Todas",
          pendiente: "Pendientes de cobro",
          parcial: "Pago parcial",
          pagado: "Pagadas",
        }}
        value={filtro}
        onValueChange={(v) => v && setFiltro(v as typeof filtro)}
      >
        <SelectTrigger className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Todas</SelectItem>
          <SelectItem value="pendiente">Pendientes de cobro</SelectItem>
          <SelectItem value="parcial">Pago parcial</SelectItem>
          <SelectItem value="pagado">Pagadas</SelectItem>
        </SelectContent>
      </Select>

      <div className="divide-y divide-gray-border rounded-2xl bg-card shadow-card">
        {filtradas.length === 0 && (
          <p className="p-6 text-center text-sm text-text-muted">No hay ventas para mostrar.</p>
        )}
        {filtradas.map((venta) => (
          <Link
            key={venta.id}
            href={`/app/ventas/${venta.id}`}
            className="flex items-center justify-between gap-3 p-4 text-sm hover:bg-gray-bg"
          >
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
    </div>
  );
}
