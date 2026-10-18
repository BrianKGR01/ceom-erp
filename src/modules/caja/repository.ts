import { and, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { cajas, configuracionCaja, movimientosCaja, turnosCaja } from "./schema";

export type TurnoCaja = typeof turnosCaja.$inferSelect;
export type Caja = typeof cajas.$inferSelect;

// --- Configuracion ---------------------------------------------------------

export async function obtenerConfiguracion(tenantId: string) {
  const [fila] = await db
    .select()
    .from(configuracionCaja)
    .where(eq(configuracionCaja.tenantId, tenantId))
    .limit(1);
  return fila ?? null;
}

export async function guardarConfiguracion(
  tenantId: string,
  data: { habilitada: boolean; exigirTurno: boolean; modificadoPor: string }
) {
  const [fila] = await db
    .insert(configuracionCaja)
    .values({ tenantId, ...data })
    .onConflictDoUpdate({
      target: configuracionCaja.tenantId,
      set: { ...data, modificadoEn: new Date() },
    })
    .returning();
  return fila;
}

// --- Cajas -----------------------------------------------------------------

export async function listarCajas(tenantId: string) {
  return db
    .select()
    .from(cajas)
    .where(and(eq(cajas.tenantId, tenantId), isNull(cajas.eliminadoEn)))
    .orderBy(cajas.nombre);
}

export async function obtenerCajaPorId(cajaId: string) {
  const [fila] = await db
    .select()
    .from(cajas)
    .where(and(eq(cajas.id, cajaId), isNull(cajas.eliminadoEn)))
    .limit(1);
  return fila ?? null;
}

export async function crearCaja(data: { tenantId: string; sucursalId: string; nombre: string }) {
  const [fila] = await db.insert(cajas).values(data).returning();
  return fila;
}

// --- Turnos ----------------------------------------------------------------

export async function obtenerTurnoPorId(turnoId: string) {
  const [fila] = await db.select().from(turnosCaja).where(eq(turnosCaja.id, turnoId)).limit(1);
  return fila ?? null;
}

export async function obtenerTurnoAbiertoDeCaja(cajaId: string) {
  const [fila] = await db
    .select()
    .from(turnosCaja)
    .where(and(eq(turnosCaja.cajaId, cajaId), eq(turnosCaja.estado, "abierto")))
    .limit(1);
  return fila ?? null;
}

/** El turno abierto de una sucursal (si hay varias cajas abiertas, el mas antiguo). */
export async function obtenerTurnoAbiertoDeSucursal(tenantId: string, sucursalId: string) {
  const [fila] = await db
    .select({ turno: turnosCaja })
    .from(turnosCaja)
    .innerJoin(cajas, eq(cajas.id, turnosCaja.cajaId))
    .where(
      and(
        eq(turnosCaja.tenantId, tenantId),
        eq(turnosCaja.estado, "abierto"),
        eq(cajas.sucursalId, sucursalId),
        isNull(cajas.eliminadoEn)
      )
    )
    .orderBy(turnosCaja.abiertoEn)
    .limit(1);
  return fila?.turno ?? null;
}

/**
 * Abre un turno con numero correlativo por negocio. El advisory lock serializa la
 * numeracion (dos aperturas simultaneas en cajas distintas no repiten numero); la
 * regla "un solo turno abierto por caja" la sostiene el indice unico parcial.
 */
export async function abrirTurnoTx(data: {
  tenantId: string;
  cajaId: string;
  abiertoPor: string;
  fondoInicial: string;
}) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${"turno_caja:" + data.tenantId}, 0))`);
    const [{ ultimo }] = await tx
      .select({ ultimo: sql<number>`coalesce(max(${turnosCaja.numero}), 0)::int` })
      .from(turnosCaja)
      .where(eq(turnosCaja.tenantId, data.tenantId));
    const [turno] = await tx
      .insert(turnosCaja)
      .values({ ...data, numero: ultimo + 1 })
      .returning();
    return turno;
  });
}

/** Cierra el turno UNA vez: si ya estaba cerrado no toca nada y devuelve null. */
export async function cerrarTurno(
  turnoId: string,
  data: {
    cerradoPor: string;
    ventasCantidad: number;
    ventasTotal: string;
    totalesPorMedio: unknown;
    efectivoEsperado: string;
    efectivoContado: string;
    diferencia: string;
    observaciones: string | null;
  }
) {
  const [fila] = await db
    .update(turnosCaja)
    .set({ ...data, estado: "cerrado", cerradoEn: new Date() })
    .where(and(eq(turnosCaja.id, turnoId), eq(turnosCaja.estado, "abierto")))
    .returning();
  return fila ?? null;
}

export async function listarTurnos(
  tenantId: string,
  filtros: {
    inicio?: Date;
    fin?: Date;
    cajaId?: string;
    estado?: "abierto" | "cerrado";
    conDiferencia?: boolean;
  }
) {
  return db
    .select({ turno: turnosCaja, cajaNombre: cajas.nombre })
    .from(turnosCaja)
    .innerJoin(cajas, eq(cajas.id, turnosCaja.cajaId))
    .where(
      and(
        eq(turnosCaja.tenantId, tenantId),
        filtros.inicio ? gte(turnosCaja.abiertoEn, filtros.inicio) : undefined,
        filtros.fin ? lt(turnosCaja.abiertoEn, filtros.fin) : undefined,
        filtros.cajaId ? eq(turnosCaja.cajaId, filtros.cajaId) : undefined,
        filtros.estado ? eq(turnosCaja.estado, filtros.estado) : undefined,
        filtros.conDiferencia === undefined
          ? undefined
          : filtros.conDiferencia
            ? sql`${turnosCaja.diferencia} is not null and ${turnosCaja.diferencia} <> 0`
            : sql`${turnosCaja.estado} = 'cerrado' and ${turnosCaja.diferencia} = 0`
      )
    )
    .orderBy(desc(turnosCaja.abiertoEn));
}

// --- Movimientos -----------------------------------------------------------

export async function crearMovimiento(data: typeof movimientosCaja.$inferInsert) {
  const [fila] = await db.insert(movimientosCaja).values(data).returning();
  return fila;
}

export async function sumarMovimientos(turnoId: string) {
  const filas = await db
    .select({
      tipo: movimientosCaja.tipo,
      total: sql<string>`coalesce(sum(${movimientosCaja.monto}), 0)`,
    })
    .from(movimientosCaja)
    .where(eq(movimientosCaja.turnoId, turnoId))
    .groupBy(movimientosCaja.tipo);
  const total = (tipo: "entrada" | "salida") => Number(filas.find((f) => f.tipo === tipo)?.total ?? 0);
  return { entradas: total("entrada"), salidas: total("salida") };
}

export async function listarMovimientos(turnoId: string) {
  return db
    .select()
    .from(movimientosCaja)
    .where(eq(movimientosCaja.turnoId, turnoId))
    .orderBy(movimientosCaja.creadoEn);
}
