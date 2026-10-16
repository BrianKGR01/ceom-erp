import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import type { UsuarioConRol } from "@/modules/identidad/repository";
import { registrarAjusteManualStock } from "@/modules/productos/actions";
import { productos } from "@/modules/productos/schema";
import { crearCanalVenta } from "@/modules/ventas/actions";
import { bonificacionesVenta, ventas } from "@/modules/ventas/schema";
import {
  crearFixturePermisosCruzados,
  type FixturePermisosCruzados,
} from "@/test-utils/fixture-permisos-cruzados";

/**
 * Roadmap Cafiatto, Fase 5 — por la Server Action real (con el esquema de validacion de la
 * ruta y la sesion simulada): la bonificacion llega al servidor, lo valida y exige la
 * capacidad del motivo. Mismo harness que `avisos-stock.test.ts`.
 */
const hasPostgres = Boolean(process.env.DATABASE_URL);

let sesion: UsuarioConRol | null = null;
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/modules/identidad/actions", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/modules/identidad/actions")>();
  return { ...original, obtenerUsuarioActual: async () => sesion };
});

vi.setConfig({ testTimeout: 40_000, hookTimeout: 60_000 });

describe.skipIf(!hasPostgres)("Vender — bonificación por la Server Action", () => {
  let f: FixturePermisosCruzados;
  let canalVentaId: string;
  let productoId: string;

  beforeAll(async () => {
    f = await crearFixturePermisosCruzados("bonif-ruta", [
      ["productos", "ver"],
      ["ventas", "ver"],
      ["ventas", "crear"],
      ["inventario", "crear"],
    ]);
    const canal = await crearCanalVenta(f.owner, f.tenantId, { nombre: "Local" });
    if (!canal.ok) throw new Error(canal.error);
    canalVentaId = canal.data.canalVentaId;
    const [p] = await db
      .insert(productos)
      .values({ tenantId: f.tenantId, nombre: "Café", unidadVenta: "unidad", precioVenta: "10" })
      .returning();
    productoId = p.id;
    const stock = await registrarAjusteManualStock(f.owner, f.tenantId, {
      productoId,
      sucursalId: f.sucursalId,
      tipo: "entrada_ajuste_manual",
      cantidad: 50,
      motivo: "Stock del test",
    });
    if (!stock.ok) throw new Error(stock.error);
  });

  afterAll(async () => {
    await f?.limpiar();
  });

  beforeEach(() => {
    sesion = null;
  });

  const venta = (bonificacion: unknown) => ({
    canalVentaId,
    lineas: [{ productoId, cantidad: 2 }],
    bonificacion,
  });
  const personal = { motivo: "consumo_personal", porcentaje: 100, beneficiario: "Ana Rojas" };

  it("el dueño bonifica: la venta vale 0 y queda registrada con su motivo", async () => {
    const { registrarVentaAction } = await import("./actions");
    sesion = f.owner;
    const res = await registrarVentaAction(f.sucursalId, venta(personal));
    if (!res.ok) throw new Error(res.error);
    expect(res.data.totalVenta).toBe(0);
    const [b] = await db.select().from(bonificacionesVenta).where(eq(bonificacionesVenta.ventaId, res.data.ventaId));
    expect(b).toMatchObject({ motivo: "consumo_personal", beneficiario: "Ana Rojas" });
    const [v] = await db.select().from(ventas).where(eq(ventas.id, res.data.ventaId));
    expect(v.estadoPago).toBe("pagado");
  });

  it("un cajero sin la capacidad no puede, aunque mande el campo a mano", async () => {
    const { registrarVentaAction } = await import("./actions");
    sesion = f.colaborador;
    const antes = (await db.select().from(ventas).where(eq(ventas.tenantId, f.tenantId))).length;

    const res = await registrarVentaAction(f.sucursalId, venta(personal));

    expect(res).toEqual({ ok: false, error: "No tenés permiso para bonificar como consumo del personal." });
    expect((await db.select().from(ventas).where(eq(ventas.tenantId, f.tenantId))).length).toBe(antes);
  });

  it("datos inválidos se rechazan en la ruta antes de llegar al módulo", async () => {
    const { registrarVentaAction } = await import("./actions");
    sesion = f.owner;
    const malo = await registrarVentaAction(f.sucursalId, venta({ ...personal, porcentaje: 0 }));
    expect(malo.ok).toBe(false);
    const otroMotivo = await registrarVentaAction(f.sucursalId, venta({ ...personal, motivo: "regalo" }));
    expect(otroMotivo.ok).toBe(false);
  });
});
