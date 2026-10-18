import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

let ruta = "/app";
vi.mock("next/navigation", () => ({
  usePathname: () => ruta,
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/lib/supabase/actions", () => ({ cerrarSesion: vi.fn() }));

import { AppShell } from "./app-shell";

const cajero = {
  todos: false,
  permitidos: ["ventas.ver", "ventas.crear", "productos.ver", "inventario.ver"],
};

function montar(props: Partial<React.ComponentProps<typeof AppShell>> = {}) {
  return render(
    <AppShell
      nombreCompleto="Ana Cajera"
      rolNombre="Cajero"
      tenantNombre="CAFIATTO"
      esOwner={false}
      nichoId="nicho_1"
      permisos={cajero}
      estadoAcceso="activo"
      fechaProximoPago={null}
      {...props}
    >
      <p>contenido de la pantalla</p>
    </AppShell>
  );
}

describe("AppShell — menu y bloqueo por permisos", () => {
  afterEach(cleanup);

  it("el cajero ve Ventas, Catalogo y Caja, y no ve Produccion, Gastos ni Reportes", () => {
    ruta = "/app/ventas";
    montar();
    expect(screen.getAllByText("Ventas").length).toBeGreaterThan(0);
    expect(screen.getByText("Catálogo")).toBeTruthy();
    expect(screen.getByText("Caja")).toBeTruthy();
    expect(screen.queryByText("Producción")).toBeNull();
    expect(screen.queryByText("Gastos")).toBeNull();
    expect(screen.queryByText("Reportes")).toBeNull();
  });

  it("un modulo muestra solo las opciones permitidas", () => {
    // Con solo operativo.ver: Produccion aparece, pero sin Resumen (que tambien pide ventas.ver).
    ruta = "/app/produccion";
    montar({ permisos: { todos: false, permitidos: ["operativo.ver"] } });
    expect(screen.getByText("Insumos")).toBeTruthy();
    expect(screen.queryByText("Resumen")).toBeNull();
  });

  it("en una pantalla sin permiso muestra el aviso grande con Volver y no el contenido", () => {
    ruta = "/app/produccion/insumos";
    montar();
    expect(screen.getByText("No podés entrar acá")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Volver atrás" })).toBeTruthy();
    expect(screen.queryByText("contenido de la pantalla")).toBeNull();
  });

  it("en una pantalla permitida muestra el contenido", () => {
    ruta = "/app/caja";
    montar();
    expect(screen.getByText("contenido de la pantalla")).toBeTruthy();
    expect(screen.queryByText("No podés entrar acá")).toBeNull();
  });

  it("el dueño lo ve todo", () => {
    ruta = "/app/produccion/bajas";
    montar({ esOwner: true, permisos: { todos: true, permitidos: [] } });
    expect(screen.getByText("contenido de la pantalla")).toBeTruthy();
    expect(screen.getByText("Producción")).toBeTruthy();
    expect(screen.getByText("Gastos")).toBeTruthy();
  });
});
