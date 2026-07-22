// Panel Admin CEOM (roadmap ítem #11, Modulo_11 secciones 2 y 4) — capa de
// consumo sin tablas propias (sin schema.ts ni repository.ts, mismo criterio
// que Financiero/Monitoreo Institucional). Consumida por `ceom_admin`
// (UsuarioConRol real) — NO pasa por el Gateway de Consentimiento: el
// acceso del equipo CEOM no requiere aprobación del tenant (Modulo_11
// sección 4, regla 5, es parte de los Términos de Servicio), pero cada
// lectura de un tenant puntual queda auditada vía `registrarAccesoAdminCeom`.
import {
  registrarAccesoAdminCeom,
} from "@/modules/consentimiento/actions";
import type { moduloPermisoEnum } from "@/modules/identidad/schema";
import {
  calcularEstadoAcceso,
  listarTenants as listarTenantsIdentidad,
  obtenerTenantPorId,
} from "@/modules/identidad/actions";
import type { UsuarioConRol } from "@/modules/identidad/actions";
import { CEOM_OPS_TENANT_ID, ROL_CEOM_ADMIN_ID } from "@/modules/identidad/constants";
import {
  costoFijoTotal,
  estadoResultados,
  flujoCaja,
} from "@/modules/financiero/actions";
import type { PeriodoFinanciero } from "@/modules/financiero/actions";
import {
  consultarMermaPeriodo,
  listarInsumos,
  listarProducciones,
} from "@/modules/operativo/nichos/nicho-1/actions";
import { listarPlanes } from "@/modules/suscripcion/actions";

export type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

type ModuloConsultado = (typeof moduloPermisoEnum.enumValues)[number];

function esCeomAdmin(solicitante: UsuarioConRol): boolean {
  return solicitante.rol.esRolSistema && solicitante.rolId === ROL_CEOM_ADMIN_ID;
}

function requiereCeomAdmin(solicitante: UsuarioConRol): { ok: false; error: string } | null {
  if (!esCeomAdmin(solicitante)) {
    return { ok: false, error: "Solo el equipo CEOM puede usar el Panel Admin CEOM." };
  }
  return null;
}

// --- Salud agregada de la plataforma (Modulo_11 sección 2.2) ---------------------------------------------------------

/**
 * Solo lo calculable hoy — decisión ya confirmada: cantidad de tenants por
 * estado_acceso, distribución por plan y por nicho. % onboarding
 * completado y % retención NO se implementan (no hay checklist de
 * onboarding ni definición de retención todavía) — ver pendientes abajo.
 * Cross-tenant, no es "acceso a un negocio puntual" — se audita igual (Etapa
 * 3 del backstop de RLS, docs/security/PLAN-RLS-BACKSTOP.md §10.5/§10.11
 * decision 6: antes esta lectura no dejaba ningún rastro), atribuido a
 * CEOM_OPS_TENANT_ID porque logs_acceso_admin_ceom exige un tenant_id real
 * y este acceso no es "sobre" ningún tenant de cliente en particular.
 */
export async function saludAgregadaPlataforma(solicitante: UsuarioConRol): Promise<
  Resultado<{
    totalTenants: number;
    porEstadoAcceso: Record<string, number>;
    porPlan: Array<{ planId: string; nombrePlan: string; cantidad: number }>;
    porNicho: Array<{ nichoId: string | null; cantidad: number }>;
  }>
> {
  const bloqueo = requiereCeomAdmin(solicitante);
  if (bloqueo) return bloqueo;

  const tenantsRes = await listarTenantsIdentidad(solicitante);
  if (!tenantsRes.ok) return tenantsRes;
  const planes = await listarPlanes();
  await loguearAcceso(solicitante, CEOM_OPS_TENANT_ID, "identidad");

  const porEstadoAcceso: Record<string, number> = {};
  const cantidadPorPlan = new Map<string, number>();
  const cantidadPorNicho = new Map<string | null, number>();

  for (const tenant of tenantsRes.data) {
    const estado = calcularEstadoAcceso(tenant);
    porEstadoAcceso[estado] = (porEstadoAcceso[estado] ?? 0) + 1;
    if (tenant.planId) {
      cantidadPorPlan.set(tenant.planId, (cantidadPorPlan.get(tenant.planId) ?? 0) + 1);
    }
    cantidadPorNicho.set(tenant.nichoId, (cantidadPorNicho.get(tenant.nichoId) ?? 0) + 1);
  }

  const porPlan = planes
    .filter((p) => cantidadPorPlan.has(p.id))
    .map((p) => ({ planId: p.id, nombrePlan: p.nombre, cantidad: cantidadPorPlan.get(p.id) ?? 0 }));

  const porNicho = Array.from(cantidadPorNicho.entries()).map(([nichoId, cantidad]) => ({
    nichoId,
    cantidad,
  }));

  return {
    ok: true,
    data: { totalTenants: tenantsRes.data.length, porEstadoAcceso, porPlan, porNicho },
  };
}

