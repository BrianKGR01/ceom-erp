"use client";

import { useState } from "react";
import Link from "next/link";
import { Calculator, Gauge, History, Percent, Scale, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listarSimulacionesAction } from "../actions";

type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

interface FilaSimulacion {
  id: string;
  productoId: string;
  tipo: "simular_precio" | "punto_equilibrio";
  frecuencia: string;
  periodo: string;
  margenDeseadoPct: string | null;
  costoUsado: string;
  costoEsManual: boolean;
  precioSugerido: string | null;
  impactoProyectadoBs: string | null;
  puntoEquilibrioUnidades: string | null;
  creadoEn: string | Date;
}

function formatoMoneda(valor: number): string {
  return valor.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatoFecha(fecha: string | Date): string {
  return new Date(fecha).toLocaleDateString("es-BO", { day: "2-digit", month: "short", year: "numeric" });
}

function formatoPeriodo(periodo: string): string {
  const [desde, hasta] = periodo.split("..");
  if (!desde || !hasta) return periodo;
  const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" };
  return `${new Date(desde).toLocaleDateString("es-BO", opts)} — ${new Date(hasta).toLocaleDateString("es-BO", opts)}`;
}

function NavSimulaciones({ activo }: { activo: "simulador" | "comparativo" | "historial" | "margen" }) {
  const items = [
    { href: "/app/simulaciones", key: "simulador", label: "Simulador", icon: Calculator },
    { href: "/app/simulaciones/comparativo", key: "comparativo", label: "Comparativo Multi-SKU", icon: Scale },
    { href: "/app/simulaciones/historial", key: "historial", label: "Historial", icon: History },
    { href: "/app/simulaciones/margen-producto", key: "margen", label: "Margen por Producto", icon: Percent },
  ] as const;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Button
          key={item.key}
          render={<Link href={item.href} />}
          nativeButton={false}
          variant={activo === item.key ? "default" : "outline"}
        >
          <item.icon className="size-4" />
          {item.label}
        </Button>
      ))}
    </div>
  );
}

export function HistorialCliente({
  datosIniciales,
  productos,
}: {
  datosIniciales: Resultado<FilaSimulacion[]>;
  productos: { id: string; nombre: string }[];
}) {
  const [productoId, setProductoId] = useState("todos");
  const [datos, setDatos] = useState(datosIniciales);
  const [cargando, setCargando] = useState(false);

  async function filtrar(nuevoProductoId: string) {
    setCargando(true);
    const resultado = await listarSimulacionesAction(
      nuevoProductoId !== "todos" ? nuevoProductoId : undefined
    );
    setCargando(false);
    setDatos(resultado);
  }

  const productoNombre = new Map(productos.map((p) => [p.id, p.nombre]));
  const filas = datos.ok ? datos.data : [];

  return (
    <div className="space-y-4">
      <PageHeader title="Historial de Simulaciones" description="Todas las simulaciones guardadas, para comparar en el tiempo." />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <NavSimulaciones activo="historial" />
        {productos.length > 0 && (
          <Select
            items={{ todos: "Todos los productos", ...Object.fromEntries(productos.map((p) => [p.id, p.nombre])) }}
            value={productoId}
            onValueChange={(v) => {
              if (!v) return;
              setProductoId(v);
              filtrar(v);
            }}
          >
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los productos</SelectItem>
              {productos.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="divide-y divide-gray-border rounded-2xl bg-card shadow-card transition-opacity" style={{ opacity: cargando ? 0.6 : 1 }}>
        {!datos.ok ? (
          <p className="p-5 text-sm text-error-text">{datos.error}</p>
        ) : filas.length === 0 ? (
          <p className="p-8 text-center text-sm text-text-muted">Todavía no guardaste ninguna simulación.</p>
        ) : (
          filas.map((fila) => (
            <div key={fila.id} className="flex items-center gap-3 p-4 text-sm">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-pastel-blue-bg text-primary">
                {fila.tipo === "simular_precio" ? <TrendingUp className="size-4" /> : <Gauge className="size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium text-navy">
                    {productoNombre.get(fila.productoId) ?? "Producto"}
                  </p>
                  <Badge variant={fila.tipo === "simular_precio" ? "info" : "outline"}>
                    {fila.tipo === "simular_precio" ? "Simular Precio" : "Punto de Equilibrio"}
                  </Badge>
                  {fila.costoEsManual && <Badge variant="warning">Costo manual</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-text-muted">
                  {fila.frecuencia === "semanal" ? "Semanal" : "Mensual"} · {formatoPeriodo(fila.periodo)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                {fila.tipo === "simular_precio" ? (
                  <>
                    <p className="font-medium text-navy">
                      {fila.precioSugerido !== null ? formatoMoneda(Number(fila.precioSugerido)) : "—"}
                    </p>
                    <p className="text-xs text-text-muted">
                      {fila.impactoProyectadoBs !== null
                        ? `${Number(fila.impactoProyectadoBs) >= 0 ? "+" : ""}${formatoMoneda(Number(fila.impactoProyectadoBs))}`
                        : "Sin impacto proyectado"}
                    </p>
                  </>
                ) : (
                  <p className="font-medium text-navy">
                    {fila.puntoEquilibrioUnidades !== null
                      ? `${Number(fila.puntoEquilibrioUnidades).toFixed(0)} un.`
                      : "Sin punto de equilibrio"}
                  </p>
                )}
                <p className="mt-0.5 text-[11px] text-text-muted">{formatoFecha(fila.creadoEn)}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
