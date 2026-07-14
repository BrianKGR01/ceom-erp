import { and, asc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  insumos,
  movimientosInsumo,
  produccionesAjuste,
  producciones,
  recetaInsumos,
  recetas,
  stockInsumo,
  vinculacionesProductoReceta,
} from "./schema";

export type NuevoInsumo = typeof insumos.$inferInsert;
export type NuevoMovimientoInsumo = typeof movimientosInsumo.$inferInsert;
export type NuevaReceta = typeof recetas.$inferInsert;
export type NuevaVinculacion = typeof vinculacionesProductoReceta.$inferInsert;
export type NuevaProduccion = typeof producciones.$inferInsert;
export type NuevaProduccionAjuste = typeof produccionesAjuste.$inferInsert;

type TipoMovimientoInsumo = (typeof movimientosInsumo.$inferSelect)["tipo"];
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// "entrada_*" suma, "salida_*" resta — misma logica que signoMovimiento() en
// Modulo 2, aca para el ledger de Insumo (Modulo_06 seccion 1.2).
const TIPOS_ENTRADA_INSUMO = new Set<TipoMovimientoInsumo>(["entrada_compra", "entrada_ajuste_manual"]);

export function signoMovimientoInsumo(tipo: TipoMovimientoInsumo): 1 | -1 {
  return TIPOS_ENTRADA_INSUMO.has(tipo) ? 1 : -1;
}

/** Costo promedio ponderado (Modulo_06 seccion 3.1) — se recalcula en cada
 * entrada_compra, nunca se edita a mano. */
export function calcularCostoPromedioPonderado(
  stockActual: number,
  costoPromedioActual: number | null,
  cantidadComprada: number,
  costoCompra: number
): number {
  const denominador = stockActual + cantidadComprada;
  if (denominador === 0) return costoCompra;
  return (stockActual * (costoPromedioActual ?? 0) + cantidadComprada * costoCompra) / denominador;
}

// --- Insumos ---------------------------------------------------------

export async function crearInsumo(data: NuevoInsumo) {
  const [insumo] = await db.insert(insumos).values(data).returning();
  return insumo;
}

export async function obtenerInsumoPorId(insumoId: string) {
  const filas = await db
    .select()
    .from(insumos)
    .where(and(eq(insumos.id, insumoId), isNull(insumos.eliminadoEn)))
    .limit(1);
  return filas[0] ?? null;
}

export async function actualizarInsumo(
  insumoId: string,
  data: Partial<Omit<NuevoInsumo, "id" | "tenantId">>
) {
  const [insumo] = await db
    .update(insumos)
    .set(data)
    .where(eq(insumos.id, insumoId))
    .returning();
  return insumo;
}

export async function eliminarInsumoSoft(insumoId: string) {
  const [insumo] = await db
    .update(insumos)
    .set({ eliminadoEn: new Date() })
    .where(eq(insumos.id, insumoId))
    .returning();
  return insumo;
}

export async function listarInsumosPorTenant(tenantId: string) {
  return db
    .select()
    .from(insumos)
    .where(and(eq(insumos.tenantId, tenantId), isNull(insumos.eliminadoEn)));
}

// --- Stock de Insumo ---------------------------------------------------------

export async function obtenerStockInsumo(insumoId: string, sucursalId: string) {
  const filas = await db
    .select()
    .from(stockInsumo)
    .where(and(eq(stockInsumo.insumoId, insumoId), eq(stockInsumo.sucursalId, sucursalId)))
    .limit(1);
  return filas[0] ?? null;
}

/**
 * Recalcula cantidad_actual desde movimientos_insumo (fuente de verdad) y
 * hace upsert de stock_insumo, dentro de la misma transaccion que inserta
 * el movimiento — mismo patron que Modulo 2.
 */
async function recalcularCantidadActualInsumoTx(
  tx: Tx,
  insumoId: string,
  sucursalId: string
): Promise<number> {
  const filasPorTipo = await tx
    .select({
      tipo: movimientosInsumo.tipo,
      total: sql<string>`coalesce(sum(${movimientosInsumo.cantidad}), 0)`,
    })
    .from(movimientosInsumo)
    .where(
      and(eq(movimientosInsumo.insumoId, insumoId), eq(movimientosInsumo.sucursalId, sucursalId))
    )
    .groupBy(movimientosInsumo.tipo);

  const cantidadActual = filasPorTipo.reduce(
    (acumulado, fila) => acumulado + signoMovimientoInsumo(fila.tipo) * Number(fila.total),
    0
  );

  const [filaExistente] = await tx
    .select({ id: stockInsumo.id })
    .from(stockInsumo)
    .where(and(eq(stockInsumo.insumoId, insumoId), eq(stockInsumo.sucursalId, sucursalId)))
    .limit(1);

  if (filaExistente) {
    await tx
      .update(stockInsumo)
      .set({ cantidadActual: String(cantidadActual), actualizadoEn: new Date() })
      .where(eq(stockInsumo.id, filaExistente.id));
  } else {
    await tx
      .insert(stockInsumo)
      .values({ insumoId, sucursalId, cantidadActual: String(cantidadActual) });
  }

  return cantidadActual;
}

