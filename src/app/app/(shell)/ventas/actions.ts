"use server";

import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import {
  abrirEvento,
  actualizarCanalVenta,
  actualizarCliente,
  actualizarComisionEvento,
  actualizarMetodoPago,
  cerrarEvento,
  crearCanalVenta,
  crearCliente,
  crearMetodoPago,
  desactivarMetodoPago,
  eliminarCanalVenta,
  eliminarCliente,
  importarVentaHistorica,
  reabrirEvento,
  reactivarMetodoPago,
  registrarAjusteVenta,
  registrarPagoVenta,
  registrarVenta,
} from "@/modules/ventas/actions";
import {
  ajusteVentaSchema,
  canalVentaFormSchema,
  clienteFormSchema,
  eventoFormSchema,
  importarVentaHistoricaFilaSchema,
  metodoPagoFormSchema,
  registrarPagoVentaSchema,
  registrarVentaSchema,
} from "@/modules/ventas/validation";

export type ResultadoAccion<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// Server Actions delgadas (mismo patron que src/app/app/productos/actions.ts):
// resuelven la sesion server-side y delegan en ventas/actions.ts.

export async function registrarVentaAction(
  sucursalId: string,
  input: unknown
): Promise<
  ResultadoAccion<{
    ventaId: string;
    totalVenta: number;
    avisosStock: string[];
  }>
> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const parsed = registrarVentaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }

  const resultado = await registrarVenta(usuario, usuario.tenantId, {
    sucursalId,
    ...parsed.data,
  });
  if (!resultado.ok) return resultado;

  const avisosStock = resultado.data.descuentosStock
    .filter((d) => !d.ok)
    .map((d) => (!d.ok ? d.error : ""));

  return {
    ok: true,
    data: {
      ventaId: resultado.data.ventaId,
      totalVenta: resultado.data.totalVenta,
      avisosStock,
    },
  };
}

export async function crearCanalVentaAction(
  input: unknown
): Promise<ResultadoAccion<{ canalVentaId: string; nombre: string }>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const parsed = canalVentaFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }

  const resultado = await crearCanalVenta(usuario, usuario.tenantId, parsed.data);
  if (!resultado.ok) return resultado;
  return { ok: true, data: { canalVentaId: resultado.data.canalVentaId, nombre: parsed.data.nombre } };
}

export async function actualizarCanalVentaAction(
  canalVentaId: string,
  input: unknown
): Promise<ResultadoAccion<undefined>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const parsed = canalVentaFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }

  const resultado = await actualizarCanalVenta(usuario, canalVentaId, parsed.data);
  if (!resultado.ok) return resultado;
  return { ok: true, data: undefined };
}

export async function toggleCanalVentaActivoAction(
  canalVentaId: string,
  activo: boolean
): Promise<ResultadoAccion<undefined>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const resultado = await actualizarCanalVenta(usuario, canalVentaId, { activo });
  if (!resultado.ok) return resultado;
  return { ok: true, data: undefined };
}

export async function eliminarCanalVentaAction(
  canalVentaId: string
): Promise<ResultadoAccion<undefined>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const resultado = await eliminarCanalVenta(usuario, canalVentaId);
  if (!resultado.ok) return resultado;
  return { ok: true, data: undefined };
}

export async function crearMetodoPagoAction(
  input: unknown
): Promise<ResultadoAccion<{ metodoPagoId: string; nombre: string }>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const parsed = metodoPagoFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }

  const resultado = await crearMetodoPago(usuario, usuario.tenantId, parsed.data);
  if (!resultado.ok) return resultado;
  return { ok: true, data: { metodoPagoId: resultado.data.metodoPagoId, nombre: parsed.data.nombre } };
}

export async function actualizarMetodoPagoAction(
  metodoPagoId: string,
  input: unknown
): Promise<ResultadoAccion<undefined>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const parsed = metodoPagoFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }

  const resultado = await actualizarMetodoPago(usuario, metodoPagoId, parsed.data);
  if (!resultado.ok) return resultado;
  return { ok: true, data: undefined };
}

export async function toggleMetodoPagoActivoAction(
  metodoPagoId: string,
  activo: boolean
): Promise<ResultadoAccion<undefined>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const resultado = activo
    ? await reactivarMetodoPago(usuario, metodoPagoId)
    : await desactivarMetodoPago(usuario, metodoPagoId);
  if (!resultado.ok) return resultado;
  return { ok: true, data: undefined };
}

