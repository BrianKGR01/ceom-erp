import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { crearFixturePermisosCruzados, type FixturePermisosCruzados } from "@/test-utils/fixture-permisos-cruzados";
import { actualizarProducto } from "./actions";
import { productos } from "./schema";

/**
 * Reporte de CAFIATTO (2026-09-23): "tengo este mensaje de error al querer
 * cambiar el precio". Los 15 cafés —productos con receta, cuyo costo calcula
 * la producción— no se podían editar en nada: ni precio, ni nombre, ni foto.
 *
 * El formulario mandaba el costo bloqueado junto con el resto, y la regla 2
 * del Módulo 2 ("el costo de un producto de producción no se edita a mano")
 * rechazaba cualquier guardado que TRAJERA un costo, aunque fuera el mismo.
 * La regla es correcta; lo que estaba mal era dispararla sin que el costo
 * cambiara. Estos tests fijan las dos mitades: el precio se puede cambiar, y
 * el costo sigue sin poder cambiarse a mano.
 */
const hasPostgres = Boolean(process.env.DATABASE_URL);
vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 });

describe.skipIf(!hasPostgres)("Productos — editar un producto con receta (regla 2)", () => {
  let f: FixturePermisosCruzados;
  let latteId: string;

  beforeAll(async () => {
    f = await crearFixturePermisosCruzados("editar-producto-receta", []);
    const [latte] = await db
      .insert(productos)
      .values({
        tenantId: f.tenantId,
        nombre: "LATTE",
        unidadVenta: "unidad",
        precioVenta: "12",
        costoOperativoVigente: "5.997",
        origenCosto: "nicho_sugerido",
        tipoOrigenProducto: "produccion_nicho",
      })
      .returning();
    latteId = latte.id;
  });

  afterAll(async () => {
    await f?.limpiar();
  });

  const leer = async () => {
    const [p] = await db.select().from(productos).where(eq(productos.id, latteId));
    return p;
  };

  it("cambiar el precio mandando el mismo costo que ya tenía se guarda (el caso del formulario)", async () => {
    const res = await actualizarProducto(f.owner, latteId, { precioVenta: 13, costoOperativoVigente: 5.997 });

    expect(res).toEqual({ ok: true, data: true });
    const p = await leer();
    expect(Number(p.precioVenta)).toBe(13);
    expect(Number(p.costoOperativoVigente)).toBe(5.997);
  });

  it("cambiar el precio sin mandar el costo se guarda", async () => {
    const res = await actualizarProducto(f.owner, latteId, { precioVenta: 14, nombre: "LATTE CLÁSICO" });

    expect(res).toEqual({ ok: true, data: true });
    const p = await leer();
    expect(Number(p.precioVenta)).toBe(14);
    expect(p.nombre).toBe("LATTE CLÁSICO");
  });

  it("intentar cambiar el costo a mano se sigue rechazando, y no se guarda nada de ese intento", async () => {
    const antes = await leer();

    const res = await actualizarProducto(f.owner, latteId, { precioVenta: 20, costoOperativoVigente: 3 });

    expect(res).toEqual({
      ok: false,
      error: "El costo operativo de un producto de producción no se edita a mano; lo actualiza el Módulo Operativo.",
    });
    const despues = await leer();
    expect(Number(despues.precioVenta)).toBe(Number(antes.precioVenta));
    expect(Number(despues.costoOperativoVigente)).toBe(5.997);
  });
});
