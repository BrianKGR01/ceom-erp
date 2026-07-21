import { tieneCapacidadEspecial, tienePermiso } from "@/modules/identidad/actions";
import type { UsuarioConRol } from "@/modules/identidad/actions";
import { consultarCapacidad } from "@/modules/patrimonio/actions";
import {
  consultarStock,
  enviarProductoAOperaciones,
  fichaProducto,
  registrarEntradaProduccion,
} from "@/modules/productos/actions";
import * as repo from "./repository";
import type { tipoMovimientoInsumoEnum, unidadMedidaInsumoEnum } from "./schema";

export type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

type UnidadMedidaInsumo = (typeof unidadMedidaInsumoEnum.enumValues)[number];
type TipoMovimientoInsumo = (typeof tipoMovimientoInsumoEnum.enumValues)[number];
type TipoAjusteInsumo = Extract<
  TipoMovimientoInsumo,
  "entrada_ajuste_manual" | "salida_ajuste_manual"
>;

const MS_POR_SEMANA = 7 * 24 * 60 * 60 * 1000;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

// --- Calculos puros (Modulo_06 seccion 3) ---------------------------------------------------------

export { calcularCostoPromedioPonderado, signoMovimientoInsumo } from "./repository";

/** rendimiento teorico de una presentacion = (rendimiento de la receta base
 * x lotes producidos) / cuanta base consume esa presentacion (Modulo_06
 * seccion 1.7). */
export function calcularRendimientoTeorico(
  rendimientoPorLote: number,
  cantidadLotesProducidos: number,
  cantidadBaseConsumidaPorUnidad: number
): number {
  if (cantidadBaseConsumidaPorUnidad === 0) return 0;
  return (rendimientoPorLote * cantidadLotesProducidos) / cantidadBaseConsumidaPorUnidad;
}

/** Nunca negativa (no existe "merma negativa") — seccion 1.7. */
export function calcularMerma(rendimientoTeorico: number, cantidadRealObtenida: number): number {
  return Math.max(0, rendimientoTeorico - cantidadRealObtenida);
}

/** Formula 3.2 — dividir por la cantidad REAL obtenida incorpora la merma
 * automaticamente en el costo por unidad. */
export function calcularCostoOperativoProduccion(
  costoTotalInsumos: number,
  cantidadRealObtenida: number
): number {
  if (cantidadRealObtenida <= 0) return 0;
  return costoTotalInsumos / cantidadRealObtenida;
}

/** Capacidad de produccion del periodo (seccion 4) — escala
 * disponibilidad_horaria_semanal a la cantidad de semanas del periodo
 * consultado. null si el Activo no tiene los datos de ciclo cargados. */
export function calcularCapacidadProduccionPeriodo(
  disponibilidadHorariaSemanal: number | null,
  tiempoEstimadoPorCicloMinutos: number | null,
  capacidadProduccionCantidad: number | null,
  semanasEnPeriodo: number
): number | null {
  if (
    !disponibilidadHorariaSemanal ||
    !tiempoEstimadoPorCicloMinutos ||
    !capacidadProduccionCantidad
  ) {
    return null;
  }
  const minutosDisponiblesEnPeriodo = disponibilidadHorariaSemanal * 60 * semanasEnPeriodo;
  const ciclosPosibles = minutosDisponiblesEnPeriodo / tiempoEstimadoPorCicloMinutos;
  return ciclosPosibles * capacidadProduccionCantidad;
}

export function calcularPorcentajeCapacidadUsada(
  usoReal: number,
  capacidadTotal: number | null
): number | null {
  if (!capacidadTotal || capacidadTotal <= 0) return null;
  return usoReal / capacidadTotal;
}

// --- Insumos ---------------------------------------------------------

export interface DatosInsumo {
  nombre: string;
  unidadMedida: UnidadMedidaInsumo;
  vidaUtilDias?: number;
  stockMinimo?: string | number;
}

export async function crearInsumo(
  solicitante: UsuarioConRol,
  tenantId: string,
  input: DatosInsumo
): Promise<Resultado<{ insumoId: string }>> {
  if (!(await tienePermiso(solicitante, tenantId, "operativo", "crear"))) {
    return { ok: false, error: "No tenés permiso para crear insumos en este tenant." };
  }

  const insumo = await repo.crearInsumo({
    tenantId,
    nombre: input.nombre,
    unidadMedida: input.unidadMedida,
    vidaUtilDias: input.vidaUtilDias,
    stockMinimo: input.stockMinimo !== undefined ? String(input.stockMinimo) : undefined,
  });

  return { ok: true, data: { insumoId: insumo.id } };
}

