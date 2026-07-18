// Simulaciones (Módulo 9, roadmap ítem #13) — se apoya casi enteramente en
// datos ya existentes en Ventas, Productos y Financiero; solo posee el
// historial de simulaciones y su configuración de umbral (Modulo_09 sección
// 1.5, regla 1). Nunca escribe en otro módulo (regla 4): ninguna función
// de acá llama a actualizarProducto() de Productos e Inventario.
import { calcularMargenPorcentaje, costoFijoTotal } from "@/modules/financiero/actions";
import type { PeriodoFinanciero } from "@/modules/financiero/actions";
import { tienePermiso } from "@/modules/identidad/actions";
import type { UsuarioConRol } from "@/modules/identidad/actions";
import {
  consultarCostoOperativo,
  consultarPrecioVenta,
  listarProductos,
} from "@/modules/productos/actions";
import { consultarUnidadesVendidasPeriodo } from "@/modules/ventas/actions";
import * as repo from "./repository";

export type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

// --- Fórmulas puras (Modulo_09 secciones 1.3, 2.2, 2.3) ---------------------------------------------------------

/** precio_sugerido = costo_produccion / (1 - margen_deseado_pct/100). */
export function calcularPrecioSugerido(
  costoProduccion: number,
  margenDeseadoPct: number
): number {
  return costoProduccion / (1 - margenDeseadoPct / 100);
}

/** impacto_proyectado_bs = (precio_sugerido - precio_venta_actual) x rotación. */
export function calcularImpactoProyectado(
  precioSugerido: number,
  precioVentaActual: number,
  rotacionHistorica: number
): number {
  return (precioSugerido - precioVentaActual) * rotacionHistorica;
}

export function calcularMargenContribucionUnitario(
  precioVenta: number,
  costoVariableUnitario: number
): number {
  return precioVenta - costoVariableUnitario;
}

/** Único motor genérico (sección 2.3), reutilizado por Punto de Equilibrio
 * (monto_a_cubrir = costo_fijo_total) y, a futuro, por la proyección de
 * inversión en activos (monto_a_cubrir = valor_compra, fuera de este
 * módulo). `null` si el margen de contribución no es positivo (caso borde
 * 2) — nunca un número infinito/negativo sin sentido. */
export function unidadesParaCubrir(
  montoACubrir: number,
  margenContribucionUnitario: number
): number | null {
  if (margenContribucionUnitario <= 0) return null;
  return montoACubrir / margenContribucionUnitario;
}

// --- Simular Precio (sección 1) ---------------------------------------------------------

export interface DatosSimularPrecio {
  productoId: string;
  frecuencia: string;
  periodo: PeriodoFinanciero;
  margenDeseadoPct: string | number;
  // Sobreescribe el costo automático SOLO para esta simulación puntual —
  // nunca persiste ni modifica el costo real del producto (regla 3.3).
  costoManual?: string | number;
}

export async function simularPrecio(
  solicitante: UsuarioConRol,
  tenantId: string,
  input: DatosSimularPrecio
): Promise<
  Resultado<{
    simulacionId: string;
    costoUsado: number;
    costoEsManual: boolean;
    precioVentaActual: number;
    margenActualPct: number | null;
    rotacionPeriodo: number;
    precioSugerido: number;
    impactoProyectadoBs: number | null;
  }>
