"use server";

import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import {
  actualizarPlan,
  crearPlan,
  desactivarPlan,
  listarPlanes,
  reactivarPlan,
  type DatosPlan,
} from "@/modules/suscripcion/actions";

// Server Actions delgadas (mismo patron que reportes/actions.ts): resuelven
// la sesion server-side (ya gateada a ceom_admin por admin/layout.tsx) y
// delegan en suscripcion/actions.ts. El gate real (requiereCeomAdmin) vive
// en ese modulo para las escrituras — listarPlanes es lectura publica de
// catalogo, sin gate.

export async function listarPlanesAction() {
  return listarPlanes();
}

export async function crearPlanAction(input: DatosPlan) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return crearPlan(usuario, input);
}

export async function actualizarPlanAction(planId: string, input: Partial<DatosPlan>) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return actualizarPlan(usuario, planId, input);
}

export async function desactivarPlanAction(planId: string) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return desactivarPlan(usuario, planId);
}

export async function reactivarPlanAction(planId: string) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return reactivarPlan(usuario, planId);
}
