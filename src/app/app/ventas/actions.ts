"use server";

import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import {
  crearCanalVenta,
  crearCliente,
  crearMetodoPago,
  registrarAjusteVenta,
  registrarPagoVenta,
  registrarVenta,
} from "@/modules/ventas/actions";
import {
  ajusteVentaSchema,
  canalVentaFormSchema,
  clienteFormSchema,
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
