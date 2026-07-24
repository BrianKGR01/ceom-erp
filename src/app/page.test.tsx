import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.hoisted: vi.mock se eleva por encima de las declaraciones del modulo, y
// sin esto las fabricas leerian los const antes de inicializarse.
const { redirect, obtenerUsuarioActual } = vi.hoisted(() => ({
  // El redirect real de Next corta la ejecucion lanzando. Replicarlo es lo
  // que hace que el test note si la pagina siguiera ejecutando despues.
  redirect: vi.fn((destino: string) => {
    throw new Error(`REDIRECT:${destino}`);
  }),
  obtenerUsuarioActual: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/modules/identidad/actions", () => ({
  obtenerUsuarioActual,
  ROL_CEOM_ADMIN_ID: "rol-ceom-admin",
}));

// La landing se stubea: lo que se prueba aca es el reparto por rol, no su
// markup. Sin el stub el test arrastraria lucide-react, next/image y base-ui
// sin necesidad.
vi.mock("@/components/landing/landing", () => ({
  Landing: () => null,
}));

import { Landing } from "@/components/landing/landing";
import Home from "./page";

/** Corre la pagina y distingue los dos desenlaces posibles: redirigir (con
 *  sesion) o devolver markup (sin sesion). */
async function correr(): Promise<{ destino: string | null; markup: unknown }> {
  try {
    return { destino: null, markup: await Home() };
  } catch (error) {
    return { destino: (error as Error).message.replace("REDIRECT:", ""), markup: null };
  }
}

describe("/ (landing publica + destino por defecto de los enlaces de Auth)", () => {
  beforeEach(() => {
    redirect.mockClear();
  });

  it("sin sesion muestra la landing y no redirige a ningun lado", async () => {
    obtenerUsuarioActual.mockResolvedValue(null);

    const { destino, markup } = await correr();

    expect(destino).toBeNull();
    expect(redirect).not.toHaveBeenCalled();
    // Es la landing lo que se renderiza, no cualquier markup.
    expect((markup as { type: unknown }).type).toBe(Landing);
  });

  it("manda a /app a un usuario de un tenant", async () => {
    obtenerUsuarioActual.mockResolvedValue({ rolId: "rol-cualquiera" });
    expect((await correr()).destino).toBe("/app");
  });

  it("manda a /admin a un ceom_admin", async () => {
    obtenerUsuarioActual.mockResolvedValue({ rolId: "rol-ceom-admin" });
    expect((await correr()).destino).toBe("/admin");
  });

  it("con sesion nunca renderiza la landing — el desvio por rol sigue mandando", async () => {
    for (const rolId of ["rol-cualquiera", "rol-ceom-admin"]) {
      redirect.mockClear();
      obtenerUsuarioActual.mockResolvedValue({ rolId });

      const { markup } = await correr();

      expect(markup).toBeNull();
      expect(redirect).toHaveBeenCalledTimes(1);
    }
  });
});
