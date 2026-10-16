import {
  listarSucursalesPorTenant,
  tieneCapacidadEspecial,
  tienePermiso,
} from "@/modules/identidad/actions";
import type { UsuarioConRol } from "@/modules/identidad/actions";
import {
  calcularConsumoRecetas,
  consumoPorUnidadVendida,
  resolverModificadoresDeProducto,
  type ConsumoInsumo,
  type ModificadorResuelto,
} from "./nichos/nicho-1/consumo-recetas";
import * as repo from "./nichos/nicho-1/repository";

/**
 * Fachada neutral del Modulo Operativo (CEOM_Arquitectura.md seccion 7).
 *
 * Ventas NO importa nada de `nichos/<nicho>/`: le habla a esta capa, que no
 * sabe de rubros — solo dice "este producto se prepara al vender: consumi sus
 * insumos". Hoy la implementa Nicho 1; otro nicho que quiera lo mismo
 * resuelve aca sin que Ventas cambie (regla 1: la logica de rubro vive en el
 * nicho, el Core solo ve este contrato).
 *
 * Autorizacion: estas funciones las dispara una Venta, asi que se gatean por
 * `ventas:crear` y no por `operativo:*` — mismo criterio que
 * `generarGastoComisionVenta` y `generarGastoCuotaPasivo` (H-27): un cajero sin
 * permisos de Operativo no puede quedarse sin descontar insumos en silencio.
 * Los ids se atan al tenant dentro de cada consulta.
 */

export type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

export type ConsumoInsumoVenta = ConsumoInsumo;
export type ModificadorVenta = ModificadorResuelto;

export { consumoPorUnidadVendida };

export interface LineaVentaOperativa {
  productoId: string;
  cantidad: number;
  /** Fase 3: modificadores elegidos para esta linea. */
  modificadorIds?: string[];
}

export interface LineaPlanConsumo {
  /** El producto se prepara al vender: sus insumos salen de la receta. */
  alVender: boolean;
  /** Costo por unidad con los modificadores aplicados; null = desconocido. */
  costoUnitario: number | null;
  /** Suma de los precios extra de los modificadores, por unidad. */
  precioExtra: number;
  /** Lo elegido, ya resuelto y listo para congelar en la linea de la venta. */
  modificadores: ModificadorVenta[];
}

export interface PlanConsumoVenta {
  /** Alineado con las lineas de entrada. */
  lineas: LineaPlanConsumo[];
  consumos: ConsumoInsumoVenta[];
}

/**
 * Antes de crear la Venta: que lineas se consumen por receta, que modificadores
 * aplican (precio y receta), cuanto de cada insumo, a que costo, y si alcanza el
 * stock. Bloquea (con el nombre del insumo) si falta, salvo la capacidad
 * especial `vender_sin_stock` — la misma que ya gobierna el stock de producto
 * terminado.
 */
export async function planificarConsumoVenta(
  solicitante: UsuarioConRol,
  tenantId: string,
  sucursalId: string,
  lineas: LineaVentaOperativa[]
): Promise<Resultado<PlanConsumoVenta>> {
  if (!(await tienePermiso(solicitante, tenantId, "ventas", "crear"))) {
    return { ok: false, error: "No tenés permiso para registrar ventas." };
  }

  const resueltas = await Promise.all(
    lineas.map((l) => resolverModificadoresDeProducto(tenantId, l.productoId, l.modificadorIds ?? []))
  );
  const fallo = resueltas.find((r) => !r.ok);
  if (fallo && !fallo.ok) return fallo;
  const modificadoresPorLinea = resueltas.map((r) => (r.ok ? r.data : []));

  const { porLinea, consumos } = await calcularConsumoRecetas(
    tenantId,
    lineas.map((l, i) => ({
      productoId: l.productoId,
      cantidad: l.cantidad,
      efectos: modificadoresPorLinea[i].flatMap((m) => m.efectoReceta),
    }))
  );

  const planLineas: LineaPlanConsumo[] = lineas.map((_, i) => ({
    alVender: porLinea[i].alVender,
    costoUnitario: porLinea[i].costoUnitario,
    precioExtra: modificadoresPorLinea[i].reduce((suma, m) => suma + m.precioExtra, 0),
    modificadores: modificadoresPorLinea[i],
  }));

  if (consumos.length === 0) return { ok: true, data: { lineas: planLineas, consumos: [] } };

  const saldos = await repo.obtenerStockInsumosEnSucursal(
    consumos.map((c) => c.insumoId),
    sucursalId
  );
  const disponiblePorInsumo = new Map(saldos.map((s) => [s.insumoId, Number(s.cantidadActual)]));
  const faltante = consumos.find((c) => (disponiblePorInsumo.get(c.insumoId) ?? 0) < c.cantidad);
  if (faltante && !(await tieneCapacidadEspecial(solicitante, "vender_sin_stock"))) {
    const disponible = disponiblePorInsumo.get(faltante.insumoId) ?? 0;
    return {
      ok: false,
      error: `Insumo insuficiente ("${faltante.insumoNombre}"): hay ${disponible} disponibles, se necesitan ${faltante.cantidad}.`,
    };
  }

  return { ok: true, data: { lineas: planLineas, consumos } };
}

