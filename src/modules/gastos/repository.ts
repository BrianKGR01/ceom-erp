import { and, asc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  categoriasGasto,
  categoriasGastoSugeridas,
  gastos,
  gastosRecurrentes,
  pagosGasto,
} from "./schema";

export type NuevaCategoriaGasto = typeof categoriasGasto.$inferInsert;
export type NuevaCategoriaGastoSugerida = typeof categoriasGastoSugeridas.$inferInsert;
export type NuevoGasto = typeof gastos.$inferInsert;
export type NuevoGastoRecurrente = typeof gastosRecurrentes.$inferInsert;
export type NuevoPagoGasto = typeof pagosGasto.$inferInsert;

// --- Categorias de Gasto ---------------------------------------------------------

export async function crearCategoriaGasto(data: NuevaCategoriaGasto) {
  const [categoria] = await db.insert(categoriasGasto).values(data).returning();
  return categoria;
}

export async function obtenerCategoriaGastoPorId(categoriaId: string) {
  const filas = await db
    .select()
    .from(categoriasGasto)
    .where(and(eq(categoriasGasto.id, categoriaId), isNull(categoriasGasto.eliminadoEn)))
    .limit(1);
  return filas[0] ?? null;
}

export async function actualizarCategoriaGasto(
  categoriaId: string,
  data: Partial<Omit<NuevaCategoriaGasto, "id" | "tenantId">>
) {
  const [categoria] = await db
    .update(categoriasGasto)
    .set(data)
    .where(eq(categoriasGasto.id, categoriaId))
    .returning();
  return categoria;
}

export async function eliminarCategoriaGastoSoft(categoriaId: string) {
  const [categoria] = await db
    .update(categoriasGasto)
    .set({ eliminadoEn: new Date() })
    .where(eq(categoriasGasto.id, categoriaId))
    .returning();
  return categoria;
}

export async function listarCategoriasGastoPorTenant(tenantId: string) {
  return db
    .select()
    .from(categoriasGasto)
    .where(and(eq(categoriasGasto.tenantId, tenantId), isNull(categoriasGasto.eliminadoEn)));
}

// --- Categorias de Gasto Sugeridas (catalogo global) ---------------------------------------------------------

export async function listarCategoriasGastoSugeridas(
  opts: { nichoId?: string; soloActivas?: boolean } = {}
) {
  const condiciones = [];
  if (opts.nichoId) {
    condiciones.push(
      sql`(${categoriasGastoSugeridas.nichoId} = ${opts.nichoId} or ${categoriasGastoSugeridas.nichoId} is null)`
    );
  }
  if (opts.soloActivas) {
    condiciones.push(eq(categoriasGastoSugeridas.activa, true));
  }
  return db
    .select()
    .from(categoriasGastoSugeridas)
    .where(condiciones.length ? and(...condiciones) : undefined);
}

export async function crearCategoriaGastoSugerida(data: NuevaCategoriaGastoSugerida) {
  const [categoria] = await db.insert(categoriasGastoSugeridas).values(data).returning();
  return categoria;
}

export async function actualizarActivaCategoriaGastoSugerida(
  categoriaGastoSugeridaId: string,
  activa: boolean
) {
  const [categoria] = await db
    .update(categoriasGastoSugeridas)
    .set({ activa })
    .where(eq(categoriasGastoSugeridas.id, categoriaGastoSugeridaId))
    .returning();
  return categoria;
}

// --- Gastos ---------------------------------------------------------

export async function obtenerGastoPorId(gastoId: string) {
  const filas = await db
    .select()
    .from(gastos)
    .where(and(eq(gastos.id, gastoId), isNull(gastos.eliminadoEn)))
    .limit(1);
  return filas[0] ?? null;
}

export async function crearGasto(data: NuevoGasto) {
  const [gasto] = await db.insert(gastos).values(data).returning();
  return gasto;
}

export async function actualizarGasto(
  gastoId: string,
  data: Partial<Omit<NuevoGasto, "id" | "tenantId">>
) {
  const [gasto] = await db.update(gastos).set(data).where(eq(gastos.id, gastoId)).returning();
  return gasto;
}

export async function eliminarGastoSoft(gastoId: string) {
  const [gasto] = await db
    .update(gastos)
    .set({ eliminadoEn: new Date() })
    .where(eq(gastos.id, gastoId))
    .returning();
  return gasto;
}

export async function listarGastosPorTenant(tenantId: string) {
  return db
    .select()
    .from(gastos)
    .where(and(eq(gastos.tenantId, tenantId), isNull(gastos.eliminadoEn)))
    .orderBy(asc(gastos.fechaGasto));
}

export async function obtenerTotalPagado(gastoId: string): Promise<number> {
  const [{ totalPagado }] = await db
    .select({ totalPagado: sql<string>`coalesce(sum(${pagosGasto.monto}), 0)` })
    .from(pagosGasto)
    .where(eq(pagosGasto.gastoId, gastoId));
  return Number(totalPagado);
}

