import { and, asc, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import type { Ejecutor } from "@/db/contexto";
import { comprasAjuste, compras, pagosCompra, proveedores } from "./schema";

export type NuevoProveedor = typeof proveedores.$inferInsert;
export type NuevaCompra = typeof compras.$inferInsert;
export type NuevoPagoCompra = typeof pagosCompra.$inferInsert;
export type NuevaCompraAjuste = typeof comprasAjuste.$inferInsert;

// --- Proveedores ---------------------------------------------------------

export async function crearProveedor(tx: Ejecutor, data: NuevoProveedor) {
  const [proveedor] = await tx.insert(proveedores).values(data).returning();
  return proveedor;
}

export async function obtenerProveedorPorId(tx: Ejecutor, proveedorId: string) {
  const filas = await tx
    .select()
    .from(proveedores)
    .where(and(eq(proveedores.id, proveedorId), isNull(proveedores.eliminadoEn)))
    .limit(1);
  return filas[0] ?? null;
}

export async function actualizarProveedor(
  tx: Ejecutor,
  proveedorId: string,
  data: Partial<Omit<NuevoProveedor, "id" | "tenantId">>
) {
  const [proveedor] = await tx
    .update(proveedores)
    .set(data)
    .where(eq(proveedores.id, proveedorId))
    .returning();
  return proveedor;
}

export async function eliminarProveedorSoft(tx: Ejecutor, proveedorId: string) {
  const [proveedor] = await tx
    .update(proveedores)
    .set({ eliminadoEn: new Date() })
    .where(eq(proveedores.id, proveedorId))
    .returning();
  return proveedor;
}

export async function listarProveedoresPorTenant(tx: Ejecutor, tenantId: string) {
  return tx
    .select()
    .from(proveedores)
    .where(and(eq(proveedores.tenantId, tenantId), isNull(proveedores.eliminadoEn)));
}

export async function resumenComprasPorProveedor(tx: Ejecutor, proveedorId: string) {
  const [resumen] = await tx
    .select({
      cantidadCompras: sql<number>`count(*)::int`,
      montoTotalComprado: sql<string>`coalesce(sum(${compras.montoTotal}), 0)`,
    })
    .from(compras)
    .where(and(eq(compras.proveedorId, proveedorId), isNull(compras.eliminadoEn)));
  return resumen;
}

export async function listarComprasPorProveedor(tx: Ejecutor, proveedorId: string) {
  return tx
    .select()
    .from(compras)
    .where(and(eq(compras.proveedorId, proveedorId), isNull(compras.eliminadoEn)))
    .orderBy(asc(compras.fechaCompra));
}

// --- Compras ---------------------------------------------------------

export async function crearCompra(tx: Ejecutor, data: NuevaCompra) {
  const [compra] = await tx.insert(compras).values(data).returning();
  return compra;
}

export async function obtenerCompraPorId(tx: Ejecutor, compraId: string) {
  const filas = await tx
    .select()
    .from(compras)
    .where(and(eq(compras.id, compraId), isNull(compras.eliminadoEn)))
    .limit(1);
  return filas[0] ?? null;
}

/** Listado general de Compras del tenant, con filtros opcionales por
 * estadoPago y estado (pedido/recibido) — antes solo existian listados
 * indirectos (por proveedor, por item). Mas reciente primero. */
export async function listarComprasPorTenant(
  tx: Ejecutor,
  tenantId: string,
  opts: {
    estadoPago?: (typeof compras.$inferSelect)["estadoPago"];
    estado?: (typeof compras.$inferSelect)["estado"];
  } = {}
) {
  const condiciones = [eq(compras.tenantId, tenantId), isNull(compras.eliminadoEn)];
  if (opts.estadoPago) condiciones.push(eq(compras.estadoPago, opts.estadoPago));
  if (opts.estado) condiciones.push(eq(compras.estado, opts.estado));

  return tx
    .select()
    .from(compras)
    .where(and(...condiciones))
    .orderBy(desc(compras.fechaCompra));
}

/** historial_precio(item_id) — Modulo_08 seccion 2, ordenado por fecha.
 * "item" es insumo o producto segun tipo (roadmap item #12) — exactamente
 * uno de los dos filtros aplica por llamada. */
export async function listarComprasPorItem(
  tx: Ejecutor,
  tenantId: string,
  item: { insumoId: string } | { productoId: string }
) {
  const filtroItem =
    "insumoId" in item
      ? eq(compras.insumoId, item.insumoId)
      : eq(compras.productoId, item.productoId);
  return tx
    .select()
    .from(compras)
    .where(and(eq(compras.tenantId, tenantId), filtroItem, isNull(compras.eliminadoEn)))
    .orderBy(asc(compras.fechaCompra));
}

/** Transiciona una Compra de "pedido" a "recibido" (roadmap item #12,
 * Modulo_08 seccion 6 — Orden de Compra como estado, no entidad nueva). */
export async function marcarCompraRecibida(tx: Ejecutor, compraId: string, fechaRecepcion: string) {
  const [compra] = await tx
    .update(compras)
    .set({ estado: "recibido", fechaRecepcion })
    .where(eq(compras.id, compraId))
    .returning();
  return compra;
}

// --- Pagos de Compra ---------------------------------------------------------

export async function obtenerTotalPagado(tx: Ejecutor, compraId: string): Promise<number> {
  const [{ totalPagado }] = await tx
    .select({ totalPagado: sql<string>`coalesce(sum(${pagosCompra.monto}), 0)` })
    .from(pagosCompra)
    .where(eq(pagosCompra.compraId, compraId));
  return Number(totalPagado);
}

/**
 * Registra el pago y recalcula estado_pago (pendiente/parcial/pagado) en
 * la misma transaccion — mismo patron que registrarPagoPasivoTx en
 * Patrimonio. Ya no abre su propia transaccion: la atomicidad la da la
 * transaccion externa que abrió comoUsuario() (docs/security/
 * PLAN-RLS-BACKSTOP.md §2.2), mismo criterio que refinanciarPasivoTx.
 */
export async function registrarPagoCompraTx(tx: Ejecutor, data: NuevoPagoCompra) {
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
}

// --- Compra de Ajuste ---------------------------------------------------------

export async function crearCompraAjuste(tx: Ejecutor, data: NuevaCompraAjuste) {
  const [ajuste] = await tx.insert(comprasAjuste).values(data).returning();
  return ajuste;
}

export async function listarAjustesPorCompra(tx: Ejecutor, compraId: string) {
  return tx
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
  tx: Ejecutor,
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

  const [{ total }] = await tx
    .select({ total: sql<string>`coalesce(sum(${pagosCompra.monto}), 0)` })
    .from(pagosCompra)
    .innerJoin(compras, eq(pagosCompra.compraId, compras.id))
    .where(and(...condiciones));

  return Number(total);
}
