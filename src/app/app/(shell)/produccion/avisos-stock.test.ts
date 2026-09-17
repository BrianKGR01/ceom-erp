import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import type { UsuarioConRol } from "@/modules/identidad/repository";
import {
  actualizarComposicionReceta,
  crearInsumo,
  crearReceta,
  registrarAjusteManualInsumo,
  vincularProductoAReceta,
} from "@/modules/operativo/nichos/nicho-1/actions";
import { activos } from "@/modules/patrimonio/schema";
import { consultarStock } from "@/modules/productos/actions";
import { productos } from "@/modules/productos/schema";
import { crearFixturePermisosCruzados, type FixturePermisosCruzados } from "@/test-utils/fixture-permisos-cruzados";

/**
 * R-3.2 — la acreditación de una producción llega a la pantalla.
 *
 * `registrarProduccionAction` reducía `acreditacionProductos` a un booleano
 * que ninguna pantalla leía: la producción quedaba registrada (con los insumos
 * ya consumidos) y el producto terminado podía no entrar al stock sin ninguna
 * señal. El disparador: alguien con permiso de operativo pero no de inventario.
 * Mismo criterio y misma estructura que `proveedores/avisos-stock.test.ts`.
 */
const hasPostgres = Boolean(process.env.DATABASE_URL);

let sesion: UsuarioConRol | null = null;
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/modules/identidad/actions", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/modules/identidad/actions")>();
  return { ...original, obtenerUsuarioActual: async () => sesion };
});

vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 });

describe.skipIf(!hasPostgres)("R-3.2 — Producción: la acreditación fallida no se descarta", () => {
  let f: FixturePermisosCruzados;
  let productoId: string;
  let activoId: string;

  beforeAll(async () => {
    f = await crearFixturePermisosCruzados("produccion", [
      ["operativo", "ver"],
      ["operativo", "crear"],
    ]);
    const [producto] = await db
      .insert(productos)
      .values({ tenantId: f.tenantId, nombre: "Pan de molde", unidadVenta: "unidad", precioVenta: "15" })
      .returning();
    productoId = producto.id;
    const [activo] = await db
      .insert(activos)
      .values({
        tenantId: f.tenantId,
        sucursalId: f.sucursalId,
        nombre: "Horno",
        tipo: "equipo_productivo",
        valorCompra: "1000",
        fechaAdquisicion: "2026-01-01",
      })
      .returning();
    activoId = activo.id;

    const insumo = await crearInsumo(f.owner, f.tenantId, { nombre: "Harina", unidadMedida: "kg" });
    if (!insumo.ok) throw new Error(insumo.error);
    const entrada = await registrarAjusteManualInsumo(f.owner, f.tenantId, {
      insumoId: insumo.data.insumoId,
      sucursalId: f.sucursalId,
      tipo: "entrada_ajuste_manual",
      cantidad: 100,
      motivo: "Stock inicial del test",
    });
    if (!entrada.ok) throw new Error(entrada.error);
    const receta = await crearReceta(f.owner, f.tenantId, { nombre: "Pan", rendimientoPorLote: 10, unidadRendimiento: "unidad" });
    if (!receta.ok) throw new Error(receta.error);
    const composicion = await actualizarComposicionReceta(f.owner, receta.data.recetaId, [
      { insumoId: insumo.data.insumoId, cantidadPorLote: 1 },
    ]);
    if (!composicion.ok) throw new Error(composicion.error);
    const vinculo = await vincularProductoAReceta(f.owner, f.tenantId, {
      productoId,
      recetaId: receta.data.recetaId,
      cantidadBaseConsumidaPorUnidad: 1,
    });
    if (!vinculo.ok) throw new Error(vinculo.error);
  });

  afterAll(async () => {
    await f?.limpiar();
  });

  beforeEach(() => {
    sesion = null;
  });

  const stock = async () => {
    const res = await consultarStock(f.owner, productoId, f.sucursalId);
    if (!res.ok) throw new Error(res.error);
    return res.data.cantidadActual;
  };

  const produccion = () => ({
    productoId,
    sucursalId: f.sucursalId,
    activoId,
    fechaProduccion: "2026-09-17",
    cantidadLotesProducidos: 1,
    cantidadRealObtenida: 10,
  });

  it("colaborador con operativo y sin inventario: la producción queda y la acción avisa que el producto no entró", async () => {
    const { registrarProduccionAction } = await import("./actions");
    sesion = f.colaborador;
    const antes = await stock();

    const res = await registrarProduccionAction(produccion());

    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("inalcanzable");
    expect(res.data.errorAcreditacion).toMatch(
      /La producción quedó registrada, pero las 10 unidades no entraron al stock: No tenés permiso para registrar entradas de stock/
    );
    expect(await stock()).toBe(antes);
  });

  it("control: el Owner registra la misma producción y no hay aviso, el producto entra al stock", async () => {
    const { registrarProduccionAction } = await import("./actions");
    sesion = f.owner;
    const antes = await stock();

    const res = await registrarProduccionAction(produccion());

    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("inalcanzable");
    expect(res.data.errorAcreditacion).toBeNull();
    expect(await stock()).toBe(antes + 10);
  });
});