export async function listarPagosPorGasto(gastoId: string) {
  return db.select().from(pagosGasto).where(eq(pagosGasto.gastoId, gastoId));
}

/**
 * Crea el Gasto y su primer Pago en una sola transaccion — usado por las
 * funciones de auto-generacion (regla 6: los gastos automaticos nacen
 * pagados). Calcula estado_pago directo (siempre "pagado" si el pago cubre
 * el monto completo).
 */
export async function crearGastoConPagoTx(data: {
  gasto: NuevoGasto;
  pago: Omit<NuevoPagoGasto, "id" | "gastoId">;
}) {
  return db.transaction(async (tx) => {
    const [gasto] = await tx
      .insert(gastos)
      .values({ ...data.gasto, estadoPago: "pagado" })
      .returning();
    const [pago] = await tx
      .insert(pagosGasto)
      .values({ ...data.pago, gastoId: gasto.id })
      .returning();
    return { gasto, pago };
  });
}

/**
 * Registra el pago y recalcula estado_pago (pendiente/parcial/pagado) en la
 * misma transaccion — mismo patron que registrarPagoVentaTx/
 * registrarPagoCompraTx.
 */
export async function registrarPagoGastoTx(data: NuevoPagoGasto) {
  return db.transaction(async (tx) => {
    const [pago] = await tx.insert(pagosGasto).values(data).returning();

    const [gasto] = await tx
      .select({ monto: gastos.monto })
      .from(gastos)
      .where(eq(gastos.id, data.gastoId));
    const [{ totalPagado }] = await tx
      .select({ totalPagado: sql<string>`coalesce(sum(${pagosGasto.monto}), 0)` })
      .from(pagosGasto)
      .where(eq(pagosGasto.gastoId, data.gastoId));

    const pagado = Number(totalPagado);
    const total = Number(gasto.monto);
    const estadoPago: (typeof gastos.$inferSelect)["estadoPago"] =
      pagado <= 0 ? "pendiente" : pagado >= total ? "pagado" : "parcial";

    await tx.update(gastos).set({ estadoPago }).where(eq(gastos.id, data.gastoId));

    return { pago, estadoPago, totalPagado: pagado };
  });
}

// --- Gastos Recurrentes ---------------------------------------------------------

export async function crearGastoRecurrente(data: NuevoGastoRecurrente) {
  const [gastoRecurrente] = await db.insert(gastosRecurrentes).values(data).returning();
  return gastoRecurrente;
}

export async function obtenerGastoRecurrentePorId(gastoRecurrenteId: string) {
  const filas = await db
    .select()
    .from(gastosRecurrentes)
    .where(eq(gastosRecurrentes.id, gastoRecurrenteId))
    .limit(1);
  return filas[0] ?? null;
}

export async function actualizarGastoRecurrente(
  gastoRecurrenteId: string,
  data: Partial<Omit<NuevoGastoRecurrente, "id" | "tenantId">>
) {
  const [gastoRecurrente] = await db
    .update(gastosRecurrentes)
    .set(data)
    .where(eq(gastosRecurrentes.id, gastoRecurrenteId))
    .returning();
  return gastoRecurrente;
}

export async function listarGastosRecurrentesPorTenant(tenantId: string) {
  return db.select().from(gastosRecurrentes).where(eq(gastosRecurrentes.tenantId, tenantId));
}

// --- Agregados (Modulo_04 seccion 2, 5.6) ---------------------------------------------------------

export async function sumarGastosPorTipoEnPeriodo(
  tenantId: string,
  tipo: (typeof gastos.$inferSelect)["tipo"],
  desde: string,
  hasta: string
): Promise<number> {
  const [{ total }] = await db
    .select({ total: sql<string>`coalesce(sum(${gastos.monto}), 0)` })
    .from(gastos)
    .where(
      and(
        eq(gastos.tenantId, tenantId),
        eq(gastos.tipo, tipo),
        isNull(gastos.eliminadoEn),
        gte(gastos.fechaGasto, desde),
        lte(gastos.fechaGasto, hasta)
      )
    );
  return Number(total);
}

export async function sumarGastosPorCategoriaEnPeriodo(
  tenantId: string,
  desde: string,
  hasta: string
) {
  return db
    .select({
      categoriaId: gastos.categoriaId,
      total: sql<string>`coalesce(sum(${gastos.monto}), 0)`,
    })
    .from(gastos)
    .where(
      and(
        eq(gastos.tenantId, tenantId),
        isNull(gastos.eliminadoEn),
        gte(gastos.fechaGasto, desde),
        lte(gastos.fechaGasto, hasta)
      )
    )
    .groupBy(gastos.categoriaId);
}