/** Ajuste manual / merma de almacenamiento (Modulo_06 seccion 1.2, caso
 * borde 6) — motivo obligatorio validado en actions.ts. */
export async function crearMovimientoInsumoTx(data: NuevoMovimientoInsumo) {
  return db.transaction(async (tx) => {
    const [movimiento] = await tx.insert(movimientosInsumo).values(data).returning();
    const cantidadActual = await recalcularCantidadActualInsumoTx(
      tx,
      data.insumoId,
      data.sucursalId
    );
    return { movimiento, cantidadActual };
  });
}

/**
 * entrada_compra (Modulo_06 seccion 3.1): ademas de sumar stock, recalcula
 * costo_unitario_vigente del Insumo (promedio ponderado) en la misma
 * transaccion — usa el stock ANTES de esta entrada para el calculo.
 */
export async function crearEntradaCompraInsumoTx(data: {
  insumoId: string;
  sucursalId: string;
  cantidad: string;
  costoCompra: string;
  fechaVencimiento?: string | null;
  referenciaId?: string | null;
  creadoPor?: string | null;
}) {
  return db.transaction(async (tx) => {
    const [insumoAntes] = await tx
      .select({ costoUnitarioVigente: insumos.costoUnitarioVigente })
      .from(insumos)
      .where(eq(insumos.id, data.insumoId));
    const [stockAntes] = await tx
      .select({ cantidadActual: stockInsumo.cantidadActual })
      .from(stockInsumo)
      .where(
        and(eq(stockInsumo.insumoId, data.insumoId), eq(stockInsumo.sucursalId, data.sucursalId))
      );

    const nuevoCostoPromedio = calcularCostoPromedioPonderado(
      stockAntes ? Number(stockAntes.cantidadActual) : 0,
      insumoAntes?.costoUnitarioVigente !== null && insumoAntes?.costoUnitarioVigente !== undefined
        ? Number(insumoAntes.costoUnitarioVigente)
        : null,
      Number(data.cantidad),
      Number(data.costoCompra)
    );

    const [movimiento] = await tx
      .insert(movimientosInsumo)
      .values({
        insumoId: data.insumoId,
        sucursalId: data.sucursalId,
        tipo: "entrada_compra",
        cantidad: data.cantidad,
        // El costo de ESTA compra especifica, no el promedio recalculado
        // (Modulo_06 seccion 1.2).
        costoUnitarioEnMovimiento: data.costoCompra,
        fechaVencimiento: data.fechaVencimiento,
        referenciaId: data.referenciaId,
        creadoPor: data.creadoPor,
      })
      .returning();

    const cantidadActual = await recalcularCantidadActualInsumoTx(
      tx,
      data.insumoId,
      data.sucursalId
    );

    await tx
      .update(insumos)
      .set({ costoUnitarioVigente: String(nuevoCostoPromedio) })
      .where(eq(insumos.id, data.insumoId));

    return { movimiento, cantidadActual, costoUnitarioVigente: nuevoCostoPromedio };
  });
}

// --- Recetas ---------------------------------------------------------

export async function crearReceta(data: NuevaReceta) {
  const [receta] = await db.insert(recetas).values(data).returning();
  return receta;
}

export async function obtenerRecetaPorId(recetaId: string) {
  const filas = await db
    .select()
    .from(recetas)
    .where(and(eq(recetas.id, recetaId), isNull(recetas.eliminadoEn)))
    .limit(1);
  return filas[0] ?? null;
}

export async function actualizarReceta(
  recetaId: string,
  data: Partial<Omit<NuevaReceta, "id" | "tenantId">>
) {
  const [receta] = await db
    .update(recetas)
    .set(data)
    .where(eq(recetas.id, recetaId))
    .returning();
  return receta;
}

export async function eliminarRecetaSoft(recetaId: string) {
  const [receta] = await db
    .update(recetas)
    .set({ eliminadoEn: new Date() })
    .where(eq(recetas.id, recetaId))
    .returning();
  return receta;
}

export async function listarRecetasPorTenant(tenantId: string) {
  return db
    .select()
    .from(recetas)
    .where(and(eq(recetas.tenantId, tenantId), isNull(recetas.eliminadoEn)));
}

/** Reemplazo total de la composicion (mismo patron que
 * reemplazarPermisosRol en Identidad) — mas simple que un CRUD incremental
 * de lineas. */
export async function reemplazarComposicionReceta(
  recetaId: string,
  lineas: { insumoId: string; cantidadPorLote: string }[]
) {
  return db.transaction(async (tx) => {
    await tx.delete(recetaInsumos).where(eq(recetaInsumos.recetaId, recetaId));
    if (lineas.length === 0) return [];
    return tx
      .insert(recetaInsumos)
      .values(lineas.map((linea) => ({ ...linea, recetaId })))
      .returning();
  });
}

