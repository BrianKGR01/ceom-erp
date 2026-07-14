import { and, asc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { comprasAjuste, compras, pagosCompra, proveedores } from "./schema";

export type NuevoProveedor = typeof proveedores.$inferInsert;
export type NuevaCompra = typeof compras.$inferInsert;
export type NuevoPagoCompra = typeof pagosCompra.$inferInsert;
export type NuevaCompraAjuste = typeof comprasAjuste.$inferInsert;

// --- Proveedores ---------------------------------------------------------

export async function crearProveedor(data: NuevoProveedor) {
  const [proveedor] = await db.insert(proveedores).values(data).returning();
  return proveedor;
}

export async function obtenerProveedorPorId(proveedorId: string) {
  const filas = await db
    .select()
    .from(proveedores)
    .where(and(eq(proveedores.id, proveedorId), isNull(proveedores.eliminadoEn)))
    .limit(1);
  return filas[0] ?? null;
}

export async function actualizarProveedor(
  proveedorId: string,
  data: Partial<Omit<NuevoProveedor, "id" | "tenantId">>
) {
  const [proveedor] = await db
    .update(proveedores)
    .set(data)
    .where(eq(proveedores.id, proveedorId))
    .returning();
  return proveedor;
}

export async function eliminarProveedorSoft(proveedorId: string) {
  const [proveedor] = await db
    .update(proveedores)
    .set({ eliminadoEn: new Date() })
    .where(eq(proveedores.id, proveedorId))
    .returning();
  return proveedor;
}

export async function listarProveedoresPorTenant(tenantId: string) {
  return db
    .select()
    .from(proveedores)
    .where(and(eq(proveedores.tenantId, tenantId), isNull(proveedores.eliminadoEn)));
}

export async function resumenComprasPorProveedor(proveedorId: string) {
  const [resumen] = await db
    .select({
      cantidadCompras: sql<number>`count(*)::int`,
      montoTotalComprado: sql<string>`coalesce(sum(${compras.montoTotal}), 0)`,
    })
    .from(compras)
    .where(and(eq(compras.proveedorId, proveedorId), isNull(compras.eliminadoEn)));
  return resumen;
}

export async function listarComprasPorProveedor(proveedorId: string) {
  return db
    .select()
    .from(compras)
    .where(and(eq(compras.proveedorId, proveedorId), isNull(compras.eliminadoEn)))
    .orderBy(asc(compras.fechaCompra));
}

// --- Compras ---------------------------------------------------------

export async function crearCompra(data: NuevaCompra) {
  const [compra] = await db.insert(compras).values(data).returning();
  return compra;
}

export async function obtenerCompraPorId(compraId: string) {
  const filas = await db
    .select()
    .from(compras)
    .where(and(eq(compras.id, compraId), isNull(compras.eliminadoEn)))
    .limit(1);
  return filas[0] ?? null;
}

/** historial_precio(item_id) — Modulo_08 seccion 2, ordenado por fecha. */
export async function listarComprasPorItem(tenantId: string, itemId: string) {
  return db
    .select()
    .from(compras)
    .where(
      and(
        eq(compras.tenantId, tenantId),
        eq(compras.itemId, itemId),
        isNull(compras.eliminadoEn)
      )
    )
    .orderBy(asc(compras.fechaCompra));
}

// --- Pagos de Compra ---------------------------------------------------------

export async function obtenerTotalPagado(compraId: string): Promise<number> {
  const [{ totalPagado }] = await db
    .select({ totalPagado: sql<string>`coalesce(sum(${pagosCompra.monto}), 0)` })
    .from(pagosCompra)
    .where(eq(pagosCompra.compraId, compraId));
  return Number(totalPagado);
}

/**
 * Registra el pago y recalcula estado_pago (pendiente/parcial/pagado) en
 * la misma transaccion — mismo patron que registrarPagoPasivoTx en
 * Patrimonio.
 */
export async function registrarPagoCompraTx(data: NuevoPagoCompra) {
  return db.transaction(async (tx) => {
    const [pago] = await tx.insert(pagosCompra).values(data).returning();

    const [compra] = await tx
      .select({ montoTotal: compras.montoTotal })
      .from(compras)
      .where(eq(compras.id, data.compraId));
    const [{ totalPagado }] = await tx
      .select({ totalPagado: sql<string>`coalesce(sum(${pagosCompra.monto}), 0)` })
      .from(pagosCompra)
      .where(eq(pagosCompra.compraId, data.compraId));

    const pagado = Number(totalPagado);
    const total = Number(compra.montoTotal);
    const estadoPago: (typeof compras.$inferSelect)["estadoPago"] =
      pagado <= 0 ? "pendiente" : pagado >= total ? "pagado" : "parcial";

    await tx.update(compras).set({ estadoPago }).where(eq(compras.id, data.compraId));

    return { pago, estadoPago, totalPagado: pagado };
  });
}

// --- Compra de Ajuste ---------------------------------------------------------

export async function crearCompraAjuste(data: NuevaCompraAjuste) {
  const [ajuste] = await db.insert(comprasAjuste).values(data).returning();
  return ajuste;
}

export async function listarAjustesPorCompra(compraId: string) {
  return db
    .select()
    .from(comprasAjuste)
    .where(eq(comprasAjuste.compraId, compraId))
    .orderBy(asc(comprasAjuste.creadoEn));
}

// --- Agregados por periodo para Financiero (Modulo_07, seccion 2) ---------------------------------------------------------
// Financiero no tiene tablas propias — consume Proveedores exclusivamente
// via esta funcion (caja negra), nunca importando "compras"/"pagos_compra"
// directo.

/** Suma de Pago de Compra por fecha_pago — base caja (nunca el evento
 * compra_registrada, que no impacta caja hasta que se paga). */
export async function sumarPagosCompraPeriodo(
  tenantId: string,
  desde: string,
  hasta: string,
  opts: { sucursalId?: string } = {}
): Promise<number> {
  const condiciones = [
    eq(compras.tenantId, tenantId),
    gte(pagosCompra.fechaPago, desde),
    lte(pagosCompra.fechaPago, hasta),
  ];
  if (opts.sucursalId) condiciones.push(eq(compras.sucursalId, opts.sucursalId));

  const [{ total }] = await db
    .select({ total: sql<string>`coalesce(sum(${pagosCompra.monto}), 0)` })
    .from(pagosCompra)
    .innerJoin(compras, eq(pagosCompra.compraId, compras.id))
    .where(and(...condiciones));

  return Number(total);
}
