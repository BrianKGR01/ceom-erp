import { registrarEntradaCompraInsumo } from "@/modules/operativo/nichos/nicho-1/actions";
import { tienePermiso } from "@/modules/identidad/actions";
import type { UsuarioConRol } from "@/modules/identidad/actions";
import { registrarEntradaCompraReventa } from "@/modules/productos/actions";
import * as repo from "./repository";
import type {
  estadoCompraEnum,
  estadoPagoCompraEnum,
  tipoAjusteCompraEnum,
  tipoCompraEnum,
} from "./schema";

export type Resultado<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type TipoCompra = (typeof tipoCompraEnum.enumValues)[number];
type EstadoCompra = (typeof estadoCompraEnum.enumValues)[number];
type EstadoPagoCompra = (typeof estadoPagoCompraEnum.enumValues)[number];
type TipoAjusteCompra = (typeof tipoAjusteCompraEnum.enumValues)[number];

/** costo_unitario = (monto_total + costo_adicional_traslado) / cantidad
 * (Modulo_08 seccion 1.2, adenda Landed Cost simple — Modulo_08 seccion 6 /
 * roadmap item #12) — se calcula una sola vez al registrar la Compra, nunca
 * se edita despues (correcciones van por Compra de Ajuste). Sin costo
 * adicional, es exactamente la formula original. */
export function calcularCostoUnitario(
  montoTotal: string | number,
  cantidad: string | number,
  costoAdicionalTraslado: string | number | null = null
): number {
  const adicional = costoAdicionalTraslado ? Number(costoAdicionalTraslado) : 0;
  return (Number(montoTotal) + adicional) / Number(cantidad);
}

// --- Proveedores ---------------------------------------------------------

export interface DatosProveedor {
  nombre: string;
  contacto?: string;
  notas?: string;
}

export async function crearProveedor(
  solicitante: UsuarioConRol,
  tenantId: string,
  input: DatosProveedor
): Promise<Resultado<{ proveedorId: string }>> {
  if (!(await tienePermiso(solicitante, tenantId, "proveedores", "crear"))) {
    return { ok: false, error: "No tenés permiso para crear proveedores en este tenant." };
  }

  const proveedor = await repo.crearProveedor({
    tenantId,
    nombre: input.nombre,
    contacto: input.contacto,
    notas: input.notas,
    creadoPor: solicitante.id,
  });

  return { ok: true, data: { proveedorId: proveedor.id } };
}

export async function actualizarProveedor(
  solicitante: UsuarioConRol,
  proveedorId: string,
  input: Partial<DatosProveedor>
): Promise<Resultado<true>> {
  const proveedor = await repo.obtenerProveedorPorId(proveedorId);
  if (!proveedor) return { ok: false, error: "Proveedor no encontrado." };
  if (
    !(await tienePermiso(solicitante, proveedor.tenantId, "proveedores", "editar"))
  ) {
    return { ok: false, error: "No tenés permiso para editar este proveedor." };
  }

  await repo.actualizarProveedor(proveedorId, input);
  return { ok: true, data: true };
}

export async function eliminarProveedor(
  solicitante: UsuarioConRol,
  proveedorId: string
): Promise<Resultado<true>> {
  const proveedor = await repo.obtenerProveedorPorId(proveedorId);
  if (!proveedor) return { ok: false, error: "Proveedor no encontrado." };
  if (
    !(await tienePermiso(
      solicitante,
      proveedor.tenantId,
      "proveedores",
      "anular_ajustar"
    ))
  ) {
    return { ok: false, error: "No tenés permiso para eliminar este proveedor." };
  }

  await repo.eliminarProveedorSoft(proveedorId);
  return { ok: true, data: true };
}

