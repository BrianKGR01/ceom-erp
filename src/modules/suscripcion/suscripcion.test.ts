import { inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { ROL_CEOM_ADMIN_ID } from "@/modules/identidad/constants";
import {
  actualizarPlan,
  crearPlan,
  desactivarPlan,
  listarPlanes,
  obtenerPlanPorId,
  PLAN_BASICO_ID,
  reactivarPlan,
} from "./actions";
import { planes } from "./schema";

// Pegan contra el Supabase Cloud de desarrollo real (mismo criterio que
// identidad.test.ts) — se saltan solos si faltan las credenciales.
const hasCredenciales = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasCredenciales)("Modulo 11 - Suscripcion (integracion)", () => {
  const ceomAdmin = { rolId: ROL_CEOM_ADMIN_ID, rol: { esRolSistema: true } };
  const owner = { rolId: "00000000-0000-0000-0000-000000000000", rol: { esRolSistema: false } };
  const planesCreados: string[] = [];

  afterAll(async () => {
    if (planesCreados.length === 0) return;
    await db.delete(planes).where(inArray(planes.id, planesCreados));
  });

  it("obtenerPlanPorId y listarPlanes leen el catalogo sin gate de rol", async () => {
    const basico = await obtenerPlanPorId(PLAN_BASICO_ID);
    expect(basico?.nombre).toBe("Básico");
    expect(basico?.activo).toBe(true);

    const activos = await listarPlanes({ soloActivos: true });
    expect(activos.some((p) => p.id === PLAN_BASICO_ID)).toBe(true);
  });

  it("crearPlan: rechaza a un solicitante que no es CEOM Admin", async () => {
    const resultado = await crearPlan(owner, {
      nombre: "Plan de prueba",
      precioMensual: 100,
      moneda: "BOB",
    });
    expect(resultado.ok).toBe(false);
  });

  it("crearPlan + actualizarPlan + desactivar/reactivar (CEOM Admin)", async () => {
    const creado = await crearPlan(ceomAdmin, {
      nombre: `Plan test ${Date.now()}`,
      precioMensual: 150,
      moneda: "BOB",
    });
    expect(creado.ok).toBe(true);
    if (!creado.ok) return;
    planesCreados.push(creado.data.planId);

    const actualizado = await actualizarPlan(ceomAdmin, creado.data.planId, {
      precioMensual: 200,
    });
    expect(actualizado.ok).toBe(true);

    const plan = await obtenerPlanPorId(creado.data.planId);
    expect(plan?.precioMensual).toBe("200.00");

    const desactivado = await desactivarPlan(ceomAdmin, creado.data.planId);
    expect(desactivado.ok).toBe(true);
    expect((await obtenerPlanPorId(creado.data.planId))?.activo).toBe(false);

    const reactivado = await reactivarPlan(ceomAdmin, creado.data.planId);
    expect(reactivado.ok).toBe(true);
    expect((await obtenerPlanPorId(creado.data.planId))?.activo).toBe(true);
  });

  it("listarPlanes({ soloActivos: true }) excluye planes desactivados", async () => {
    const creado = await crearPlan(ceomAdmin, {
      nombre: `Plan inactivo ${Date.now()}`,
      precioMensual: 50,
      moneda: "BOB",
    });
    if (!creado.ok) throw new Error("setup del test fallo");
    planesCreados.push(creado.data.planId);
    await desactivarPlan(ceomAdmin, creado.data.planId);

    const activos = await listarPlanes({ soloActivos: true });
    expect(activos.some((p) => p.id === creado.data.planId)).toBe(false);
  });
});
