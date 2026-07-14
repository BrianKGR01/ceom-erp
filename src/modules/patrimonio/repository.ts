import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { activos, pagosPasivo, pasivos } from "./schema";

export type NuevoActivo = typeof activos.$inferInsert;
export type NuevoPasivo = typeof pasivos.$inferInsert;
export type NuevoPagoPasivo = typeof pagosPasivo.$inferInsert;

// --- Activos ---------------------------------------------------------

export async function crearActivo(data: NuevoActivo) {
  const [activo] = await db.insert(activos).values(data).returning();
  return activo;
}

export async function obtenerActivoPorId(activoId: string) {
  const filas = await db
    .select()
    .from(activos)
    .where(and(eq(activos.id, activoId), isNull(activos.eliminadoEn)))
    .limit(1);
  return filas[0] ?? null;
}

export async function actualizarActivo(
  activoId: string,
  data: Partial<Omit<NuevoActivo, "id" | "tenantId">>
) {
  const [activo] = await db
    .update(activos)
    .set(data)
    .where(eq(activos.id, activoId))
    .returning();
  return activo;
}

export async function actualizarEstadoActivo(
  activoId: string,
  estado: (typeof activos.$inferSelect)["estado"],
  modificadoPor: string
) {
  const [activo] = await db
    .update(activos)
    .set({ estado, modificadoPor, modificadoEn: new Date() })
    .where(eq(activos.id, activoId))
    .returning();
  return activo;
}

export async function actualizarSucursalActivo(
  activoId: string,
  sucursalId: string,
  modificadoPor: string
) {
  const [activo] = await db
    .update(activos)
    .set({ sucursalId, modificadoPor, modificadoEn: new Date() })
    .where(eq(activos.id, activoId))
    .returning();
  return activo;
}

export async function listarActivosPorTenant(
  tenantId: string,
  { excluirDadosDeBaja }: { excluirDadosDeBaja?: boolean } = {}
) {
  const condiciones = [eq(activos.tenantId, tenantId), isNull(activos.eliminadoEn)];
  if (excluirDadosDeBaja) {
    condiciones.push(sql`${activos.estado} <> 'dado_de_baja'`);
  }
  return db.select().from(activos).where(and(...condiciones));
}

// --- Pasivos ---------------------------------------------------------

export async function obtenerPasivoPorId(pasivoId: string) {
  const filas = await db
    .select()
    .from(pasivos)
    .where(and(eq(pasivos.id, pasivoId), isNull(pasivos.eliminadoEn)))
    .limit(1);
  return filas[0] ?? null;
}

export async function crearPasivo(data: NuevoPasivo) {
  const [pasivo] = await db.insert(pasivos).values(data).returning();
  return pasivo;
}

export async function listarPasivosPorTenant(
  tenantId: string,
  { soloActivos }: { soloActivos?: boolean } = {}
) {
  const condiciones = [eq(pasivos.tenantId, tenantId), isNull(pasivos.eliminadoEn)];
  if (soloActivos) {
    condiciones.push(eq(pasivos.estado, "activo"));
  }
  return db.select().from(pasivos).where(and(...condiciones));
}

export async function obtenerPasivoDeActivo(activoId: string) {
  const filas = await db
    .select()
    .from(pasivos)
    .where(and(eq(pasivos.activoId, activoId), isNull(pasivos.eliminadoEn)));
  return filas;
}

/**
 * Refinanciacion atomica: crea el pasivo nuevo (referenciando al anterior
 * via refinanciado_desde_id) y marca el anterior como "refinanciado" — el
 * original nunca se edita (Modulo_05 seccion 3, regla 4).
 */
export async function refinanciarPasivoTx(
  pasivoAnteriorId: string,
  nuevoPasivo: Omit<NuevoPasivo, "refinanciadoDesdeId">
) {
  return db.transaction(async (tx) => {
    const [nuevo] = await tx
      .insert(pasivos)
      .values({ ...nuevoPasivo, refinanciadoDesdeId: pasivoAnteriorId })
      .returning();
    await tx
      .update(pasivos)
      .set({ estado: "refinanciado" })
      .where(eq(pasivos.id, pasivoAnteriorId));
    return nuevo;
  });
}

// --- Pagos de Pasivo ---------------------------------------------------------

export async function obtenerSaldoPendiente(pasivoId: string): Promise<number> {
  const [pasivo] = await db
    .select({ montoTotal: pasivos.montoTotal })
    .from(pasivos)
    .where(eq(pasivos.id, pasivoId));
  if (!pasivo) return 0;

  const [{ totalPagado }] = await db
    .select({ totalPagado: sql<string>`coalesce(sum(${pagosPasivo.monto}), 0)` })
    .from(pagosPasivo)
    .where(eq(pagosPasivo.pasivoId, pasivoId));

  return Number(pasivo.montoTotal) - Number(totalPagado);
}

/**
 * Registra el pago y, si el saldo llega a 0, transiciona el pasivo a
 * "pagado" — todo en una transaccion (Modulo_05 seccion 1.4).
 */
export async function registrarPagoPasivoTx(data: NuevoPagoPasivo) {
  return db.transaction(async (tx) => {
    const [pago] = await tx.insert(pagosPasivo).values(data).returning();

    const [pasivo] = await tx
      .select({ montoTotal: pasivos.montoTotal })
      .from(pasivos)
      .where(eq(pasivos.id, data.pasivoId));
    const [{ totalPagado }] = await tx
      .select({ totalPagado: sql<string>`coalesce(sum(${pagosPasivo.monto}), 0)` })
      .from(pagosPasivo)
      .where(eq(pagosPasivo.pasivoId, data.pasivoId));

    const saldoPendiente = Number(pasivo.montoTotal) - Number(totalPagado);
    if (saldoPendiente <= 0) {
      await tx
        .update(pasivos)
        .set({ estado: "pagado" })
        .where(eq(pasivos.id, data.pasivoId));
    }

    return { pago, saldoPendiente };
  });
}
