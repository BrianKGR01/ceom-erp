import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Ventas duplicadas (informe del 2026-09-23): después de guardar la venta, el
 * punto de venta volvía a habilitar "Confirmar venta" y recién entonces
 * navegaba a la ficha, sin vaciar el carrito. En los 2-4 s que tarda esa
 * navegación la pantalla quedaba igual que antes de confirmar, y la cajera
 * volvía a tocar: 13 ventas duplicadas en 3 días.
 *
 * El test congela la navegación (`router.push` no hace nada, como una ficha
 * que todavía no llegó) y afirma que en ese estado no se puede confirmar otra
 * vez: la acción del servidor se llama UNA sola vez aunque se toque de nuevo.
 */
const { registrarVentaAction, push } = vi.hoisted(() => ({
  registrarVentaAction: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("./actions", () => ({
  registrarVentaAction,
  crearCanalVentaAction: vi.fn(),
  crearMetodoPagoAction: vi.fn(),
}));

import { PosCliente } from "./pos-cliente";

function renderPos() {
  return render(
    <PosCliente
      sucursalId="suc-1"
      stockPorProducto={{ "prod-1": 10 }}
      productos={[
        {
          id: "prod-1",
          categoriaId: null,
          nombre: "Cuñapé",
          imagenUrl: null,
          unidadVenta: "unidad",
          precioVenta: "6",
          costoOperativoVigente: "2",
        },
      ]}
      categorias={[]}
      clientesIniciales={[]}
      canalesIniciales={[{ id: "canal-1", nombre: "Local físico" }]}
      metodosIniciales={[]}
      eventosIniciales={[]}
    />
  );
}

describe("Punto de venta — no se puede confirmar dos veces", () => {
  beforeEach(() => {
    registrarVentaAction.mockReset();
    push.mockReset();
    registrarVentaAction.mockResolvedValue({
      ok: true,
      data: { ventaId: "venta-1", totalVenta: 6, avisosStock: [] },
    });
  });

  it("después de guardar: carrito vacío, aviso de venta registrada y ninguna segunda venta aunque se toque de nuevo", async () => {
    renderPos();
    fireEvent.click(screen.getByText("Cuñapé"));
    const confirmar = screen.getByRole("button", { name: "Confirmar venta" });

    fireEvent.click(confirmar);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/app/ventas/venta-1"));

    // La navegación "no llegó" todavía: es la ventana del incidente.
    expect(screen.getByRole("status")).toHaveTextContent("Venta registrada. Abriendo el detalle…");
    expect(screen.queryByRole("button", { name: "Confirmar venta" })).toBeNull();
    expect(screen.getByText("Tocá un producto para agregarlo acá.")).toBeInTheDocument();

    // Aunque el botón viejo siguiera en el DOM, otro clic no puede disparar otra venta.
    fireEvent.click(confirmar);
    expect(registrarVentaAction).toHaveBeenCalledTimes(1);
  });

  it("si el servidor rechaza la venta, se puede corregir y volver a confirmar", async () => {
    registrarVentaAction.mockResolvedValueOnce({ ok: false, error: "Elegí un canal de venta." });
    renderPos();
    fireEvent.click(screen.getByText("Cuñapé"));

    fireEvent.click(screen.getByRole("button", { name: "Confirmar venta" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Elegí un canal de venta."));

    const confirmar = screen.getByRole("button", { name: "Confirmar venta" });
    expect(confirmar).not.toBeDisabled();
    fireEvent.click(confirmar);
    await waitFor(() => expect(registrarVentaAction).toHaveBeenCalledTimes(2));
  });
});
