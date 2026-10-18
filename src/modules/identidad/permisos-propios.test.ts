import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { crearFixturePermisosCruzados, type FixturePermisosCruzados } from "@/test-utils/fixture-permisos-cruzados";
import { permisosPropios } from "./actions";

const hasPostgres = Boolean(process.env.DATABASE_URL);
vi.setConfig({ testTimeout: 40_000, hookTimeout: 60_000 });

describe.skipIf(!hasPostgres)("permisosPropios", () => {
  let f: FixturePermisosCruzados;
  beforeAll(async () => {
    f = await crearFixturePermisosCruzados("permisos-propios", [
      ["ventas", "ver"],
      ["ventas", "crear"],
      ["productos", "ver"],
    ]);
  });
  afterAll(async () => {
    await f?.limpiar();
  });

  it("el dueño lo tiene todo; el colaborador, exactamente los de su rol", async () => {
    expect(await permisosPropios(f.owner)).toEqual({ todos: true, permitidos: [] });
    const c = await permisosPropios(f.colaborador);
    expect(c.todos).toBe(false);
    expect([...c.permitidos].sort()).toEqual(["productos.ver", "ventas.crear", "ventas.ver"]);
  });
});
