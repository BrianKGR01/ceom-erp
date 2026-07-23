import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecuperarForm } from "./recuperar-form";

vi.mock("./actions", () => ({ solicitarRecuperacion: vi.fn() }));

import { solicitarRecuperacion } from "./actions";

const MENSAJE_GENERICO =
  "Si ese correo tiene una cuenta, te mandamos un enlace para crear una contraseña nueva.";

async function pedirEnlace(email: string) {
  render(<RecuperarForm />);
  fireEvent.change(screen.getByLabelText(/correo electrónico/i), { target: { value: email } });
  fireEvent.click(screen.getByRole("button", { name: /enviarme el enlace/i }));
}

describe("RecuperarForm", () => {
  it("pide el correo con un label accesible", () => {
    render(<RecuperarForm />);
    expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /volver a iniciar sesión/i })).toBeInTheDocument();
  });

  it("reemplaza el formulario por el acuse, para no invitar a reintentar", async () => {
    vi.mocked(solicitarRecuperacion).mockResolvedValue({ ok: true, mensaje: MENSAJE_GENERICO });

    await pedirEnlace("alguien@ceom.lat");

    expect(await screen.findByText(/revisá tu correo/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /enviarme el enlace/i })).not.toBeInTheDocument();
  });

  it("no revela si el correo existe: mismo acuse en los dos casos", async () => {
    vi.mocked(solicitarRecuperacion).mockResolvedValue({ ok: true, mensaje: MENSAJE_GENERICO });

    await pedirEnlace("no-existe@ceom.lat");
    const acuseDesconocido = (await screen.findByText(/si ese correo tiene una cuenta/i))
      .textContent;

    screen.getByRole("link", { name: /volver a iniciar sesión/i });
    expect(acuseDesconocido).toContain("Si ese correo tiene una cuenta");
    expect(acuseDesconocido).not.toMatch(/no encontramos|no existe|no está registrado/i);
  });

  it("muestra el aviso de cupo de envios sin ocultarlo tras el acuse", async () => {
    vi.mocked(solicitarRecuperacion).mockResolvedValue({
      ok: false,
      error: "Pediste varios enlaces seguidos. Esperá un minuto y volvé a intentar.",
    });

    await pedirEnlace("alguien@ceom.lat");

    expect(await screen.findByRole("alert")).toHaveTextContent(/esperá un minuto/i);
    expect(screen.getByRole("button", { name: /enviarme el enlace/i })).toBeInTheDocument();
  });
});
