"use server";

import { revalidatePath } from "next/cache";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import {
  actualizarProveedor,
  consultarSaldoCompra,
  crearProveedor,
  eliminarProveedor,
  recibirCompra,
  registrarCompra,
  registrarCompraDeAjuste,
  registrarPagoCompra,
} from "@/modules/proveedores/actions";
import {
  compraAjusteSchema,
  compraFormSchema,
  proveedorFormSchema,
  recibirCompraSchema,
  registrarPagoCompraSchema,
} from "@/modules/proveedores/validation";

export type ResultadoAccion<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// Server Actions delgadas (mismo patron que src/app/app/(shell)/patrimonio/actions.ts):
// resuelven la sesion server-side y delegan en proveedores/actions.ts.
//
// revalidatePath("/app/proveedores") en las tres mutaciones de abajo — a
// diferencia del resto de la app (donde router.refresh() del cliente
// alcanza), acá el layout.tsx del maestro-detalle es un segmento PADRE
// compartido entre la pagina vieja y la nueva a la que se navega tras
// crear/editar/eliminar. router.push()+router.refresh() en el cliente
// compiten por la misma transicion de React y una cancela a la otra (bug
// real encontrado al construir esta pantalla — el Directorio quedaba
// desactualizado, o la navegacion ni ocurria). revalidatePath() invalida
// el cache del router ANTES de que el cliente navegue, sin esa carrera.

export async function crearProveedorAction(
  input: unknown
): Promise<ResultadoAccion<{ proveedorId: string }>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const parsed = proveedorFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }

  const resultado = await crearProveedor(usuario, usuario.tenantId, parsed.data);
  if (!resultado.ok) return resultado;
  revalidatePath("/app/proveedores");
  return { ok: true, data: { proveedorId: resultado.data.proveedorId } };
}

export async function actualizarProveedorAction(
  proveedorId: string,
  input: unknown
): Promise<ResultadoAccion<undefined>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const parsed = proveedorFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }

  const resultado = await actualizarProveedor(usuario, proveedorId, parsed.data);
  if (!resultado.ok) return resultado;
  revalidatePath("/app/proveedores");
  return { ok: true, data: undefined };
}

export async function eliminarProveedorAction(
  proveedorId: string
): Promise<ResultadoAccion<undefined>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const resultado = await eliminarProveedor(usuario, proveedorId);
  if (!resultado.ok) return resultado;
  revalidatePath("/app/proveedores");
  return { ok: true, data: undefined };
}

// --- Compras ---------------------------------------------------------

export async function registrarCompraAction(
  input: unknown
): Promise<ResultadoAccion<{ compraId: string }>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const parsed = compraFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }

  const { proveedorId, insumoId, productoId, fechaVencimiento, ...resto } = parsed.data;
  const resultado = await registrarCompra(usuario, usuario.tenantId, {
    ...resto,
    proveedorId: proveedorId || undefined,
    insumoId: resto.tipo === "insumo" ? insumoId : undefined,
    productoId: resto.tipo === "reventa" ? productoId : undefined,
    fechaVencimiento: fechaVencimiento || undefined,
  });
  if (!resultado.ok) return resultado;
  revalidatePath("/app/proveedores/compras");
  return { ok: true, data: { compraId: resultado.data.compraId } };
}

export async function recibirCompraAction(
  compraId: string,
  input: unknown
): Promise<ResultadoAccion<undefined>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const parsed = recibirCompraSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }

  const resultado = await recibirCompra(usuario, compraId, parsed.data.fechaRecepcion);
  if (!resultado.ok) return resultado;
  revalidatePath("/app/proveedores/compras");
  return { ok: true, data: undefined };
}

export async function consultarSaldoCompraAction(
  compraId: string
): Promise<ResultadoAccion<{ saldoPendiente: number }>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const resultado = await consultarSaldoCompra(usuario, compraId);
  if (!resultado.ok) return resultado;
  return { ok: true, data: resultado.data };
}

export async function registrarPagoCompraAction(
  compraId: string,
  input: unknown
): Promise<ResultadoAccion<{ estadoPago: string; totalPagado: number }>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const parsed = registrarPagoCompraSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }

  const resultado = await registrarPagoCompra(usuario, compraId, parsed.data);
  if (!resultado.ok) return resultado;
  revalidatePath("/app/proveedores/compras");
  return { ok: true, data: resultado.data };
}

export async function registrarCompraDeAjusteAction(
  compraId: string,
  input: unknown
): Promise<ResultadoAccion<{ ajusteId: string }>> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };

  const parsed = compraAjusteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }

  const resultado = await registrarCompraDeAjuste(usuario, compraId, parsed.data);
  if (!resultado.ok) return resultado;
  revalidatePath("/app/proveedores/compras");
  return { ok: true, data: resultado.data };
}