// --- Lecturas de un tenant puntual (auditadas vía registrarAccesoAdminCeom) ---------------------------------------------------------

async function loguearAcceso(
  solicitante: UsuarioConRol,
  tenantId: string,
  moduloConsultado: ModuloConsultado
): Promise<void> {
  await registrarAccesoAdminCeom(solicitante, tenantId, moduloConsultado);
}

export async function consultarTenantDetalle(
  solicitante: UsuarioConRol,
  tenantId: string
): Promise<Resultado<Awaited<ReturnType<typeof obtenerTenantPorId>> extends Resultado<infer D> ? D : never>> {
  const bloqueo = requiereCeomAdmin(solicitante);
  if (bloqueo) return bloqueo;

  const res = await obtenerTenantPorId(solicitante, tenantId);
  if (!res.ok) return res;
  await loguearAcceso(solicitante, tenantId, "identidad");
  return res;
}

export async function consultarFinancieroTenant(
  solicitante: UsuarioConRol,
  tenantId: string,
  periodo: PeriodoFinanciero
): Promise<
  Resultado<{ flujoCaja: number; estadoResultados: number; costoFijoTotal: number }>
> {
  const bloqueo = requiereCeomAdmin(solicitante);
  if (bloqueo) return bloqueo;

  const [flujoRes, resultadosRes, costoFijoRes] = await Promise.all([
    flujoCaja(solicitante, tenantId, periodo),
    estadoResultados(solicitante, tenantId, periodo),
    costoFijoTotal(solicitante, tenantId, periodo),
  ]);
  if (!flujoRes.ok) return flujoRes;
  if (!resultadosRes.ok) return resultadosRes;
  if (!costoFijoRes.ok) return costoFijoRes;

  await loguearAcceso(solicitante, tenantId, "financiero");

  return {
    ok: true,
    data: {
      flujoCaja: flujoRes.data.flujoCaja,
      estadoResultados: resultadosRes.data.estadoResultados,
      costoFijoTotal: costoFijoRes.data.costoFijoTotal,
    },
  };
}

export async function consultarOperativoTenant(
  solicitante: UsuarioConRol,
  tenantId: string,
  periodo: { desde: string; hasta: string }
): Promise<
  Resultado<{
    producciones: Extract<Awaited<ReturnType<typeof listarProducciones>>, { ok: true }>["data"];
    mermaCostoTotal: number;
  }>
> {
  const bloqueo = requiereCeomAdmin(solicitante);
  if (bloqueo) return bloqueo;

  const [produccionesRes, mermaRes] = await Promise.all([
    listarProducciones(solicitante, tenantId),
    consultarMermaPeriodo(solicitante, tenantId, periodo),
  ]);
  if (!produccionesRes.ok) return produccionesRes;
  if (!mermaRes.ok) return mermaRes;

  await loguearAcceso(solicitante, tenantId, "operativo");

  return {
    ok: true,
    data: { producciones: produccionesRes.data, mermaCostoTotal: mermaRes.data.mermaCostoTotal },
  };
}

/**
 * `moduloConsultado: "operativo"` (no "inventario_operativo") — decisión de
 * esta tarea: `moduloPermisoEnum` (el catálogo interno de Identidad) no
 * distingue insumos de producción, ambos viven bajo el mismo permiso
 * `"operativo"` (ver `listarInsumos` en Operativo Nicho 1, gatea igual que
 * `listarProducciones`). Solo `moduloVeedorEnum` (Gateway) hace esa
 * distinción, y ese catálogo es un enum aparte, no reutilizable acá.
 */
export async function consultarInventarioOperativoTenant(
  solicitante: UsuarioConRol,
  tenantId: string
): Promise<
  Resultado<{
    insumos: Extract<Awaited<ReturnType<typeof listarInsumos>>, { ok: true }>["data"];
  }>
> {
  const bloqueo = requiereCeomAdmin(solicitante);
  if (bloqueo) return bloqueo;

  const res = await listarInsumos(solicitante, tenantId);
  if (!res.ok) return res;

  await loguearAcceso(solicitante, tenantId, "operativo");

  return { ok: true, data: { insumos: res.data } };
}
