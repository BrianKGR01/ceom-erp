"use server";

import { obtenerUsuarioActual } from "@/modules/identidad/actions";
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