/**
 * Despues de crear la Venta: descuenta los insumos del plan. Un movimiento
 * `salida_venta` por insumo, con la venta como referencia y el costo vigente
 * congelado en el movimiento (regla 4). Devuelve el saldo resultante de cada
 * insumo para que la pantalla avise si alguno quedo en negativo.
 */
export async function consumirInsumosPorVenta(
  solicitante: UsuarioConRol,
  tenantId: string,
  input: { ventaId: string; sucursalId: string; consumos: ConsumoInsumoVenta[] }
): Promise<Resultado<{ saldos: Array<{ insumoId: string; insumoNombre: string; cantidadActual: number }> }>> {
  if (!(await tienePermiso(solicitante, tenantId, "ventas", "crear"))) {
    return { ok: false, error: "No tenés permiso para registrar ventas." };
  }
  if (input.consumos.length === 0) return { ok: true, data: { saldos: [] } };

  const sucursales = await listarSucursalesPorTenant(solicitante, tenantId);
  if (!sucursales.ok || !sucursales.data.some((s) => s.id === input.sucursalId)) {
    return { ok: false, error: "La sucursal indicada no existe en este negocio." };
  }

  const ids = input.consumos.map((c) => c.insumoId);
  if ((await repo.contarInsumosDelTenant(tenantId, ids)) !== new Set(ids).size) {
    return { ok: false, error: "Insumo no encontrado." };
  }

  const saldos = await repo.crearConsumosVentaTx({
    ventaId: input.ventaId,
    sucursalId: input.sucursalId,
    creadoPor: solicitante.id,
    consumos: input.consumos.map((c) => ({
      insumoId: c.insumoId,
      cantidad: String(c.cantidad),
      costoUnitarioEnMovimiento: String(c.costoUnitario ?? 0),
    })),
  });
  const nombre = new Map(input.consumos.map((c) => [c.insumoId, c.insumoNombre]));
  return {
    ok: true,
    data: {
      saldos: saldos.map((s) => ({ ...s, insumoNombre: nombre.get(s.insumoId) ?? "Insumo" })),
    },
  };
}

export interface OpcionModificadorVenta {
  id: string;
  nombre: string;
  tipo: "agrega" | "reemplaza" | "indicacion";
  esBase: boolean;
  precioExtra: number;
}

export interface GrupoModificadoresVenta {
  id: string;
  nombre: string;
  seleccion: "una" | "varias";
  opciones: OpcionModificadorVenta[];
}

/**
 * Lo que el punto de venta ofrece al tocar un producto: los grupos de
 * modificadores de cada uno, con sus opciones y precios. Solo lectura para armar
 * la pantalla; el servidor vuelve a validar todo al registrar la venta.
 */
export async function listarModificadoresParaVenta(
  solicitante: UsuarioConRol,
  tenantId: string,
  productoIds: string[]
): Promise<Resultado<Record<string, GrupoModificadoresVenta[]>>> {
  if (!(await tienePermiso(solicitante, tenantId, "ventas", "crear"))) {
    return { ok: false, error: "No tenés permiso para registrar ventas." };
  }
  const filas = await repo.obtenerModificadoresParaProductos(tenantId, productoIds);

  const resultado: Record<string, GrupoModificadoresVenta[]> = {};
  for (const fila of filas) {
    const grupos = (resultado[fila.productoId] ??= []);
    let grupo = grupos.find((g) => g.id === fila.grupoId);
    if (!grupo) {
      grupo = { id: fila.grupoId, nombre: fila.grupoNombre, seleccion: fila.seleccion, opciones: [] };
      grupos.push(grupo);
    }
    grupo.opciones.push({
      id: fila.modificadorId,
      nombre: fila.nombre,
      tipo: fila.tipo,
      esBase: fila.esBase,
      precioExtra: Number(fila.precioExtra),
    });
  }
  return { ok: true, data: resultado };
}
