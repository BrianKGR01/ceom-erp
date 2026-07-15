import { and, asc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  ajustesVenta,
  canalesVenta,
  clientes,
  detallesVenta,
  eventos,
  metodosPago,
  pagosVenta,
  ventas,
} from "./schema";

export type NuevoCliente = typeof clientes.$inferInsert;
export type NuevoCanalVenta = typeof canalesVenta.$inferInsert;
export type NuevoMetodoPago = typeof metodosPago.$inferInsert;
export type NuevoEvento = typeof eventos.$inferInsert;
export type NuevaVenta = typeof ventas.$inferInsert;
export type NuevoDetalleVenta = typeof detallesVenta.$inferInsert;
export type NuevoAjusteVenta = typeof ajustesVenta.$inferInsert;
export type NuevoPagoVenta = typeof pagosVenta.$inferInsert;

// --- Clientes ---------------------------------------------------------

export async function crearCliente(data: NuevoCliente) {
  const [cliente] = await db.insert(clientes).values(data).returning();
  return cliente;
}

export async function obtenerClientePorId(clienteId: string) {
  const filas = await db
    .select()
    .from(clientes)
    .where(and(eq(clientes.id, clienteId), isNull(clientes.eliminadoEn)))
    .limit(1);
  return filas[0] ?? null;
}

export async function actualizarCliente(
  clienteId: string,
  data: Partial<Omit<NuevoCliente, "id" | "tenantId">>
) {
  const [cliente] = await db
    .update(clientes)
    .set(data)
    .where(eq(clientes.id, clienteId))
    .returning();
  return cliente;
}

export async function eliminarClienteSoft(clienteId: string) {
  const [cliente] = await db
    .update(clientes)
    .set({ eliminadoEn: new Date() })
    .where(eq(clientes.id, clienteId))
    .returning();
  return cliente;
}

export async function listarClientesPorTenant(tenantId: string) {
  return db
    .select()
    .from(clientes)
    .where(and(eq(clientes.tenantId, tenantId), isNull(clientes.eliminadoEn)));
}

// --- Canal de Venta ---------------------------------------------------------

export async function crearCanalVenta(data: NuevoCanalVenta) {
  const [canal] = await db.insert(canalesVenta).values(data).returning();
  return canal;
}

export async function obtenerCanalVentaPorId(canalVentaId: string) {
  const filas = await db
    .select()
    .from(canalesVenta)
    .where(and(eq(canalesVenta.id, canalVentaId), isNull(canalesVenta.eliminadoEn)))
    .limit(1);
  return filas[0] ?? null;
}

export async function actualizarCanalVenta(
  canalVentaId: string,
  data: Partial<Omit<NuevoCanalVenta, "id" | "tenantId">>
) {
  const [canal] = await db
    .update(canalesVenta)
    .set(data)
    .where(eq(canalesVenta.id, canalVentaId))
    .returning();
  return canal;
}

export async function eliminarCanalVentaSoft(canalVentaId: string) {
  const [canal] = await db
    .update(canalesVenta)
    .set({ eliminadoEn: new Date() })
    .where(eq(canalesVenta.id, canalVentaId))
    .returning();
  return canal;
}

export async function listarCanalesVentaPorTenant(tenantId: string) {
  return db
    .select()
    .from(canalesVenta)
    .where(and(eq(canalesVenta.tenantId, tenantId), isNull(canalesVenta.eliminadoEn)));
}

// --- Metodo de Pago ---------------------------------------------------------

export async function crearMetodoPago(data: NuevoMetodoPago) {
  const [metodo] = await db.insert(metodosPago).values(data).returning();
  return metodo;
}

export async function obtenerMetodoPagoPorId(metodoPagoId: string) {
  const filas = await db
    .select()
    .from(metodosPago)
    .where(eq(metodosPago.id, metodoPagoId))
    .limit(1);
  return filas[0] ?? null;
}

export async function actualizarMetodoPago(
  metodoPagoId: string,
  data: Partial<Omit<NuevoMetodoPago, "id" | "tenantId">>
) {
  const [metodo] = await db
    .update(metodosPago)
    .set(data)
    .where(eq(metodosPago.id, metodoPagoId))
    .returning();
  return metodo;
}

export async function listarMetodosPagoPorTenant(tenantId: string) {
  return db.select().from(metodosPago).where(eq(metodosPago.tenantId, tenantId));
}

// --- Eventos ---------------------------------------------------------

export async function crearEvento(data: NuevoEvento) {
  const [evento] = await db.insert(eventos).values(data).returning();
  return evento;
}

export async function obtenerEventoPorId(eventoId: string) {
  const filas = await db
    .select()
    .from(eventos)
    .where(and(eq(eventos.id, eventoId), isNull(eventos.eliminadoEn)))
    .limit(1);
  return filas[0] ?? null;
}

export async function actualizarEvento(
  eventoId: string,
  data: Partial<Omit<NuevoEvento, "id" | "tenantId">>
) {
  const [evento] = await db
    .update(eventos)
    .set(data)
    .where(eq(eventos.id, eventoId))
    .returning();
  return evento;
}

