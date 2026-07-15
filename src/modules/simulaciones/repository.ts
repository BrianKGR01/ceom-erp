import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { configuracionSimulaciones, simulaciones } from "./schema";

export type NuevaSimulacion = typeof simulaciones.$inferInsert;

export async function crearSimulacion(data: NuevaSimulacion) {
  const [simulacion] = await db.insert(simulaciones).values(data).returning();
  return simulacion;
}

export async function listarSimulacionesPorTenant(
  tenantId: string,
  productoId?: string
) {
  const condiciones = [eq(simulaciones.tenantId, tenantId)];
  if (productoId) condiciones.push(eq(simulaciones.productoId, productoId));
  return db
    .select()
    .from(simulaciones)
    .where(and(...condiciones))
    .orderBy(desc(simulaciones.creadoEn));
}

export async function obtenerConfiguracion(tenantId: string) {
  const filas = await db
    .select()
    .from(configuracionSimulaciones)
    .where(eq(configuracionSimulaciones.tenantId, tenantId))
    .limit(1);
  return filas[0] ?? null;
}

/** Upsert (Modulo_09 seccion 1.5: una fila por tenant, no siempre existe
 * todavia). */
export async function upsertConfiguracion(
  tenantId: string,
  umbralMargenAlertaPct: string,
  modificadoPor: string
) {
  const [config] = await db
    .insert(configuracionSimulaciones)
    .values({ tenantId, umbralMargenAlertaPct, modificadoPor, modificadoEn: new Date() })
    .onConflictDoUpdate({
      target: configuracionSimulaciones.tenantId,
      set: { umbralMargenAlertaPct, modificadoPor, modificadoEn: new Date() },
    })
    .returning();
  return config;
}