export async function actualizarInsumo(
  solicitante: UsuarioConRol,
  insumoId: string,
  input: Partial<DatosInsumo>
): Promise<Resultado<true>> {
  const insumo = await repo.obtenerInsumoPorId(insumoId);
  if (!insumo) return { ok: false, error: "Insumo no encontrado." };
  if (!(await tienePermiso(solicitante, insumo.tenantId, "operativo", "editar"))) {
    return { ok: false, error: "No tenés permiso para editar este insumo." };
  }

  // costo_unitario_vigente nunca se edita a mano (seccion 1.1) — ni siquiera
  // esta en DatosInsumo, asi que no hay forma de colarlo por este camino.
  await repo.actualizarInsumo(insumoId, {
    nombre: input.nombre,
    unidadMedida: input.unidadMedida,
    vidaUtilDias: input.vidaUtilDias,
    stockMinimo: input.stockMinimo !== undefined ? String(input.stockMinimo) : undefined,
  });
  return { ok: true, data: true };
}

export async function eliminarInsumo(
  solicitante: UsuarioConRol,
  insumoId: string
): Promise<Resultado<true>> {
  const insumo = await repo.obtenerInsumoPorId(insumoId);
  if (!insumo) return { ok: false, error: "Insumo no encontrado." };
  if (!(await tienePermiso(solicitante, insumo.tenantId, "operativo", "anular_ajustar"))) {
    return { ok: false, error: "No tenés permiso para eliminar este insumo." };
  }

  await repo.eliminarInsumoSoft(insumoId);
  return { ok: true, data: true };
}