export async function obtenerComposicionReceta(recetaId: string) {
  return db
    .select({
      insumoId: recetaInsumos.insumoId,
      cantidadPorLote: recetaInsumos.cantidadPorLote,
      insumoNombre: insumos.nombre,
      costoUnitarioVigente: insumos.costoUnitarioVigente,
    })
    .from(recetaInsumos)
    .innerJoin(insumos, eq(recetaInsumos.insumoId, insumos.id))
    .where(eq(recetaInsumos.recetaId, recetaId));
}

// --- Vinculacion Producto-Receta ---------------------------------------------------------

export async function crearVinculacion(data: NuevaVinculacion) {
  const [vinculacion] = await db.insert(vinculacionesProductoReceta).values(data).returning();
  return vinculacion;
}

export async function obtenerVinculacionPorProducto(productoId: string) {
  const filas = await db
    .select()
    .from(vinculacionesProductoReceta)
    .where(
      and(
        eq(vinculacionesProductoReceta.productoId, productoId),
        isNull(vinculacionesProductoReceta.eliminadoEn)
      )
    )
    .limit(1);
  return filas[0] ?? null;
}

export async function eliminarVinculacionSoft(vinculacionId: string) {
  const [vinculacion] = await db
    .update(vinculacionesProductoReceta)
    .set({ eliminadoEn: new Date() })
    .where(eq(vinculacionesProductoReceta.id, vinculacionId))
    .returning();
  return vinculacion;
}

// --- Producciones ---------------------------------------------------------

export async function obtenerProduccionPorId(produccionId: string) {
  const filas = await db
    .select()
    .from(producciones)
    .where(and(eq(producciones.id, produccionId), isNull(producciones.eliminadoEn)))
    .limit(1);
  return filas[0] ?? null;
}

export async function listarProduccionesPorTenant(tenantId: string) {
  return db
    .select()
    .from(producciones)
    .where(and(eq(producciones.tenantId, tenantId), isNull(producciones.eliminadoEn)))
    .orderBy(asc(producciones.fechaProduccion));
}

/** Usado por Capacidad Operativa (seccion 4) — produccion real registrada
 * por Activo en un periodo. */
export async function listarProduccionesPorActivoEnPeriodo(
  activoId: string,
  desde: Date,
  hasta: Date
) {
  return db
    .select()
    .from(producciones)
    .where(
      and(
        eq(producciones.activoId, activoId),
        isNull(producciones.eliminadoEn),
        gte(producciones.fechaProduccion, desde),
        lte(producciones.fechaProduccion, hasta)
      )
    );
}

/** Productos distintos que se produjeron alguna vez con este Activo — usado
 * para derivar "capacidad de almacenamiento usada" sin que Productos e
 * Inventario necesite saber nada de Activos (decision del plan). */
export async function listarProductosSucursalesPorActivo(activoId: string) {
  const filas = await db
    .selectDistinct({
      productoId: producciones.productoId,
      sucursalId: producciones.sucursalId,
    })
    .from(producciones)
    .where(and(eq(producciones.activoId, activoId), isNull(producciones.eliminadoEn)));
  return filas;
}

export async function consultarMermaPeriodo(tenantId: string, desde: Date, hasta: Date) {
  const [{ total }] = await db
    .select({ total: sql<string>`coalesce(sum(${producciones.mermaCosto}), 0)` })
    .from(producciones)
    .where(
      and(
        eq(producciones.tenantId, tenantId),
        isNull(producciones.eliminadoEn),
        gte(producciones.fechaProduccion, desde),
        lte(producciones.fechaProduccion, hasta)
      )
    );
  return Number(total);
}

/**
 * Registra el consumo de insumos (ledger, salida_produccion) y la
 * Produccion en una sola transaccion. La acreditacion del stock/costo hacia
 * Productos e Inventario ocurre DESPUES, fuera de esta transaccion (ver
 * ANCLA.md — gap de atomicidad cruzada aceptado a proposito).
 */
export async function crearProduccionTx(data: {
  produccion: NuevaProduccion;
  consumos: Array<{ insumoId: string; sucursalId: string; cantidad: string; costoUnitarioEnMovimiento: string }>;
}) {
  return db.transaction(async (tx) => {
    for (const consumo of data.consumos) {
      await tx.insert(movimientosInsumo).values({
        insumoId: consumo.insumoId,
        sucursalId: consumo.sucursalId,
        tipo: "salida_produccion",
        cantidad: consumo.cantidad,
        costoUnitarioEnMovimiento: consumo.costoUnitarioEnMovimiento,
        creadoPor: data.produccion.creadoPor,
      });
      await recalcularCantidadActualInsumoTx(tx, consumo.insumoId, consumo.sucursalId);
    }

    const [produccion] = await tx.insert(producciones).values(data.produccion).returning();
    return produccion;
  });
}

export async function crearProduccionAjuste(data: NuevaProduccionAjuste) {
  const [ajuste] = await db.insert(produccionesAjuste).values(data).returning();
  return ajuste;
}
