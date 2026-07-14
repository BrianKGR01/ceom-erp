import { tienePermiso } from "@/modules/identidad/actions";
import type { UsuarioConRol } from "@/modules/identidad/actions";
import * as repo from "./repository";
import type {
  estadoPagoCompraEnum,
  tipoAjusteCompraEnum,
  tipoCompraEnum,
} from "./schema";

export type Resultado<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type TipoCompra = (typeof tipoCompraEnum.enumValues)[number];
type EstadoPagoCompra = (typeof estadoPagoCompraEnum.enumValues)[number];
type TipoAjusteCompra = (typeof tipoAjusteCompraEnum.enumValues)[number];

/** costo_unitario = monto_total / cantidad (Modulo_08 seccion 1.2) — se
 * calcula una sola vez al registrar la Compra, nunca se edita despues
 * (correcciones van por Compra de Ajuste). */
export function calcularCostoUnitario(
  montoTotal: string | number,
  cantidad: string | number
): number {
  return Number(montoTotal) / Number(cantidad);
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
  itemId: string;
  cantidad: string | number;
  montoTotal: string | number;
  fechaCompra: string;
  fechaVencimiento?: string;
}

export async function registrarCompra(
  solicitante: UsuarioConRol,
  tenantId: string,
  input: DatosCompra
): Promise<Resultado<{ compraId: string; costoUnitario: number }>> {
  if (!(await tienePermiso(solicitante, tenantId, "proveedores", "crear"))) {
    return { ok: false, error: "No tenés permiso para registrar compras en este tenant." };
  }

  const costoUnitario = calcularCostoUnitario(input.montoTotal, input.cantidad);

  const compra = await repo.crearCompra({
    tenantId,
    sucursalId: input.sucursalId,
    proveedorId: input.proveedorId,
    tipo: input.tipo,
    itemId: input.itemId,
    cantidad: String(input.cantidad),
    costoUnitario: String(costoUnitario),
    montoTotal: String(input.montoTotal),
    fechaCompra: input.fechaCompra,
    fechaVencimiento: input.fechaVencimiento,
    creadoPor: solicitante.id,
  });

  return { ok: true, data: { compraId: compra.id, costoUnitario } };
}

/** historial_precio(item_id) — Modulo_08 seccion 2. */
export async function historialPrecio(
  solicitante: UsuarioConRol,
  tenantId: string,
  itemId: string
): Promise<Resultado<Awaited<ReturnType<typeof repo.listarComprasPorItem>>>> {
  if (!(await tienePermiso(solicitante, tenantId, "proveedores", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver el historial de este tenant." };
  }
  return { ok: true, data: await repo.listarComprasPorItem(tenantId, itemId) };
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
