import { ROL_CEOM_ADMIN_ID } from "@/modules/identidad/constants";
import { tieneCapacidadEspecial, tienePermiso } from "@/modules/identidad/actions";
import type { UsuarioConRol } from "@/modules/identidad/actions";
import * as repo from "./repository";
import type {
  origenCostoEnum,
  tipoOrigenProductoEnum,
  unidadVentaEnum,
} from "./schema";

export type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

type UnidadVenta = (typeof unidadVentaEnum.enumValues)[number];
type OrigenCosto = (typeof origenCostoEnum.enumValues)[number];
type TipoOrigenProducto = (typeof tipoOrigenProductoEnum.enumValues)[number];

// Solo se necesita el rol del solicitante para gatear las escrituras del
// catalogo global de categorias sugeridas — mismo criterio que Suscripcion
// para el catalogo de Planes (no se importa UsuarioConRol para no acoplar
// mas de lo necesario en esa rama).
interface SolicitanteCeomAdmin {
  rolId: string;
}

function requiereCeomAdmin(
  solicitante: SolicitanteCeomAdmin
): { ok: false; error: string } | null {
  if (solicitante.rolId !== ROL_CEOM_ADMIN_ID) {
    return {
      ok: false,
      error: "Solo CEOM Admin puede gestionar el catálogo de categorías sugeridas.",
    };
  }
  return null;
}

// --- Categorias de Producto ---------------------------------------------------------

export interface DatosCategoria {
  nombre: string;
  categoriaSugeridaId?: string;
}

export async function crearCategoria(
  solicitante: UsuarioConRol,
  tenantId: string,
  input: DatosCategoria
): Promise<Resultado<{ categoriaId: string }>> {
  if (!(await tienePermiso(solicitante, tenantId, "productos", "crear"))) {
    return { ok: false, error: "No tenés permiso para crear categorías en este tenant." };
  }

  const categoria = await repo.crearCategoria({
    tenantId,
    nombre: input.nombre,
    categoriaSugeridaId: input.categoriaSugeridaId,
  });

  return { ok: true, data: { categoriaId: categoria.id } };
}

export async function actualizarCategoria(
  solicitante: UsuarioConRol,
  categoriaId: string,
  input: Partial<DatosCategoria>
): Promise<Resultado<true>> {
  const categoria = await repo.obtenerCategoriaPorId(categoriaId);
  if (!categoria) return { ok: false, error: "Categoría no encontrada." };
  if (!(await tienePermiso(solicitante, categoria.tenantId, "productos", "editar"))) {
    return { ok: false, error: "No tenés permiso para editar esta categoría." };
  }

  await repo.actualizarCategoria(categoriaId, input);
  return { ok: true, data: true };
}

export async function eliminarCategoria(
  solicitante: UsuarioConRol,
  categoriaId: string
): Promise<Resultado<true>> {
  const categoria = await repo.obtenerCategoriaPorId(categoriaId);
  if (!categoria) return { ok: false, error: "Categoría no encontrada." };
  if (
    !(await tienePermiso(solicitante, categoria.tenantId, "productos", "anular_ajustar"))
  ) {
    return { ok: false, error: "No tenés permiso para eliminar esta categoría." };
  }

  await repo.eliminarCategoriaSoft(categoriaId);
  return { ok: true, data: true };
}

