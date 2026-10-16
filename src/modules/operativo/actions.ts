import {
  listarSucursalesPorTenant,
  tieneCapacidadEspecial,
  tienePermiso,
} from "@/modules/identidad/actions";
import type { UsuarioConRol } from "@/modules/identidad/actions";
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

export interface LineaVentaOperativa {
  productoId: string;
  cantidad: number;
}

export interface ConsumoInsumoVenta {
  insumoId: string;
  insumoNombre: string;
  /** Total a descontar en toda la venta, ya agregado por insumo (4 decimales). */
  cantidad: number;
  costoUnitario: number | null;
}

export interface PlanConsumoVenta {
  /**
   * Productos de la venta que se preparan al vender. Los productos que NO
   * estan aca siguen el camino de siempre (stock de producto terminado).
   * `costoUnitario` es el costo de la receta por unidad vendida; `null` si a
   * algun insumo le falta costo (la venta lo marca como costo desconocido).
   */
  porProducto: Record<string, { costoUnitario: number | null }>;
  consumos: ConsumoInsumoVenta[];
}

const redondear4 = (n: number) => Math.round(n * 10_000) / 10_000;

/**
 * Cuanto de cada insumo gasta UNA unidad vendida:
 * cantidad_por_lote x (base que consume la presentacion / rendimiento del lote).
 * Para recetas "por unidad" (rendimiento 1, base 1) es la cantidad de la receta.
 */
export function consumoPorUnidadVendida(
  cantidadPorLote: number,
  cantidadBase: number,
  rendimientoPorLote: number
): number {
  if (rendimientoPorLote <= 0) return 0;
  return (cantidadPorLote * cantidadBase) / rendimientoPorLote;
}

/**
 * Antes de crear la Venta: que productos se consumen por receta, cuanto de
 * cada insumo, a que costo, y si alcanza el stock. Bloquea (con el nombre del
 * insumo) si falta, salvo la capacidad especial `vender_sin_stock` — la misma
 * que ya gobierna el stock de producto terminado.
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

  const productoIds = [...new Set(lineas.map((l) => l.productoId))];
  const recetas = await repo.obtenerRecetasAlVender(tenantId, productoIds);
  if (recetas.length === 0) return { ok: true, data: { porProducto: {}, consumos: [] } };
  const recetaPorProducto = new Map(recetas.map((r) => [r.productoId, r]));

  const porProducto: PlanConsumoVenta["porProducto"] = {};
  const acumulado = new Map<string, ConsumoInsumoVenta>();

  for (const [productoId, receta] of recetaPorProducto) {
    // Receta sin insumos: no hay costo que congelar, no es un costo de 0.
    let costo: number | null = receta.composicion.length === 0 ? null : 0;
    for (const linea of receta.composicion) {
      const porUnidad = consumoPorUnidadVendida(
        Number(linea.cantidadPorLote),
        Number(receta.cantidadBase),
        Number(receta.rendimientoPorLote)
      );
      const costoInsumo = linea.costoUnitarioVigente === null ? null : Number(linea.costoUnitarioVigente);
      costo = costo === null || costoInsumo === null ? null : costo + porUnidad * costoInsumo;

      const unidadesVendidas = lineas
        .filter((l) => l.productoId === productoId)
        .reduce((suma, l) => suma + l.cantidad, 0);
      const previo = acumulado.get(linea.insumoId);
      acumulado.set(linea.insumoId, {
        insumoId: linea.insumoId,
        insumoNombre: linea.insumoNombre,
        cantidad: (previo?.cantidad ?? 0) + porUnidad * unidadesVendidas,
        costoUnitario: costoInsumo,
      });
    }
    porProducto[productoId] = { costoUnitario: costo === null ? null : redondear4(costo) };
  }

  const consumos = [...acumulado.values()]
    .map((c) => ({ ...c, cantidad: redondear4(c.cantidad) }))
    .filter((c) => c.cantidad > 0);

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

  return { ok: true, data: { porProducto, consumos } };
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
