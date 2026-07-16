import { and, eq, isNull, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/db/client";
import { signoMovimiento } from "./signo-movimiento";
import {
  categoriasProducto,
  categoriasSugeridas,
  movimientosStock,
  productos,
  stock,
} from "./schema";

export type NuevaCategoria = typeof categoriasProducto.$inferInsert;
export type NuevaCategoriaSugerida = typeof categoriasSugeridas.$inferInsert;
export type NuevoProducto = typeof productos.$inferInsert;
export type NuevoMovimientoStock = typeof movimientosStock.$inferInsert;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export { signoMovimiento };

// --- Categorias ---------------------------------------------------------

export async function crearCategoria(data: NuevaCategoria) {
  const [categoria] = await db.insert(categoriasProducto).values(data).returning();
  return categoria;
}

export async function obtenerCategoriaPorId(categoriaId: string) {
  const filas = await db
    .select()
    .from(categoriasProducto)
    .where(
      and(eq(categoriasProducto.id, categoriaId), isNull(categoriasProducto.eliminadoEn))
    )
    .limit(1);
  return filas[0] ?? null;
}

export async function actualizarCategoria(
  categoriaId: string,
  data: Partial<Omit<NuevaCategoria, "id" | "tenantId">>
) {
  const [categoria] = await db
    .update(categoriasProducto)
    .set(data)
    .where(eq(categoriasProducto.id, categoriaId))
    .returning();
  return categoria;
}

export async function eliminarCategoriaSoft(categoriaId: string) {
  const [categoria] = await db
    .update(categoriasProducto)
    .set({ eliminadoEn: new Date() })
    .where(eq(categoriasProducto.id, categoriaId))
    .returning();
  return categoria;
}

export async function listarCategoriasPorTenant(tenantId: string) {
  return db
    .select()
    .from(categoriasProducto)
    .where(
      and(eq(categoriasProducto.tenantId, tenantId), isNull(categoriasProducto.eliminadoEn))
    );
}

// --- Categorias sugeridas (catalogo global, Panel Admin CEOM) --------------------

/** Sugerencias por Nicho + genericas (nicho_id null) — Modulo_02 seccion 2.2. */
export async function listarCategoriasSugeridas(
  opts: { nichoId?: string; soloActivas?: boolean } = {}
) {
  const condiciones = [];
  if (opts.nichoId) {
    condiciones.push(
      sql`(${categoriasSugeridas.nichoId} = ${opts.nichoId} or ${categoriasSugeridas.nichoId} is null)`
    );
  }
  if (opts.soloActivas) {
    condiciones.push(eq(categoriasSugeridas.activa, true));
  }
  return db
    .select()
    .from(categoriasSugeridas)
    .where(condiciones.length ? and(...condiciones) : undefined);
}

export async function crearCategoriaSugerida(data: NuevaCategoriaSugerida) {
  const [categoria] = await db.insert(categoriasSugeridas).values(data).returning();
  return categoria;
}

export async function actualizarActivaCategoriaSugerida(
  categoriaSugeridaId: string,
  activa: boolean
) {
  const [categoria] = await db
    .update(categoriasSugeridas)
    .set({ activa })
    .where(eq(categoriasSugeridas.id, categoriaSugeridaId))
    .returning();
  return categoria;
}

// --- Productos ---------------------------------------------------------

export async function crearProducto(data: NuevoProducto) {
  const [producto] = await db.insert(productos).values(data).returning();
  return producto;
}

export async function obtenerProductoPorId(productoId: string) {
  const filas = await db
    .select()
    .from(productos)
    .where(and(eq(productos.id, productoId), isNull(productos.eliminadoEn)))
    .limit(1);
  return filas[0] ?? null;
}

export async function actualizarProducto(
  productoId: string,
  data: Partial<Omit<NuevoProducto, "id" | "tenantId">>
) {
  const [producto] = await db
    .update(productos)
    .set(data)
    .where(eq(productos.id, productoId))
    .returning();
  return producto;
}

export async function eliminarProductoSoft(productoId: string) {
  const [producto] = await db
    .update(productos)
    .set({ eliminadoEn: new Date() })
    .where(eq(productos.id, productoId))
    .returning();
  return producto;
}

export async function listarProductosPorTenant(tenantId: string) {
  return db
    .select()
    .from(productos)
    .where(and(eq(productos.tenantId, tenantId), isNull(productos.eliminadoEn)));
}

// --- Stock ---------------------------------------------------------

export async function obtenerStock(productoId: string, sucursalId: string) {
  const filas = await db
    .select()
    .from(stock)
    .where(and(eq(stock.productoId, productoId), eq(stock.sucursalId, sucursalId)))
    .limit(1);
  return filas[0] ?? null;
}

/** Suma cantidad_actual de TODOS los productos del tenant en una sucursal —
 * roadmap item #12 (Nicho 4): insumo para consultarCapacidadAlmacenamiento-
 * Usada, que no tiene el historial de Producciones que usa Nicho 1 para
 * derivar el mismo dato. */
export async function sumarStockPorSucursal(
  tenantId: string,
  sucursalId: string
): Promise<number> {
  const [{ total }] = await db
    .select({ total: sql<string>`coalesce(sum(${stock.cantidadActual}), 0)` })
    .from(stock)
    .innerJoin(productos, eq(stock.productoId, productos.id))
    .where(
      and(
        eq(productos.tenantId, tenantId),
        eq(stock.sucursalId, sucursalId),
        isNull(productos.eliminadoEn)
      )
    );
  return Number(total);
}

/** Suma de stock de un producto en todas sus sucursales — usada por el caso
 * borde 1 (advertencia al eliminar un producto con stock positivo). */
export async function obtenerStockTotalProducto(productoId: string) {
  const [{ total }] = await db
    .select({ total: sql<string>`coalesce(sum(${stock.cantidadActual}), 0)` })
    .from(stock)
    .where(eq(stock.productoId, productoId));
  return Number(total);
}

/** Umbral de alerta (Modulo_02 seccion 2.4/5) — upsert directo, no pasa por
 * el ledger porque no cambia cantidad_actual, solo el umbral que la compara. */
export async function actualizarStockMinimo(
  productoId: string,
  sucursalId: string,
  stockMinimo: string | null
) {
  const filaExistente = await obtenerStock(productoId, sucursalId);
  if (filaExistente) {
    const [fila] = await db
      .update(stock)
      .set({ stockMinimo, actualizadoEn: new Date() })
      .where(eq(stock.id, filaExistente.id))
      .returning();
    return fila;
  }
  const [fila] = await db
    .insert(stock)
    .values({ productoId, sucursalId, stockMinimo })
    .returning();
  return fila;
}

/**
 * Recalcula cantidad_actual desde movimientos_stock (fuente de verdad) y
 * hace upsert de la fila de stock, dentro de la misma transaccion que
 * inserta el movimiento (Modulo_02 seccion 2.5: nunca se edita a mano).
 */
async function recalcularCantidadActualTx(
  tx: Tx,
  productoId: string,
  sucursalId: string
): Promise<number> {
  const filasPorTipo = await tx
    .select({
      tipo: movimientosStock.tipo,
      total: sql<string>`coalesce(sum(${movimientosStock.cantidad}), 0)`,
    })
    .from(movimientosStock)
    .where(
      and(
        eq(movimientosStock.productoId, productoId),
        eq(movimientosStock.sucursalId, sucursalId)
      )
    )
    .groupBy(movimientosStock.tipo);

  const cantidadActual = filasPorTipo.reduce(
    (acumulado, fila) => acumulado + signoMovimiento(fila.tipo) * Number(fila.total),
    0
  );

  const [filaExistente] = await tx
    .select({ id: stock.id })
    .from(stock)
    .where(and(eq(stock.productoId, productoId), eq(stock.sucursalId, sucursalId)))
    .limit(1);

  if (filaExistente) {
    await tx
      .update(stock)
      .set({ cantidadActual: String(cantidadActual), actualizadoEn: new Date() })
      .where(eq(stock.id, filaExistente.id));
  } else {
    await tx
      .insert(stock)
      .values({ productoId, sucursalId, cantidadActual: String(cantidadActual) });
  }

  return cantidadActual;
}

export async function crearMovimientoTx(data: NuevoMovimientoStock) {
  return db.transaction(async (tx) => {
    const [movimiento] = await tx.insert(movimientosStock).values(data).returning();
    const cantidadActual = await recalcularCantidadActualTx(
      tx,
      data.productoId,
      data.sucursalId
    );
    return { movimiento, cantidadActual };
  });
}

/** entrada_produccion (Modulo_02 seccion 3, caso de uso 4): ademas de sumar
 * stock, actualiza costo_operativo_vigente/origen_costo del producto en la
 * misma transaccion — hoy sin caller real (Modulo 6 no existe todavia). */
export async function crearEntradaProduccionTx(data: {
  productoId: string;
  sucursalId: string;
  cantidad: string;
  costoOperativo: string;
  referenciaId?: string | null;
  creadoPor?: string | null;
}) {
  return db.transaction(async (tx) => {
    const [movimiento] = await tx
      .insert(movimientosStock)
      .values({
        productoId: data.productoId,
        sucursalId: data.sucursalId,
        tipo: "entrada_produccion",
        cantidad: data.cantidad,
        referenciaId: data.referenciaId,
        creadoPor: data.creadoPor,
      })
      .returning();
    const cantidadActual = await recalcularCantidadActualTx(
      tx,
      data.productoId,
      data.sucursalId
    );
    await tx
      .update(productos)
      .set({ costoOperativoVigente: data.costoOperativo, origenCosto: "nicho_sugerido" })
      .where(eq(productos.id, data.productoId));
    return { movimiento, cantidadActual };
  });
}

/** entrada_compra_reventa (Modulo_02 seccion 3, caso de uso 5) — hoy sin
 * caller real (Proveedores no dispara el evento compra_registrada todavia). */
export async function crearEntradaCompraReventaTx(data: {
  productoId: string;
  sucursalId: string;
  cantidad: string;
  costoCompra: string;
  referenciaId?: string | null;
  creadoPor?: string | null;
}) {
  return db.transaction(async (tx) => {
    const [movimiento] = await tx
      .insert(movimientosStock)
      .values({
        productoId: data.productoId,
        sucursalId: data.sucursalId,
        tipo: "entrada_compra_reventa",
        cantidad: data.cantidad,
        referenciaId: data.referenciaId,
        creadoPor: data.creadoPor,
      })
      .returning();
    const cantidadActual = await recalcularCantidadActualTx(
      tx,
      data.productoId,
      data.sucursalId
    );
    await tx
      .update(productos)
      .set({ costoOperativoVigente: data.costoCompra, origenCosto: "proveedor_reventa" })
      .where(eq(productos.id, data.productoId));
    return { movimiento, cantidadActual };
  });
}

/** Transferencia entre sucursales: par de movimientos ligados por el mismo
 * referencia_id (Modulo_02 seccion 7, caso de uso 7), en una sola transaccion. */
export async function crearTransferenciaStockTx(data: {
  productoId: string;
  sucursalOrigenId: string;
  sucursalDestinoId: string;
  cantidad: string;
  creadoPor?: string | null;
}) {
  return db.transaction(async (tx) => {
    const referenciaId = randomUUID();

    const [salida] = await tx
      .insert(movimientosStock)
      .values({
        productoId: data.productoId,
        sucursalId: data.sucursalOrigenId,
        tipo: "salida_transferencia",
        cantidad: data.cantidad,
        referenciaId,
        creadoPor: data.creadoPor,
      })
      .returning();
    const [entrada] = await tx
      .insert(movimientosStock)
      .values({
        productoId: data.productoId,
        sucursalId: data.sucursalDestinoId,
        tipo: "entrada_transferencia",
        cantidad: data.cantidad,
        referenciaId,
        creadoPor: data.creadoPor,
      })
      .returning();

    const cantidadActualOrigen = await recalcularCantidadActualTx(
      tx,
      data.productoId,
      data.sucursalOrigenId
    );
    const cantidadActualDestino = await recalcularCantidadActualTx(
      tx,
      data.productoId,
      data.sucursalDestinoId
    );

    return { salida, entrada, cantidadActualOrigen, cantidadActualDestino };
  });
}

export async function listarStockPorProducto(productoId: string) {
  return db.select().from(stock).where(eq(stock.productoId, productoId));
}

export async function listarMovimientosStock(productoId: string, sucursalId: string) {
  return db
    .select()
    .from(movimientosStock)
    .where(
      and(
        eq(movimientosStock.productoId, productoId),
        eq(movimientosStock.sucursalId, sucursalId)
      )
    )
    .orderBy(movimientosStock.creadoEn);
}
