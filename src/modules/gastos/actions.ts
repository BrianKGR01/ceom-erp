import { tienePermiso } from "@/modules/identidad/actions";
import type { UsuarioConRol } from "@/modules/identidad/actions";
import { ROL_CEOM_ADMIN_ID } from "@/modules/identidad/constants";
import { registrarPagoPasivo } from "@/modules/patrimonio/actions";
import { fichaVenta } from "@/modules/ventas/actions";
import * as repo from "./repository";
import type {
  estadoPagoGastoEnum,
  origenGastoEnum,
  tipoGastoEnum,
} from "./schema";

export type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

type TipoGasto = (typeof tipoGastoEnum.enumValues)[number];
type OrigenGasto = (typeof origenGastoEnum.enumValues)[number];
type EstadoPagoGasto = (typeof estadoPagoGastoEnum.enumValues)[number];

// Solo se necesita el rol del solicitante para gatear el catalogo global de
// categorias sugeridas — mismo criterio que Suscripcion/Modulo 2.
// `rol.esRolSistema` obligatorio (no solo rolId): chequeo doble unificado en
// la Etapa 3 del backstop de RLS (docs/security/PLAN-RLS-BACKSTOP.md
// §10.2/§10.11 decision 5), igual que identidad/tienePermiso().
interface SolicitanteCeomAdmin {
  rolId: string;
  rol: { esRolSistema: boolean };
}

function requiereCeomAdmin(
  solicitante: SolicitanteCeomAdmin
): { ok: false; error: string } | null {
  if (!(solicitante.rol.esRolSistema && solicitante.rolId === ROL_CEOM_ADMIN_ID)) {
    return {
      ok: false,
      error: "Solo CEOM Admin puede gestionar el catálogo de categorías de gasto sugeridas.",
    };
  }
  return null;
}

/** Set default global (Modulo_04 seccion 1.2) — se precarga al crear el
 * tenant en el diseño, pero como el onboarding no existe todavia, queda
 * como funcion invocable a mano (mismo criterio que CanalVenta en Ventas). */
export const CATEGORIAS_GASTO_DEFAULT = [
  "Insumos",
  "Mano de obra",
  "Transporte",
  "Marketing",
  "Servicios",
] as const;

// --- Categorias de Gasto ---------------------------------------------------------

export interface DatosCategoriaGasto {
  nombre: string;
  categoriaGastoSugeridaId?: string;
}

export async function crearCategoriaGasto(
  solicitante: UsuarioConRol,
  tenantId: string,
  input: DatosCategoriaGasto
): Promise<Resultado<{ categoriaId: string }>> {
  if (!(await tienePermiso(solicitante, tenantId, "costos_gastos", "crear"))) {
    return { ok: false, error: "No tenés permiso para crear categorías de gasto en este tenant." };
  }
  const categoria = await repo.crearCategoriaGasto({
    tenantId,
    nombre: input.nombre,
    categoriaGastoSugeridaId: input.categoriaGastoSugeridaId,
  });
  return { ok: true, data: { categoriaId: categoria.id } };
}

/** Carga el set default global (sin dedupe — se asume una sola invocacion,
 * justo despues de crear el tenant). */
export async function sembrarCategoriasGastoDefault(
  solicitante: UsuarioConRol,
  tenantId: string
): Promise<Resultado<{ categoriaIds: string[] }>> {
  if (!(await tienePermiso(solicitante, tenantId, "costos_gastos", "crear"))) {
    return { ok: false, error: "No tenés permiso para crear categorías de gasto en este tenant." };
  }
  // Set fijo de 5 categorias (no crece con datos del tenant) — insercion en
  // paralelo, cada una independiente y el orden no importa.
  const categorias = await Promise.all(
    CATEGORIAS_GASTO_DEFAULT.map((nombre) => repo.crearCategoriaGasto({ tenantId, nombre }))
  );
  return { ok: true, data: { categoriaIds: categorias.map((c) => c.id) } };
}