export async function listarProveedores(
  solicitante: UsuarioConRol,
  tenantId: string
): Promise<Resultado<Awaited<ReturnType<typeof repo.listarProveedoresPorTenant>>>> {
  if (!(await tienePermiso(solicitante, tenantId, "proveedores", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver proveedores en este tenant." };
  }
  return { ok: true, data: await repo.listarProveedoresPorTenant(tenantId) };
}

/** ficha_proveedor(proveedor_id) — resumen de compras a ese proveedor
 * (Modulo_08 seccion 2). */
export async function fichaProveedor(
  solicitante: UsuarioConRol,
  proveedorId: string
): Promise<Resultado<{
  proveedor: Awaited<ReturnType<typeof repo.obtenerProveedorPorId>>;
  cantidadCompras: number;
  montoTotalComprado: number;
  compras: Awaited<ReturnType<typeof repo.listarComprasPorProveedor>>;
}>> {
  const proveedor = await repo.obtenerProveedorPorId(proveedorId);
  if (!proveedor) return { ok: false, error: "Proveedor no encontrado." };
  if (!(await tienePermiso(solicitante, proveedor.tenantId, "proveedores", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver este proveedor." };
  }

  const [resumen, comprasDelProveedor] = await Promise.all([
    repo.resumenComprasPorProveedor(proveedorId),
    repo.listarComprasPorProveedor(proveedorId),
  ]);

  return {
    ok: true,
    data: {
      proveedor,
      cantidadCompras: resumen.cantidadCompras,
      montoTotalComprado: Number(resumen.montoTotalComprado),
      compras: comprasDelProveedor,
    },
  };
}

// --- Compras ---------------------------------------------------------

export interface DatosCompra {
  sucursalId: string;
  proveedorId?: string;
  tipo: TipoCompra;
  // Exactamente uno segun "tipo" — validado abajo, reforzado por el CHECK
  // de la base (roadmap item #12: cierra el pendiente de item_id sin FK).
  insumoId?: string;
  productoId?: string;
  cantidad: string | number;
  montoTotal: string | number;
  costoAdicionalTraslado?: string | number;
  fechaCompra: string;
  fechaVencimiento?: string;
  // "recibido" (default) preserva el comportamiento historico: la Compra
  // ya representa mercaderia que entro. "pedido" es el flujo de Orden de
  // Compra (Modulo_08 seccion 6) — recien entra a inventario al llamar
  // recibirCompra().
  estado?: EstadoCompra;
}

export interface DatosEntradaStock {
  ok: boolean;
  error?: string;
}

/** Dispara la entrada de stock real segun tipo — Modulo 2 (reventa) o
 * Operativo Nicho 1 (insumo). Mismo criterio de "gap de atomicidad cruzada
 * aceptado a proposito" que Ventas/Producción (Módulos 3/6): si esta
 * llamada falla, la Compra ya quedó "recibido" igual — el caller detecta el
 * error en el resultado y reintenta a mano. */
async function dispararEntradaStock(
  solicitante: UsuarioConRol,
  tenantId: string,
  compra: NonNullable<Awaited<ReturnType<typeof repo.obtenerCompraPorId>>>
): Promise<DatosEntradaStock> {
  if (compra.tipo === "reventa") {
    const res = await registrarEntradaCompraReventa(solicitante, tenantId, {
      productoId: compra.productoId!,
      sucursalId: compra.sucursalId,
      cantidad: compra.cantidad,
      costoCompra: compra.costoUnitario,
      referenciaId: compra.id,
    });
    return res.ok ? { ok: true } : { ok: false, error: res.error };
  }

  const res = await registrarEntradaCompraInsumo(solicitante, tenantId, {
    insumoId: compra.insumoId!,
    sucursalId: compra.sucursalId,
    cantidad: compra.cantidad,
    costoCompra: compra.costoUnitario,
    fechaVencimiento: compra.fechaVencimiento ?? undefined,
    referenciaId: compra.id,
  });
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

export async function registrarCompra(
  solicitante: UsuarioConRol,
  tenantId: string,
  input: DatosCompra
): Promise<
  Resultado<{ compraId: string; costoUnitario: number; entradaStock?: DatosEntradaStock }>
> {
  if (!(await tienePermiso(solicitante, tenantId, "proveedores", "crear"))) {
    return { ok: false, error: "No tenés permiso para registrar compras en este tenant." };
  }
  if (input.tipo === "insumo" && (!input.insumoId || input.productoId)) {
    return { ok: false, error: "Una compra de insumo requiere insumoId (y no productoId)." };
  }
  if (input.tipo === "reventa" && (!input.productoId || input.insumoId)) {
    return { ok: false, error: "Una compra de reventa requiere productoId (y no insumoId)." };
  }

  const costoUnitario = calcularCostoUnitario(
    input.montoTotal,
    input.cantidad,
    input.costoAdicionalTraslado ?? null
  );
  const estado = input.estado ?? "recibido";

  const compra = await repo.crearCompra({
    tenantId,
    sucursalId: input.sucursalId,
    proveedorId: input.proveedorId,
    tipo: input.tipo,
    insumoId: input.insumoId,
    productoId: input.productoId,
    cantidad: String(input.cantidad),
    costoUnitario: String(costoUnitario),
    montoTotal: String(input.montoTotal),
    costoAdicionalTraslado:
      input.costoAdicionalTraslado !== undefined ? String(input.costoAdicionalTraslado) : undefined,
    fechaCompra: input.fechaCompra,
    fechaVencimiento: input.fechaVencimiento,
    estado,
    fechaRecepcion: estado === "recibido" ? input.fechaCompra : undefined,
    creadoPor: solicitante.id,
  });

  if (estado !== "recibido") {
    return { ok: true, data: { compraId: compra.id, costoUnitario } };
  }

  const entradaStock = await dispararEntradaStock(solicitante, tenantId, compra);
  return { ok: true, data: { compraId: compra.id, costoUnitario, entradaStock } };
}

/** Transiciona una Compra "pedido" -> "recibido" y recien ahi dispara la
 * entrada de stock real (Modulo_08 seccion 6 / roadmap item #12: Orden de
 * Compra como estado, no entidad nueva). */
export async function recibirCompra(
  solicitante: UsuarioConRol,
  compraId: string
): Promise<Resultado<{ entradaStock: DatosEntradaStock }>> {
  const compra = await repo.obtenerCompraPorId(compraId);
  if (!compra) return { ok: false, error: "Compra no encontrada." };
  if (!(await tienePermiso(solicitante, compra.tenantId, "proveedores", "crear"))) {
    return { ok: false, error: "No tenés permiso para recibir compras en este tenant." };
  }
  if (compra.estado === "recibido") {
    return { ok: false, error: "Esta compra ya está recibida." };
  }

  const hoy = new Date().toISOString().slice(0, 10);
  const compraRecibida = await repo.marcarCompraRecibida(compraId, hoy);
  const entradaStock = await dispararEntradaStock(
    solicitante,
    compra.tenantId,
    compraRecibida
  );

  return { ok: true, data: { entradaStock } };
}

/** historial_precio(item) — Modulo_08 seccion 2. "item" es insumo o
 * producto segun tipo (roadmap item #12). */
export async function historialPrecio(
  solicitante: UsuarioConRol,
  tenantId: string,
  item: { insumoId: string } | { productoId: string }
): Promise<Resultado<Awaited<ReturnType<typeof repo.listarComprasPorItem>>>> {
  if (!(await tienePermiso(solicitante, tenantId, "proveedores", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver el historial de este tenant." };
  }
  return { ok: true, data: await repo.listarComprasPorItem(tenantId, item) };
}

/** Listado general de Compras del tenant — antes solo existian listados
 * indirectos (fichaProveedor -> compras[] por proveedor, historialPrecio
 * por item). Filtros opcionales por estadoPago y estado (pedido/recibido),
 * mas reciente primero. Agregada para la UI de "Listado de Compras"
 * (docs/ui/pantallas.md seccion 4). */
export async function listarCompras(
  solicitante: UsuarioConRol,
  tenantId: string,
  opts: { estadoPago?: EstadoPagoCompra; estado?: EstadoCompra } = {}
): Promise<Resultado<Awaited<ReturnType<typeof repo.listarComprasPorTenant>>>> {
  if (!(await tienePermiso(solicitante, tenantId, "proveedores", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver compras en este tenant." };
  }
  return { ok: true, data: await repo.listarComprasPorTenant(tenantId, opts) };
}

// --- Pagos de Compra ---------------------------------------------------------

export async function registrarPagoCompra(
  solicitante: UsuarioConRol,
  compraId: string,
  input: { monto: string | number; fechaPago: string }
): Promise<Resultado<{ estadoPago: EstadoPagoCompra; totalPagado: number }>> {
  const compra = await repo.obtenerCompraPorId(compraId);
  if (!compra) return { ok: false, error: "Compra no encontrada." };
  if (!(await tienePermiso(solicitante, compra.tenantId, "proveedores", "crear"))) {
    return { ok: false, error: "No tenés permiso para registrar pagos en esta compra." };
  }

  const { estadoPago, totalPagado } = await repo.registrarPagoCompraTx({
    compraId,
    monto: String(input.monto),
    fechaPago: input.fechaPago,
    creadoPor: solicitante.id,
  });

  return { ok: true, data: { estadoPago, totalPagado } };
}

// --- Compra de Ajuste ---------------------------------------------------------

export interface DatosCompraAjuste {
  tipo: TipoAjusteCompra;
  montoAjuste: string | number;
  motivo: string;
}

/** Nunca se edita una Compra directamente (regla 3.3) — se corrige con una
 * Compra de Ajuste que referencia a la original, con motivo obligatorio. */
export async function registrarCompraDeAjuste(
  solicitante: UsuarioConRol,
  compraId: string,
  input: DatosCompraAjuste
): Promise<Resultado<{ ajusteId: string }>> {
  const compra = await repo.obtenerCompraPorId(compraId);
  if (!compra) return { ok: false, error: "Compra no encontrada." };
  if (
    !(await tienePermiso(solicitante, compra.tenantId, "proveedores", "anular_ajustar"))
  ) {
    return { ok: false, error: "No tenés permiso para ajustar esta compra." };
  }
  if (!input.motivo.trim()) {
    return { ok: false, error: "El motivo del ajuste es obligatorio." };
  }

  const ajuste = await repo.crearCompraAjuste({
    compraId,
    tipo: input.tipo,
    montoAjuste: String(input.montoAjuste),
    motivo: input.motivo,
    creadoPor: solicitante.id,
  });

  return { ok: true, data: { ajusteId: ajuste.id } };
}

// --- Agregados por periodo para Financiero (Modulo_07, seccion 2) ---------------------------------------------------------

export async function consultarPagosCompraEnPeriodo(
  solicitante: UsuarioConRol,
  tenantId: string,
  periodo: { desde: string; hasta: string },
  opts: { sucursalId?: string } = {}
): Promise<Resultado<{ totalPagado: number }>> {
  if (!(await tienePermiso(solicitante, tenantId, "proveedores", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver compras en este tenant." };
  }
  const totalPagado = await repo.sumarPagosCompraPeriodo(
    tenantId,
    periodo.desde,
    periodo.hasta,
    opts
  );
  return { ok: true, data: { totalPagado } };
}
