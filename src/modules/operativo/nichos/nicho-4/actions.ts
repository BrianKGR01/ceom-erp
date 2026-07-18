// Modulo Operativo — Nicho 4 (Comercio Minorista y Distribucion), roadmap
// item #12. Sin schema.ts ni repository.ts propio: a diferencia de Nicho 1
// (produccion/recetas/insumos), este nicho no tiene entidades propias —
// Landed Cost y Orden de Compra viven en Proveedores (Modulo 8, "Compra"
// gana estado + costoAdicionalTraslado), y "Productos de compra-venta sin
// receta" ya esta cubierto por tipo_origen_producto=reventa_simple
// (Modulo 2, ya existente). Lo unico genuinamente especifico de este nicho
// es la consulta de capacidad de almacenamiento, mirror parcial de Nicho 1
// pero con una fuente de datos distinta (stock real de Productos e
// Inventario, no hay historial de Producciones acá).
import { tienePermiso } from "@/modules/identidad/actions";
import type { UsuarioConRol } from "@/modules/identidad/actions";
import { calcularPorcentajeCapacidadUsada } from "@/modules/operativo/nichos/nicho-1/actions";
import { consultarCapacidad } from "@/modules/patrimonio/actions";
import { consultarStockTotalPorSucursal } from "@/modules/productos/actions";

export type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Equivalente de Nicho 1 (`consultarCapacidadAlmacenamientoUsada`), pero
 * "stockActualTotal" viene de `consultarStockTotalPorSucursal()` (Módulo 2)
 * en vez de derivarse del historial de Producciones — este nicho no
 * produce nada, solo revende. `sucursalId` se recibe explícito (no se
 * deriva de `activo.sucursalId`, que puede ser `null` = "aplica a todo el
 * negocio") — mismo criterio que `consultarStock()` de Módulo 2, que
 * también recibe la sucursal explícita en vez de inferirla.
 */
export async function consultarCapacidadAlmacenamientoUsada(
  solicitante: UsuarioConRol,
  tenantId: string,
  activoId: string,
  sucursalId: string
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

  const stockRes = await consultarStockTotalPorSucursal(solicitante, tenantId, sucursalId);
  if (!stockRes.ok) return stockRes;

  const capacidadAlmacenamientoCantidad =
    capacidad.data.capacidadAlmacenamientoCantidad !== null
      ? Number(capacidad.data.capacidadAlmacenamientoCantidad)
      : null;

  return {
    ok: true,
    data: {
      capacidadAlmacenamientoCantidad,
      stockActualTotal: stockRes.data.stockTotal,
      porcentajeUsado: calcularPorcentajeCapacidadUsada(
        stockRes.data.stockTotal,
        capacidadAlmacenamientoCantidad
      ),
    },
  };
}
