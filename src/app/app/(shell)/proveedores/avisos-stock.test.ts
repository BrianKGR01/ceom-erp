import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import type { UsuarioConRol } from "@/modules/identidad/repository";
import { consultarStock } from "@/modules/productos/actions";
import { productos } from "@/modules/productos/schema";
import { crearFixturePermisosCruzados, type FixturePermisosCruzados } from "@/test-utils/fixture-permisos-cruzados";

/**
 * R-3.2 / DA-24 — el aviso de stock de una compra llega a la pantalla.
 *
 * Desde el incidente de pool del 2026-09-17 la entrada de stock corre DESPUÉS
 * del commit de la compra: una compra recibida sin stock ya no se revierte
 * nunca. Si además el aviso se descarta en la Server Action de la ruta, ese
 * estado es permanente e invisible. Estos tests llaman a las Server Actions
 * reales (la capa que antes lo tiraba), con la sesión simulada.
 *
 * El escenario es el disparador documentado: un colaborador con permiso de
 * proveedores y SIN permiso de inventario. El caso Owner es el control: sin él,
 * un `errorStock` que viniera siempre lleno pasaría el test (dev-practices §6.1 b).
 */
const hasPostgres = Boolean(process.env.DATABASE_URL);

let sesion: UsuarioConRol | null = null;
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/modules/identidad/actions", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/modules/identidad/actions")>();
  return { ...original, obtenerUsuarioActual: async () => sesion };
});

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

describe.skipIf(!hasPostgres)("R-3.2 — Compras: el problema de stock no se descarta", () => {
  let f: FixturePermisosCruzados;
  let productoId: string;

  beforeAll(async () => {
    f = await crearFixturePermisosCruzados("compras", [
      ["proveedores", "ver"],
      ["proveedores", "crear"],
    ]);
    const [producto] = await db
      .insert(productos)
      .values({ tenantId: f.tenantId, nombre: "Café en grano", unidadVenta: "unidad", precioVenta: "50" })
      .returning();
    productoId = producto.id;
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

  const compra = (estado: "recibido" | "pedido") => ({
    tipo: "reventa",
    productoId,
    cantidad: 4,
    montoTotal: 40,
    fechaCompra: "2026-09-17",
    estado,
  });

  it("registrar compra recibida SIN permiso de inventario: la compra queda y la acción devuelve el aviso", async () => {
    const { registrarCompraAction } = await import("./actions");
    sesion = f.colaborador;
    const antes = await stock();

    const res = await registrarCompraAction({ ...compra("recibido"), sucursalId: f.sucursalId });

    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("inalcanzable");
    expect(res.data.errorStock).toMatch(/La compra quedó registrada, pero el stock no entró/);
    expect(res.data.errorStock).toMatch(/No tenés permiso para registrar entradas de stock/);
    expect(await stock()).toBe(antes);
  });

  it("control: el Owner registra la misma compra y no hay aviso, el stock entra", async () => {
    const { registrarCompraAction } = await import("./actions");
    sesion = f.owner;
    const antes = await stock();

    const res = await registrarCompraAction({ ...compra("recibido"), sucursalId: f.sucursalId });

    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("inalcanzable");
    expect(res.data.errorStock).toBeNull();
    expect(await stock()).toBe(antes + 4);
  });

  it("recibir una compra en pedido SIN permiso de inventario: queda recibida y la acción devuelve el aviso", async () => {
    const { recibirCompraAction, registrarCompraAction } = await import("./actions");
    sesion = f.colaborador;
    const creada = await registrarCompraAction({ ...compra("pedido"), sucursalId: f.sucursalId });
    expect(creada.ok).toBe(true);
    if (!creada.ok) throw new Error("inalcanzable");
    // Una compra en pedido no dispara stock: no hay nada que avisar todavía.
    expect(creada.data.errorStock).toBeNull();
    const antes = await stock();

    const res = await recibirCompraAction(creada.data.compraId, { fechaRecepcion: "2026-09-17" });

    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("inalcanzable");
    expect(res.data.errorStock).toMatch(/La compra quedó recibida, pero el stock no entró/);
    expect(await stock()).toBe(antes);
  });

  it("control: el Owner recibe una compra en pedido y no hay aviso, el stock entra", async () => {
    const { recibirCompraAction, registrarCompraAction } = await import("./actions");
    sesion = f.owner;
    const creada = await registrarCompraAction({ ...compra("pedido"), sucursalId: f.sucursalId });
    if (!creada.ok) throw new Error(creada.error);
    const antes = await stock();

    const res = await recibirCompraAction(creada.data.compraId, { fechaRecepcion: "2026-09-17" });

    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("inalcanzable");
    expect(res.data.errorStock).toBeNull();
    expect(await stock()).toBe(antes + 4);
  });
});
