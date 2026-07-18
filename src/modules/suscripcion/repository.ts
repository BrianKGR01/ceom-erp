import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { planes } from "./schema";

export type NuevoPlan = typeof planes.$inferInsert;

export async function obtenerPlanPorId(planId: string) {
  const filas = await db.select().from(planes).where(eq(planes.id, planId)).limit(1);
  return filas[0] ?? null;
}

export async function listarPlanes({ soloActivos }: { soloActivos?: boolean } = {}) {
  if (soloActivos) {
    return db.select().from(planes).where(eq(planes.activo, true));
  }
  return db.select().from(planes);
}

export async function crearPlan(data: Omit<NuevoPlan, "id">) {
  const [plan] = await db.insert(planes).values(data).returning();
  return plan;
}

export async function actualizarPlan(
  planId: string,
  data: Partial<Omit<NuevoPlan, "id">>
) {
  const [plan] = await db
    .update(planes)
    .set(data)
    .where(eq(planes.id, planId))
    .returning();
  return plan;
}

export async function actualizarActivoPlan(planId: string, activo: boolean) {
  const [plan] = await db
    .update(planes)
    .set({ activo })
    .where(eq(planes.id, planId))
    .returning();
  return plan;
}
