"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, X } from "lucide-react";
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
  sucursales,
  datosIniciales,
  capacidadAlmacenamiento,
}: {
  tenantId: string;
  nombreNegocio: string;
  tieneProductos: boolean;
  sucursales: { id: string; nombre: string }[];
  datosIniciales: DatosDashboard;
  capacidadAlmacenamiento: CapacidadAlmacenamientoWidget | null;
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
        <DashboardResumen
          sucursales={sucursales}
          datosIniciales={datosIniciales}
          capacidadAlmacenamiento={capacidadAlmacenamiento}
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
            Es lo único que necesitás para empezar a vender — el resto lo vas completando
            después.
          </p>
        </div>
        <Button render={<Link href="/app/productos/nuevo" />} nativeButton={false} size="sm">
          Cargar producto
        </Button>
      </div>
    </div>
  );
}