> {
  if (!(await tienePermiso(solicitante, tenantId, "simulaciones", "crear"))) {
    return { ok: false, error: "No tenés permiso para simular precios en este tenant." };
  }

  const costoEsManual = input.costoManual !== undefined;
  let costoUsado: number;
  if (costoEsManual) {
    costoUsado = Number(input.costoManual);
  } else {
    const costoRes = await consultarCostoOperativo(solicitante, input.productoId);
    if (!costoRes.ok) return costoRes;
    if (costoRes.data.costoOperativoVigente === null) {
      return {
        ok: false,
        error:
          "Este producto no tiene un costo operativo vigente todavía — cargalo en Productos o ingresá un costo manual para esta simulación.",
      };
    }
    costoUsado = costoRes.data.costoOperativoVigente;
  }

  const precioRes = await consultarPrecioVenta(solicitante, input.productoId);
  if (!precioRes.ok) return precioRes;

  const rotacionRes = await consultarUnidadesVendidasPeriodo(
    solicitante,
    tenantId,
    input.productoId,
    input.periodo
  );
  if (!rotacionRes.ok) return rotacionRes;

  const margenDeseadoPct = Number(input.margenDeseadoPct);
  const precioSugerido = calcularPrecioSugerido(costoUsado, margenDeseadoPct);
  // Caso borde 1: sin rotación, solo precio sugerido — nunca se le pide al
  // usuario una estimación manual que generaría fricción.
  const impactoProyectadoBs =
    rotacionRes.data.unidadesVendidas > 0
      ? calcularImpactoProyectado(
          precioSugerido,
          precioRes.data.precioVenta,
          rotacionRes.data.unidadesVendidas
        )
      : null;

  // "Margen actual" (sección 1.1) — reutiliza calcularMargenPorcentaje de
  // Financiero tratando precio/costo como ingresos/costos de una unidad.
  const margenActualPct = calcularMargenPorcentaje(precioRes.data.precioVenta, costoUsado);

  const simulacion = await repo.crearSimulacion({
    tenantId,
    productoId: input.productoId,
    tipo: "simular_precio",
    frecuencia: input.frecuencia,
    periodo: `${input.periodo.desde}..${input.periodo.hasta}`,
    margenDeseadoPct: String(margenDeseadoPct),
    costoUsado: String(costoUsado),
    costoEsManual,
    precioSugerido: String(precioSugerido),
    impactoProyectadoBs: impactoProyectadoBs !== null ? String(impactoProyectadoBs) : undefined,
    creadoPor: solicitante.id,
  });

  return {
    ok: true,
    data: {
      simulacionId: simulacion.id,
      costoUsado,
      costoEsManual,
      precioVentaActual: precioRes.data.precioVenta,
      margenActualPct,
      rotacionPeriodo: rotacionRes.data.unidadesVendidas,
      precioSugerido,
      impactoProyectadoBs,
    },
  };
}

// --- Punto de Equilibrio (sección 2) ---------------------------------------------------------

export interface DatosPuntoEquilibrio {
  productoId: string;
  frecuencia: string;
  periodo: PeriodoFinanciero;
}

export async function calcularPuntoEquilibrio(
  solicitante: UsuarioConRol,
  tenantId: string,
  input: DatosPuntoEquilibrio
): Promise<
  Resultado<{
    simulacionId: string;
    costoFijoTotalPeriodo: number;
    costoVariableUnitario: number;
    precioVenta: number;
    margenContribucionUnitario: number;
    puntoEquilibrioUnidades: number | null;
    advertencia: string | null;
  }>
> {
  if (!(await tienePermiso(solicitante, tenantId, "simulaciones", "crear"))) {
    return { ok: false, error: "No tenés permiso para calcular el punto de equilibrio en este tenant." };
  }

  const costoFijoRes = await costoFijoTotal(solicitante, tenantId, input.periodo);
  if (!costoFijoRes.ok) return costoFijoRes;

  const costoRes = await consultarCostoOperativo(solicitante, input.productoId);
  if (!costoRes.ok) return costoRes;
  if (costoRes.data.costoOperativoVigente === null) {
    return {
      ok: false,
      error: "Este producto no tiene un costo operativo vigente todavía — cargalo en Productos.",
    };
  }

  const precioRes = await consultarPrecioVenta(solicitante, input.productoId);
  if (!precioRes.ok) return precioRes;

  const margenContribucionUnitario = calcularMargenContribucionUnitario(
    precioRes.data.precioVenta,
    costoRes.data.costoOperativoVigente
  );
  const puntoEquilibrioUnidades = unidadesParaCubrir(
    costoFijoRes.data.costoFijoTotal,
    margenContribucionUnitario
  );
  // Caso borde 2: margen de contribución <= 0 — advertencia en lenguaje
  // simple en vez de un numero sin sentido (infinito/negativo).
  const advertencia =
    puntoEquilibrioUnidades === null
      ? "A este precio y con este costo, nunca vas a cubrir tus costos fijos: el precio de venta no supera el costo variable."
      : null;

  const simulacion = await repo.crearSimulacion({
    tenantId,
    productoId: input.productoId,
    tipo: "punto_equilibrio",
    frecuencia: input.frecuencia,
    periodo: `${input.periodo.desde}..${input.periodo.hasta}`,
    costoUsado: String(costoRes.data.costoOperativoVigente),
    costoEsManual: false,
    puntoEquilibrioUnidades:
      puntoEquilibrioUnidades !== null ? String(puntoEquilibrioUnidades) : undefined,
    creadoPor: solicitante.id,
  });

  return {
    ok: true,
    data: {
      simulacionId: simulacion.id,
      costoFijoTotalPeriodo: costoFijoRes.data.costoFijoTotal,
      costoVariableUnitario: costoRes.data.costoOperativoVigente,
      precioVenta: precioRes.data.precioVenta,
      margenContribucionUnitario,
      puntoEquilibrioUnidades,
      advertencia,
    },
  };
}