export async function crearClienteAction(
  input: unknown
): Promise<ResultadoAccion<{ clienteId: string; nombre: string }>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const parsed = clienteFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }

  const resultado = await crearCliente(usuario, usuario.tenantId, parsed.data);
  if (!resultado.ok) return resultado;
  return { ok: true, data: { clienteId: resultado.data.clienteId, nombre: parsed.data.nombre } };
}

export async function actualizarClienteAction(
  clienteId: string,
  input: unknown
): Promise<ResultadoAccion<undefined>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const parsed = clienteFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }

  const resultado = await actualizarCliente(usuario, clienteId, parsed.data);
  if (!resultado.ok) return resultado;
  return { ok: true, data: undefined };
}

export async function eliminarClienteAction(clienteId: string): Promise<ResultadoAccion<undefined>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const resultado = await eliminarCliente(usuario, clienteId);
  if (!resultado.ok) return resultado;
  return { ok: true, data: undefined };
}

export async function registrarPagoVentaAction(
  ventaId: string,
  input: unknown
): Promise<ResultadoAccion<{ estadoPago: string; totalPagado: number }>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const parsed = registrarPagoVentaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }

  const resultado = await registrarPagoVenta(usuario, ventaId, parsed.data);
  if (!resultado.ok) return resultado;
  return { ok: true, data: resultado.data };
}

export async function registrarAjusteVentaAction(
  ventaId: string,
  input: unknown
): Promise<ResultadoAccion<{ ajusteId: string }>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const parsed = ajusteVentaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }

  const resultado = await registrarAjusteVenta(usuario, ventaId, parsed.data);
  if (!resultado.ok) return resultado;
  return { ok: true, data: { ajusteId: resultado.data.ajusteId } };
}

export async function abrirEventoAction(
  input: unknown
): Promise<ResultadoAccion<{ eventoId: string }>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const parsed = eventoFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }

  const resultado = await abrirEvento(usuario, usuario.tenantId, parsed.data);
  if (!resultado.ok) return resultado;
  return { ok: true, data: resultado.data };
}

export async function actualizarComisionEventoAction(
  eventoId: string,
  nuevoPorcentaje: number
): Promise<ResultadoAccion<undefined>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const resultado = await actualizarComisionEvento(usuario, eventoId, nuevoPorcentaje);
  if (!resultado.ok) return resultado;
  return { ok: true, data: undefined };
}

export async function cerrarEventoAction(eventoId: string): Promise<ResultadoAccion<undefined>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const resultado = await cerrarEvento(usuario, eventoId);
  if (!resultado.ok) return resultado;
  return { ok: true, data: undefined };
}

export async function reabrirEventoAction(eventoId: string): Promise<ResultadoAccion<undefined>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const resultado = await reabrirEvento(usuario, eventoId);
  if (!resultado.ok) return resultado;
  return { ok: true, data: undefined };
}

/** Cada fila del CSV ya resuelto (canal/producto/cliente por nombre → id,
 * hecho en el cliente) es una Venta de una sola línea — mismo criterio que
 * el resto de esta importación: sin stock, sin comisión, snapshots directos
 * del input (ver `importarVentaHistorica` del módulo). */
export async function importarVentaHistoricaLoteAction(
  sucursalId: string,
  filas: unknown[]
): Promise<ResultadoAccion<{ importadas: number; errores: { fila: number; motivo: string }[] }>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  if (!sucursalId) return { ok: false, error: "Elegí una sucursal para la importación." };

  let importadas = 0;
  const errores: { fila: number; motivo: string }[] = [];

  for (let i = 0; i < filas.length; i++) {
    const parsed = importarVentaHistoricaFilaSchema.safeParse(filas[i]);
    if (!parsed.success) {
      errores.push({ fila: i + 1, motivo: parsed.error.issues[0]?.message ?? "Fila inválida." });
      continue;
    }
    const { clienteId, fechaVenta, canalVentaId, productoId, cantidad, precioVentaSnapshot, costoUnitarioSnapshot } =
      parsed.data;
    const resultado = await importarVentaHistorica(usuario, usuario.tenantId, {
      sucursalId,
      clienteId,
      fechaVenta,
      canalVentaId,
      lineas: [{ productoId, cantidad, precioVentaSnapshot, costoUnitarioSnapshot }],
    });
    if (!resultado.ok) {
      errores.push({ fila: i + 1, motivo: resultado.error });
      continue;
    }
    importadas++;
  }

  return { ok: true, data: { importadas, errores } };
}