export async function listarEventosPorTenant(tenantId: string) {
  return db
    .select()
    .from(eventos)
    .where(and(eq(eventos.tenantId, tenantId), isNull(eventos.eliminadoEn)));
}

// --- Ventas ---------------------------------------------------------

export async function obtenerVentaPorId(ventaId: string) {
  const filas = await db.select().from(ventas).where(eq(ventas.id, ventaId)).limit(1);
  return filas[0] ?? null;
}

export async function listarVentasPorTenant(tenantId: string) {
  return db
    .select()
    .from(ventas)
    .where(eq(ventas.tenantId, tenantId))
    .orderBy(asc(ventas.fechaVenta));
}

export async function obtenerDetallesVenta(ventaId: string) {
  return db.select().from(detallesVenta).where(eq(detallesVenta.ventaId, ventaId));
}

export async function obtenerTotalVenta(ventaId: string): Promise<number> {
  const [{ total }] = await db
    .select({ total: sql<string>`coalesce(sum(${detallesVenta.subtotal}), 0)` })
    .from(detallesVenta)
    .where(eq(detallesVenta.ventaId, ventaId));
  return Number(total);
}

/**
 * Crea la Venta y sus lineas en una transaccion, y si hay cliente, actualiza
 * primera_compra_en/ultima_compra_en (Modulo_03 seccion 1.8) — todo o nada.
 */
export async function crearVentaConDetalleTx(data: {
  venta: NuevaVenta;
  lineas: Array<Omit<NuevoDetalleVenta, "id" | "ventaId">>;
}) {
  return db.transaction(async (tx) => {
    const [venta] = await tx.insert(ventas).values(data.venta).returning();

    const lineas = await tx
      .insert(detallesVenta)
      .values(data.lineas.map((linea) => ({ ...linea, ventaId: venta.id })))
      .returning();

    if (venta.clienteId) {
      const [clienteActual] = await tx
        .select({ primeraCompraEn: clientes.primeraCompraEn })
        .from(clientes)
        .where(eq(clientes.id, venta.clienteId));
      await tx
        .update(clientes)
        .set({
          primeraCompraEn: clienteActual?.primeraCompraEn ?? venta.fechaVenta,
          ultimaCompraEn: venta.fechaVenta,
        })
        .where(eq(clientes.id, venta.clienteId));
    }

    return { venta, lineas };
  });
}

// --- Ajuste de Venta ---------------------------------------------------------

/** Regla 7: si la devolucion implica dinero real, crea tambien un Pago de
 * Venta negativo en la misma transaccion. */
export async function crearAjusteVentaTx(data: {
  ajuste: NuevoAjusteVenta;
  pagoNegativo?: Omit<NuevoPagoVenta, "id" | "ventaId">;
}) {
  return db.transaction(async (tx) => {
    const [ajuste] = await tx.insert(ajustesVenta).values(data.ajuste).returning();

    let pago = null;
    if (data.pagoNegativo) {
      [pago] = await tx
        .insert(pagosVenta)
        .values({ ...data.pagoNegativo, ventaId: data.ajuste.ventaId })
        .returning();
    }

    return { ajuste, pago };
  });
}

export async function listarAjustesPorVenta(ventaId: string) {
  return db.select().from(ajustesVenta).where(eq(ajustesVenta.ventaId, ventaId));
}

// --- Pago de Venta ---------------------------------------------------------

export async function obtenerTotalPagado(ventaId: string): Promise<number> {
  const [{ totalPagado }] = await db
    .select({ totalPagado: sql<string>`coalesce(sum(${pagosVenta.monto}), 0)` })
    .from(pagosVenta)
    .where(eq(pagosVenta.ventaId, ventaId));
  return Number(totalPagado);
}

export async function listarPagosPorVenta(ventaId: string) {
  return db.select().from(pagosVenta).where(eq(pagosVenta.ventaId, ventaId));
}

/**
 * Registra el pago y recalcula estado_pago (pendiente/parcial/pagado) en la
 * misma transaccion, contra el total derivado de detalles_venta (Venta no
 * persiste un monto_total propio) — mismo patron que registrarPagoCompraTx.
 */
export async function registrarPagoVentaTx(data: NuevoPagoVenta) {
  return db.transaction(async (tx) => {
    const [pago] = await tx.insert(pagosVenta).values(data).returning();

    const [{ totalVenta }] = await tx
      .select({ totalVenta: sql<string>`coalesce(sum(${detallesVenta.subtotal}), 0)` })
      .from(detallesVenta)
      .where(eq(detallesVenta.ventaId, data.ventaId));
    const [{ totalPagado }] = await tx
      .select({ totalPagado: sql<string>`coalesce(sum(${pagosVenta.monto}), 0)` })
      .from(pagosVenta)
      .where(eq(pagosVenta.ventaId, data.ventaId));

    const pagado = Number(totalPagado);
    const total = Number(totalVenta);
    const estadoPago: (typeof ventas.$inferSelect)["estadoPago"] =
      pagado <= 0 ? "pendiente" : pagado >= total ? "pagado" : "parcial";

    await tx.update(ventas).set({ estadoPago }).where(eq(ventas.id, data.ventaId));

    return { pago, estadoPago, totalPagado: pagado };
  });
}

