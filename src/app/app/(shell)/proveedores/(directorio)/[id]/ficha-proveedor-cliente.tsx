"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, History, Pencil, Tag, Trash2, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { FormError } from "@/components/ui/form-error";
import {
  ProveedorFormDialog,
  type ProveedorEditable,
} from "../../proveedor-form-dialog";
import { eliminarProveedorAction } from "../../actions";

type EstadoCompra = "pedido" | "recibido";
type EstadoPagoCompra = "pendiente" | "parcial" | "pagado";

const BADGE_ESTADO: Record<EstadoCompra, { variant: "warning" | "success"; label: string }> = {
  pedido: { variant: "warning", label: "Pedido" },
  recibido: { variant: "success", label: "Recibido" },
};

const BADGE_PAGO: Record<EstadoPagoCompra, { variant: "error" | "warning" | "success"; label: string }> = {
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

export interface CompraDeProveedor {
  id: string;
  itemNombre: string;
  cantidad: string;
  costoUnitario: string;
  montoTotal: string;
  fechaCompra: string;
  estado: EstadoCompra;
  estadoPago: EstadoPagoCompra;
}

export function FichaProveedorCliente({
  proveedor,
  cantidadCompras,
  montoTotalComprado,
  compras,
}: {
  proveedor: ProveedorEditable;
  cantidadCompras: number;
  montoTotalComprado: number;
  compras: CompraDeProveedor[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"compras" | "precios">("compras");
  const [dialogoEditar, setDialogoEditar] = useState(false);
  const [confirmandoBaja, setConfirmandoBaja] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Historial de precios: mismas compras agrupadas por item, mas reciente
  // primero — no hay una accion aparte para esto, se deriva de los mismos
  // datos que ya trae fichaProveedor().compras.
  const precioPorItem = useMemo(() => {
    const grupos = new Map<string, CompraDeProveedor[]>();
    for (const compra of compras) {
      const lista = grupos.get(compra.itemNombre) ?? [];
      lista.push(compra);
      grupos.set(compra.itemNombre, lista);
    }
    return Array.from(grupos.entries()).map(([itemNombre, filas]) => ({
      itemNombre,
      filas: [...filas].sort((a, b) => (a.fechaCompra < b.fechaCompra ? 1 : -1)),
    }));
  }, [compras]);

  async function confirmarEliminar() {
    setEliminando(true);
    setError(null);
    const resultado = await eliminarProveedorAction(proveedor.id);
    setEliminando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    router.push("/app/proveedores");
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-card p-5 shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-pastel-blue-bg text-primary">
              <Truck className="size-5" />
            </span>
            <div>
              <h1 className="font-heading text-lg font-semibold text-navy">{proveedor.nombre}</h1>
              {proveedor.contacto && <p className="text-xs text-text-muted">{proveedor.contacto}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="icon-sm" onClick={() => setDialogoEditar(true)} aria-label="Editar proveedor">
              <Pencil className="size-4" />
            </Button>
            {confirmandoBaja ? (
              <div className="flex items-center gap-1.5">
                <Button variant="destructive" size="sm" onClick={confirmarEliminar} disabled={eliminando}>
                  Sí, eliminar
                </Button>
                <Button variant="outline" size="sm" onClick={() => setConfirmandoBaja(false)}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setConfirmandoBaja(true)}
                aria-label="Eliminar proveedor"
              >
                <Trash2 className="size-4 text-error-text" />
              </Button>
            )}
          </div>
        </div>

        <FormError className="mt-2">{error}</FormError>

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-border pt-4 text-sm">
          <div>
            <p className="text-xs text-text-muted">Compras registradas</p>
            <p className="font-semibold text-navy">{cantidadCompras}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Monto total comprado</p>
            <p className="font-semibold text-navy">{formatMoneda(montoTotalComprado)}</p>
          </div>
        </div>

        {proveedor.notas && (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-warning-bg p-3 text-sm text-warning-text">
            <FileText className="mt-0.5 size-4 shrink-0" />
            <p>{proveedor.notas}</p>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <Tabs
          items={[
            { key: "compras", label: "Historial de Compras", icon: History },
            { key: "precios", label: "Historial de Precios", icon: Tag },
          ]}
          value={tab}
          onValueChange={(key) => setTab(key as "compras" | "precios")}
        />

        <div className="rounded-2xl bg-card shadow-card">
          {tab === "compras" ? (
            compras.length === 0 ? (
              <p className="p-6 text-center text-sm text-text-muted">Todavía no hay compras registradas.</p>
            ) : (
              <div className="divide-y divide-gray-border">
                {compras.map((compra) => (
                  <div key={compra.id} className="flex items-center gap-3 p-4 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="text-text-body">{compra.itemNombre}</p>
                      <p className="text-xs text-text-muted">
                        {formatFecha(compra.fechaCompra)} · {compra.cantidad} × {formatMoneda(compra.costoUnitario)}
                      </p>
                    </div>
                    <span className="font-semibold text-navy">{formatMoneda(compra.montoTotal)}</span>
                    <Badge variant={BADGE_ESTADO[compra.estado].variant}>{BADGE_ESTADO[compra.estado].label}</Badge>
                    <Badge variant={BADGE_PAGO[compra.estadoPago].variant}>{BADGE_PAGO[compra.estadoPago].label}</Badge>
                  </div>
                ))}
              </div>
            )
          ) : precioPorItem.length === 0 ? (
            <p className="p-6 text-center text-sm text-text-muted">Todavía no hay compras registradas.</p>
          ) : (
            <div className="divide-y divide-gray-border">
              {precioPorItem.map(({ itemNombre, filas }) => (
                <div key={itemNombre} className="p-4">
                  <p className="mb-2 text-sm font-medium text-navy">{itemNombre}</p>
                  <div className="space-y-1.5">
                    {filas.map((fila) => (
                      <div key={fila.id} className="flex items-center justify-between text-xs">
                        <span className="text-text-muted">{formatFecha(fila.fechaCompra)}</span>
                        <span className="text-text-body">{formatMoneda(fila.costoUnitario)} / unidad</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ProveedorFormDialog
        open={dialogoEditar}
        onOpenChange={setDialogoEditar}
        proveedor={proveedor}
        onGuardado={() => router.refresh()}
      />
    </div>
  );
}
