import { ROL_CEOM_ADMIN_ID } from "@/modules/identidad/constants";
import * as repo from "./repository";
import type { moduloVeedorEnum } from "./schema";

export type Resultado<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type ModuloVeedor = (typeof moduloVeedorEnum.enumValues)[number];

// Solo se necesita el rol del solicitante para gatear estas acciones — se
// evita importar el tipo UsuarioConRol de Identidad (no forma parte de su
// contrato publico en actions.ts) para no acoplar mas de lo necesario.
interface Solicitante {
  rolId: string;
}

export interface DatosPlan {
  nombre: string;
  nichoId?: string;
  incluyeSucursales?: boolean;
  permiteMultiplesOwners?: boolean;
  permiteDowngradeAutogestionado?: boolean;
  duracionInvitacionDias?: number;
  duracionEtapaSoloLecturaDias?: number;
  modulosVeedorPermitidos?: ModuloVeedor[];
  precioMensual: string | number;
  moneda: string;
}

function requiereCeomAdmin(
  solicitante: Solicitante
): { ok: false; error: string } | null {
  if (solicitante.rolId !== ROL_CEOM_ADMIN_ID) {
    return { ok: false, error: "Solo CEOM Admin puede gestionar el catálogo de planes." };
  }
  return null;
}

// --- Lecturas (catalogo publico, sin gate) ---------------------------------------------------------

export async function obtenerPlanPorId(planId: string) {
  return repo.obtenerPlanPorId(planId);
}

export async function listarPlanes(opts: { soloActivos?: boolean } = {}) {
  return repo.listarPlanes(opts);
}

// --- Escrituras (solo CEOM Admin) ---------------------------------------------------------

export async function crearPlan(
  solicitante: Solicitante,
  input: DatosPlan
): Promise<Resultado<{ planId: string }>> {
  const bloqueo = requiereCeomAdmin(solicitante);
  if (bloqueo) return bloqueo;

  const plan = await repo.crearPlan({
    nombre: input.nombre,
    nichoId: input.nichoId,
    incluyeSucursales: input.incluyeSucursales ?? false,
    permiteMultiplesOwners: input.permiteMultiplesOwners ?? false,
    permiteDowngradeAutogestionado: input.permiteDowngradeAutogestionado ?? false,
    duracionInvitacionDias: input.duracionInvitacionDias ?? 7,
    duracionEtapaSoloLecturaDias: input.duracionEtapaSoloLecturaDias ?? 3,
    modulosVeedorPermitidos: input.modulosVeedorPermitidos ?? [],
    precioMensual: String(input.precioMensual),
    moneda: input.moneda,
  });

  return { ok: true, data: { planId: plan.id } };
}

export async function actualizarPlan(
  solicitante: Solicitante,
  planId: string,
  input: Partial<DatosPlan>
): Promise<Resultado<true>> {
  const bloqueo = requiereCeomAdmin(solicitante);
  if (bloqueo) return bloqueo;

  const plan = await repo.obtenerPlanPorId(planId);
  if (!plan) return { ok: false, error: "Plan no encontrado." };

  await repo.actualizarPlan(planId, {
    ...input,
    precioMensual:
      input.precioMensual !== undefined ? String(input.precioMensual) : undefined,
  });
  return { ok: true, data: true };
}

export async function desactivarPlan(
  solicitante: Solicitante,
  planId: string
): Promise<Resultado<true>> {
  const bloqueo = requiereCeomAdmin(solicitante);
  if (bloqueo) return bloqueo;

  const plan = await repo.obtenerPlanPorId(planId);
  if (!plan) return { ok: false, error: "Plan no encontrado." };

  await repo.actualizarActivoPlan(planId, false);
  return { ok: true, data: true };
}

export async function reactivarPlan(
  solicitante: Solicitante,
  planId: string
): Promise<Resultado<true>> {
  const bloqueo = requiereCeomAdmin(solicitante);
  if (bloqueo) return bloqueo;

  const plan = await repo.obtenerPlanPorId(planId);
  if (!plan) return { ok: false, error: "Plan no encontrado." };

  await repo.actualizarActivoPlan(planId, true);
  return { ok: true, data: true };
}

export { PLAN_BASICO_ID } from "./constants";
