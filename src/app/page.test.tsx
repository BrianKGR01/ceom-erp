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

import Home from "./page";

/** Falla si la pagina devuelve markup en vez de redirigir. */
async function destinoDe(): Promise<string> {
  try {
    await Home();
  } catch (error) {
    return (error as Error).message.replace("REDIRECT:", "");
  }
  throw new Error("Home() no redirigio — volvio a renderizar contenido");
}

describe("/ (destino por defecto de los enlaces de Auth)", () => {
  beforeEach(() => {
    redirect.mockClear();
  });

  it("manda al login cuando no hay sesion", async () => {
    obtenerUsuarioActual.mockResolvedValue(null);
    expect(await destinoDe()).toBe("/login");
  });

  it("manda a /app a un usuario de un tenant", async () => {
    obtenerUsuarioActual.mockResolvedValue({ rolId: "rol-cualquiera" });
    expect(await destinoDe()).toBe("/app");
  });

  it("manda a /admin a un ceom_admin", async () => {
    obtenerUsuarioActual.mockResolvedValue({ rolId: "rol-ceom-admin" });
    expect(await destinoDe()).toBe("/admin");
  });

  it("siempre redirige — nunca renderiza el boilerplate de create-next-app", async () => {
    obtenerUsuarioActual.mockResolvedValue(null);
    await destinoDe();
    expect(redirect).toHaveBeenCalledTimes(1);
  });
});
