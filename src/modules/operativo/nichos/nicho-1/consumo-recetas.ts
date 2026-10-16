import * as repo from "./repository";

/**
 * Calculo de consumo de insumos por receta, compartido por la venta (via la
 * fachada `operativo/actions.ts`) y por las bajas de producto preparado. Es
 * solo lectura y NO autoriza: quien lo llama decide el permiso segun su caso
 * (`ventas:crear` para una venta, `operativo:anular_ajustar` para una baja).
 */

export interface LineaConsumo {
  productoId: string;
  cantidad: number;
}

export interface ConsumoInsumo {
  insumoId: string;
  insumoNombre: string;
  /** Total a descontar, ya agregado por insumo (4 decimales). */
  cantidad: number;
  costoUnitario: number | null;
}

export interface ConsumoRecetas {
  /**
   * Productos que se preparan al vender. `costoUnitario` es el costo de la
   * receta por unidad; `null` si a algun insumo le falta costo o la receta no
   * tiene insumos (se marca como desconocido, no se estima en cero).
   */
  porProducto: Record<string, { costoUnitario: number | null }>;
  consumos: ConsumoInsumo[];
}

export const redondear4 = (n: number) => Math.round(n * 10_000) / 10_000;

/**
 * Cuanto de cada insumo gasta UNA unidad:
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

export async function calcularConsumoRecetas(
  tenantId: string,
  lineas: LineaConsumo[]
): Promise<ConsumoRecetas> {
  const productoIds = [...new Set(lineas.map((l) => l.productoId))];
  const recetas = await repo.obtenerRecetasAlVender(tenantId, productoIds);

  const unidadesPorProducto = new Map<string, number>();
  for (const l of lineas) {
    unidadesPorProducto.set(l.productoId, (unidadesPorProducto.get(l.productoId) ?? 0) + l.cantidad);
  }

  const porProducto: ConsumoRecetas["porProducto"] = {};
  const acumulado = new Map<string, ConsumoInsumo>();

  for (const receta of recetas) {
    const unidades = unidadesPorProducto.get(receta.productoId) ?? 0;
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

      const previo = acumulado.get(linea.insumoId);
      acumulado.set(linea.insumoId, {
        insumoId: linea.insumoId,
        insumoNombre: linea.insumoNombre,
        cantidad: (previo?.cantidad ?? 0) + porUnidad * unidades,
        costoUnitario: costoInsumo,
      });
    }
    porProducto[receta.productoId] = { costoUnitario: costo === null ? null : redondear4(costo) };
  }

  const consumos = [...acumulado.values()]
    .map((c) => ({ ...c, cantidad: redondear4(c.cantidad) }))
    .filter((c) => c.cantidad > 0);

  return { porProducto, consumos };
}