export async function actualizarCategoriaGasto(
  solicitante: UsuarioConRol,
  categoriaId: string,
  input: Partial<DatosCategoriaGasto>
): Promise<Resultado<true>> {
  const categoria = await repo.obtenerCategoriaGastoPorId(categoriaId);
  if (!categoria) return { ok: false, error: "Categoría de gasto no encontrada." };
  if (!(await tienePermiso(solicitante, categoria.tenantId, "costos_gastos", "editar"))) {
    return { ok: false, error: "No tenés permiso para editar esta categoría de gasto." };
  }
  await repo.actualizarCategoriaGasto(categoriaId, input);
  return { ok: true, data: true };
}

/** Caso borde 2: eliminar una categoria en uso no rompe los gastos ya
 * registrados con ella — solo deja de estar disponible para gastos nuevos. */
export async function eliminarCategoriaGasto(
  solicitante: UsuarioConRol,
  categoriaId: string
): Promise<Resultado<true>> {
  const categoria = await repo.obtenerCategoriaGastoPorId(categoriaId);
  if (!categoria) return { ok: false, error: "Categoría de gasto no encontrada." };
  if (!(await tienePermiso(solicitante, categoria.tenantId, "costos_gastos", "anular_ajustar"))) {
    return { ok: false, error: "No tenés permiso para eliminar esta categoría de gasto." };
  }
  await repo.eliminarCategoriaGastoSoft(categoriaId);
  return { ok: true, data: true };
}

