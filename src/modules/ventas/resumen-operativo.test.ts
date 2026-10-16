import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { hoyLocal, sumarDias, zonaHorariaTenant } from "@/lib/periodo";
import {
  actualizarComposicionReceta,
  crearInsumo,
  crearReceta,
  vincularProductoAReceta,
} from "@/modules/operativo/nichos/nicho-1/actions";
import { listarProductosConRecetaIncompleta } from "@/modules/operativo/actions";
import { registrarAjusteManualStock } from "@/modules/productos/actions";
import { productos } from "@/modules/productos/schema";
import {
  crearFixturePermisosCruzados,
  type FixturePermisosCruzados,
} from "@/test-utils/fixture-permisos-cruzados";
import { consultarActividadVentas, crearCanalVenta, registrarVenta } from "./actions";

/**
 * Roadmap Cafiatto, Fase 6 — resumen operativo: ventas por hora y por vendedor, y ocultar en
 * Vender lo que se prepara al vender con la receta vacia. Cada caso afirma un numero que la
 * falla no puede producir (dev-practices 6.1 b).
 */
const hasPostgres = Boolean(process.env.DATABASE_URL);
vi.setConfig({ testTimeout: 40_000, hookTimeout: 60_000 });

const ok = <T>(r: { ok: true; data: T } | { ok: false; error: string }): T => {
  if (!r.ok) throw new Error(r.error);
  return r.data;
};

describe.skipIf(!hasPostgres)("Resumen operativo (Fase 6)", () => {
  let f: FixturePermisosCruzados;
  let canalVentaId: string;
  let cafeId: string;
  let sodaId: string;

  const vender = (usuario: FixturePermisosCruzados["owner"], lineas: Array<{ productoId: string; cantidad: number }>) =>
    registrarVenta(usuario, f.tenantId, { sucursalId: f.sucursalId, canalVentaId, lineas });

  beforeAll(async () => {
    f = await crearFixturePermisosCruzados("resumen-operativo", [
      ["productos", "ver"],
      ["ventas", "ver"],
      ["ventas", "crear"],
      ["inventario", "crear"],
    ]);
    canalVentaId = ok(await crearCanalVenta(f.owner, f.tenantId, { nombre: "Local" })).canalVentaId;

    const [soda, vacio, completo] = await db
      .insert(productos)
      .values([
        { tenantId: f.tenantId, nombre: "Soda", unidadVenta: "unidad", precioVenta: "10", costoOperativoVigente: "4" },
        { tenantId: f.tenantId, nombre: "Latte sin receta", unidadVenta: "unidad", precioVenta: "20" },
        { tenantId: f.tenantId, nombre: "Espresso", unidadVenta: "unidad", precioVenta: "12" },
      ])
      .returning();
    sodaId = soda.id;
    ok(
      await registrarAjusteManualStock(f.owner, f.tenantId, {
        productoId: sodaId,
        sucursalId: f.sucursalId,
        tipo: "entrada_ajuste_manual",
        cantidad: 100,
        motivo: "Stock del test",
      })
    );

    cafeId = ok(await crearInsumo(f.owner, f.tenantId, { nombre: "Café", unidadMedida: "kg" })).insumoId;
    const vincular = async (productoId: string, conInsumo: boolean) => {
      const receta = ok(
        await crearReceta(f.owner, f.tenantId, { nombre: `R-${productoId}`, rendimientoPorLote: 1, unidadRendimiento: "UND" })
      );
      if (conInsumo) {
        ok(await actualizarComposicionReceta(f.owner, receta.recetaId, [{ insumoId: cafeId, cantidadPorLote: 0.015 }]));
      }
      ok(
        await vincularProductoAReceta(f.owner, f.tenantId, {
          productoId,
          recetaId: receta.recetaId,
          cantidadBaseConsumidaPorUnidad: 1,
          modoConsumo: "al_vender",
        })
      );
    };
    await vincular(vacio.id, false);
    await vincular(completo.id, true);
  });

  afterAll(async () => {
    await f?.limpiar();
  });

  it("cuenta ventas, ingresos, y reparte por hora local y por vendedor", async () => {
    ok(await vender(f.owner, [{ productoId: sodaId, cantidad: 2 }]));
    ok(await vender(f.owner, [{ productoId: sodaId, cantidad: 1 }]));
    ok(await vender(f.colaborador, [{ productoId: sodaId, cantidad: 3 }]));

    const zona = await zonaHorariaTenant(f.tenantId);
    const hoy = hoyLocal(zona);
    const res = ok(await consultarActividadVentas(f.owner, f.tenantId, { desde: sumarDias(hoy, -1), hasta: hoy }));

    expect(res.cantidad).toBe(3);
    expect(res.ingresos).toBe(60); // 6 sodas x 10
    // Las tres ventas se hicieron en la misma hora: una sola barra con todo.
    expect(res.porHora).toHaveLength(1);
    expect(res.porHora[0]).toMatchObject({ cantidad: 3, ingresos: 60 });
    const dueño = res.porVendedor.find((v) => v.vendedorId === f.owner.id);
    const colaborador = res.porVendedor.find((v) => v.vendedorId === f.colaborador.id);
    expect(dueño).toMatchObject({ cantidad: 2, ingresos: 30 });
    expect(colaborador).toMatchObject({ cantidad: 1, ingresos: 30 });
  });

  it("un periodo sin ventas devuelve ceros, no un error", async () => {
    const zona = await zonaHorariaTenant(f.tenantId);
    const hoy = hoyLocal(zona);
    const res = ok(await consultarActividadVentas(f.owner, f.tenantId, { desde: sumarDias(hoy, -30), hasta: sumarDias(hoy, -20) }));
    expect(res).toEqual({ cantidad: 0, ingresos: 0, porHora: [], porVendedor: [] });
  });

  it("sin permiso de ver ventas se rechaza", async () => {
    const sinPermiso = await crearFixturePermisosCruzados("resumen-sin-permiso", [["productos", "ver"]]);
    try {
      const zona = await zonaHorariaTenant(sinPermiso.tenantId);
      const hoy = hoyLocal(zona);
      const res = await consultarActividadVentas(sinPermiso.colaborador, sinPermiso.tenantId, { desde: hoy, hasta: hoy });
      expect(res.ok).toBe(false);
    } finally {
      await sinPermiso.limpiar();
    }
  });

  it("marca como incompleto solo lo que se prepara al vender con la receta vacia", async () => {
    const ids = ok(await listarProductosConRecetaIncompleta(f.owner, f.tenantId));
    const nombres = (
      await db.select({ id: productos.id, nombre: productos.nombre }).from(productos)
    ).filter((p) => ids.includes(p.id));
    expect(nombres.map((p) => p.nombre)).toEqual(["Latte sin receta"]);
  });
});
