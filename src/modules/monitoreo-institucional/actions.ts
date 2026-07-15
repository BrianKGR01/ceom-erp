// Monitoreo Institucional (roadmap ítem #11, Modulo_11 sección 3.3) — capa de
// consumo sin tablas propias (sin schema.ts ni repository.ts, mismo criterio
// que Financiero): compone llamadas ya existentes de otros módulos vía sus
// actions.ts públicos. Nunca calcula nada de negocio propio.
//
// Consumida por una Institución externa (futuro Portal de Entidades
// Veedoras) — no es un UsuarioConRol, así que ninguna función de acá recibe
// `solicitante`, mismo criterio ya usado en tieneConsentimiento()/
// canjearCodigoAcceso() del Gateway. El login/autenticación real de la
// Institución en ese portal es UI futura, fuera de este alcance.
import {
  listarCarteraPropia,
  tieneConsentimiento,
} from "@/modules/consentimiento/actions";
import type { ModuloVeedor } from "@/modules/consentimiento/actions";
import {
  costoFijoTotal,
  estadoResultados,
  flujoCaja,
} from "@/modules/financiero/actions";
import type { PeriodoFinanciero } from "@/modules/financiero/actions";
import {
  obtenerTenantParaVeedor,
  solicitanteGateway,
} from "@/modules/identidad/actions";
import {
  consultarMermaPeriodo,
  listarInsumos,
  listarProducciones,
} from "@/modules/operativo/nichos/nicho-1/actions";
import { consultarIngresosPeriodo } from "@/modules/ventas/actions";

export type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

// Nunca se lanza con datos parciales: si el módulo veedor correspondiente no
// fue aprobado, `autorizado:false` sin `detalle` — el llamador (UI del
// Portal de Entidades Veedoras) decide cómo mostrar "no aprobado".
export type ConAutorizacion<T> =
  | { autorizado: true; detalle: T }
  | { autorizado: false };

async function estaEnCartera(institucionId: string, tenantId: string): Promise<boolean> {
  const cartera = await listarCarteraPropia(institucionId);
  if (!cartera.ok) return false;
  return cartera.data.some((fila) => fila.tenantId === tenantId);
}

// --- Cartera + estado básico del tenant (NO requiere módulo veedor
// aprobado — es metadato de la relación de cartera, no dato de negocio) ---------------------------------------------------------

/** Lista de tenants en la cartera de la institución (Modulo_11 sección 3.3). */
export async function listarCartera(institucionId: string): Promise<
  Resultado<
    Array<{
      tenantId: string;
      cohorte: string | null;
      fechaInicio: string;
      fechaFin: string | null;
      nombreNegocio: string;
      nichoId: string | null;
      planId: string | null;
      estadoAcceso: string;
    }>
  >
> {
  const cartera = await listarCarteraPropia(institucionId);
  if (!cartera.ok) return cartera;

  const filas = await Promise.all(
    cartera.data.map(async (fila) => {
      const tenant = await obtenerTenantParaVeedor(fila.tenantId);
      if (!tenant.ok) return null;
      return {
        tenantId: fila.tenantId,
        cohorte: fila.cohorte,
        fechaInicio: fila.fechaInicio,
        fechaFin: fila.fechaFin,
        ...tenant.data,
      };
    })
  );

  return { ok: true, data: filas.filter((f): f is NonNullable<typeof f> => f !== null) };
}

/** Estado básico de un tenant puntual de la cartera (Modulo_11 sección 3.3). */
export async function estadoTenant(
  institucionId: string,
  tenantId: string
): Promise<
  Resultado<{
    id: string;
    nombreNegocio: string;
    nichoId: string | null;
    planId: string | null;
    estadoAcceso: string;
  }>
> {
  if (!(await estaEnCartera(institucionId, tenantId))) {
    return { ok: false, error: "Este tenant no está en la cartera de la institución." };
  }
  return obtenerTenantParaVeedor(tenantId);
}

// --- Detalle por módulo veedor (gateado por tieneConsentimiento()) ---------------------------------------------------------

/**
 * Tendencia de ventas — decisión del plan: Ventas no tiene veedor propio en
 * moduloVeedorEnum, se gatea bajo "financiero" (regla 1 del Módulo 11:
 * ninguna institución ve nada sin aprobación explícita).
 */
