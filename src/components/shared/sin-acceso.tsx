"use client";

import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Pantalla para quien llega a una seccion para la que su rol no tiene permiso (por el menu,
 * un enlace viejo o escribiendo la direccion). Mensaje grande y salida clara.
 */
export function SinAcceso() {
  const router = useRouter();

  function volver() {
    // Sin historial (se abrio el enlace directo en una pestaña nueva) no hay a donde "volver".
    if (window.history.length > 1) router.back();
    else router.push("/app");
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <div role="alert" className="max-w-md space-y-5 text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-warning-bg text-warning-text">
          <ShieldAlert className="size-8" aria-hidden />
        </span>
        <h1 className="font-heading text-3xl font-extrabold tracking-[-0.6px] text-navy">
          No podés entrar acá
        </h1>
        <p className="text-sm text-text-muted">
          Tu usuario no tiene permiso para ver esta sección. Si la necesitás para tu trabajo, pedile al dueño del
          negocio que te la habilite.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button type="button" onClick={volver}>
            Volver atrás
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push("/app")}>
            Ir al inicio
          </Button>
        </div>
      </div>
    </div>
  );
}
