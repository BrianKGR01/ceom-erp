"use client";

import { useSyncExternalStore } from "react";
import { diaLocalDe } from "@/lib/periodo";

const sinSuscripcion = () => () => {};

/**
 * `true` solo despues de hidratar. `useSyncExternalStore` con dos snapshots
 * distintos es la forma canonica de preguntarlo — un `useState` + `useEffect`
 * hace lo mismo pero dispara un render en cascada (y lo marca el linter).
 */
function useHidratado(): boolean {
  return useSyncExternalStore(
    sinSuscripcion,
    () => true,
    () => false
  );
}

/**
 * "al 27 jul, 10:32" — la aclaración de que el período todavía no terminó.
 *
 * Decisión de producto del 2026-07-27 (documento 05, sección 8, decisión 2).
 * Hasta H-49 el día en curso no entraba en ningún reporte, así que el problema
 * no existía. Ahora que sí entra, un período que termina hoy muestra un día
 * PARCIAL: leer "Hoy: Bs 340" a las 10 de la mañana y compararlo contra el día
 * anterior completo es una conclusión equivocada, y nada en la pantalla lo
 * advertía. Se resolvió con esta línea en vez de con un preset "Ayer".
 *
 * Solo aparece cuando el período efectivamente llega hasta hoy — un reporte de
 * un mes ya cerrado no lo muestra.
 *
 * La hora se pinta recién después de hidratar: el servidor y el navegador no
 * comparten el minuto y React lo marcaría como error de hidratación.
 */
export function SelloPeriodoParcial({ hasta, zona }: { hasta: string; zona: string }) {
  if (!useHidratado()) return null;
  const ahora = new Date();
  if (diaLocalDe(ahora, zona) !== hasta) return null;

  const hora = ahora.toLocaleTimeString("es-BO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: zona,
  });
  const dia = new Date(`${hasta}T12:00:00Z`).toLocaleDateString("es-BO", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

  return (
    <p className="text-xs text-text-muted">
      Al {dia}, {hora} — el día todavía no terminó.
    </p>
  );
}