export async function listarCategorias(
  solicitante: UsuarioConRol,
  tenantId: string
): Promise<Resultado<Awaited<ReturnType<typeof repo.listarCategoriasPorTenant>>>> {
  if (!(await tienePermiso(solicitante, tenantId, "productos", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver categorías en este tenant." };
  }
  return { ok: true, data: await repo.listarCategoriasPorTenant(tenantId) };
}

// --- Categorias Sugeridas (catalogo global, Panel Admin CEOM) --------------------

export async function listarCategoriasSugeridas(
  opts: { nichoId?: string; soloActivas?: boolean } = {}
) {
  return repo.listarCategoriasSugeridas(opts);
}

export async function crearCategoriaSugerida(
  solicitante: SolicitanteCeomAdmin,
  input: { nichoId?: string; nombre: string }
): Promise<Resultado<{ categoriaSugeridaId: string }>> {
  const bloqueo = requiereCeomAdmin(solicitante);
  if (bloqueo) return bloqueo;

  const categoria = await repo.crearCategoriaSugerida({
    nichoId: input.nichoId,
    nombre: input.nombre,
  });
  return { ok: true, data: { categoriaSugeridaId: categoria.id } };
}

export async function desactivarCategoriaSugerida(
  solicitante: SolicitanteCeomAdmin,
  categoriaSugeridaId: string
): Promise<Resultado<true>> {
  const bloqueo = requiereCeomAdmin(solicitante);
  if (bloqueo) return bloqueo;

  await repo.actualizarActivaCategoriaSugerida(categoriaSugeridaId, false);
  return { ok: true, data: true };
}

// --- Productos ---------------------------------------------------------

export interface DatosProducto {
  categoriaId?: string;
  nombre: string;
  imagenUrl?: string;
  unidadVenta: UnidadVenta;
  precioVenta: string | number;
  costoOperativoVigente?: string | number;
  origenCosto?: OrigenCosto;
  // "produccion_nicho" no es aceptado aca (regla de vinculacion explicita,
  // Modulo_02 seccion 4.3) — solo enviarProductoAOperaciones() lo asigna.
  tipoOrigenProducto?: Exclude<TipoOrigenProducto, "produccion_nicho">;
  fechaVencimientoReferencia?: string;
  vidaUtilDias?: number;
  activo?: boolean;
}

export async function crearProducto(
  solicitante: UsuarioConRol,
  tenantId: string,
  input: DatosProducto
): Promise<Resultado<{ productoId: string }>> {
  if (!(await tienePermiso(solicitante, tenantId, "productos", "crear"))) {
    return { ok: false, error: "No tenés permiso para crear productos en este tenant." };
  }

  const producto = await repo.crearProducto({
    tenantId,
    categoriaId: input.categoriaId,
    nombre: input.nombre,
    imagenUrl: input.imagenUrl,
    unidadVenta: input.unidadVenta,
    precioVenta: String(input.precioVenta),
    costoOperativoVigente:
      input.costoOperativoVigente !== undefined
        ? String(input.costoOperativoVigente)
        : undefined,
    origenCosto: input.origenCosto ?? "manual",
    tipoOrigenProducto: input.tipoOrigenProducto ?? "manual",
    fechaVencimientoReferencia: input.fechaVencimientoReferencia,
    vidaUtilDias: input.vidaUtilDias,
    activo: input.activo ?? true,
    creadoPor: solicitante.id,
  });

  return { ok: true, data: { productoId: producto.id } };
}

export async function actualizarProducto(
  solicitante: UsuarioConRol,
  productoId: string,
  input: Partial<DatosProducto>
): Promise<Resultado<true>> {
  const producto = await repo.obtenerProductoPorId(productoId);
  if (!producto) return { ok: false, error: "Producto no encontrado." };
  if (!(await tienePermiso(solicitante, producto.tenantId, "productos", "editar"))) {
    return { ok: false, error: "No tenés permiso para editar este producto." };
  }
  // Regla 2 (Modulo_02 seccion 4): el costo operativo de un producto de
  // produccion nunca se edita a mano, solo lo actualiza el Modulo Operativo
  // (via registrarEntradaProduccion).
  if (
    input.costoOperativoVigente !== undefined &&
    producto.tipoOrigenProducto === "produccion_nicho"
  ) {
    return {
      ok: false,
      error:
        "El costo operativo de un producto de producción no se edita a mano; lo actualiza el Módulo Operativo.",
    };
  }

  await repo.actualizarProducto(productoId, {
    categoriaId: input.categoriaId,
    nombre: input.nombre,
    imagenUrl: input.imagenUrl,
    unidadVenta: input.unidadVenta,
    precioVenta: input.precioVenta !== undefined ? String(input.precioVenta) : undefined,
    costoOperativoVigente:
      input.costoOperativoVigente !== undefined
        ? String(input.costoOperativoVigente)
        : undefined,
    origenCosto: input.origenCosto,
    fechaVencimientoReferencia: input.fechaVencimientoReferencia,
    vidaUtilDias: input.vidaUtilDias,
    activo: input.activo,
    modificadoPor: solicitante.id,
    modificadoEn: new Date(),
  });
  return { ok: true, data: true };
}

/** Caso borde 1 (Modulo_02 seccion 8): eliminar con stock positivo exige
 * confirmacion explicita — no se pierde el valor de inventario reportado. */
export async function eliminarProducto(
  solicitante: UsuarioConRol,
  productoId: string,
  opts: { confirmarConStock?: boolean } = {}
): Promise<Resultado<true>> {
  const producto = await repo.obtenerProductoPorId(productoId);
  if (!producto) return { ok: false, error: "Producto no encontrado." };
  if (
    !(await tienePermiso(solicitante, producto.tenantId, "productos", "anular_ajustar"))
  ) {
    return { ok: false, error: "No tenés permiso para eliminar este producto." };
  }

  const stockTotal = await repo.obtenerStockTotalProducto(productoId);
  if (stockTotal > 0 && !opts.confirmarConStock) {
    return {
      ok: false,
      error: `Este producto tiene ${stockTotal} unidades en stock. Confirmá explícitamente para eliminarlo igual.`,
    };
  }

  await repo.eliminarProductoSoft(productoId);
  return { ok: true, data: true };
}

export async function listarProductos(
  solicitante: UsuarioConRol,
  tenantId: string
): Promise<Resultado<Awaited<ReturnType<typeof repo.listarProductosPorTenant>>>> {
  if (!(await tienePermiso(solicitante, tenantId, "productos", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver productos en este tenant." };
  }
  return { ok: true, data: await repo.listarProductosPorTenant(tenantId) };
}

export async function fichaProducto(
  solicitante: UsuarioConRol,
  productoId: string
): Promise<
  Resultado<{
    producto: Awaited<ReturnType<typeof repo.obtenerProductoPorId>>;
    stockPorSucursal: Awaited<ReturnType<typeof repo.listarStockPorProducto>>;
  }>
> {
  const producto = await repo.obtenerProductoPorId(productoId);
  if (!producto) return { ok: false, error: "Producto no encontrado." };
  if (!(await tienePermiso(solicitante, producto.tenantId, "productos", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver este producto." };
  }

  const stockPorSucursal = await repo.listarStockPorProducto(productoId);
  return { ok: true, data: { producto, stockPorSucursal } };
}

/** "Vincular a proceso operativo" (Modulo_02 seccion 4.3): la unica forma de
 * que un producto pase a tipo_origen_producto = produccion_nicho — nunca es
 * automatico. Pendiente: validar que el tenant tenga un Nicho activo exige
 * que Identidad exponga esa consulta publicamente (hoy no lo hace); queda
 * documentado en ANCLA.md, igual que otros pendientes cross-modulo. */
export async function enviarProductoAOperaciones(
  solicitante: UsuarioConRol,
  productoId: string
): Promise<Resultado<true>> {
  const producto = await repo.obtenerProductoPorId(productoId);
  if (!producto) return { ok: false, error: "Producto no encontrado." };
  if (!(await tienePermiso(solicitante, producto.tenantId, "productos", "editar"))) {
    return {
      ok: false,
      error: "No tenés permiso para vincular este producto a un proceso operativo.",
    };
  }

  if (producto.tipoOrigenProducto === "produccion_nicho") {
    return { ok: true, data: true };
  }

  await repo.actualizarProducto(productoId, {
    tipoOrigenProducto: "produccion_nicho",
    origenCosto: "nicho_sugerido",
    modificadoPor: solicitante.id,
    modificadoEn: new Date(),
  });
  return { ok: true, data: true };
}

// --- Consultas (Modulo_02 seccion 3 — salidas que expone) ---------------------------------------------------------

export async function consultarStock(
  solicitante: UsuarioConRol,
  productoId: string,
  sucursalId: string
): Promise<
  Resultado<{ cantidadActual: number; stockMinimo: number | null; bajoStockMinimo: boolean }>
> {
  const producto = await repo.obtenerProductoPorId(productoId);
  if (!producto) return { ok: false, error: "Producto no encontrado." };
  if (!(await tienePermiso(solicitante, producto.tenantId, "inventario", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver el stock de este tenant." };
  }

  const filaStock = await repo.obtenerStock(productoId, sucursalId);
  const cantidadActual = filaStock ? Number(filaStock.cantidadActual) : 0;
  const stockMinimo =
    filaStock?.stockMinimo != null ? Number(filaStock.stockMinimo) : null;
  const bajoStockMinimo = stockMinimo !== null && cantidadActual <= stockMinimo;

  return { ok: true, data: { cantidadActual, stockMinimo, bajoStockMinimo } };
}

/** Suma cantidad_actual de TODOS los productos del tenant en una sucursal —
 * roadmap item #12 (Nicho 4): a diferencia de consultarStock (un producto
 * puntual), esto es el insumo que necesita consultarCapacidadAlmacenamiento-
 * Usada de Nicho 4 para comparar contra la capacidad de un Activo. */
export async function consultarStockTotalPorSucursal(
  solicitante: UsuarioConRol,
  tenantId: string,
  sucursalId: string
): Promise<Resultado<{ stockTotal: number }>> {
  if (!(await tienePermiso(solicitante, tenantId, "inventario", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver el stock de este tenant." };
  }
  const stockTotal = await repo.sumarStockPorSucursal(tenantId, sucursalId);
  return { ok: true, data: { stockTotal } };
}

/** Configura el umbral de alerta (Modulo_02 seccion 5) — no crea movimiento,
 * no toca cantidad_actual, solo el umbral con el que se compara. */
export async function configurarStockMinimo(
  solicitante: UsuarioConRol,
  productoId: string,
  sucursalId: string,
  stockMinimo: string | number | null
): Promise<Resultado<true>> {
  const producto = await repo.obtenerProductoPorId(productoId);
  if (!producto) return { ok: false, error: "Producto no encontrado." };
  if (!(await tienePermiso(solicitante, producto.tenantId, "inventario", "editar"))) {
    return { ok: false, error: "No tenés permiso para configurar el stock mínimo en este tenant." };
  }

  await repo.actualizarStockMinimo(
    productoId,
    sucursalId,
    stockMinimo !== null ? String(stockMinimo) : null
  );
  return { ok: true, data: true };
}

export async function consultarPrecioVenta(
  solicitante: UsuarioConRol,
  productoId: string
): Promise<Resultado<{ precioVenta: number }>> {
  const producto = await repo.obtenerProductoPorId(productoId);
  if (!producto) return { ok: false, error: "Producto no encontrado." };
  if (!(await tienePermiso(solicitante, producto.tenantId, "productos", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver este producto." };
  }
  return { ok: true, data: { precioVenta: Number(producto.precioVenta) } };
}

export async function consultarCostoOperativo(
  solicitante: UsuarioConRol,
  productoId: string
): Promise<Resultado<{ costoOperativoVigente: number | null }>> {
  const producto = await repo.obtenerProductoPorId(productoId);
  if (!producto) return { ok: false, error: "Producto no encontrado." };
  if (!(await tienePermiso(solicitante, producto.tenantId, "productos", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver este producto." };
  }
  return {
    ok: true,
    data: {
      costoOperativoVigente:
        producto.costoOperativoVigente !== null
          ? Number(producto.costoOperativoVigente)
          : null,
    },
  };
}

// --- Movimientos de Stock (Modulo_02 seccion 2.5 y 3) ---------------------------------------------------------
// Las que reciben eventos de otros modulos (produccion, compra de reventa,
// venta) quedan listas para cuando existan Modulo 6/Ventas — hoy nadie las
// llama todavia, mismo criterio que compra_registrada en Proveedores.

export async function registrarEntradaProduccion(
  solicitante: UsuarioConRol,
  tenantId: string,
  input: {
    productoId: string;
    sucursalId: string;
    cantidad: string | number;
    costoOperativo: string | number;
    referenciaId?: string;
  }
): Promise<Resultado<{ movimientoId: string; cantidadActual: number }>> {
  if (!(await tienePermiso(solicitante, tenantId, "inventario", "crear"))) {
    return { ok: false, error: "No tenés permiso para registrar entradas de stock en este tenant." };
  }

  const { movimiento, cantidadActual } = await repo.crearEntradaProduccionTx({
    productoId: input.productoId,
    sucursalId: input.sucursalId,
    cantidad: String(input.cantidad),
    costoOperativo: String(input.costoOperativo),
    referenciaId: input.referenciaId,
    creadoPor: solicitante.id,
  });

  return { ok: true, data: { movimientoId: movimiento.id, cantidadActual } };
}

export async function registrarEntradaCompraReventa(
  solicitante: UsuarioConRol,
  tenantId: string,
  input: {
    productoId: string;
    sucursalId: string;
    cantidad: string | number;
    costoCompra: string | number;
    referenciaId?: string;
  }
): Promise<Resultado<{ movimientoId: string; cantidadActual: number }>> {
  if (!(await tienePermiso(solicitante, tenantId, "inventario", "crear"))) {
    return { ok: false, error: "No tenés permiso para registrar entradas de stock en este tenant." };
  }

  const { movimiento, cantidadActual } = await repo.crearEntradaCompraReventaTx({
    productoId: input.productoId,
    sucursalId: input.sucursalId,
    cantidad: String(input.cantidad),
    costoCompra: String(input.costoCompra),
    referenciaId: input.referenciaId,
    creadoPor: solicitante.id,
  });

  return { ok: true, data: { movimientoId: movimiento.id, cantidadActual } };
}

export async function registrarAjusteManualStock(
  solicitante: UsuarioConRol,
  tenantId: string,
  input: {
    productoId: string;
    sucursalId: string;
    tipo: "entrada_ajuste_manual" | "salida_ajuste_manual";
    cantidad: string | number;
    motivo: string;
  }
): Promise<Resultado<{ movimientoId: string; cantidadActual: number }>> {
  if (
    !(await tienePermiso(solicitante, tenantId, "inventario", "anular_ajustar"))
  ) {
    return { ok: false, error: "No tenés permiso para ajustar stock en este tenant." };
  }
  if (!input.motivo.trim()) {
    return { ok: false, error: "El motivo del ajuste es obligatorio." };
  }

  const { movimiento, cantidadActual } = await repo.crearMovimientoTx({
    productoId: input.productoId,
    sucursalId: input.sucursalId,
    tipo: input.tipo,
    cantidad: String(input.cantidad),
    motivo: input.motivo,
    creadoPor: solicitante.id,
  });

  return { ok: true, data: { movimientoId: movimiento.id, cantidadActual } };
}

/** descontar_stock() (Modulo_02 seccion 3) — hoy sin caller real (Ventas no
 * existe todavia). Regla 4 (seccion 4): bloquea si no alcanza el stock,
 * salvo capacidad especial "vender_sin_stock". */
export async function descontarStockVenta(
  solicitante: UsuarioConRol,
  tenantId: string,
  input: {
    productoId: string;
    sucursalId: string;
    cantidad: string | number;
    referenciaId?: string;
  }
): Promise<Resultado<{ movimientoId: string; cantidadActual: number }>> {
  if (!(await tienePermiso(solicitante, tenantId, "inventario", "crear"))) {
    return { ok: false, error: "No tenés permiso para descontar stock en este tenant." };
  }

  const cantidadPedida = Number(input.cantidad);
  const filaStock = await repo.obtenerStock(input.productoId, input.sucursalId);
  const disponible = filaStock ? Number(filaStock.cantidadActual) : 0;

  if (disponible < cantidadPedida) {
    const puedeVenderSinStock = await tieneCapacidadEspecial(
      solicitante,
      "vender_sin_stock"
    );
    if (!puedeVenderSinStock) {
      return {
        ok: false,
        error: `Stock insuficiente: hay ${disponible} unidades disponibles.`,
      };
    }
  }

  const { movimiento, cantidadActual } = await repo.crearMovimientoTx({
    productoId: input.productoId,
    sucursalId: input.sucursalId,
    tipo: "salida_venta",
    cantidad: String(input.cantidad),
    referenciaId: input.referenciaId,
    creadoPor: solicitante.id,
  });

  return { ok: true, data: { movimientoId: movimiento.id, cantidadActual } };
}

/** Transferencia entre sucursales (Modulo_02 seccion 7, caso de uso 7) — no
 * aplica la excepcion de "vender_sin_stock" (es especifica de Ventas), se
 * bloquea siempre si no alcanza el stock en la sucursal de origen. */
export async function registrarTransferenciaStock(
  solicitante: UsuarioConRol,
  tenantId: string,
  input: {
    productoId: string;
    sucursalOrigenId: string;
    sucursalDestinoId: string;
    cantidad: string | number;
  }
): Promise<
  Resultado<{
    cantidadActualOrigen: number;
    cantidadActualDestino: number;
  }>
> {
  if (!(await tienePermiso(solicitante, tenantId, "inventario", "crear"))) {
    return { ok: false, error: "No tenés permiso para transferir stock en este tenant." };
  }

  const cantidadPedida = Number(input.cantidad);
  const filaStock = await repo.obtenerStock(input.productoId, input.sucursalOrigenId);
  const disponible = filaStock ? Number(filaStock.cantidadActual) : 0;
  if (disponible < cantidadPedida) {
    return {
      ok: false,
      error: `Stock insuficiente en la sucursal de origen: hay ${disponible} unidades disponibles.`,
    };
  }

  const { cantidadActualOrigen, cantidadActualDestino } =
    await repo.crearTransferenciaStockTx({
      productoId: input.productoId,
      sucursalOrigenId: input.sucursalOrigenId,
      sucursalDestinoId: input.sucursalDestinoId,
      cantidad: String(input.cantidad),
      creadoPor: solicitante.id,
    });

  return { ok: true, data: { cantidadActualOrigen, cantidadActualDestino } };
}

export { signoMovimiento } from "./repository";