// --- Configuración (umbral de alerta, sección 1.5) ---------------------------------------------------------

export async function obtenerConfiguracion(
  solicitante: UsuarioConRol,
  tenantId: string
): Promise<Resultado<{ umbralMargenAlertaPct: number }>> {
  if (!(await tienePermiso(solicitante, tenantId, "simulaciones", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver la configuración de este tenant." };
  }
  const config = await repo.obtenerConfiguracion(tenantId);
  return {
    ok: true,
    data: { umbralMargenAlertaPct: config ? Number(config.umbralMargenAlertaPct) : 15 },
  };
}

export async function actualizarUmbralAlerta(
  solicitante: UsuarioConRol,
  tenantId: string,
  umbralPct: string | number
): Promise<Resultado<{ umbralMargenAlertaPct: number }>> {
  if (!(await tienePermiso(solicitante, tenantId, "simulaciones", "editar"))) {
    return { ok: false, error: "No tenés permiso para editar la configuración de este tenant." };
  }
  const config = await repo.upsertConfiguracion(tenantId, String(umbralPct), solicitante.id);
  return { ok: true, data: { umbralMargenAlertaPct: Number(config.umbralMargenAlertaPct) } };
}

// --- Comparativo multi-SKU (sección 1.4) ---------------------------------------------------------

/**
 * "precio_sugerido" por fila usa el margen % PROMEDIO de todo el catálogo
 * como objetivo — decisión confirmada con el usuario (el doc no especifica
 * de dónde sale ese margen objetivo, a diferencia de Simular Precio que sí
 * lo pide como input). Coherente con que el umbral de alerta ya compara
 * cada margen contra ese mismo promedio.
 */
export async function comparativoMultiSku(
  solicitante: UsuarioConRol,
  tenantId: string
): Promise<
  Resultado<{
    umbralMargenAlertaPct: number;
    margenPromedioCatalogo: number | null;
    productos: Array<{
      productoId: string;
      nombre: string;
      costo: number | null;
      precioVenta: number;
      margenPct: number | null;
      precioSugerido: number | null;
      alerta: boolean;
    }>;
  }>
> {
  if (!(await tienePermiso(solicitante, tenantId, "simulaciones", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver el comparativo en este tenant." };
  }

  const [productosRes, configRes] = await Promise.all([
    listarProductos(solicitante, tenantId),
    obtenerConfiguracion(solicitante, tenantId),
  ]);
  if (!productosRes.ok) return productosRes;
  if (!configRes.ok) return configRes;

  // Productos sin costo cargado se excluyen del promedio y de la alerta —
  // no hay con qué comparar (decisión de esta tarea, el doc no lo cubre).
  const margenesValidos = productosRes.data
    .filter((p) => p.costoOperativoVigente !== null)
    .map((p) =>
      calcularMargenPorcentaje(Number(p.precioVenta), Number(p.costoOperativoVigente))
    )
    .filter((m): m is number => m !== null);
  const margenPromedioCatalogo =
    margenesValidos.length > 0
      ? margenesValidos.reduce((acc, m) => acc + m, 0) / margenesValidos.length
      : null;

  const productos = productosRes.data.map((p) => {
    const costo = p.costoOperativoVigente !== null ? Number(p.costoOperativoVigente) : null;
    const margenPct =
      costo !== null ? calcularMargenPorcentaje(Number(p.precioVenta), costo) : null;
    const precioSugerido =
      costo !== null && margenPromedioCatalogo !== null
        ? calcularPrecioSugerido(costo, margenPromedioCatalogo)
        : null;
    const alerta =
      margenPct !== null && margenPromedioCatalogo !== null
        ? Math.abs(margenPct - margenPromedioCatalogo) > configRes.data.umbralMargenAlertaPct
        : false;

    return {
      productoId: p.id,
      nombre: p.nombre,
      costo,
      precioVenta: Number(p.precioVenta),
      margenPct,
      precioSugerido,
      alerta,
    };
  });

  return {
    ok: true,
    data: {
      umbralMargenAlertaPct: configRes.data.umbralMargenAlertaPct,
      margenPromedioCatalogo,
      productos,
    },
  };
}

// --- Historial (sección 1.5) ---------------------------------------------------------

export async function listarSimulaciones(
  solicitante: UsuarioConRol,
  tenantId: string,
  productoId?: string
): Promise<Resultado<Awaited<ReturnType<typeof repo.listarSimulacionesPorTenant>>>> {
  if (!(await tienePermiso(solicitante, tenantId, "simulaciones", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver simulaciones en este tenant." };
  }
  return { ok: true, data: await repo.listarSimulacionesPorTenant(tenantId, productoId) };
}
