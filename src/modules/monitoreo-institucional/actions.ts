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
  registrarAccesoInstitucion,
  tieneConsentimiento,
} from "@/modules/consentimiento/actions";
import type { ModuloVeedor } from "@/modules/consentimiento/actions";
import {
  costoFijoTotal,
  estadoResultados,
  flujoCaja,
} from "@/modules/financiero/actions";
import type {
  EstadoResultadosData,
  MarcadorEstadoResultados,
  PeriodoFinanciero,
} from "@/modules/financiero/actions";
import { proyectar } from "@/lib/proyeccion-institucional";
import type { Clasificacion, Proyectado } from "@/lib/proyeccion-institucional";
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
//
// **`motivo` es de la tanda 3.3a (G-14)** y distingue dos situaciones que
// hasta entonces se veían idénticas en pantalla, y que significan cosas
// opuestas:
//
//   - `sin_consentimiento` — el negocio TIENE estos datos y decidió no
//     compartirlos. Candado.
//   - `modulo_no_aplica`   — el negocio no usa este módulo (es de otro nicho),
//     así que no hay nada que compartir ni ahora ni nunca.
//
// Sin esta distinción, un comercio minorista con "Producción" consentida
// mostraba "Sin producciones registradas" SIN candado — y el manual enseña
// textualmente que una tabla vacía sin candado significa "ese negocio
// realmente no registró actividad". Era falso: no registró porque no puede.
export type ConAutorizacion<T> =
  | { autorizado: true; detalle: T }
  | { autorizado: false; motivo: "sin_consentimiento" | "modulo_no_aplica" };

/**
 * ¿Este negocio usa el Módulo Operativo? (G-14)
 *
 * Hoy `operativo` e `inventario_operativo` los implementa **únicamente**
 * Nicho 1 — `detalleOperativo`/`detalleInventarioOperativo` llaman a sus
 * funciones. Un negocio de otro nicho, o en Modo Básico, no tiene producciones
 * ni insumos y **nunca los va a tener**: sus tablas están vacías por
 * definición, no por falta de actividad.
 *
 * El chequeo va acá, en la capa de consumo, y no dentro de Nicho 1: sus
 * funciones son correctas —devuelven lo que hay, que es nada— y agregarles un
 * gate por nicho las haría mentir distinto. Lo que faltaba era que el tercero
 * supiera **por qué** está vacío.
 *
 * Cuando exista un segundo nicho con módulo operativo propio, esto pasa a ser
 * una lista y no una comparación — que es el momento correcto para
 * generalizarlo, no antes.
 */
async function usaModuloOperativo(tenantId: string): Promise<boolean> {
  const tenant = await obtenerTenantParaVeedor(tenantId);
  return tenant.ok && tenant.data.nichoId === "nicho_1";
}

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
      /** X-02: cobertura del dato — ver obtenerTenantParaVeedor(). */
      sucursalesTotales: number;
      sucursalesOperables: number;
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
    /** X-02: cobertura del dato — ver obtenerTenantParaVeedor(). */
    sucursalesTotales: number;
    sucursalesOperables: number;
  }>
> {
  if (!(await estaEnCartera(institucionId, tenantId))) {
    return { ok: false, error: "Este negocio no está en la cartera de la institución." };
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
    return { ok: true, data: { autorizado: false, motivo: "sin_consentimiento" } };
  }
  // D-1: falla CERRADO — si no se puede dejar constancia, no se sirve el dato.
  // Ver la justificación completa en registrarAccesoInstitucion().
  await registrarAccesoInstitucion(institucionId, tenantId, "financiero");
  const solicitante = await solicitanteGateway();
  const res = await consultarIngresosPeriodo(solicitante, tenantId, periodo);
  if (!res.ok) return res;
  return { ok: true, data: { autorizado: true, detalle: { ingresos: res.data.ingresos } } };
}

/**
 * Qué campos de `estadoResultados()` llegan a la institución (D-10 / X-03).
 *
 * **No es una lista de campos elegidos a mano: es una clasificación exhaustiva
 * verificada por el compilador.** Si `EstadoResultadosData` gana un campo,
 * `pnpm typecheck` falla acá hasta que alguien decida qué hacer con él — que es
 * exactamente lo que NO pasó con `ingresosSinCostoConocido` y produjo X-01.
 *
 * `ingresosSinCostoConocido` está clasificado `"marcador"` porque figura en
 * `MARCADORES_ESTADO_RESULTADOS`; el tipo **no admite** otra cosa para él.
 */
const PROYECCION_ESTADO_RESULTADOS = {
  estadoResultados: "expuesto",
  ingresosSinCostoConocido: "marcador",
  ingresos: {
    omitido: "El portal es agregado por diseño: la institución ve el resultado, no su descomposición.",
    esMarcador: false,
  },
  costos: {
    omitido: "Ídem `ingresos` — descomposición, no completitud.",
    esMarcador: false,
  },
  gastos: {
    omitido: "Ídem `ingresos` — descomposición, no completitud.",
    esMarcador: false,
  },
  ajustesVenta: {
    omitido: "Ídem `ingresos` — ya está incorporado al resultado que sí viaja.",
    esMarcador: false,
  },
  ajustesCompra: {
    omitido: "Ídem `ingresos` — ya está incorporado al resultado que sí viaja.",
    esMarcador: false,
  },
} as const satisfies Clasificacion<EstadoResultadosData, MarcadorEstadoResultados>;

export async function detalleFinanciero(
  institucionId: string,
  tenantId: string,
  periodo: PeriodoFinanciero
): Promise<
  Resultado<
    ConAutorizacion<
      { flujoCaja: number; costoFijoTotal: number } & Proyectado<
        EstadoResultadosData,
        typeof PROYECCION_ESTADO_RESULTADOS
      >
    >
  >
> {
  if (!(await tieneConsentimiento(institucionId, tenantId, "financiero"))) {
    return { ok: true, data: { autorizado: false, motivo: "sin_consentimiento" } };
  }
  await registrarAccesoInstitucion(institucionId, tenantId, "financiero");
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
        costoFijoTotal: costoFijoRes.data.costoFijoTotal,
        // X-01: acá se descartaba el marcador. Ya no se elige a mano.
        ...proyectar(resultadosRes.data, PROYECCION_ESTADO_RESULTADOS),
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
    return { ok: true, data: { autorizado: false, motivo: "sin_consentimiento" } };
  }
  // G-14: el consentimiento existe, pero este negocio no usa el módulo.
  if (!(await usaModuloOperativo(tenantId))) {
    return { ok: true, data: { autorizado: false, motivo: "modulo_no_aplica" } };
  }
  await registrarAccesoInstitucion(institucionId, tenantId, "operativo");
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
    return { ok: true, data: { autorizado: false, motivo: "sin_consentimiento" } };
  }
  // G-14: ídem — sin insumos porque no hay operación que los consuma.
  if (!(await usaModuloOperativo(tenantId))) {
    return { ok: true, data: { autorizado: false, motivo: "modulo_no_aplica" } };
  }
  await registrarAccesoInstitucion(institucionId, tenantId, "inventario_operativo");
  const solicitante = await solicitanteGateway();
  const res = await listarInsumos(solicitante, tenantId);
  if (!res.ok) return res;

  return { ok: true, data: { autorizado: true, detalle: { insumos: res.data } } };
}

export type { ModuloVeedor };
