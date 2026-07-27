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

/** Suma de los ajustes de una Compra, con su signo (positivo = costó más,
 * negativo = a favor del negocio). 0 si no tiene ajustes. */
export async function obtenerTotalAjustes(tx: Ejecutor, compraId: string): Promise<number> {
  const [{ totalAjustes }] = await tx
    .select({ totalAjustes: sql<string>`coalesce(sum(${comprasAjuste.montoAjuste}), 0)` })
    .from(comprasAjuste)
    .where(eq(comprasAjuste.compraId, compraId));
  return Number(totalAjustes);
}

/**
 * Lo que realmente vale la Compra hoy: su monto original mas la suma de sus
 * ajustes (H-31 — antes los ajustes se escribian y no cambiaban nada, asi que
 * una compra anulada seguia figurando pendiente por su monto completo). Nunca
 * negativo: el guard de registrarCompraDeAjuste rechaza un ajuste que lo
 * empujaria por debajo de 0, y el clamp de aca es la segunda red.
 */
export async function obtenerMontoTotalEfectivo(
  tx: Ejecutor,
  compraId: string
): Promise<number> {
  const [compra] = await tx
    .select({ montoTotal: compras.montoTotal })
    .from(compras)
    .where(eq(compras.id, compraId));
  if (!compra) return 0;
  const ajustes = await obtenerTotalAjustes(tx, compraId);
  return Math.max(0, Number(compra.montoTotal) + ajustes);
}

/**
 * estado_pago derivado de lo pagado contra el monto EFECTIVO (con ajustes),
 * no contra el monto original. Unica fuente de verdad de esa regla: la usan
 * registrarPagoCompraTx (llega un pago nuevo) y recalcularEstadoPagoTx (llega
 * un ajuste nuevo).
 *
 * El orden de las ramas importa y cambio con H-31: antes era
 * `pagado <= 0 ? pendiente : ...`, que con una compra anulada (total efectivo
 * 0, nada pagado) daba "pendiente" — o sea "debes plata" sobre una compra que
 * ya no existe. Ahora "pendiente" exige que efectivamente haya algo que
 * deber. Para cualquier compra sin ajustes el resultado es identico al de
 * antes.
 */
export function derivarEstadoPago(
  totalPagado: number,
  montoTotalEfectivo: number
): (typeof compras.$inferSelect)["estadoPago"] {
  if (totalPagado >= montoTotalEfectivo) return "pagado";
  if (totalPagado <= 0) return "pendiente";
  return "parcial";
}

/** Recalcula estado_pago de una Compra tras un cambio que no es un pago
 * (hoy: un ajuste). Mismo criterio append-only que el resto del sistema —
 * no edita montos, solo re-deriva el estado. */
export async function recalcularEstadoPagoTx(tx: Ejecutor, compraId: string) {
  const [totalPagado, montoTotalEfectivo] = await Promise.all([
    obtenerTotalPagado(tx, compraId),
    obtenerMontoTotalEfectivo(tx, compraId),
  ]);
  const estadoPago = derivarEstadoPago(totalPagado, montoTotalEfectivo);
  await tx.update(compras).set({ estadoPago }).where(eq(compras.id, compraId));
  return { estadoPago, totalPagado, montoTotalEfectivo };
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

  // Compara contra el monto EFECTIVO (con ajustes), no contra montoTotal
  // (H-31): si la compra se corrigio a la baja, pagar el saldo nuevo tiene
  // que dejarla "pagado", no "parcial" para siempre.
  const { estadoPago, totalPagado } = await recalcularEstadoPagoTx(tx, data.compraId);

  return { pago, estadoPago, totalPagado };
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

/** Todos los ajustes del tenant en una sola consulta — evita el N+1 que
 * saldria de pedirle los ajustes a cada compra del listado (mismo problema
 * que listarVentasConTotal resuelve por fila; aca alcanza con una query
 * porque compras_ajuste es chica y se agrupa en memoria). */
export async function listarAjustesPorTenant(tx: Ejecutor, tenantId: string) {
  return tx
    .select({
      id: comprasAjuste.id,
      compraId: comprasAjuste.compraId,
      tipo: comprasAjuste.tipo,
      montoAjuste: comprasAjuste.montoAjuste,
      motivo: comprasAjuste.motivo,
      creadoEn: comprasAjuste.creadoEn,
    })
    .from(comprasAjuste)
    .innerJoin(compras, eq(comprasAjuste.compraId, compras.id))
    .where(and(eq(compras.tenantId, tenantId), isNull(compras.eliminadoEn)))
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

/**
 * Costo extra que los ajustes de compra del periodo le agregaron al negocio
 * — el insumo del estado de resultados para H-31.
 *
 * **Solo la direccion de costo, nunca la contraria.** Se agrupa por compra,
 * se toma el NETO de sus ajustes del periodo y se descarta si es negativo
 * (`greatest(neto, 0)`). El motivo es de negocio, no de programacion: en CEOM
 * una compra nunca fue un gasto — entra al resultado recien como costo cuando
 * la mercaderia se vende, congelada en `costo_unitario_snapshot`. Entonces:
 *
 * - Si la compra terminó costando MAS de lo registrado, ese excedente es un
 *   costo real que los snapshots ya congelados no van a recoger nunca. Resta.
 * - Si terminó costando MENOS (devolución, anulación, corrección a la baja),
 *   deshacer una compra no es una ganancia: sumarlo al resultado inventaría
 *   utilidad. Esa dirección se refleja en el saldo de la compra y su estado
 *   de pago, no en la utilidad.
 *
 * El neto se toma POR COMPRA y no fila por fila para que dos correcciones que
 * se cancelan (+50 y luego -50 sobre la misma compra) queden en 0 en vez de
 * dejar un costo fantasma de 50.
 *
 * Se filtra por `creado_en` porque `compras_ajuste` no tiene fecha propia —
 * misma limitacion (y mismo criterio) que `sumarAjustesVentaPeriodo` en
 * Ventas.
 */
export async function sumarCostoExtraAjustesCompraPeriodo(
  tx: Ejecutor,
  tenantId: string,
  desde: Date,
  hasta: Date,
  opts: { sucursalId?: string } = {}
): Promise<number> {
  const condiciones = [
    eq(compras.tenantId, tenantId),
    isNull(compras.eliminadoEn),
    gte(comprasAjuste.creadoEn, desde),
    lte(comprasAjuste.creadoEn, hasta),
  ];
  if (opts.sucursalId) condiciones.push(eq(compras.sucursalId, opts.sucursalId));

  const netosPorCompra = tx
    .select({
      neto: sql<string>`sum(${comprasAjuste.montoAjuste})`.as("neto"),
    })
    .from(comprasAjuste)
    .innerJoin(compras, eq(comprasAjuste.compraId, compras.id))
    .where(and(...condiciones))
    .groupBy(comprasAjuste.compraId)
    .as("netos_por_compra");

  const [{ total }] = await tx
    .select({ total: sql<string>`coalesce(sum(greatest(${netosPorCompra.neto}, 0)), 0)` })
    .from(netosPorCompra);

  return Number(total);
}