export async function listarCategoriasGasto(
  solicitante: UsuarioConRol,
  tenantId: string
): Promise<Resultado<Awaited<ReturnType<typeof repo.listarCategoriasGastoPorTenant>>>> {
  if (!(await tienePermiso(solicitante, tenantId, "costos_gastos", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver categorías de gasto en este tenant." };
  }
  return { ok: true, data: await repo.listarCategoriasGastoPorTenant(tenantId) };
}

// --- Categorias de Gasto Sugeridas (catalogo global, Panel Admin CEOM) --------------------

export async function listarCategoriasGastoSugeridas(
  opts: { nichoId?: string; soloActivas?: boolean } = {}
) {
  return repo.listarCategoriasGastoSugeridas(opts);
}

export async function crearCategoriaGastoSugerida(
  solicitante: SolicitanteCeomAdmin,
  input: { nichoId?: string; nombre: string }
): Promise<Resultado<{ categoriaGastoSugeridaId: string }>> {
  const bloqueo = requiereCeomAdmin(solicitante);
  if (bloqueo) return bloqueo;
  const categoria = await repo.crearCategoriaGastoSugerida({
    nichoId: input.nichoId,
    nombre: input.nombre,
  });
  return { ok: true, data: { categoriaGastoSugeridaId: categoria.id } };
}

export async function desactivarCategoriaGastoSugerida(
  solicitante: SolicitanteCeomAdmin,
  categoriaGastoSugeridaId: string
): Promise<Resultado<true>> {
  const bloqueo = requiereCeomAdmin(solicitante);
  if (bloqueo) return bloqueo;
  await repo.actualizarActivaCategoriaGastoSugerida(categoriaGastoSugeridaId, false);
  return { ok: true, data: true };
}

// --- Gastos ---------------------------------------------------------

export interface DatosGasto {
  sucursalId?: string;
  tipo: TipoGasto;
  categoriaId: string;
  monto: string | number;
  fechaGasto: string;
  proveedorId?: string;
  descripcion?: string;
}

export async function crearGastoManual(
  solicitante: UsuarioConRol,
  tenantId: string,
  input: DatosGasto
): Promise<Resultado<{ gastoId: string }>> {
  if (!(await tienePermiso(solicitante, tenantId, "costos_gastos", "crear"))) {
    return { ok: false, error: "No tenés permiso para crear gastos en este tenant." };
  }
  const gasto = await repo.crearGasto({
    tenantId,
    sucursalId: input.sucursalId,
    tipo: input.tipo,
    categoriaId: input.categoriaId,
    monto: String(input.monto),
    fechaGasto: input.fechaGasto,
    proveedorId: input.proveedorId,
    origen: "manual",
    descripcion: input.descripcion,
    creadoPor: solicitante.id,
  });
  return { ok: true, data: { gastoId: gasto.id } };
}

function esGastoManual(gasto: { origen: OrigenGasto }): boolean {
  return gasto.origen === "manual";
}

/** Regla 2 / caso borde 1: un gasto de origen automatico nunca se edita
 * directo — se corrige en su modulo de origen (Patrimonio o AjusteVenta).
 * Caso borde 6: no se permite bajar el monto por debajo de lo ya pagado. */
export async function actualizarGastoManual(
  solicitante: UsuarioConRol,
  gastoId: string,
  input: Partial<Omit<DatosGasto, "tipo">>
): Promise<Resultado<true>> {
  const gasto = await repo.obtenerGastoPorId(gastoId);
  if (!gasto) return { ok: false, error: "Gasto no encontrado." };
  if (!(await tienePermiso(solicitante, gasto.tenantId, "costos_gastos", "editar"))) {
    return { ok: false, error: "No tenés permiso para editar este gasto." };
  }
  if (!esGastoManual(gasto)) {
    return {
      ok: false,
      error:
        "Este gasto es de origen automático — se corrige en su módulo de origen (Patrimonio o Ajuste de Venta), no acá.",
    };
  }
  if (input.monto !== undefined) {
    const totalPagado = await repo.obtenerTotalPagado(gastoId);
    if (Number(input.monto) < totalPagado) {
      return {
        ok: false,
        error: `No se puede bajar el monto por debajo de lo ya pagado (${totalPagado}).`,
      };
    }
  }

  await repo.actualizarGasto(gastoId, {
    sucursalId: input.sucursalId,
    categoriaId: input.categoriaId,
    monto: input.monto !== undefined ? String(input.monto) : undefined,
    fechaGasto: input.fechaGasto,
    proveedorId: input.proveedorId,
    descripcion: input.descripcion,
    modificadoPor: solicitante.id,
    modificadoEn: new Date(),
  });
  return { ok: true, data: true };
}

export async function eliminarGastoManual(
  solicitante: UsuarioConRol,
  gastoId: string
): Promise<Resultado<true>> {
  const gasto = await repo.obtenerGastoPorId(gastoId);
  if (!gasto) return { ok: false, error: "Gasto no encontrado." };
  if (!(await tienePermiso(solicitante, gasto.tenantId, "costos_gastos", "anular_ajustar"))) {
    return { ok: false, error: "No tenés permiso para eliminar este gasto." };
  }
  if (!esGastoManual(gasto)) {
    return {
      ok: false,
      error:
        "Este gasto es de origen automático — se corrige en su módulo de origen, no se elimina acá.",
    };
  }
  await repo.eliminarGastoSoft(gastoId);
  return { ok: true, data: true };
}

export async function listarGastos(
  solicitante: UsuarioConRol,
  tenantId: string
): Promise<Resultado<Awaited<ReturnType<typeof repo.listarGastosPorTenant>>>> {
  if (!(await tienePermiso(solicitante, tenantId, "costos_gastos", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver gastos en este tenant." };
  }
  return { ok: true, data: await repo.listarGastosPorTenant(tenantId) };
}

export async function fichaGasto(
  solicitante: UsuarioConRol,
  gastoId: string
): Promise<
  Resultado<{
    gasto: Awaited<ReturnType<typeof repo.obtenerGastoPorId>>;
    pagos: Awaited<ReturnType<typeof repo.listarPagosPorGasto>>;
  }>
> {
  const gasto = await repo.obtenerGastoPorId(gastoId);
  if (!gasto) return { ok: false, error: "Gasto no encontrado." };
  if (!(await tienePermiso(solicitante, gasto.tenantId, "costos_gastos", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver este gasto." };
  }
  const pagos = await repo.listarPagosPorGasto(gastoId);
  return { ok: true, data: { gasto, pagos } };
}

/** Los gastos de origen automatico ya nacen pagados (regla 6) — no admiten
 * pagos manuales adicionales via esta funcion. */
export async function registrarPagoGasto(
  solicitante: UsuarioConRol,
  gastoId: string,
  input: { monto: string | number; fechaPago: string }
): Promise<Resultado<{ estadoPago: EstadoPagoGasto; totalPagado: number }>> {
  const gasto = await repo.obtenerGastoPorId(gastoId);
  if (!gasto) return { ok: false, error: "Gasto no encontrado." };
  if (!(await tienePermiso(solicitante, gasto.tenantId, "costos_gastos", "crear"))) {
    return { ok: false, error: "No tenés permiso para registrar pagos en este gasto." };
  }
  if (!esGastoManual(gasto)) {
    return {
      ok: false,
      error: "Este gasto ya nació pagado — no admite pagos manuales adicionales.",
    };
  }

  const { estadoPago, totalPagado } = await repo.registrarPagoGastoTx({
    gastoId,
    monto: String(input.monto),
    fechaPago: input.fechaPago,
    creadoPor: solicitante.id,
  });
  return { ok: true, data: { estadoPago, totalPagado } };
}

// --- Auto-generacion (Modulo_04 seccion 2 y 3.6) ---------------------------------------------------------

/**
 * Cierra el pendiente que Patrimonio dejo documentado: crea el Gasto (nace
 * pagado, regla 6) Y llama de verdad a registrarPagoPasivo(origen:
 * "automatico") para decrementar el saldo del Pasivo. El monto/pasivoId los
 * pasa el llamador — Patrimonio no expone una consulta publica de un
 * Pasivo individual mas alla de consultarPasivoDeActivo(activoId).
 */
export async function generarGastoCuotaPasivo(
  solicitante: UsuarioConRol,
  tenantId: string,
  input: {
    pasivoId: string;
    categoriaId: string;
    sucursalId?: string;
    monto: string | number;
    fechaGasto: string;
  }
): Promise<
  Resultado<{ gastoId: string; pagoPasivo: Awaited<ReturnType<typeof registrarPagoPasivo>> }>
> {
  if (!(await tienePermiso(solicitante, tenantId, "costos_gastos", "crear"))) {
    return { ok: false, error: "No tenés permiso para registrar gastos en este tenant." };
  }

  const { gasto } = await repo.crearGastoConPagoTx({
    gasto: {
      tenantId,
      sucursalId: input.sucursalId,
      tipo: "fijo",
      categoriaId: input.categoriaId,
      monto: String(input.monto),
      fechaGasto: input.fechaGasto,
      origen: "cuota_pasivo_automatica",
      referenciaId: input.pasivoId,
      creadoPor: solicitante.id,
    },
    pago: { monto: String(input.monto), fechaPago: input.fechaGasto, creadoPor: solicitante.id },
  });

  const pagoPasivo = await registrarPagoPasivo(solicitante, input.pasivoId, {
    monto: input.monto,
    fechaPago: input.fechaGasto,
    origen: "automatico",
  });

  return { ok: true, data: { gastoId: gasto.id, pagoPasivo } };
}

/**
 * Cierra el pendiente que Ventas dejo documentado: lee la comision ya
 * calculada y persistida en la Venta (via fichaVenta(), caja negra) y crea
 * el Gasto correspondiente, ya pagado (regla 6). categoriaId lo pasa el
 * llamador (el doc no especifica que categoria usar automaticamente).
 */
export async function generarGastoComisionVenta(
  solicitante: UsuarioConRol,
  tenantId: string,
  input: { ventaId: string; categoriaId: string }
): Promise<Resultado<{ gastoId: string }>> {
  if (!(await tienePermiso(solicitante, tenantId, "costos_gastos", "crear"))) {
    return { ok: false, error: "No tenés permiso para registrar gastos en este tenant." };
  }

  const ficha = await fichaVenta(solicitante, input.ventaId);
  if (!ficha.ok) return ficha;
  const venta = ficha.data.venta;
  if (!venta || venta.comisionMontoCalculado === null) {
    return { ok: false, error: "Esta venta no tiene una comisión calculada." };
  }

  const fechaGasto = venta.fechaVenta.toISOString().slice(0, 10);
  const { gasto } = await repo.crearGastoConPagoTx({
    gasto: {
      tenantId,
      sucursalId: venta.sucursalId,
      tipo: "variable_no_productivo",
      categoriaId: input.categoriaId,
      monto: venta.comisionMontoCalculado,
      fechaGasto,
      origen: "comision_venta_automatica",
      referenciaId: input.ventaId,
      creadoPor: solicitante.id,
    },
    pago: {
      monto: venta.comisionMontoCalculado,
      fechaPago: fechaGasto,
      creadoPor: solicitante.id,
    },
  });

  return { ok: true, data: { gastoId: gasto.id } };
}

// --- Gastos Recurrentes ---------------------------------------------------------

export interface DatosGastoRecurrente {
  sucursalId?: string;
  categoriaId: string;
  monto: string | number;
  frecuencia: "mensual" | "semanal" | "quincenal" | "anual";
  fechaInicio: string;
  fechaFin?: string;
}

export async function crearGastoRecurrente(
  solicitante: UsuarioConRol,
  tenantId: string,
  input: DatosGastoRecurrente
): Promise<Resultado<{ gastoRecurrenteId: string }>> {
  if (!(await tienePermiso(solicitante, tenantId, "costos_gastos", "crear"))) {
    return { ok: false, error: "No tenés permiso para crear gastos recurrentes en este tenant." };
  }
  const gastoRecurrente = await repo.crearGastoRecurrente({
    tenantId,
    sucursalId: input.sucursalId,
    categoriaId: input.categoriaId,
    monto: String(input.monto),
    frecuencia: input.frecuencia,
    fechaInicio: input.fechaInicio,
    fechaFin: input.fechaFin,
    creadoPor: solicitante.id,
  });
  return { ok: true, data: { gastoRecurrenteId: gastoRecurrente.id } };
}

export async function actualizarGastoRecurrente(
  solicitante: UsuarioConRol,
  gastoRecurrenteId: string,
  input: Partial<DatosGastoRecurrente>
): Promise<Resultado<true>> {
  const gastoRecurrente = await repo.obtenerGastoRecurrentePorId(gastoRecurrenteId);
  if (!gastoRecurrente) return { ok: false, error: "Gasto recurrente no encontrado." };
  if (
    !(await tienePermiso(solicitante, gastoRecurrente.tenantId, "costos_gastos", "editar"))
  ) {
    return { ok: false, error: "No tenés permiso para editar este gasto recurrente." };
  }
  await repo.actualizarGastoRecurrente(gastoRecurrenteId, {
    sucursalId: input.sucursalId,
    categoriaId: input.categoriaId,
    monto: input.monto !== undefined ? String(input.monto) : undefined,
    frecuencia: input.frecuencia,
    fechaInicio: input.fechaInicio,
    fechaFin: input.fechaFin,
  });
  return { ok: true, data: true };
}

/** Caso borde 3: detiene la generacion futura sin borrar el historico ya
 * generado. */
export async function desactivarGastoRecurrente(
  solicitante: UsuarioConRol,
  gastoRecurrenteId: string
): Promise<Resultado<true>> {
  const gastoRecurrente = await repo.obtenerGastoRecurrentePorId(gastoRecurrenteId);
  if (!gastoRecurrente) return { ok: false, error: "Gasto recurrente no encontrado." };
  if (
    !(await tienePermiso(
      solicitante,
      gastoRecurrente.tenantId,
      "costos_gastos",
      "anular_ajustar"
    ))
  ) {
    return { ok: false, error: "No tenés permiso para desactivar este gasto recurrente." };
  }
  await repo.actualizarGastoRecurrente(gastoRecurrenteId, { activo: false });
  return { ok: true, data: true };
}

export async function listarGastosRecurrentes(
  solicitante: UsuarioConRol,
  tenantId: string
): Promise<Resultado<Awaited<ReturnType<typeof repo.listarGastosRecurrentesPorTenant>>>> {
  if (!(await tienePermiso(solicitante, tenantId, "costos_gastos", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver gastos recurrentes en este tenant." };
  }
  return { ok: true, data: await repo.listarGastosRecurrentesPorTenant(tenantId) };
}

/**
 * Genera el Gasto de un periodo desde la plantilla. origen="manual"
 * (decision del plan): a diferencia de la cuota de pasivo o la comision de
 * venta, un gasto recurrente (ej. alquiler) no representa una transaccion
 * con una contraparte que ya quedo registrada en otro modulo — el Owner
 * puede necesitar corregir el monto de un mes puntual sin tocar la
 * plantilla, asi que se comporta como cualquier gasto manual editable
 * (regla 3). Sin pago automatico: sigue el ciclo normal de Pago de Gasto.
 */
export async function generarGastoDesdeRecurrente(
  solicitante: UsuarioConRol,
  gastoRecurrenteId: string,
  input: { fechaGasto: string }
): Promise<Resultado<{ gastoId: string }>> {
  const gastoRecurrente = await repo.obtenerGastoRecurrentePorId(gastoRecurrenteId);
  if (!gastoRecurrente) return { ok: false, error: "Gasto recurrente no encontrado." };
  if (
    !(await tienePermiso(solicitante, gastoRecurrente.tenantId, "costos_gastos", "crear"))
  ) {
    return { ok: false, error: "No tenés permiso para generar gastos en este tenant." };
  }
  if (!gastoRecurrente.activo) {
    return { ok: false, error: "Este gasto recurrente está desactivado." };
  }

  const gasto = await repo.crearGasto({
    tenantId: gastoRecurrente.tenantId,
    sucursalId: gastoRecurrente.sucursalId,
    tipo: "fijo",
    categoriaId: gastoRecurrente.categoriaId,
    monto: gastoRecurrente.monto,
    fechaGasto: input.fechaGasto,
    origen: "manual",
    referenciaId: gastoRecurrenteId,
    creadoPor: solicitante.id,
  });

  return { ok: true, data: { gastoId: gasto.id } };
}

// --- Agregados (Modulo_04 seccion 2) ---------------------------------------------------------

export async function consultarTotalCostosFijos(
  solicitante: UsuarioConRol,
  tenantId: string,
  periodo: { desde: string; hasta: string }
): Promise<Resultado<{ totalCostosFijos: number }>> {
  if (!(await tienePermiso(solicitante, tenantId, "costos_gastos", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver gastos en este tenant." };
  }
  const totalCostosFijos = await repo.sumarGastosPorTipoEnPeriodo(
    tenantId,
    "fijo",
    periodo.desde,
    periodo.hasta
  );
  return { ok: true, data: { totalCostosFijos } };
}

export async function consultarDistribucionPorCategoria(
  solicitante: UsuarioConRol,
  tenantId: string,
  periodo: { desde: string; hasta: string }
): Promise<Resultado<Array<{ categoriaId: string; total: number }>>> {
  if (!(await tienePermiso(solicitante, tenantId, "costos_gastos", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver gastos en este tenant." };
  }
  const filas = await repo.sumarGastosPorCategoriaEnPeriodo(
    tenantId,
    periodo.desde,
    periodo.hasta
  );
  return { ok: true, data: filas.map((f) => ({ categoriaId: f.categoriaId, total: Number(f.total) })) };
}

// --- Agregados por periodo para Financiero (Modulo_07, seccion 2) ---------------------------------------------------------

export async function consultarPagosGastoEnPeriodo(
  solicitante: UsuarioConRol,
  tenantId: string,
  periodo: { desde: string; hasta: string },
  opts: { sucursalId?: string } = {}
): Promise<Resultado<{ totalPagado: number }>> {
  if (!(await tienePermiso(solicitante, tenantId, "costos_gastos", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver gastos en este tenant." };
  }
  const totalPagado = await repo.sumarPagosGastoPeriodo(
    tenantId,
    periodo.desde,
    periodo.hasta,
    opts
  );
  return { ok: true, data: { totalPagado } };
}

/** A diferencia de consultarTotalCostosFijos (solo tipo=fijo), suma TODOS
 * los Gasto del periodo — insumo de estado_resultados en Financiero. */
export async function consultarTotalGastosEnPeriodo(
  solicitante: UsuarioConRol,
  tenantId: string,
  periodo: { desde: string; hasta: string },
  opts: { sucursalId?: string } = {}
): Promise<Resultado<{ totalGastos: number }>> {
  if (!(await tienePermiso(solicitante, tenantId, "costos_gastos", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver gastos en este tenant." };
  }
  const totalGastos = await repo.sumarTotalGastosPeriodo(
    tenantId,
    periodo.desde,
    periodo.hasta,
    opts
  );
  return { ok: true, data: { totalGastos } };
}
