"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Receipt, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GestionarCategoriasGastoBoton,
  type CategoriaGasto,
  type CategoriaGastoSugerida,
} from "./gestionar-categorias-dialog";

type TipoGasto = "fijo" | "variable_no_productivo" | "unico";
type EstadoPagoGasto = "pendiente" | "parcial" | "pagado";
type OrigenGasto = "manual" | "comision_venta_automatica" | "cuota_pasivo_automatica";

const BADGE_TIPO: Record<TipoGasto, { variant: "info" | "warning" | "outline"; label: string }> = {
  fijo: { variant: "info", label: "Fijo" },
  variable_no_productivo: { variant: "outline", label: "Variable" },
  unico: { variant: "warning", label: "Único" },
};

const BADGE_PAGO: Record<EstadoPagoGasto, { variant: "error" | "warning" | "success"; label: string }> = {
  pendiente: { variant: "error", label: "Pendiente" },
  parcial: { variant: "warning", label: "Parcial" },
  pagado: { variant: "success", label: "Pagado" },
};

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

export interface GastoListado {
  id: string;
  categoriaId: string;
  categoriaNombre: string;
  tipo: TipoGasto;
  monto: string;
  fechaGasto: string;
  proveedorNombre: string | null;
  estadoPago: EstadoPagoGasto;
  origen: OrigenGasto;
}

const POR_PAGINA = 10;

export function GastosCliente({
  gastos,
  categorias,
  categoriasSugeridas,
}: {
  gastos: GastoListado[];
  categorias: CategoriaGasto[];
  categoriasSugeridas: CategoriaGastoSugerida[];
}) {
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroPago, setFiltroPago] = useState("todos");
  const [limite, setLimite] = useState(POR_PAGINA);

  const hayFiltros = filtroCategoria !== "todas" || filtroTipo !== "todos" || filtroPago !== "todos";

  function limpiarFiltros() {
    setFiltroCategoria("todas");
    setFiltroTipo("todos");
    setFiltroPago("todos");
    setLimite(POR_PAGINA);
  }

  const filtrados = gastos.filter((g) => {
    if (filtroCategoria !== "todas" && g.categoriaId !== filtroCategoria) return false;
    if (filtroTipo !== "todos" && g.tipo !== filtroTipo) return false;
    if (filtroPago !== "todos" && g.estadoPago !== filtroPago) return false;
    return true;
  });
  const visibles = filtrados.slice(0, limite);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Gastos"
        description="Gestioná y analizá los egresos del negocio."
        action={
          <div className="flex items-center gap-2">
            <Button render={<Link href="/app/gastos/recurrentes" />} nativeButton={false} variant="outline">
              <RefreshCw className="size-4" />
              Recurrentes
            </Button>
            <GestionarCategoriasGastoBoton categorias={categorias} categoriasSugeridas={categoriasSugeridas} />
            <Button render={<Link href="/app/gastos/nuevo" />} nativeButton={false}>
              <Plus className="size-4" />
              Nuevo gasto
            </Button>
          </div>
        }
      />

      {gastos.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Todavía no registraste ningún gasto"
          description="Cargá los costos fijos, variables o únicos de tu negocio para llevar el control de egresos."
          action={{ label: "Registrar gasto", href: "/app/gastos/nuevo" }}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              items={{ todas: "Categoría", ...Object.fromEntries(categorias.map((c) => [c.id, c.nombre])) }}
              value={filtroCategoria}
              onValueChange={(v) => v && setFiltroCategoria(v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Categoría: Todas</SelectItem>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              items={{
                todos: "Tipo de Gasto",
                fijo: "Fijo",
                variable_no_productivo: "Var. No Productivo",
                unico: "Único",
              }}
              value={filtroTipo}
              onValueChange={(v) => v && setFiltroTipo(v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Tipo de Gasto: Todos</SelectItem>
                <SelectItem value="fijo">Fijo</SelectItem>
                <SelectItem value="variable_no_productivo">Var. No Productivo</SelectItem>
                <SelectItem value="unico">Único</SelectItem>
              </SelectContent>
            </Select>

            <Select
              items={{ todos: "Estado de Pago", pendiente: "Pendiente", parcial: "Parcial", pagado: "Pagado" }}
              value={filtroPago}
              onValueChange={(v) => v && setFiltroPago(v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Estado de Pago: Todos</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="parcial">Parcial</SelectItem>
                <SelectItem value="pagado">Pagado</SelectItem>
              </SelectContent>
            </Select>

            {hayFiltros && (
              <button
                type="button"
                onClick={limpiarFiltros}
                className="text-xs font-medium text-primary hover:underline"
              >
                Limpiar filtros
              </button>
            )}
          </div>

          {filtrados.length === 0 ? (
            <p className="rounded-2xl bg-card p-6 text-center text-sm text-text-muted shadow-card">
              Ningún gasto coincide con estos filtros.
            </p>
          ) : (
            <div className="divide-y divide-gray-border rounded-2xl bg-card shadow-card">
              {visibles.map((gasto) => (
                <Link
                  key={gasto.id}
                  href={`/app/gastos/${gasto.id}`}
                  className="flex items-center gap-3 p-4 text-sm hover:bg-gray-bg"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-text-body">{gasto.categoriaNombre}</p>
                    <p className="truncate text-xs text-text-muted">
                      {formatFecha(gasto.fechaGasto)}
                      {gasto.proveedorNombre ? ` · ${gasto.proveedorNombre}` : ""}
                    </p>
                  </div>
                  <span className="w-24 shrink-0 text-right font-semibold text-navy">
                    {formatMoneda(gasto.monto)}
                  </span>
                  <Badge variant={BADGE_TIPO[gasto.tipo].variant}>{BADGE_TIPO[gasto.tipo].label}</Badge>
                  <Badge variant={BADGE_PAGO[gasto.estadoPago].variant}>
                    {BADGE_PAGO[gasto.estadoPago].label}
                  </Badge>
                  <Badge variant="outline">{gasto.origen === "manual" ? "Manual" : "Automático"}</Badge>
                </Link>
              ))}
            </div>
          )}

          {filtrados.length > limite && (
            <div className="text-center">
              <Button variant="outline" onClick={() => setLimite((l) => l + POR_PAGINA)}>
                Cargar más gastos
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
