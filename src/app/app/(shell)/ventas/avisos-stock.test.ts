import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import type { UsuarioConRol } from "@/modules/identidad/repository";
import { consultarStock, registrarAjusteManualStock } from "@/modules/productos/actions";
import { productos } from "@/modules/productos/schema";
import { crearCanalVenta } from "@/modules/ventas/actions";
import { crearFixturePermisosCruzados, type FixturePermisosCruzados } from "@/test-utils/fixture-permisos-cruzados";

/**
 * R-3.2 / H-37 — lo que pasa con el stock al vender o al ajustar una venta
 * llega a la pantalla, en vez de calcularse y descartarse.
 *
 * Mismo criterio que `proveedores/avisos-stock.test.ts`: se llaman las Server
 * Actions reales de la ruta, con la sesión simulada. El escenario de permisos
 * cruzados es un colaborador que puede vender y ajustar ventas pero no mover
 * inventario — la venta/el ajuste quedan registrados y el stock no se mueve.
 * Cada caso tiene su control, con valores que la falla no puede producir.
 */
const hasPostgres = Boolean(process.env.DATABASE_URL);

let sesion: UsuarioConRol | null = null;
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/modules/identidad/actions", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/modules/identidad/actions")>();
  return { ...original, obtenerUsuarioActual: async () => sesion };
});

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

describe.skipIf(!hasPostgres)("R-3.2 — Ventas: el problema de stock no se descarta", () => {
  let f: FixturePermisosCruzados;
  let productoId: string;
  let productoSinMovimientosId: string;
  let canalVentaId: string;

  beforeAll(async () => {
    f = await crearFixturePermisosCruzados("ventas", [
      // Un cajero real: ve productos (para el precio) y vende, pero no mueve inventario.
      ["productos", "ver"],
      ["ventas", "ver"],
      ["ventas", "crear"],
      ["ventas", "anular_ajustar"],
    ]);
    const [p1, p2] = await db
      .insert(productos)
      .values([
        { tenantId: f.tenantId, nombre: "Medialuna", unidadVenta: "unidad", precioVenta: "5" },
        { tenantId: f.tenantId, nombre: "Torta entera", unidadVenta: "unidad", precioVenta: "90" },
      ])
      .returning();
    productoId = p1.id;
    productoSinMovimientosId = p2.id;
    const entrada = await registrarAjusteManualStock(f.owner, f.tenantId, {
      productoId,
      sucursalId: f.sucursalId,
      tipo: "entrada_ajuste_manual",
      cantidad: 10,
      motivo: "Stock inicial del test",
    });
    if (!entrada.ok) throw new Error(entrada.error);
    const canal = await crearCanalVenta(f.owner, f.tenantId, { nombre: "Local" });
    if (!canal.ok) throw new Error(canal.error);
    canalVentaId = canal.data.canalVentaId;
  });

  afterAll(async () => {
    await f?.limpiar();
  });

  beforeEach(() => {
    sesion = null;
  });

  const stock = async (id = productoId) => {
    const res = await consultarStock(f.owner, id, f.sucursalId);
    if (!res.ok) throw new Error(res.error);
    return res.data.cantidadActual;
  };

  const venta = (cantidad: number) => ({ canalVentaId, lineas: [{ productoId, cantidad }] });

  describe("POS — registrarVentaAction (H-37)", () => {
    it("colaborador sin permiso de inventario: la venta queda y la acción avisa que el stock no bajó", async () => {
      const { registrarVentaAction } = await import("./actions");
      sesion = f.colaborador;
      const antes = await stock();

      const res = await registrarVentaAction(f.sucursalId, venta(2));

      expect(res.ok).toBe(true);
      if (!res.ok) throw new Error("inalcanzable");
      expect(res.data.avisosStock).toEqual([
        {
          productoId,
          mensaje: expect.stringMatching(/no se descontó del stock: No tenés permiso para descontar stock/),
        },
      ]);
      expect(await stock()).toBe(antes);
    });

    it("control: el Owner vende dentro del stock y no hay aviso", async () => {
      const { registrarVentaAction } = await import("./actions");
      sesion = f.owner;
      const antes = await stock();

      const res = await registrarVentaAction(f.sucursalId, venta(2));

      expect(res.ok).toBe(true);
      if (!res.ok) throw new Error("inalcanzable");
      expect(res.data.avisosStock).toEqual([]);
      expect(await stock()).toBe(antes - 2);
    });

    it("el Owner vende más de lo que hay (vender sin stock): la venta se descuenta y avisa que quedó en negativo", async () => {
      const { registrarVentaAction } = await import("./actions");
      sesion = f.owner;
      const antes = await stock();
      const cantidad = antes + 3;

      const res = await registrarVentaAction(f.sucursalId, venta(cantidad));

      expect(res.ok).toBe(true);
      if (!res.ok) throw new Error("inalcanzable");
      expect(await stock()).toBe(-3);
      expect(res.data.avisosStock).toEqual([
        { productoId, mensaje: expect.stringMatching(/quedó en negativo: -3/) },
      ]);
    });

    it("el stock por producto de la sucursal llega entero, incluido el producto sin movimientos (0)", async () => {
      const { listarStockPorSucursal } = await import("@/modules/productos/actions");
      const res = await listarStockPorSucursal(f.owner, f.tenantId, f.sucursalId);
      expect(res.ok).toBe(true);
      if (!res.ok) throw new Error("inalcanzable");
      const porId = new Map(res.data.map((s) => [s.productoId, s.cantidadActual]));
      expect(porId.get(productoId)).toBe(await stock());
      expect(porId.get(productoSinMovimientosId)).toBe(0);

      // Sin permiso de ver inventario no hay número que mostrar (y la pantalla no inventa uno).
      await expect(listarStockPorSucursal(f.colaborador, f.tenantId, f.sucursalId)).resolves.toEqual({
        ok: false,
        error: "No tenés permiso para ver el stock.",
      });
    });
  });

  describe("Ajuste de venta — registrarAjusteVentaAction", () => {
    async function ventaDelOwner() {
      const { registrarVentaAction } = await import("./actions");
      sesion = f.owner;
      const res = await registrarVentaAction(f.sucursalId, venta(1));
      if (!res.ok) throw new Error(res.error);
      return res.data.ventaId;
    }

    const devolucion = { tipo: "devolucion", montoAjuste: -5, productoId: "", cantidadProductoAjustada: 1, motivo: "Devolvió" };

    it("colaborador sin permiso de inventario: el ajuste queda y la acción avisa que el stock no volvió", async () => {
      const { registrarAjusteVentaAction } = await import("./actions");
      const ventaId = await ventaDelOwner();
      sesion = f.colaborador;
      const antes = await stock();

      const res = await registrarAjusteVentaAction(ventaId, { ...devolucion, productoId });

      expect(res.ok).toBe(true);
      if (!res.ok) throw new Error("inalcanzable");
      expect(res.data.errorStock).toMatch(/El ajuste quedó registrado, pero el stock no volvió: No tenés permiso para ajustar stock/);
      expect(await stock()).toBe(antes);
    });

    it("control: el Owner registra la misma devolución y no hay aviso, el stock vuelve", async () => {
      const { registrarAjusteVentaAction } = await import("./actions");
      const ventaId = await ventaDelOwner();
      const antes = await stock();

      const res = await registrarAjusteVentaAction(ventaId, { ...devolucion, productoId });

      expect(res.ok).toBe(true);
      if (!res.ok) throw new Error("inalcanzable");
      expect(res.data.errorStock).toBeNull();
      expect(await stock()).toBe(antes + 1);
    });
  });
});
