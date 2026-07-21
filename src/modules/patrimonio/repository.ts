import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { Ejecutor } from "@/db/contexto";
import { activos, pagosPasivo, pasivos } from "./schema";

export type NuevoActivo = typeof activos.$inferInsert;
export type NuevoPasivo = typeof pasivos.$inferInsert;
export type NuevoPagoPasivo = typeof pagosPasivo.$inferInsert;

// --- Activos ---------------------------------------------------------

export async function crearActivo(tx: Ejecutor, data: NuevoActivo) {
  const [activo] = await tx.insert(activos).values(data).returning();
  return activo;
}

export async function obtenerActivoPorId(tx: Ejecutor, activoId: string) {
  const filas = await tx
    .select()
    .from(activos)
    .where(and(eq(activos.id, activoId), isNull(activos.eliminadoEn)))
    .limit(1);
  return filas[0] ?? null;
}

export async function actualizarActivo(
  tx: Ejecutor,
  activoId: string,
  data: Partial<Omit<NuevoActivo, "id" | "tenantId">>
) {
  const [activo] = await tx
    .update(activos)
    .set(data)
    .where(eq(activos.id, activoId))
    .returning();
  return activo;
}

export async function actualizarEstadoActivo(
  tx: Ejecutor,
  activoId: string,
  estado: (typeof activos.$inferSelect)["estado"],
  modificadoPor: string,
  motivoBaja?: string
) {
  const [activo] = await tx
    .update(activos)
    .set({ estado, motivoBaja, modificadoPor, modificadoEn: new Date() })
    .where(eq(activos.id, activoId))
    .returning();
  return activo;
}

export async function actualizarSucursalActivo(
  tx: Ejecutor,
  activoId: string,
  sucursalId: string,
  modificadoPor: string
) {
  const [activo] = await tx
    .update(activos)
    .set({ sucursalId, modificadoPor, modificadoEn: new Date() })
    .where(eq(activos.id, activoId))
    .returning();
  return activo;
}

export async function listarActivosPorTenant(
  tx: Ejecutor,
  tenantId: string,
  { excluirDadosDeBaja }: { excluirDadosDeBaja?: boolean } = {}
) {
  const condiciones = [eq(activos.tenantId, tenantId), isNull(activos.eliminadoEn)];
  if (excluirDadosDeBaja) {
    condiciones.push(sql`${activos.estado} <> 'dado_de_baja'`);
  }
  return tx.select().from(activos).where(and(...condiciones));
}

// --- Pasivos ---------------------------------------------------------

export async function obtenerPasivoPorId(tx: Ejecutor, pasivoId: string) {
  const filas = await tx
    .select()
    .from(pasivos)
    .where(and(eq(pasivos.id, pasivoId), isNull(pasivos.eliminadoEn)))
    .limit(1);
  return filas[0] ?? null;
}

export async function crearPasivo(tx: Ejecutor, data: NuevoPasivo) {
  const [pasivo] = await tx.insert(pasivos).values(data).returning();
  return pasivo;
}

export async function listarPasivosPorTenant(
  tx: Ejecutor,
  tenantId: string,
  { soloActivos }: { soloActivos?: boolean } = {}
) {
  const condiciones = [eq(pasivos.tenantId, tenantId), isNull(pasivos.eliminadoEn)];
  if (soloActivos) {
    condiciones.push(eq(pasivos.estado, "activo"));
  }
  return tx.select().from(pasivos).where(and(...condiciones));
}

export async function obtenerPasivoDeActivo(tx: Ejecutor, activoId: string) {
  const filas = await tx
    .select()
    .from(pasivos)
    .where(and(eq(pasivos.activoId, activoId), isNull(pasivos.eliminadoEn)));
  return filas;
}

/**
 * Refinanciacion atomica: crea el pasivo nuevo (referenciando al anterior
 * via refinanciado_desde_id) y marca el anterior como "refinanciado" — el
 * original nunca se edita (Modulo_05 seccion 3, regla 4). Ya no abre su
 * propia transaccion: la atomicidad la da la transaccion externa que abrió
 * comoUsuario()/comoCeomAdmin() (docs/security/PLAN-RLS-BACKSTOP.md §2.2) —
 * verificado empíricamente que un `tx.transaction()` anidado acá adentro
 * sería redundante, no incorrecto, así que se lo saca para ahorrar el
 * round-trip de un savepoint que no hace falta.
 */
export async function refinanciarPasivoTx(
  tx: Ejecutor,
  pasivoAnteriorId: string,
  nuevoPasivo: Omit<NuevoPasivo, "refinanciadoDesdeId">
) {
  const [nuevo] = await tx
    .insert(pasivos)
    .values({ ...nuevoPasivo, refinanciadoDesdeId: pasivoAnteriorId })
    .returning();
  await tx
    .update(pasivos)
    .set({ estado: "refinanciado" })
    .where(eq(pasivos.id, pasivoAnteriorId));
  return nuevo;
}

// --- Pagos de Pasivo ---------------------------------------------------------

export async function obtenerSaldoPendiente(tx: Ejecutor, pasivoId: string): Promise<number> {
  const [pasivo] = await tx
    .select({ montoTotal: pasivos.montoTotal })
    .from(pasivos)
    .where(eq(pasivos.id, pasivoId));
  if (!pasivo) return 0;

  const [{ totalPagado }] = await tx
    .select({ totalPagado: sql<string>`coalesce(sum(${pagosPasivo.monto}), 0)` })
    .from(pagosPasivo)
    .where(eq(pagosPasivo.pasivoId, pasivoId));

  return Number(pasivo.montoTotal) - Number(totalPagado);
}

/** Historial completo de pagos de un pasivo, mas antiguo primero — mismo
 * criterio que listarPagosPorVenta (Ventas). */
export async function listarPagosPorPasivo(tx: Ejecutor, pasivoId: string) {
  return tx
    .select()
    .from(pagosPasivo)
    .where(eq(pagosPasivo.pasivoId, pasivoId))
    .orderBy(asc(pagosPasivo.fechaPago));
}

/**
 * Registra el pago y, si el saldo llega a 0, transiciona el pasivo a
 * "pagado" — todo dentro de la misma transaccion externa que abrió
 * comoUsuario() (Modulo_05 seccion 1.4; ver nota de refinanciarPasivoTx
 * sobre por qué ya no anida su propia transaccion).
 */
export async function registrarPagoPasivoTx(tx: Ejecutor, data: NuevoPagoPasivo) {
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
}
