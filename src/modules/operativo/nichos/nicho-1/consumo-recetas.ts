import * as repo from "./repository";

/**
 * Calculo de consumo de insumos por receta, compartido por la venta (via la
 * fachada `operativo/actions.ts`) y por las bajas de producto preparado. Es
 * solo lectura y NO autoriza: quien lo llama decide el permiso segun su caso
 * (`ventas:crear` para una venta, `operativo:anular_ajustar` para una baja).
 *
 * Fase 3: cada linea puede traer `efectos` de modificadores (cambio neto de
 * insumos POR UNIDAD), asi que el resultado es por LINEA, no por producto: dos
 * lattes de la misma venta, uno con leche de almendra y otro sin, cuestan y
 * consumen distinto.
 */

/** Cambio de un insumo por UNIDAD vendida. Negativo = se saco de la receta. */
export interface EfectoReceta {
  insumoId: string;
  insumoNombre: string;
  cantidad: number;
  costoUnitario: number | null;
}

export interface LineaConsumo {
  productoId: string;
  cantidad: number;
  efectos?: EfectoReceta[];
}

export interface ConsumoInsumo {
  insumoId: string;
  insumoNombre: string;
  /** Total a descontar, ya agregado por insumo (4 decimales). */
  cantidad: number;
  costoUnitario: number | null;
}

export interface ConsumoLinea {
  /** El producto de esta linea se prepara al vender (tiene receta en ese modo). */
  alVender: boolean;
  /**
   * Costo de la receta POR UNIDAD, con los modificadores de la linea. `null` si
   * a algun insumo le falta costo o la receta no tiene insumos (se marca como
   * desconocido, no se estima en cero).
   */
  costoUnitario: number | null;
}

export interface ConsumoRecetas {
  /** Alineado con las lineas de entrada. */
  porLinea: ConsumoLinea[];
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
  const recetaPorProducto = new Map(recetas.map((r) => [r.productoId, r]));

  const acumulado = new Map<string, ConsumoInsumo>();
  const sumar = (insumoId: string, insumoNombre: string, cantidad: number, costoUnitario: number | null) => {
    const previo = acumulado.get(insumoId);
    acumulado.set(insumoId, {
      insumoId,
      insumoNombre,
      cantidad: (previo?.cantidad ?? 0) + cantidad,
      costoUnitario,
    });
  };

  const porLinea: ConsumoLinea[] = lineas.map((linea) => {
    const receta = recetaPorProducto.get(linea.productoId);
    if (!receta) return { alVender: false, costoUnitario: null };

    // Receta sin insumos: no hay costo que congelar, no es un costo de 0.
    let costo: number | null = receta.composicion.length === 0 ? null : 0;
    for (const base of receta.composicion) {
      const porUnidad = consumoPorUnidadVendida(
        Number(base.cantidadPorLote),
        Number(receta.cantidadBase),
        Number(receta.rendimientoPorLote)
      );
      const costoInsumo = base.costoUnitarioVigente === null ? null : Number(base.costoUnitarioVigente);
      costo = costo === null || costoInsumo === null ? null : costo + porUnidad * costoInsumo;
      sumar(base.insumoId, base.insumoNombre, porUnidad * linea.cantidad, costoInsumo);
    }
    for (const efecto of linea.efectos ?? []) {
      costo =
        costo === null || efecto.costoUnitario === null ? null : costo + efecto.cantidad * efecto.costoUnitario;
      sumar(efecto.insumoId, efecto.insumoNombre, efecto.cantidad * linea.cantidad, efecto.costoUnitario);
    }
    return { alVender: true, costoUnitario: costo === null ? null : redondear4(costo) };
  });

  const consumos = [...acumulado.values()]
    .map((c) => ({ ...c, cantidad: redondear4(c.cantidad) }))
    .filter((c) => c.cantidad > 0);

  return { porLinea, consumos };
}

// --- Modificadores ------------------------------------------------------------

export interface ModificadorResuelto {
  modificadorId: string;
  grupoNombre: string;
  nombre: string;
  tipo: "agrega" | "reemplaza" | "indicacion";
  precioExtra: number;
  /** Cambio neto de insumos por unidad; vacio para una indicacion. */
  efectoReceta: EfectoReceta[];
}

export type ResultadoModificadores =
  | { ok: true; data: ModificadorResuelto[] }
  | { ok: false; error: string };

/**
 * Valida los modificadores elegidos para UN producto y los traduce a precio y
 * receta. Todo lo que llega es controlado por el cliente, asi que se ata al
 * tenant y al producto: un modificador solo vale si su grupo esta ofrecido a ese
 * producto. Las opciones "base" de un grupo no hacen nada y no se registran.
 */