export async function listarInsumos(
  solicitante: UsuarioConRol,
  tenantId: string
): Promise<Resultado<Awaited<ReturnType<typeof repo.listarInsumosPorTenant>>>> {
  if (!(await tienePermiso(solicitante, tenantId, "operativo", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver insumos en este tenant." };
  }
  return { ok: true, data: await repo.listarInsumosPorTenant(tenantId) };
}

export async function consultarStockInsumo(
  solicitante: UsuarioConRol,
  insumoId: string,
  sucursalId: string
): Promise<Resultado<{ cantidadActual: number }>> {
  const insumo = await repo.obtenerInsumoPorId(insumoId);
  if (!insumo) return { ok: false, error: "Insumo no encontrado." };
  if (!(await tienePermiso(solicitante, insumo.tenantId, "operativo", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver el stock de este tenant." };
  }

  const fila = await repo.obtenerStockInsumo(insumoId, sucursalId);
  return { ok: true, data: { cantidadActual: fila ? Number(fila.cantidadActual) : 0 } };
}

/** ficha_insumo(insumo_id) — insumo + stock por sucursal en una sola
 * llamada, mismo patron que fichaProducto() en Modulo 2. Cierra el gap de
 * backend documentado en docs/ui/pantallas.md seccion 6 ("no hay una
 * fichaInsumo() que junte insumo+stock en una llamada"). */
export async function fichaInsumo(
  solicitante: UsuarioConRol,
  insumoId: string
): Promise<
  Resultado<{
    insumo: Awaited<ReturnType<typeof repo.obtenerInsumoPorId>>;
    stockPorSucursal: Awaited<ReturnType<typeof repo.listarStockPorInsumo>>;
  }>
> {
  const insumo = await repo.obtenerInsumoPorId(insumoId);
  if (!insumo) return { ok: false, error: "Insumo no encontrado." };
  if (!(await tienePermiso(solicitante, insumo.tenantId, "operativo", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver este insumo." };
  }

  const stockPorSucursal = await repo.listarStockPorInsumo(insumoId);
  return { ok: true, data: { insumo, stockPorSucursal } };
}

/** Historial de movimientos de un Insumo en una sucursal — mismo patron y
 * mismo gate que listarMovimientosStock() en Modulo 2. Cierra el segundo
 * gap documentado en docs/ui/pantallas.md seccion 6 ("no existe ninguna
 * funcion, ni en el repository, que liste movimientos_insumo"). */
export async function listarMovimientosInsumo(
  solicitante: UsuarioConRol,
  insumoId: string,
  sucursalId: string
): Promise<Resultado<Awaited<ReturnType<typeof repo.listarMovimientosPorInsumo>>>> {
  const insumo = await repo.obtenerInsumoPorId(insumoId);
  if (!insumo) return { ok: false, error: "Insumo no encontrado." };
  if (!(await tienePermiso(solicitante, insumo.tenantId, "operativo", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver el stock de este tenant." };
  }
  return { ok: true, data: await repo.listarMovimientosPorInsumo(insumoId, sucursalId) };
}

// --- Ledger de Insumo ---------------------------------------------------------

/** entrada_compra (seccion 3.1 y 3.6) — hoy sin caller real (Proveedores no
 * dispara el evento compra_registrada todavia). */
export async function registrarEntradaCompraInsumo(
  solicitante: UsuarioConRol,
  tenantId: string,
  input: {
    insumoId: string;
    sucursalId: string;
    cantidad: string | number;
    costoCompra: string | number;
    fechaVencimiento?: string;
    referenciaId?: string;
  }
): Promise<Resultado<{ movimientoId: string; cantidadActual: number; costoUnitarioVigente: number }>> {
  if (!(await tienePermiso(solicitante, tenantId, "operativo", "crear"))) {
    return { ok: false, error: "No tenés permiso para registrar compras de insumo en este tenant." };
  }

  const insumo = await repo.obtenerInsumoPorId(input.insumoId);
  // Ata el insumoId del cliente al tenant ya autorizado — sin esto, una
  // escritura al ledger/costo del insumo caia sobre un insumo ajeno
  // (auditoría de autorización; RLS bypasseada, es la única defensa).
  if (!insumo || insumo.tenantId !== tenantId) {
    return { ok: false, error: "Insumo no encontrado." };
  }

  const fechaVencimiento =
    input.fechaVencimiento ??
    (insumo.vidaUtilDias
      ? new Date(Date.now() + insumo.vidaUtilDias * MS_POR_DIA).toISOString().slice(0, 10)
      : null);

  const { movimiento, cantidadActual, costoUnitarioVigente } =
    await repo.crearEntradaCompraInsumoTx({
      insumoId: input.insumoId,
      sucursalId: input.sucursalId,
      cantidad: String(input.cantidad),
      costoCompra: String(input.costoCompra),
      fechaVencimiento,
      referenciaId: input.referenciaId,
      creadoPor: solicitante.id,
    });

  return {
    ok: true,
    data: { movimientoId: movimiento.id, cantidadActual, costoUnitarioVigente },
  };
}

export async function registrarAjusteManualInsumo(
  solicitante: UsuarioConRol,
  tenantId: string,
  input: {
    insumoId: string;
    sucursalId: string;
    tipo: TipoAjusteInsumo;
    cantidad: string | number;
    motivo: string;
  }
): Promise<Resultado<{ movimientoId: string; cantidadActual: number }>> {
  if (!(await tienePermiso(solicitante, tenantId, "operativo", "anular_ajustar"))) {
    return { ok: false, error: "No tenés permiso para ajustar insumos en este tenant." };
  }
  if (!input.motivo.trim()) {
    return { ok: false, error: "El motivo del ajuste es obligatorio." };
  }

  const insumo = await repo.obtenerInsumoPorId(input.insumoId);
  // Ata el insumoId del cliente al tenant ya autorizado — sin esto, una
  // escritura al ledger/costo del insumo caia sobre un insumo ajeno
  // (auditoría de autorización; RLS bypasseada, es la única defensa).
  if (!insumo || insumo.tenantId !== tenantId) {
    return { ok: false, error: "Insumo no encontrado." };
  }

  const { movimiento, cantidadActual } = await repo.crearMovimientoInsumoTx({
    insumoId: input.insumoId,
    sucursalId: input.sucursalId,
    tipo: input.tipo,
    cantidad: String(input.cantidad),
    costoUnitarioEnMovimiento: insumo.costoUnitarioVigente ?? "0",
    motivo: input.motivo,
    creadoPor: solicitante.id,
  });

  return { ok: true, data: { movimientoId: movimiento.id, cantidadActual } };
}

/** Caso borde 6: insumo perecedero que se vence sin llegar a produccion. */
export async function registrarMermaAlmacenamiento(
  solicitante: UsuarioConRol,
  tenantId: string,
  input: { insumoId: string; sucursalId: string; cantidad: string | number; motivo: string }
): Promise<Resultado<{ movimientoId: string; cantidadActual: number }>> {
  if (!(await tienePermiso(solicitante, tenantId, "operativo", "anular_ajustar"))) {
    return { ok: false, error: "No tenés permiso para registrar merma en este tenant." };
  }
  if (!input.motivo.trim()) {
    return { ok: false, error: "El motivo de la merma es obligatorio." };
  }

  const insumo = await repo.obtenerInsumoPorId(input.insumoId);
  // Ata el insumoId del cliente al tenant ya autorizado — sin esto, una
  // escritura al ledger/costo del insumo caia sobre un insumo ajeno
  // (auditoría de autorización; RLS bypasseada, es la única defensa).
  if (!insumo || insumo.tenantId !== tenantId) {
    return { ok: false, error: "Insumo no encontrado." };
  }

  const { movimiento, cantidadActual } = await repo.crearMovimientoInsumoTx({
    insumoId: input.insumoId,
    sucursalId: input.sucursalId,
    tipo: "salida_merma_almacenamiento",
    cantidad: String(input.cantidad),
    costoUnitarioEnMovimiento: insumo.costoUnitarioVigente ?? "0",
    motivo: input.motivo,
    creadoPor: solicitante.id,
  });

  return { ok: true, data: { movimientoId: movimiento.id, cantidadActual } };
}

// --- Recetas ---------------------------------------------------------

export interface DatosReceta {
  nombre: string;
  rendimientoPorLote: string | number;
  unidadRendimiento: string;
}

export async function crearReceta(
  solicitante: UsuarioConRol,
  tenantId: string,
  input: DatosReceta
): Promise<Resultado<{ recetaId: string }>> {
  if (!(await tienePermiso(solicitante, tenantId, "operativo", "crear"))) {
    return { ok: false, error: "No tenés permiso para crear recetas en este tenant." };
  }

  const receta = await repo.crearReceta({
    tenantId,
    nombre: input.nombre,
    rendimientoPorLote: String(input.rendimientoPorLote),
    unidadRendimiento: input.unidadRendimiento,
  });
  return { ok: true, data: { recetaId: receta.id } };
}

export async function actualizarReceta(
  solicitante: UsuarioConRol,
  recetaId: string,
  input: Partial<DatosReceta>
): Promise<Resultado<true>> {
  const receta = await repo.obtenerRecetaPorId(recetaId);
  if (!receta) return { ok: false, error: "Receta no encontrada." };
  if (!(await tienePermiso(solicitante, receta.tenantId, "operativo", "editar"))) {
    return { ok: false, error: "No tenés permiso para editar esta receta." };
  }

  await repo.actualizarReceta(recetaId, {
    nombre: input.nombre,
    rendimientoPorLote:
      input.rendimientoPorLote !== undefined ? String(input.rendimientoPorLote) : undefined,
    unidadRendimiento: input.unidadRendimiento,
  });
  return { ok: true, data: true };
}

export async function eliminarReceta(
  solicitante: UsuarioConRol,
  recetaId: string
): Promise<Resultado<true>> {
  const receta = await repo.obtenerRecetaPorId(recetaId);
  if (!receta) return { ok: false, error: "Receta no encontrada." };
  if (!(await tienePermiso(solicitante, receta.tenantId, "operativo", "anular_ajustar"))) {
    return { ok: false, error: "No tenés permiso para eliminar esta receta." };
  }

  await repo.eliminarRecetaSoft(recetaId);
  return { ok: true, data: true };
}

export async function listarRecetas(
  solicitante: UsuarioConRol,
  tenantId: string
): Promise<Resultado<Awaited<ReturnType<typeof repo.listarRecetasPorTenant>>>> {
  if (!(await tienePermiso(solicitante, tenantId, "operativo", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver recetas en este tenant." };
  }
  return { ok: true, data: await repo.listarRecetasPorTenant(tenantId) };
}

/** ficha_receta(receta_id) — receta + composicion en una sola llamada, por
 * recetaId directo. `obtenerRecetaDeProducto()` ya cubre este mismo dato
 * pero solo llegando por productoId a traves de una Vinculacion — no sirve
 * para la pantalla "Gestión de Recetas", donde se edita la composicion de
 * una Receta que puede no tener ningun producto vinculado todavia. Tercer
 * gap cerrado en esta tanda (no estaba en el "doble gap" original de
 * Ficha de Insumo, pero es la misma clase de problema: faltaba el wrapper
 * de lectura combinada). */
export async function fichaReceta(
  solicitante: UsuarioConRol,
  recetaId: string
): Promise<
  Resultado<{
    receta: Awaited<ReturnType<typeof repo.obtenerRecetaPorId>>;
    composicion: Awaited<ReturnType<typeof repo.obtenerComposicionReceta>>;
  }>
> {
  const receta = await repo.obtenerRecetaPorId(recetaId);
  if (!receta) return { ok: false, error: "Receta no encontrada." };
  if (!(await tienePermiso(solicitante, receta.tenantId, "operativo", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver esta receta." };
  }

  const composicion = await repo.obtenerComposicionReceta(recetaId);
  return { ok: true, data: { receta, composicion } };
}

export async function actualizarComposicionReceta(
  solicitante: UsuarioConRol,
  recetaId: string,
  lineas: { insumoId: string; cantidadPorLote: string | number }[]
): Promise<Resultado<true>> {
  const receta = await repo.obtenerRecetaPorId(recetaId);
  if (!receta) return { ok: false, error: "Receta no encontrada." };
  if (!(await tienePermiso(solicitante, receta.tenantId, "operativo", "editar"))) {
    return { ok: false, error: "No tenés permiso para editar esta receta." };
  }

  // Cada insumoId de la composición debe ser del mismo tenant que la receta —
  // sin esto se podía inyectar un insumo ajeno en la composición y filtrar su
  // costo vía el costo calculado de la receta (auditoría de autorización).
  // Paralelo: cada lookup es independiente (insumoId distinto) y el error es
  // el mismo generico sin importar cual linea fallo, asi que el orden no
  // afecta el resultado observable.
  const insumosDeLaComposicion = await Promise.all(
    lineas.map((l) => repo.obtenerInsumoPorId(l.insumoId))
  );
  const hayInsumoInvalido = insumosDeLaComposicion.some(
    (insumo) => !insumo || insumo.tenantId !== receta.tenantId
  );
  if (hayInsumoInvalido) {
    return { ok: false, error: "Uno de los insumos indicados no existe en este negocio." };
  }

  await repo.reemplazarComposicionReceta(
    recetaId,
    lineas.map((l) => ({ insumoId: l.insumoId, cantidadPorLote: String(l.cantidadPorLote) }))
  );
  return { ok: true, data: true };
}

// --- Vinculacion Producto-Receta ---------------------------------------------------------

/** "Vincular a proceso operativo" (Modulo_02 seccion 4.3, Modulo_06 seccion
 * 1.6) como un solo paso real: crea la vinculacion Y llama a
 * enviarProductoAOperaciones() de Productos e Inventario para que
 * tipo_origen_producto pase a produccion_nicho — no dos pasos manuales
 * separados. */
export async function vincularProductoAReceta(
  solicitante: UsuarioConRol,
  tenantId: string,
  input: { productoId: string; recetaId: string; cantidadBaseConsumidaPorUnidad: string | number }
): Promise<Resultado<{ vinculacionId: string }>> {
  if (!(await tienePermiso(solicitante, tenantId, "operativo", "crear"))) {
    return { ok: false, error: "No tenés permiso para vincular productos en este tenant." };
  }

  const ficha = await fichaProducto(solicitante, input.productoId);
  if (!ficha.ok) return ficha;

  // La receta a vincular debe ser del mismo tenant — sin esto se vinculaba un
  // producto propio a una receta ajena, exponiendo su composición/costos al
  // producir (auditoría de autorización).
  const receta = await repo.obtenerRecetaPorId(input.recetaId);
  if (!receta || receta.tenantId !== tenantId) {
    return { ok: false, error: "Receta no encontrada." };
  }

  const vinculo = await enviarProductoAOperaciones(solicitante, input.productoId);
  if (!vinculo.ok) return vinculo;

  const vinculacion = await repo.crearVinculacion({
    productoId: input.productoId,
    recetaId: input.recetaId,
    cantidadBaseConsumidaPorUnidad: String(input.cantidadBaseConsumidaPorUnidad),
  });

  return { ok: true, data: { vinculacionId: vinculacion.id } };
}

export async function desvincularProductoDeReceta(
  solicitante: UsuarioConRol,
  productoId: string
): Promise<Resultado<true>> {
  const vinculacion = await repo.obtenerVinculacionPorProducto(productoId);
  if (!vinculacion) return { ok: false, error: "Este producto no está vinculado a ninguna receta." };

  const receta = await repo.obtenerRecetaPorId(vinculacion.recetaId);
  if (!receta) return { ok: false, error: "Receta no encontrada." };
  if (!(await tienePermiso(solicitante, receta.tenantId, "operativo", "editar"))) {
    return { ok: false, error: "No tenés permiso para desvincular este producto." };
  }

  await repo.eliminarVinculacionSoft(vinculacion.id);
  return { ok: true, data: true };
}

export async function obtenerRecetaDeProducto(
  solicitante: UsuarioConRol,
  productoId: string
): Promise<
  Resultado<{
    receta: Awaited<ReturnType<typeof repo.obtenerRecetaPorId>>;
    composicion: Awaited<ReturnType<typeof repo.obtenerComposicionReceta>>;
    cantidadBaseConsumidaPorUnidad: string;
  } | null>
> {
  const vinculacion = await repo.obtenerVinculacionPorProducto(productoId);
  if (!vinculacion) return { ok: true, data: null };

  const receta = await repo.obtenerRecetaPorId(vinculacion.recetaId);
  if (!receta) return { ok: true, data: null };
  if (!(await tienePermiso(solicitante, receta.tenantId, "operativo", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver esta receta." };
  }

  const composicion = await repo.obtenerComposicionReceta(vinculacion.recetaId);
  return {
    ok: true,
    data: {
      receta,
      composicion,
      cantidadBaseConsumidaPorUnidad: vinculacion.cantidadBaseConsumidaPorUnidad,
    },
  };
}

// --- Produccion ---------------------------------------------------------

export interface DatosProduccion {
  productoId: string;
  sucursalId: string;
  activoId: string;
  fechaProduccion: string;
  cantidadLotesProducidos: string | number;
  cantidadRealObtenida: string | number;
  fechaVencimientoLote?: string;
}

/**
 * Descuenta insumos segun la receta vinculada, calcula costo real (con
 * merma incorporada) y ACREDITA de verdad el stock/costo en Productos e
 * Inventario (registrarEntradaProduccion) — no es un stub. La acreditacion
 * ocurre fuera de la transaccion de insumos: si falla despues de confirmado
 * el descuento, queda un desfase sin compensacion automatica (aceptado y
 * documentado en ANCLA.md, ver `acreditacionProductos` en el resultado).
 */
export async function registrarProduccion(
  solicitante: UsuarioConRol,
  tenantId: string,
  input: DatosProduccion
): Promise<
  Resultado<{
    produccionId: string;
    costoOperativoCalculado: number;
    mermaCantidad: number;
    mermaCosto: number;
    acreditacionProductos: Awaited<ReturnType<typeof registrarEntradaProduccion>>;
  }>
> {
  if (!(await tienePermiso(solicitante, tenantId, "operativo", "crear"))) {
    return { ok: false, error: "No tenés permiso para registrar producciones en este tenant." };
  }

  // Regla 3.4 / caso borde 4: sin vinculacion, no hay Produccion.
  const vinculacion = await repo.obtenerVinculacionPorProducto(input.productoId);
  if (!vinculacion) {
    return {
      ok: false,
      error: "Este producto no tiene una receta vinculada — no se puede registrar producción.",
    };
  }

  // La receta (y por ende producto/insumos) debe ser del tenant — sin esto se
  // leía la composición/costos de un producto ajeno y se descontaba stock de
  // insumos de otro tenant (auditoría de autorización). Se valida vía la receta
  // (no vía fichaProducto) para no exigir el permiso productos:ver a un rol que
  // solo tiene operativo: la vinculación siempre ata producto y receta al mismo
  // tenant (vincularProductoAReceta lo garantiza), así que un productoId ajeno
  // resuelve a una receta ajena y se rechaza acá.
  const receta = await repo.obtenerRecetaPorId(vinculacion.recetaId);
  if (!receta || receta.tenantId !== tenantId) {
    return { ok: false, error: "Receta no encontrada." };
  }

  const composicion = await repo.obtenerComposicionReceta(vinculacion.recetaId);
  const cantidadLotesProducidos = Number(input.cantidadLotesProducidos);
  const cantidadRealObtenida = Number(input.cantidadRealObtenida);

  // Regla 3.5: bloquea si falta insumo, salvo capacidad especial.
  const puedeProducirSinStock = await tieneCapacidadEspecial(
    solicitante,
    "producir_sin_stock_insumo"
  );

  // Paralelo solo la lectura: cada obtenerStockInsumo es independiente (un
  // insumo distinto de la composicion), esto era N round-trips secuenciales
  // contra Supabase Cloud real por cada produccion registrada. La validacion
  // de stock suficiente y el orden de "primer insumo insuficiente reportado"
  // se preserva armando el resultado en el mismo orden de `composicion`
  // despues de que todas las lecturas resolvieron.
  const stocksPorLinea = await Promise.all(
    composicion.map((linea) => repo.obtenerStockInsumo(linea.insumoId, input.sucursalId))
  );

  let costoTotalInsumos = 0;
  const consumos: Array<{
    insumoId: string;
    sucursalId: string;
    cantidad: string;
    costoUnitarioEnMovimiento: string;
  }> = [];

  for (let i = 0; i < composicion.length; i++) {
    const linea = composicion[i];
    const cantidadNecesaria = Number(linea.cantidadPorLote) * cantidadLotesProducidos;
    const stockInsumo = stocksPorLinea[i];
    const disponible = stockInsumo ? Number(stockInsumo.cantidadActual) : 0;

    if (disponible < cantidadNecesaria && !puedeProducirSinStock) {
      return {
        ok: false,
        error: `Insumo insuficiente ("${linea.insumoNombre}"): hay ${disponible} disponibles, se necesitan ${cantidadNecesaria}.`,
      };
    }

    const costoUnitarioVigente = Number(linea.costoUnitarioVigente ?? 0);
    costoTotalInsumos += cantidadNecesaria * costoUnitarioVigente;
    consumos.push({
      insumoId: linea.insumoId,
      sucursalId: input.sucursalId,
      cantidad: String(cantidadNecesaria),
      costoUnitarioEnMovimiento: String(costoUnitarioVigente),
    });
  }

  const costoOperativoCalculado = calcularCostoOperativoProduccion(
    costoTotalInsumos,
    cantidadRealObtenida
  );
  const rendimientoTeorico = calcularRendimientoTeorico(
    Number(receta.rendimientoPorLote),
    cantidadLotesProducidos,
    Number(vinculacion.cantidadBaseConsumidaPorUnidad)
  );
  const mermaCantidad = calcularMerma(rendimientoTeorico, cantidadRealObtenida);
  const mermaCosto = mermaCantidad * costoOperativoCalculado;

  let fechaVencimientoLote = input.fechaVencimientoLote ?? null;
  if (!fechaVencimientoLote) {
    const ficha = await fichaProducto(solicitante, input.productoId);
    const vidaUtilDias = ficha.ok ? ficha.data.producto?.vidaUtilDias : null;
    if (vidaUtilDias) {
      fechaVencimientoLote = new Date(
        new Date(input.fechaProduccion).getTime() + Number(vidaUtilDias) * MS_POR_DIA
      )
        .toISOString()
        .slice(0, 10);
    }
  }

  const produccion = await repo.crearProduccionTx({
    produccion: {
      tenantId,
      sucursalId: input.sucursalId,
      productoId: input.productoId,
      activoId: input.activoId,
      fechaProduccion: new Date(input.fechaProduccion),
      cantidadLotesProducidos: String(cantidadLotesProducidos),
      cantidadRealObtenida: String(cantidadRealObtenida),
      fechaVencimientoLote,
      costoOperativoCalculado: String(costoOperativoCalculado),
      mermaCantidad: String(mermaCantidad),
      mermaCosto: String(mermaCosto),
      creadoPor: solicitante.id,
    },
    consumos,
  });

  const acreditacionProductos = await registrarEntradaProduccion(solicitante, tenantId, {
    productoId: input.productoId,
    sucursalId: input.sucursalId,
    cantidad: cantidadRealObtenida,
    costoOperativo: costoOperativoCalculado,
    referenciaId: produccion.id,
  });

  return {
    ok: true,
    data: {
      produccionId: produccion.id,
      costoOperativoCalculado,
      mermaCantidad,
      mermaCosto,
      acreditacionProductos,
    },
  };
}

/** Caso borde 5: correccion de una Produccion ya registrada, con stock ya
 * consumido en ventas posteriores — no edita ni revierte, solo deja
 * trazabilidad (mismo espiritu que AjusteVenta). */
export async function registrarProduccionDeAjuste(
  solicitante: UsuarioConRol,
  produccionId: string,
  input: {
    costoOperativoCorregido?: string | number;
    cantidadRealObtenidaCorregida?: string | number;
    motivo: string;
  }
): Promise<Resultado<{ ajusteId: string }>> {
  const produccion = await repo.obtenerProduccionPorId(produccionId);
  if (!produccion) return { ok: false, error: "Producción no encontrada." };
  if (!(await tienePermiso(solicitante, produccion.tenantId, "operativo", "anular_ajustar"))) {
    return { ok: false, error: "No tenés permiso para ajustar esta producción." };
  }
  if (!input.motivo.trim()) {
    return { ok: false, error: "El motivo del ajuste es obligatorio." };
  }

  const ajuste = await repo.crearProduccionAjuste({
    produccionId,
    costoOperativoCorregido:
      input.costoOperativoCorregido !== undefined
        ? String(input.costoOperativoCorregido)
        : undefined,
    cantidadRealObtenidaCorregida:
      input.cantidadRealObtenidaCorregida !== undefined
        ? String(input.cantidadRealObtenidaCorregida)
        : undefined,
    motivo: input.motivo,
    creadoPor: solicitante.id,
  });

  return { ok: true, data: { ajusteId: ajuste.id } };
}

export async function listarProducciones(
  solicitante: UsuarioConRol,
  tenantId: string
): Promise<Resultado<Awaited<ReturnType<typeof repo.listarProduccionesPorTenant>>>> {
  if (!(await tienePermiso(solicitante, tenantId, "operativo", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver producciones en este tenant." };
  }
  return { ok: true, data: await repo.listarProduccionesPorTenant(tenantId) };
}

/** consultar_merma_periodo() (Modulo_06 seccion 2, adenda Modulo 10). */
export async function consultarMermaPeriodo(
  solicitante: UsuarioConRol,
  tenantId: string,
  periodo: { desde: string; hasta: string }
): Promise<Resultado<{ mermaCostoTotal: number }>> {
  if (!(await tienePermiso(solicitante, tenantId, "operativo", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver reportes de este tenant." };
  }
  const mermaCostoTotal = await repo.consultarMermaPeriodo(
    tenantId,
    new Date(periodo.desde),
    new Date(periodo.hasta)
  );
  return { ok: true, data: { mermaCostoTotal } };
}

// --- Capacidad Operativa (solo consulta, Modulo_06 seccion 4) ---------------------------------------------------------

export async function consultarCapacidadProduccionUsada(
  solicitante: UsuarioConRol,
  tenantId: string,
  activoId: string,
  periodo: { desde: string; hasta: string }
): Promise<
  Resultado<{ capacidadPeriodo: number | null; produccionReal: number; porcentajeUsado: number | null }>
> {
  if (!(await tienePermiso(solicitante, tenantId, "operativo", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver capacidad operativa en este tenant." };
  }

  const capacidad = await consultarCapacidad(solicitante, activoId);
  if (!capacidad.ok) return capacidad;

  const desde = new Date(periodo.desde);
  const hasta = new Date(periodo.hasta);
  const semanasEnPeriodo = Math.max(0, (hasta.getTime() - desde.getTime()) / MS_POR_SEMANA);

  const capacidadPeriodo = calcularCapacidadProduccionPeriodo(
    capacidad.data.disponibilidadHorariaSemanal !== null
      ? Number(capacidad.data.disponibilidadHorariaSemanal)
      : null,
    capacidad.data.tiempoEstimadoPorCicloMinutos !== null
      ? Number(capacidad.data.tiempoEstimadoPorCicloMinutos)
      : null,
    capacidad.data.capacidadProduccionCantidad !== null
      ? Number(capacidad.data.capacidadProduccionCantidad)
      : null,
    semanasEnPeriodo
  );

  const produccionesDelPeriodo = await repo.listarProduccionesPorActivoEnPeriodo(
    activoId,
    desde,
    hasta
  );
  const produccionReal = produccionesDelPeriodo.reduce(
    (acc, p) => acc + Number(p.cantidadRealObtenida),
    0
  );

  return {
    ok: true,
    data: {
      capacidadPeriodo,
      produccionReal,
      porcentajeUsado: calcularPorcentajeCapacidadUsada(produccionReal, capacidadPeriodo),
    },
  };
}

/** Deriva que productos se almacenan en este Activo desde el historico de
 * Produccion (decision del plan) — Productos e Inventario no sabe nada de
 * Activos, asi que no hay otra forma de cruzar el dato sin ese historico. */
export async function consultarCapacidadAlmacenamientoUsada(
  solicitante: UsuarioConRol,
  tenantId: string,
  activoId: string
): Promise<
  Resultado<{
    capacidadAlmacenamientoCantidad: number | null;
    stockActualTotal: number;
    porcentajeUsado: number | null;
  }>
> {
  if (!(await tienePermiso(solicitante, tenantId, "operativo", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver capacidad operativa en este tenant." };
  }

  const capacidad = await consultarCapacidad(solicitante, activoId);
  if (!capacidad.ok) return capacidad;

  const productosSucursales = await repo.listarProductosSucursalesPorActivo(activoId);
  // Paralelo, no secuencial: cada consultarStock es independiente (distinto
  // producto/sucursal) y esto era N round-trips uno detrás del otro contra
  // Supabase Cloud real -- causa raíz confirmada de un timeout de test
  // intermitente (operativo-nicho1.test.ts, "seccion 4"), no una cuestión de
  // infraestructura lenta.
  const stocks = await Promise.all(
    productosSucursales.map(({ productoId, sucursalId }) =>
      consultarStock(solicitante, productoId, sucursalId)
    )
  );
  const stockActualTotal = stocks.reduce(
    (acc, stock) => acc + (stock.ok ? stock.data.cantidadActual : 0),
    0
  );

  const capacidadAlmacenamientoCantidad =
    capacidad.data.capacidadAlmacenamientoCantidad !== null
      ? Number(capacidad.data.capacidadAlmacenamientoCantidad)
      : null;

  return {
    ok: true,
    data: {
      capacidadAlmacenamientoCantidad,
      stockActualTotal,
      porcentajeUsado: calcularPorcentajeCapacidadUsada(
        stockActualTotal,
        capacidadAlmacenamientoCantidad
      ),
    },
  };
}
