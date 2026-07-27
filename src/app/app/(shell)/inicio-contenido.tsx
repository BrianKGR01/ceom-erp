"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Coins, Package, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { DashboardResumen } from "./dashboard-resumen";
import type { CapacidadAlmacenamientoWidget, DatosDashboard } from "./inicio-actions";

// "Sub-onboarding" de la pantalla de Inicio: mientras el tenant no tenga
// ni un producto cargado, se prioriza esta guía sobre el Dashboard real.
// Se apaga solo con el primer producto — esa regla manda siempre sobre el
// cierre manual (localStorage, solo preferencia de UI, no dato de
// negocio). En cuanto se apaga (por producto o a mano), se muestra el
// Dashboard real (Modulo 14, Sección A).
export function InicioContenido({
  tenantId,
  nombreNegocio,
  tieneProductos,
  productosSinCosto,
  sucursales,
  datosIniciales,
  capacidadAlmacenamiento,
  zona,
}: {
  tenantId: string;
  nombreNegocio: string;
  tieneProductos: boolean;
  /** Cuántos productos activos no tienen costo cargado (H-15). */
  productosSinCosto: number;
  sucursales: { id: string; nombre: string }[];
  datosIniciales: DatosDashboard;
  capacidadAlmacenamiento: CapacidadAlmacenamientoWidget | null;
  /** Zona horaria del negocio — viaja desde el servidor hasta DashboardResumen,
   * que la necesita para traducir el preset a dias locales. */
  zona: string;
}) {
  const storageKey = `ceom_checklist_cerrado_${tenantId}`;
  const [cerradoManualmente, setCerradoManualmente] = useState(true);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    function leerPreferencia() {
      setCerradoManualmente(window.localStorage.getItem(storageKey) === "1");
      setListo(true);
    }
    leerPreferencia();
  }, [storageKey]);

  if (!listo) return null;

  const mostrarChecklist = !tieneProductos && !cerradoManualmente;

  if (!mostrarChecklist) {
    return (
      <div className="space-y-6">
        <PageHeader title={`¡Hola, ${nombreNegocio}!`} description="Así viene tu negocio en este período." />
        {/* H-15: un negocio que ya opera necesita su Dashboard, no un
            checklist — así que esto es una tira compacta ARRIBA del
            Dashboard, no en lugar de él. Sigue siendo prevención: después de
            la primera venta de un producto sin costo, ese hueco ya no se
            puede tapar (el snapshot no se recalcula, regla 4). */}
        {productosSinCosto > 0 && (
          <div className="flex flex-col items-start gap-3 rounded-2xl bg-warning-bg p-4 shadow-card sm:flex-row sm:items-center">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-card text-warning-text">
              <Coins className="size-5" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium text-warning-text">
                {productosSinCosto === 1
                  ? "Tenés 1 producto sin costo cargado"
                  : `Tenés ${productosSinCosto} productos sin costo cargado`}
              </p>
              <p className="text-xs text-text-body">
                Cada venta de esos productos se cuenta como ganancia pura y su margen queda sin
                calcular. Lo que se vende hoy sin costo no se puede corregir después.
              </p>
            </div>
            <Button
              variant="outline"
              render={<Link href="/app/productos" />}
              nativeButton={false}
              size="sm"
            >
              Cargar costos
            </Button>
          </div>
        )}
        <DashboardResumen
          sucursales={sucursales}
          datosIniciales={datosIniciales}
          capacidadAlmacenamiento={capacidadAlmacenamiento}
          zona={zona}
        />
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl bg-card p-6 shadow-card">
      <button
        type="button"
        onClick={() => {
          window.localStorage.setItem(storageKey, "1");
          setCerradoManualmente(true);
        }}
        aria-label="Cerrar"
        className="absolute top-4 right-4 text-text-muted hover:text-text-body"
      >
        <X className="size-4" />
      </button>

      <h1 className="font-heading text-xl font-semibold text-navy">¡Bienvenido, {nombreNegocio}!</h1>
      <p className="mt-1 text-sm text-text-muted">Empecemos por cargar lo que vendés.</p>

      <div className="mt-4 flex flex-col items-start gap-3 rounded-xl border border-gray-border p-4 sm:flex-row sm:items-center">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-pastel-blue-bg text-primary">
          <Package className="size-5" />
        </span>
        <div className="flex-1">
          <p className="text-sm font-medium text-navy">Cargá tu primer producto</p>
          <p className="text-xs text-text-muted">
            Es el primer paso. Para registrar una venta también vas a elegir un canal —
            podés crearlo en el momento, desde la misma pantalla de venta.
          </p>
        </div>
        <Button render={<Link href="/app/productos/nuevo" />} nativeButton={false} size="sm">
          Cargar producto
        </Button>
      </div>

      {/* H-15: el paso que faltaba. Cargar el producto es la mitad — sin el
          costo, la primera venta ya nace mal contada. Se dice acá, que es
          cuando el usuario está más dispuesto a completar datos. */}
      <p className="mt-3 text-xs text-text-muted">
        Cargale también el <span className="font-medium text-navy">costo</span>: es lo que
        permite calcular tu margen. Sin él, cada venta se cuenta como ganancia pura — y el
        costo de una venta ya registrada no se puede corregir después.
      </p>
    </div>
  );
}