export async function resolverModificadoresDeProducto(
  tenantId: string,
  productoId: string,
  modificadorIds: string[]
): Promise<ResultadoModificadores> {
  const ids = [...new Set(modificadorIds)];
  if (ids.length === 0) return { ok: true, data: [] };

  const disponibles = await repo.obtenerModificadoresParaProductos(tenantId, [productoId]);
  const porId = new Map(disponibles.map((d) => [d.modificadorId, d]));
  const elegidos = [];
  for (const id of ids) {
    const m = porId.get(id);
    if (!m) return { ok: false, error: "Un modificador elegido no está disponible para este producto." };
    if (!m.esBase) elegidos.push(m);
  }

  // Un grupo de "elige 1" no admite dos opciones a la vez.
  const porGrupo = new Map<string, number>();
  for (const m of elegidos) {
    const n = (porGrupo.get(m.grupoId) ?? 0) + 1;
    porGrupo.set(m.grupoId, n);
    if (m.seleccion === "una" && n > 1) {
      return { ok: false, error: `Del grupo "${m.grupoNombre}" solo se puede elegir una opción.` };
    }
  }

  const cambiaReceta = elegidos.some((m) => m.tipo !== "indicacion");
  const receta = cambiaReceta ? (await repo.obtenerRecetasAlVender(tenantId, [productoId]))[0] : undefined;
  if (cambiaReceta && !receta) {
    // Un modificador solo de precio (sin insumos) sigue siendo valido en un producto sin receta.
    const culpable = elegidos.find((m) => m.tipo !== "indicacion" && (m.insumoId || m.insumoReemplazadoId));
    if (culpable) {
      return {
        ok: false,
        error: `"${culpable.nombre}" cambia la receta, pero este producto no se prepara al vender.`,
      };
    }
  }

  const insumosNuevos = await repo.obtenerInsumosPorIds(
    tenantId,
    elegidos.flatMap((m) => (m.insumoId ? [m.insumoId] : []))
  );
  const insumoPorId = new Map(insumosNuevos.map((i) => [i.id, i]));
  const yaReemplazados = new Set<string>();

  const resueltos: ModificadorResuelto[] = [];
  for (const m of elegidos) {
    const efectoReceta: EfectoReceta[] = [];

    if (m.tipo === "reemplaza" && m.insumoReemplazadoId && receta) {
      const lineasBase = receta.composicion.filter((l) => l.insumoId === m.insumoReemplazadoId);
      if (lineasBase.length === 0) {
        return { ok: false, error: `La receta de este producto no usa el insumo que "${m.nombre}" reemplaza.` };
      }
      if (yaReemplazados.has(m.insumoReemplazadoId)) {
        return { ok: false, error: `Dos modificadores reemplazan el mismo insumo ("${m.nombre}").` };
      }
      yaReemplazados.add(m.insumoReemplazadoId);
      const sacado = lineasBase.reduce(
        (suma, l) =>
          suma +
          consumoPorUnidadVendida(
            Number(l.cantidadPorLote),
            Number(receta.cantidadBase),
            Number(receta.rendimientoPorLote)
          ),
        0
      );
      efectoReceta.push({
        insumoId: m.insumoReemplazadoId,
        insumoNombre: lineasBase[0].insumoNombre,
        cantidad: -redondear4(sacado),
        costoUnitario:
          lineasBase[0].costoUnitarioVigente === null ? null : Number(lineasBase[0].costoUnitarioVigente),
      });
      if (m.insumoId) {
        const nuevo = insumoPorId.get(m.insumoId);
        if (!nuevo) return { ok: false, error: `El insumo de "${m.nombre}" ya no existe.` };
        efectoReceta.push({
          insumoId: nuevo.id,
          insumoNombre: nuevo.nombre,
          cantidad: m.cantidad === null ? redondear4(sacado) : Number(m.cantidad),
          costoUnitario: nuevo.costoUnitarioVigente === null ? null : Number(nuevo.costoUnitarioVigente),
        });
      }
    } else if (m.tipo === "agrega" && m.insumoId && receta) {
      const nuevo = insumoPorId.get(m.insumoId);
      if (!nuevo) return { ok: false, error: `El insumo de "${m.nombre}" ya no existe.` };
      efectoReceta.push({
        insumoId: nuevo.id,
        insumoNombre: nuevo.nombre,
        cantidad: Number(m.cantidad),
        costoUnitario: nuevo.costoUnitarioVigente === null ? null : Number(nuevo.costoUnitarioVigente),
      });
    }

    resueltos.push({
      modificadorId: m.modificadorId,
      grupoNombre: m.grupoNombre,
      nombre: m.nombre,
      tipo: m.tipo,
      precioExtra: Number(m.precioExtra),
      efectoReceta,
    });
  }
  return { ok: true, data: resueltos };
}