// --- Agregados por periodo (Modulo_07 - Financiero, seccion 2) ---------------------------------------------------------
// Financiero no tiene tablas propias — estas funciones son la unica forma
// de que consuma "solo lectura" a Ventas sin importar sus tablas directo
// (regla de caja negra).

/** Ingresos (subtotal, ya persistido) y costos (cantidad x costo snapshot)
 * de Detalle de Venta, por fecha_venta — base devengado. */
export async function sumarIngresosCostosPeriodo(
  tenantId: string,
  desde: Date,
  hasta: Date,
  opts: { sucursalId?: string; productoId?: string } = {}
): Promise<{ ingresos: number; costos: number }> {
  const condiciones = [
    eq(ventas.tenantId, tenantId),
    gte(ventas.fechaVenta, desde),
    lte(ventas.fechaVenta, hasta),
  ];
  if (opts.sucursalId) condiciones.push(eq(ventas.sucursalId, opts.sucursalId));
  if (opts.productoId) condiciones.push(eq(detallesVenta.productoId, opts.productoId));

  const [{ ingresos, costos }] = await db
    .select({
      ingresos: sql<string>`coalesce(sum(${detallesVenta.subtotal}), 0)`,
      costos: sql<string>`coalesce(sum(${detallesVenta.cantidad} * ${detallesVenta.costoUnitarioSnapshot}), 0)`,
    })
    .from(detallesVenta)
    .innerJoin(ventas, eq(detallesVenta.ventaId, ventas.id))
    .where(and(...condiciones));

  return { ingresos: Number(ingresos), costos: Number(costos) };
}

/** Unidades vendidas (rotación) de un producto en un período — roadmap
 * ítem #13 (Simulaciones): "rotación del último período" (sección 1.1 del
 * Módulo 9), insumo de simularPrecio(). Por fecha_venta, mismo criterio de
 * "base devengado" que sumarIngresosCostosPeriodo. */
export async function sumarUnidadesVendidasPeriodo(
  tenantId: string,
  productoId: string,
  desde: Date,
  hasta: Date,
  opts: { sucursalId?: string } = {}
): Promise<number> {
  const condiciones = [
    eq(ventas.tenantId, tenantId),
    eq(detallesVenta.productoId, productoId),
    gte(ventas.fechaVenta, desde),
    lte(ventas.fechaVenta, hasta),
  ];
  if (opts.sucursalId) condiciones.push(eq(ventas.sucursalId, opts.sucursalId));

  const [{ total }] = await db
    .select({ total: sql<string>`coalesce(sum(${detallesVenta.cantidad}), 0)` })
    .from(detallesVenta)
    .innerJoin(ventas, eq(detallesVenta.ventaId, ventas.id))
    .where(and(...condiciones));

  return Number(total);
}

/** Suma de Pago de Venta por fecha_pago — base caja. */
export async function sumarPagosVentaPeriodo(
  tenantId: string,
  desde: Date,
  hasta: Date,
  opts: { sucursalId?: string } = {}
): Promise<number> {
  const condiciones = [
    eq(ventas.tenantId, tenantId),
    gte(pagosVenta.fechaPago, desde),
    lte(pagosVenta.fechaPago, hasta),
  ];
  if (opts.sucursalId) condiciones.push(eq(ventas.sucursalId, opts.sucursalId));

  const [{ total }] = await db
    .select({ total: sql<string>`coalesce(sum(${pagosVenta.monto}), 0)` })
    .from(pagosVenta)
    .innerJoin(ventas, eq(pagosVenta.ventaId, ventas.id))
    .where(and(...condiciones));

  return Number(total);
}

/** Suma de AjusteVenta.monto_ajuste por su fecha de creacion — AjusteVenta
 * no tiene un campo de fecha propio distinto de creado_en. */
export async function sumarAjustesVentaPeriodo(
  tenantId: string,
  desde: Date,
  hasta: Date,
  opts: { sucursalId?: string; productoId?: string } = {}
): Promise<number> {
  const condiciones = [
    eq(ventas.tenantId, tenantId),
    gte(ajustesVenta.creadoEn, desde),
    lte(ajustesVenta.creadoEn, hasta),
  ];
  if (opts.sucursalId) condiciones.push(eq(ventas.sucursalId, opts.sucursalId));
  if (opts.productoId) condiciones.push(eq(ajustesVenta.productoId, opts.productoId));

  const [{ total }] = await db
    .select({ total: sql<string>`coalesce(sum(${ajustesVenta.montoAjuste}), 0)` })
    .from(ajustesVenta)
    .innerJoin(ventas, eq(ajustesVenta.ventaId, ventas.id))
    .where(and(...condiciones));

  return Number(total);
}
