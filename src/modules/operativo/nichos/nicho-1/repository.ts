import { and, asc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  bajas,
  gruposModificadores,
  insumos,
  modificadores,
  movimientosInsumo,
  produccionesAjuste,
  producciones,
  productosGruposModificadores,
  recetaInsumos,
  recetas,
  stockInsumo,
  vinculacionesProductoReceta,
} from "./schema";

export type NuevoGrupoModificadores = typeof gruposModificadores.$inferInsert;
export type NuevoModificador = typeof modificadores.$inferInsert;
export type NuevaBaja = typeof bajas.$inferInsert;
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

/** Stock de un Insumo en todas sus sucursales — mismo patron que
 * listarStockPorProducto en Modulo 2, usado por fichaInsumo(). */
export async function listarStockPorInsumo(insumoId: string) {
  return db.select().from(stockInsumo).where(eq(stockInsumo.insumoId, insumoId));
}

/** Historial de movimientos de un Insumo en una sucursal — mismo patron que
 * listarMovimientosStock en Modulo 2, usado por listarMovimientosInsumo(). */
export async function listarMovimientosPorInsumo(insumoId: string, sucursalId: string) {
  return db
    .select()
    .from(movimientosInsumo)
    .where(
      and(eq(movimientosInsumo.insumoId, insumoId), eq(movimientosInsumo.sucursalId, sucursalId))
    )
    .orderBy(movimientosInsumo.creadoEn);
}

/**
 * Recalcula cantidad_actual desde movimientos_insumo (fuente de verdad) y
 * hace upsert de stock_insumo, dentro de la misma transaccion que inserta
 * el movimiento — mismo patron que Modulo 2, y con el mismo lock por
 * (insumo, sucursal) que cerro DA-45 en Productos (ver
 * `recalcularCantidadActualTx` en productos/repository.ts): sin el, movimientos
 * simultaneos del mismo insumo dejaban el cache por debajo del ledger.
 */
