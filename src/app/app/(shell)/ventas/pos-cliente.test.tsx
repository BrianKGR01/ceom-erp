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

const sinVariante = { grupoVariantes: null, etiquetaVariante: null, alVender: false };

function renderPos(
  props: Partial<React.ComponentProps<typeof PosCliente>> = {}
) {
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
          ...sinVariante,
        },
      ]}
      modificadoresPorProducto={{}}
      categorias={[]}
      clientesIniciales={[]}
      canalesIniciales={[{ id: "canal-1", nombre: "Local físico" }]}
      metodosIniciales={[]}
      eventosIniciales={[]}
      {...props}
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

/**
 * Roadmap Cafiatto, Fase 3 — variantes y modificadores en el punto de venta.
 * El servidor vuelve a validar y a calcular todo; acá se afirma lo que la
 * pantalla arma y manda: una tarjeta por grupo de variantes, el precio con los
 * extras y los ids de modificadores en la linea.
 */
describe("Punto de venta — variantes y modificadores", () => {
  const latte = (id: string, etiqueta: string, precio: string) => ({
    id,
    categoriaId: null,
    nombre: `Latte ${etiqueta}`,
    imagenUrl: null,
    unidadVenta: "unidad",
    precioVenta: precio,
    costoOperativoVigente: null,
    grupoVariantes: "Latte",
    etiquetaVariante: etiqueta,
    alVender: true,
  });
  const grupos = {
    "latte-12": [
      {
        id: "g-leche",
        nombre: "Leche",
        seleccion: "una" as const,
        opciones: [
          { id: "m-entera", nombre: "Entera", tipo: "indicacion" as const, esBase: true, precioExtra: 0 },
          { id: "m-almendra", nombre: "Almendra", tipo: "reemplaza" as const, esBase: false, precioExtra: 4 },
        ],
      },
      {
        id: "g-extras",
        nombre: "Extras",
        seleccion: "varias" as const,
        opciones: [{ id: "m-shot", nombre: "Shot", tipo: "agrega" as const, esBase: false, precioExtra: 5 }],
      },
    ],
  };

  beforeEach(() => {
    registrarVentaAction.mockReset();
    push.mockReset();
    registrarVentaAction.mockResolvedValue({
      ok: true,
      data: { ventaId: "venta-1", totalVenta: 29, avisosStock: [] },
    });
  });

  it("las variantes del mismo grupo son UNA tarjeta, con el precio 'desde'", () => {
    renderPos({
      productos: [latte("latte-12", "12 oz", "20"), latte("latte-16", "16 oz", "26")],
      modificadoresPorProducto: grupos,
    });
    expect(screen.getAllByText("Latte")).toHaveLength(1);
    expect(screen.queryByText("Latte 12 oz")).toBeNull();
    expect(screen.getByText(/desde/)).toBeInTheDocument();
  });

  it("el precio de la hoja suma los extras y la linea viaja con sus modificadores", async () => {
    renderPos({
      productos: [latte("latte-12", "12 oz", "20")],
      modificadoresPorProducto: grupos,
    });
    fireEvent.click(screen.getByText("Latte 12 oz"));
    expect(screen.getByRole("button", { name: /Agregar · Bs 20.00/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Almendra/ }));
    fireEvent.click(screen.getByRole("button", { name: /Shot/ }));
    // 20 + 4 + 5
    fireEvent.click(screen.getByRole("button", { name: /Agregar · Bs 29.00/ }));

    expect(screen.getByText("Almendra · Shot")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar venta" }));
    await waitFor(() => expect(registrarVentaAction).toHaveBeenCalledTimes(1));
    const [, entrada] = registrarVentaAction.mock.calls[0];
    expect(entrada.lineas).toEqual([
      { productoId: "latte-12", cantidad: 1, modificadorIds: ["m-almendra", "m-shot"], observacion: undefined },
    ]);
  });

  it("el mismo producto con otros modificadores es otra linea; con los mismos, suma cantidad", () => {
    renderPos({
      productos: [latte("latte-12", "12 oz", "20")],
      modificadoresPorProducto: grupos,
    });
    const agregar = (nombre: RegExp, texto: RegExp) => {
      // La tarjeta va antes que el carrito en el DOM; el carrito repite el nombre.
      fireEvent.click(screen.getAllByText("Latte 12 oz")[0]);
      if (nombre) fireEvent.click(screen.getByRole("button", { name: nombre }));
      fireEvent.click(screen.getByRole("button", { name: texto }));
    };
    agregar(/Shot/, /Agregar · Bs 25.00/);
    agregar(/Shot/, /Agregar · Bs 25.00/); // mismas opciones -> misma linea (cantidad 2)
    agregar(/Almendra/, /Agregar · Bs 24.00/); // otras opciones -> otra linea

    expect(screen.getByText("Shot")).toBeInTheDocument();
    expect(screen.getByText("Almendra")).toBeInTheDocument();
    expect(screen.getByText("50.00")).toBeInTheDocument(); // 2 x 25
    expect(screen.getByText("24.00")).toBeInTheDocument();
  });

  it("un producto que se prepara al vender no avisa 'sin stock' ni 'sin costo'", () => {
    renderPos({
      stockPorProducto: {},
      productos: [latte("latte-12", "12 oz", "20")],
      modificadoresPorProducto: {},
    });
    // Sin opciones: se agrega directo al tocar.
    fireEvent.click(screen.getByText("Latte 12 oz"));
    expect(screen.getByText("Tu venta")).toBeInTheDocument();
    expect(screen.queryByText(/no tiene costo cargado/)).toBeNull();
    expect(screen.queryByText(/stock/i)).toBeNull();
  });
});

/**
 * Roadmap Cafiatto, Fase 4 — con la caja activa y exigida, sin turno abierto no se
 * confirma la venta (el servidor lo vuelve a exigir: esto evita el viaje de ida y vuelta).
 */
describe("Punto de venta — caja y turnos", () => {
  beforeEach(() => {
    registrarVentaAction.mockReset();
    push.mockReset();
  });

  it("sin turno abierto avisa, ofrece abrirlo y no manda la venta", () => {
    renderPos({ caja: { exigirTurno: true, turnoNumero: null, cajaNombre: "Caja Principal" } });
    expect(screen.getByRole("alert")).toHaveTextContent("No hay un turno abierto en Caja Principal.");
    expect(screen.getByRole("link", { name: "Abrir turno" })).toHaveAttribute("href", "/app/caja");

    fireEvent.click(screen.getByText("Cuñapé"));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar venta" }));
    expect(registrarVentaAction).not.toHaveBeenCalled();
    expect(screen.getAllByRole("alert").some((a) => a.textContent?.includes("primero abrí el turno"))).toBe(true);
  });

  it("con turno abierto muestra cuál es y vende normal", async () => {
    registrarVentaAction.mockResolvedValue({ ok: true, data: { ventaId: "v-1", totalVenta: 6, avisosStock: [] } });
    renderPos({ caja: { exigirTurno: true, turnoNumero: 31, cajaNombre: "Caja Principal" } });
    expect(screen.getByText("Caja Principal · Turno #31 abierto")).toBeInTheDocument();
    expect(screen.queryByText(/No hay un turno abierto/)).toBeNull();

    fireEvent.click(screen.getByText("Cuñapé"));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar venta" }));
    await waitFor(() => expect(registrarVentaAction).toHaveBeenCalledTimes(1));
  });

  it("con la caja apagada no aparece nada de turnos", () => {
    renderPos({ caja: null });
    expect(screen.queryByText(/Turno/)).toBeNull();
  });
});
