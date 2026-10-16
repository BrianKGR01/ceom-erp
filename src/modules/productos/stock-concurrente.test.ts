import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { registrarAjusteManualStock } from "@/modules/productos/actions";
import { movimientosStock, productos, stock } from "@/modules/productos/schema";
import {
  crearInsumo,
  registrarAjusteManualInsumo,
} from "@/modules/operativo/nichos/nicho-1/actions";
import { movimientosInsumo, stockInsumo } from "@/modules/operativo/nichos/nicho-1/schema";
import {
  crearFixturePermisosCruzados,
  type FixturePermisosCruzados,
} from "@/test-utils/fixture-permisos-cruzados";

/**
 * DA-45: movimientos simultaneos sobre el MISMO producto/insumo y sucursal.
 * Antes del lock por (item, sucursal) el cache quedaba por debajo de la suma
 * del ledger (12 recepciones de 5 -> 14 en vez de 60) y, si la fila de stock
 * no existia, una de las escrituras revertia su movimiento por 23505.
 * Se afirma el numero que la falla no puede producir (dev-practices 6.1 b):
 * cache == suma del ledger == suma esperada. 8 operaciones a proposito: menos
 * que el pool (max 10), para medir el recalculo y no el agotamiento del pool.
 */
const hasPostgres = Boolean(process.env.DATABASE_URL);
vi.setConfig({ testTimeout: 40_000, hookTimeout: 60_000 });
const N = 8;
const CANTIDAD = 5;

describe.skipIf(!hasPostgres)("Stock — movimientos simultáneos del mismo ítem (DA-45)", () => {
  let f: FixturePermisosCruzados;

  beforeAll(async () => {
    f = await crearFixturePermisosCruzados("da45", []);
  });
  afterAll(async () => {
    await f?.limpiar();
  });

  it("Productos: N entradas simultáneas sobre una fila de stock que no existe suman todas", async () => {
    const [producto] = await db
      .insert(productos)
      .values({ tenantId: f.tenantId, nombre: "Concurrente", unidadVenta: "unidad", precioVenta: "1" })
      .returning();

    const resultados = await Promise.all(
      Array.from({ length: N }, () =>
        registrarAjusteManualStock(f.owner, f.tenantId, {
          productoId: producto.id,
          sucursalId: f.sucursalId,
          tipo: "entrada_ajuste_manual",
          cantidad: CANTIDAD,
          motivo: "Concurrencia",
        })
      )
    );
    for (const r of resultados) expect(r).toMatchObject({ ok: true });

    const [cache] = await db
      .select({ c: stock.cantidadActual })
      .from(stock)
      .where(and(eq(stock.productoId, producto.id), eq(stock.sucursalId, f.sucursalId)));
    const [ledger] = await db
      .select({ t: sql<string>`sum(${movimientosStock.cantidad})` })
      .from(movimientosStock)
      .where(eq(movimientosStock.productoId, producto.id));
    expect(Number(ledger.t)).toBe(N * CANTIDAD);
    expect(Number(cache.c)).toBe(N * CANTIDAD);
  });

  it("Insumos (Nicho 1): lo mismo con stock_insumo", async () => {
    const insumo = await crearInsumo(f.owner, f.tenantId, { nombre: "Leche DA45", unidadMedida: "litros" });
    if (!insumo.ok) throw new Error(insumo.error);

    const resultados = await Promise.all(
      Array.from({ length: N }, () =>
        registrarAjusteManualInsumo(f.owner, f.tenantId, {
          insumoId: insumo.data.insumoId,
          sucursalId: f.sucursalId,
          tipo: "entrada_ajuste_manual",
          cantidad: CANTIDAD,
          motivo: "Concurrencia",
        })
      )
    );
    for (const r of resultados) expect(r).toMatchObject({ ok: true });

    const [cache] = await db
      .select({ c: stockInsumo.cantidadActual })
      .from(stockInsumo)
      .where(and(eq(stockInsumo.insumoId, insumo.data.insumoId), eq(stockInsumo.sucursalId, f.sucursalId)));
    const [ledger] = await db
      .select({ t: sql<string>`sum(${movimientosInsumo.cantidad})` })
      .from(movimientosInsumo)
      .where(eq(movimientosInsumo.insumoId, insumo.data.insumoId));
    expect(Number(ledger.t)).toBe(N * CANTIDAD);
    expect(Number(cache.c)).toBe(N * CANTIDAD);
  });
});