async function recalcularCantidadActualInsumoTx(
  tx: Tx,
  insumoId: string,
  sucursalId: string
): Promise<number> {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${"stock_insumo:" + insumoId + ":" + sucursalId}, 0))`
  );
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

export async function actualizarModoConsumoVinculacion(
  vinculacionId: string,
  modoConsumo: "al_producir" | "al_vender"
) {
  const [vinculacion] = await db
    .update(vinculacionesProductoReceta)
    .set({ modoConsumo })
    .where(eq(vinculacionesProductoReceta.id, vinculacionId))
    .returning();
  return vinculacion;
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
 * por Activo en un periodo.
 *
 * `[inicio, fin)` semiabierto, ya traducido desde dias locales por
 * `rangoInstantes()` en la capa de acciones (H-49): `fecha_produccion` es un
 * timestamp, y con `<= fin` quedaba afuera todo lo producido durante el ultimo
 * dia del rango. */
export async function listarProduccionesPorActivoEnPeriodo(
  activoId: string,
  inicio: Date,
  fin: Date
) {
  return db
    .select()
    .from(producciones)
    .where(
      and(
        eq(producciones.activoId, activoId),
        isNull(producciones.eliminadoEn),
        gte(producciones.fechaProduccion, inicio),
        lt(producciones.fechaProduccion, fin)
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

export async function consultarMermaPeriodo(tenantId: string, inicio: Date, fin: Date) {
  const [{ total }] = await db
    .select({ total: sql<string>`coalesce(sum(${producciones.mermaCosto}), 0)` })
    .from(producciones)
    .where(
      and(
        eq(producciones.tenantId, tenantId),
        isNull(producciones.eliminadoEn),
        gte(producciones.fechaProduccion, inicio),
        lt(producciones.fechaProduccion, fin)
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
    // Secuencial a proposito: recalcularCantidadActualInsumoTx hace un
    // select-existente-then-insert/update sobre stock_insumo (clave
    // insumo+sucursal). Si la misma receta repite un insumo en mas de una
    // linea, dos recalculos concurrentes para la misma clave podrian
    // pisarse o chocar contra el unique index (ninguno ve el upsert del
    // otro todavia) — no hay garantia de eso hoy en el schema de
    // receta_insumos, asi que no se puede asumir que las claves son
    // siempre distintas. La coleccion es chica (items de una receta), el
    // costo de ir secuencial acá es despreciable.
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

// --- Consumo de insumos al vender (Fase 1 Cafiatto) -------------------------

/**
 * Recetas de los productos vinculados en modo `al_vender`, con su composicion.
 * Dos consultas para N productos (nada de una ficha por fila). Solo recetas
 * del tenant y no eliminadas.
 */
export async function obtenerRecetasAlVender(tenantId: string, productoIds: string[]) {
  if (productoIds.length === 0) return [];
  const vinculos = await db
    .select({
      productoId: vinculacionesProductoReceta.productoId,
      recetaId: vinculacionesProductoReceta.recetaId,
      cantidadBase: vinculacionesProductoReceta.cantidadBaseConsumidaPorUnidad,
      rendimientoPorLote: recetas.rendimientoPorLote,
    })
    .from(vinculacionesProductoReceta)
    .innerJoin(recetas, eq(vinculacionesProductoReceta.recetaId, recetas.id))
    .where(
      and(
        inArray(vinculacionesProductoReceta.productoId, productoIds),
        eq(vinculacionesProductoReceta.modoConsumo, "al_vender"),
        isNull(vinculacionesProductoReceta.eliminadoEn),
        eq(recetas.tenantId, tenantId),
        isNull(recetas.eliminadoEn)
      )
    );
  if (vinculos.length === 0) return [];

  const lineas = await db
    .select({
      recetaId: recetaInsumos.recetaId,
      insumoId: recetaInsumos.insumoId,
      cantidadPorLote: recetaInsumos.cantidadPorLote,
      insumoNombre: insumos.nombre,
      costoUnitarioVigente: insumos.costoUnitarioVigente,
    })
    .from(recetaInsumos)
    .innerJoin(insumos, eq(recetaInsumos.insumoId, insumos.id))
    .where(
      inArray(
        recetaInsumos.recetaId,
        vinculos.map((v) => v.recetaId)
      )
    );

  return vinculos.map((v) => ({
    ...v,
    composicion: lineas.filter((l) => l.recetaId === v.recetaId),
  }));
}

/** Productos del tenant que se preparan al vender (vinculacion vigente en ese modo). */
export async function listarProductoIdsAlVender(tenantId: string) {
  const filas = await db
    .select({ productoId: vinculacionesProductoReceta.productoId })
    .from(vinculacionesProductoReceta)
    .innerJoin(recetas, eq(vinculacionesProductoReceta.recetaId, recetas.id))
    .where(
      and(
        eq(vinculacionesProductoReceta.modoConsumo, "al_vender"),
        isNull(vinculacionesProductoReceta.eliminadoEn),
        eq(recetas.tenantId, tenantId),
        isNull(recetas.eliminadoEn)
      )
    );
  return filas.map((f) => f.productoId);
}

/**
 * Fase 6: productos que se preparan al vender pero cuya receta no tiene ningun insumo. Venderlos
 * no descontaria nada ni tendria costo: el punto de venta los oculta hasta que la receta se complete.
 */
export async function listarProductoIdsAlVenderSinInsumos(tenantId: string) {
  const filas = await db
    .select({ productoId: vinculacionesProductoReceta.productoId })
    .from(vinculacionesProductoReceta)
    .innerJoin(recetas, eq(vinculacionesProductoReceta.recetaId, recetas.id))
    .where(
      and(
        eq(vinculacionesProductoReceta.modoConsumo, "al_vender"),
        isNull(vinculacionesProductoReceta.eliminadoEn),
        eq(recetas.tenantId, tenantId),
        isNull(recetas.eliminadoEn),
        sql`not exists (select 1 from ${recetaInsumos} where ${recetaInsumos.recetaId} = ${recetas.id})`
      )
    );
  return filas.map((f) => f.productoId);
}

/** Saldo de varios insumos en una sucursal, en una sola consulta. */
export async function obtenerStockInsumosEnSucursal(insumoIds: string[], sucursalId: string) {
  if (insumoIds.length === 0) return [];
  return db
    .select({ insumoId: stockInsumo.insumoId, cantidadActual: stockInsumo.cantidadActual })
    .from(stockInsumo)
    .where(and(inArray(stockInsumo.insumoId, insumoIds), eq(stockInsumo.sucursalId, sucursalId)));
}

export async function contarInsumosDelTenant(tenantId: string, insumoIds: string[]) {
  if (insumoIds.length === 0) return 0;
  const filas = await db
    .select({ id: insumos.id })
    .from(insumos)
    .where(and(inArray(insumos.id, insumoIds), eq(insumos.tenantId, tenantId)));
  return filas.length;
}

/**
 * Descuenta de golpe los insumos de una venta: un movimiento `salida_venta`
 * por insumo (ya agregado por quien llama) y el recalculo del saldo, todo en
 * una transaccion. Secuencial por la misma razon que `crearProduccionTx`.
 */
export async function crearConsumosVentaTx(data: {
  ventaId: string;
  sucursalId: string;
  creadoPor: string;
  consumos: Array<{ insumoId: string; cantidad: string; costoUnitarioEnMovimiento: string }>;
}) {
  return db.transaction(async (tx) => {
    const saldos: Array<{ insumoId: string; cantidadActual: number }> = [];
    for (const consumo of data.consumos) {
      await tx.insert(movimientosInsumo).values({
        insumoId: consumo.insumoId,
        sucursalId: data.sucursalId,
        tipo: "salida_venta",
        cantidad: consumo.cantidad,
        costoUnitarioEnMovimiento: consumo.costoUnitarioEnMovimiento,
        referenciaId: data.ventaId,
        creadoPor: data.creadoPor,
      });
      const cantidadActual = await recalcularCantidadActualInsumoTx(
        tx,
        consumo.insumoId,
        data.sucursalId
      );
      saldos.push({ insumoId: consumo.insumoId, cantidadActual });
    }
    return saldos;
  });
}

// --- Modificadores (Fase 3 Cafiatto) -----------------------------------------

export async function obtenerInsumosPorIds(tenantId: string, insumoIds: string[]) {
  if (insumoIds.length === 0) return [];
  return db
    .select({
      id: insumos.id,
      nombre: insumos.nombre,
      costoUnitarioVigente: insumos.costoUnitarioVigente,
    })
    .from(insumos)
    .where(and(inArray(insumos.id, insumoIds), eq(insumos.tenantId, tenantId), isNull(insumos.eliminadoEn)));
}

/**
 * Grupos de modificadores ofrecidos a cada producto, con sus opciones. Una sola
 * consulta para N productos. Solo lo no eliminado y del tenant.
 */
export async function obtenerModificadoresParaProductos(tenantId: string, productoIds: string[]) {
  if (productoIds.length === 0) return [];
  return db
    .select({
      productoId: productosGruposModificadores.productoId,
      grupoId: gruposModificadores.id,
      grupoNombre: gruposModificadores.nombre,
      seleccion: gruposModificadores.seleccion,
      grupoOrden: gruposModificadores.orden,
      modificadorId: modificadores.id,
      nombre: modificadores.nombre,
      tipo: modificadores.tipo,
      esBase: modificadores.esBase,
      precioExtra: modificadores.precioExtra,
      insumoId: modificadores.insumoId,
      cantidad: modificadores.cantidad,
      insumoReemplazadoId: modificadores.insumoReemplazadoId,
      orden: modificadores.orden,
    })
    .from(productosGruposModificadores)
    .innerJoin(gruposModificadores, eq(productosGruposModificadores.grupoId, gruposModificadores.id))
    .innerJoin(modificadores, eq(modificadores.grupoId, gruposModificadores.id))
    .where(
      and(
        inArray(productosGruposModificadores.productoId, productoIds),
        isNull(productosGruposModificadores.eliminadoEn),
        eq(gruposModificadores.tenantId, tenantId),
        isNull(gruposModificadores.eliminadoEn),
        isNull(modificadores.eliminadoEn)
      )
    )
    .orderBy(asc(gruposModificadores.orden), asc(modificadores.orden));
}

export async function crearGrupoModificadores(data: NuevoGrupoModificadores) {
  const [grupo] = await db.insert(gruposModificadores).values(data).returning();
  return grupo;
}

export async function obtenerGrupoModificadoresPorId(grupoId: string) {
  const [grupo] = await db
    .select()
    .from(gruposModificadores)
    .where(and(eq(gruposModificadores.id, grupoId), isNull(gruposModificadores.eliminadoEn)))
    .limit(1);
  return grupo ?? null;
}

export async function actualizarGrupoModificadores(
  grupoId: string,
  data: Partial<Pick<NuevoGrupoModificadores, "nombre" | "seleccion" | "orden">>
) {
  const [grupo] = await db
    .update(gruposModificadores)
    .set(data)
    .where(eq(gruposModificadores.id, grupoId))
    .returning();
  return grupo;
}

/** Soft delete del grupo y, con el, de sus opciones y de sus vinculos a productos. */
export async function eliminarGrupoModificadoresSoft(grupoId: string) {
  const ahora = new Date();
  await db.transaction(async (tx) => {
    await tx.update(gruposModificadores).set({ eliminadoEn: ahora }).where(eq(gruposModificadores.id, grupoId));
    await tx
      .update(modificadores)
      .set({ eliminadoEn: ahora })
      .where(and(eq(modificadores.grupoId, grupoId), isNull(modificadores.eliminadoEn)));
    await tx
      .update(productosGruposModificadores)
      .set({ eliminadoEn: ahora })
      .where(and(eq(productosGruposModificadores.grupoId, grupoId), isNull(productosGruposModificadores.eliminadoEn)));
  });
}

export async function listarGruposConModificadores(tenantId: string) {
  const grupos = await db
    .select()
    .from(gruposModificadores)
    .where(and(eq(gruposModificadores.tenantId, tenantId), isNull(gruposModificadores.eliminadoEn)))
    .orderBy(asc(gruposModificadores.orden), asc(gruposModificadores.nombre));
  if (grupos.length === 0) return [];
  const opciones = await db
    .select()
    .from(modificadores)
    .where(
      and(
        inArray(
          modificadores.grupoId,
          grupos.map((g) => g.id)
        ),
        isNull(modificadores.eliminadoEn)
      )
    )
    .orderBy(asc(modificadores.orden), asc(modificadores.nombre));
  const vinculos = await db
    .select({
      grupoId: productosGruposModificadores.grupoId,
      productoId: productosGruposModificadores.productoId,
    })
    .from(productosGruposModificadores)
    .where(
      and(
        inArray(
          productosGruposModificadores.grupoId,
          grupos.map((g) => g.id)
        ),
        isNull(productosGruposModificadores.eliminadoEn)
      )
    );
  return grupos.map((g) => ({
    ...g,
    modificadores: opciones.filter((m) => m.grupoId === g.id),
    productoIds: vinculos.filter((v) => v.grupoId === g.id).map((v) => v.productoId),
  }));
}

export async function crearModificador(data: NuevoModificador) {
  const [modificador] = await db.insert(modificadores).values(data).returning();
  return modificador;
}

export async function obtenerModificadorPorId(modificadorId: string) {
  const [modificador] = await db
    .select()
    .from(modificadores)
    .where(and(eq(modificadores.id, modificadorId), isNull(modificadores.eliminadoEn)))
    .limit(1);
  return modificador ?? null;
}

export async function actualizarModificador(
  modificadorId: string,
  data: Partial<
    Pick<
      NuevoModificador,
      "nombre" | "tipo" | "esBase" | "precioExtra" | "insumoId" | "cantidad" | "insumoReemplazadoId" | "orden"
    >
  >
) {
  const [modificador] = await db
    .update(modificadores)
    .set(data)
    .where(eq(modificadores.id, modificadorId))
    .returning();
  return modificador;
}

export async function eliminarModificadorSoft(modificadorId: string) {
  await db.update(modificadores).set({ eliminadoEn: new Date() }).where(eq(modificadores.id, modificadorId));
}

export async function existeBaseEnGrupo(grupoId: string, exceptoModificadorId?: string) {
  const filas = await db
    .select({ id: modificadores.id })
    .from(modificadores)
    .where(
      and(eq(modificadores.grupoId, grupoId), eq(modificadores.esBase, true), isNull(modificadores.eliminadoEn))
    );
  return filas.some((f) => f.id !== exceptoModificadorId);
}

export async function vincularGrupoAProducto(productoId: string, grupoId: string) {
  const [existente] = await db
    .select({ id: productosGruposModificadores.id })
    .from(productosGruposModificadores)
    .where(
      and(
        eq(productosGruposModificadores.productoId, productoId),
        eq(productosGruposModificadores.grupoId, grupoId),
        isNull(productosGruposModificadores.eliminadoEn)
      )
    )
    .limit(1);
  if (existente) return existente;
  const [vinculo] = await db
    .insert(productosGruposModificadores)
    .values({ productoId, grupoId })
    .returning({ id: productosGruposModificadores.id });
  return vinculo;
}

export async function desvincularGrupoDeProducto(productoId: string, grupoId: string) {
  await db
    .update(productosGruposModificadores)
    .set({ eliminadoEn: new Date() })
    .where(
      and(
        eq(productosGruposModificadores.productoId, productoId),
        eq(productosGruposModificadores.grupoId, grupoId),
        isNull(productosGruposModificadores.eliminadoEn)
      )
    );
}

// --- Bajas (Fase 2 Cafiatto) -------------------------------------------------

/** Baja de un insumo: registro + movimiento `salida_baja` + saldo, todo o nada. */
export async function crearBajaInsumoTx(data: {
  baja: Omit<NuevaBaja, "id" | "creadoEn">;
  costoUnitarioEnMovimiento: string;
}) {
  return db.transaction(async (tx) => {
    const [baja] = await tx.insert(bajas).values(data.baja).returning();
    await tx.insert(movimientosInsumo).values({
      insumoId: data.baja.insumoId!,
      sucursalId: data.baja.sucursalId,
      tipo: "salida_baja",
      cantidad: data.baja.cantidad,
      costoUnitarioEnMovimiento: data.costoUnitarioEnMovimiento,
      motivo: data.baja.motivo,
      referenciaId: baja.id,
      creadoPor: data.baja.creadoPor,
    });
    const cantidadActual = await recalcularCantidadActualInsumoTx(
      tx,
      data.baja.insumoId!,
      data.baja.sucursalId
    );
    return { baja, saldos: [{ insumoId: data.baja.insumoId!, cantidadActual }] };
  });
}

/** Baja de un producto preparado: registro + un `salida_baja` por insumo de su receta. */
export async function crearBajaProductoConRecetaTx(data: {
  baja: Omit<NuevaBaja, "id" | "creadoEn">;
  consumos: Array<{ insumoId: string; cantidad: string; costoUnitarioEnMovimiento: string }>;
}) {
  return db.transaction(async (tx) => {
    const [baja] = await tx.insert(bajas).values(data.baja).returning();
    const saldos: Array<{ insumoId: string; cantidadActual: number }> = [];
    for (const consumo of data.consumos) {
      await tx.insert(movimientosInsumo).values({
        insumoId: consumo.insumoId,
        sucursalId: data.baja.sucursalId,
        tipo: "salida_baja",
        cantidad: consumo.cantidad,
        costoUnitarioEnMovimiento: consumo.costoUnitarioEnMovimiento,
        motivo: data.baja.motivo,
        referenciaId: baja.id,
        creadoPor: data.baja.creadoPor,
      });
      saldos.push({
        insumoId: consumo.insumoId,
        cantidadActual: await recalcularCantidadActualInsumoTx(tx, consumo.insumoId, data.baja.sucursalId),
      });
    }
    return { baja, saldos };
  });
}

/** Solo el registro: el movimiento de stock terminado lo escribe Productos. */
export async function crearBaja(data: Omit<NuevaBaja, "id" | "creadoEn">) {
  const [baja] = await db.insert(bajas).values(data).returning();
  return baja;
}

export async function listarBajasEnPeriodo(
  tenantId: string,
  inicio: Date,
  fin: Date,
  sucursalId?: string
) {
  return db
    .select({
      id: bajas.id,
      sucursalId: bajas.sucursalId,
      tipo: bajas.tipo,
      insumoId: bajas.insumoId,
      insumoNombre: insumos.nombre,
      productoId: bajas.productoId,
      cantidad: bajas.cantidad,
      motivo: bajas.motivo,
      nota: bajas.nota,
      costoTotal: bajas.costoTotal,
      costoDesconocido: bajas.costoDesconocido,
      creadoPor: bajas.creadoPor,
      creadoEn: bajas.creadoEn,
    })
    .from(bajas)
    .leftJoin(insumos, eq(bajas.insumoId, insumos.id))
    .where(
      and(
        eq(bajas.tenantId, tenantId),
        gte(bajas.creadoEn, inicio),
        lt(bajas.creadoEn, fin),
        sucursalId ? eq(bajas.sucursalId, sucursalId) : undefined
      )
    )
    .orderBy(sql`${bajas.creadoEn} desc`);
}

/** Total por motivo. `sinCostoConocido` cuenta las bajas cuyo costo no se pudo calcular. */
export async function resumirBajasPorMotivo(tenantId: string, inicio: Date, fin: Date) {
  return db
    .select({
      motivo: bajas.motivo,
      cantidadBajas: sql<number>`count(*)::int`,
      costoTotal: sql<string>`coalesce(sum(${bajas.costoTotal}), 0)`,
      sinCostoConocido: sql<number>`count(*) filter (where ${bajas.costoDesconocido})::int`,
    })
    .from(bajas)
    .where(and(eq(bajas.tenantId, tenantId), gte(bajas.creadoEn, inicio), lt(bajas.creadoEn, fin)))
    .groupBy(bajas.motivo);
}

export async function crearProduccionAjuste(data: NuevaProduccionAjuste) {
  const [ajuste] = await db.insert(produccionesAjuste).values(data).returning();
  return ajuste;
}