export async function tendenciaVentas(
  institucionId: string,
  tenantId: string,
  periodo: PeriodoFinanciero
): Promise<Resultado<ConAutorizacion<{ ingresos: number }>>> {
  if (!(await tieneConsentimiento(institucionId, tenantId, "financiero"))) {
    return { ok: true, data: { autorizado: false } };
  }
  const solicitante = await solicitanteGateway();
  const res = await consultarIngresosPeriodo(solicitante, tenantId, periodo);
  if (!res.ok) return res;
  return { ok: true, data: { autorizado: true, detalle: { ingresos: res.data.ingresos } } };
}

export async function detalleFinanciero(
  institucionId: string,
  tenantId: string,
  periodo: PeriodoFinanciero
): Promise<
  Resultado<
    ConAutorizacion<{ flujoCaja: number; estadoResultados: number; costoFijoTotal: number }>
  >
> {
  if (!(await tieneConsentimiento(institucionId, tenantId, "financiero"))) {
    return { ok: true, data: { autorizado: false } };
  }
  const solicitante = await solicitanteGateway();
  const [flujoRes, resultadosRes, costoFijoRes] = await Promise.all([
    flujoCaja(solicitante, tenantId, periodo),
    estadoResultados(solicitante, tenantId, periodo),
    costoFijoTotal(solicitante, tenantId, periodo),
  ]);
  if (!flujoRes.ok) return flujoRes;
  if (!resultadosRes.ok) return resultadosRes;
  if (!costoFijoRes.ok) return costoFijoRes;

  return {
    ok: true,
    data: {
      autorizado: true,
      detalle: {
        flujoCaja: flujoRes.data.flujoCaja,
        estadoResultados: resultadosRes.data.estadoResultados,
        costoFijoTotal: costoFijoRes.data.costoFijoTotal,
      },
    },
  };
}

/**
 * Solo `listarProducciones` + `consultarMermaPeriodo` — `consultarCapacidad-
 * ProduccionUsada` queda fuera de este alcance: necesita un `activoId` que
 * el veedor no tiene forma de descubrir hoy (Patrimonio no está expuesto a
 * ningún módulo veedor). Documentado como pendiente, no silencioso.
 */
export async function detalleOperativo(
  institucionId: string,
  tenantId: string,
  periodo: { desde: string; hasta: string }
): Promise<
  Resultado<
    ConAutorizacion<{
      producciones: Extract<Awaited<ReturnType<typeof listarProducciones>>, { ok: true }>["data"];
      mermaCostoTotal: number;
    }>
  >
> {
  if (!(await tieneConsentimiento(institucionId, tenantId, "operativo"))) {
    return { ok: true, data: { autorizado: false } };
  }
  const solicitante = await solicitanteGateway();
  const [produccionesRes, mermaRes] = await Promise.all([
    listarProducciones(solicitante, tenantId),
    consultarMermaPeriodo(solicitante, tenantId, periodo),
  ]);
  if (!produccionesRes.ok) return produccionesRes;
  if (!mermaRes.ok) return mermaRes;

  return {
    ok: true,
    data: {
      autorizado: true,
      detalle: {
        producciones: produccionesRes.data,
        mermaCostoTotal: mermaRes.data.mermaCostoTotal,
      },
    },
  };
}

/**
 * Solo `listarInsumos` (catálogo + costo vigente) — `consultarStockInsumo`
 * queda fuera de este alcance: necesita `insumoId` + `sucursalId`, y no hay
 * hoy una función veedor-segura para enumerar sucursales de un tenant.
 * Documentado como pendiente, no silencioso.
 */
export async function detalleInventarioOperativo(
  institucionId: string,
  tenantId: string
): Promise<
  Resultado<
    ConAutorizacion<{
      insumos: Extract<Awaited<ReturnType<typeof listarInsumos>>, { ok: true }>["data"];
    }>
  >
> {
  if (!(await tieneConsentimiento(institucionId, tenantId, "inventario_operativo"))) {
    return { ok: true, data: { autorizado: false } };
  }
  const solicitante = await solicitanteGateway();
  const res = await listarInsumos(solicitante, tenantId);
  if (!res.ok) return res;

  return { ok: true, data: { autorizado: true, detalle: { insumos: res.data } } };
}

export type { ModuloVeedor };
