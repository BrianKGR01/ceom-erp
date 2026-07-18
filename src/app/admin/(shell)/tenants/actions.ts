"use server";

import {
  cambiarEstadoSuscripcion,
  cambiarPlanTenant,
  crearTenant,
  obtenerUsuarioActual,
} from "@/modules/identidad/actions";
import {
  cambiarEstadoSuscripcionSchema,
  crearTenantFormSchema,
} from "@/modules/identidad/validation";
import type { PeriodoFinanciero } from "@/modules/financiero/actions";
import {
  consultarFinancieroTenant,
  consultarInventarioOperativoTenant,
  consultarOperativoTenant,
  consultarTenantDetalle,
  saludAgregadaPlataforma,
} from "@/modules/panel-admin-ceom/actions";
import { calcularEstadoAcceso, listarTenants } from "@/modules/identidad/actions";

// Server Actions delgadas (mismo patron que reportes/actions.ts): resuelven
// la sesion server-side (ya gateada a ceom_admin por admin/layout.tsx) y
// delegan en panel-admin-ceom/actions.ts. El gate real (requiereCeomAdmin)
// vive en ese modulo, no aca — esta capa solo resuelve el usuario.

export async function saludAgregadaPlataformaAction() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return saludAgregadaPlataforma(usuario);
}

export async function listarTenantsConEstadoAction() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  const res = await listarTenants(usuario);
  if (!res.ok) return res;
  return {
    ok: true as const,
    data: res.data.map((t) => ({
      id: t.id,
      nombreNegocio: t.nombreNegocio,
      planId: t.planId,
      nichoId: t.nichoId,
      estadoAcceso: calcularEstadoAcceso(t),
    })),
  };
}

export async function consultarTenantDetalleAction(tenantId: string) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  const res = await consultarTenantDetalle(usuario, tenantId);
  if (!res.ok) return res;
  return { ok: true as const, data: { ...res.data, estadoAcceso: calcularEstadoAcceso(res.data) } };
}

export async function consultarFinancieroTenantAction(tenantId: string, periodo: PeriodoFinanciero) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return consultarFinancieroTenant(usuario, tenantId, periodo);
}

export async function consultarOperativoTenantAction(
  tenantId: string,
  periodo: { desde: string; hasta: string }
) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return consultarOperativoTenant(usuario, tenantId, periodo);
}

export async function consultarInventarioOperativoTenantAction(tenantId: string) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return consultarInventarioOperativoTenant(usuario, tenantId);
}

export async function crearTenantAction(input: unknown) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  const parsed = crearTenantFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }
  return crearTenant(usuario, {
    nombreNegocio: parsed.data.nombreNegocio,
    monedaPrincipal: parsed.data.monedaPrincipal,
    planId: parsed.data.planId,
    fechaInicioSuscripcion: parsed.data.fechaInicioSuscripcion,
    ownerEmail: parsed.data.ownerEmail,
    ownerNombreCompleto: parsed.data.ownerNombreCompleto,
  });
}

export async function cambiarPlanTenantAction(tenantId: string, nuevoPlanId: string) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return cambiarPlanTenant(usuario, tenantId, nuevoPlanId);
}

export async function cambiarEstadoSuscripcionAction(tenantId: string, input: unknown) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  const parsed = cambiarEstadoSuscripcionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Revisá los datos ingresados." };
  }
  return cambiarEstadoSuscripcion(
    usuario,
    tenantId,
    parsed.data.nuevoEstado,
    parsed.data.fechaProximoPago
  );
}
