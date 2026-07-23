import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CambiarContrasenaForm } from "./cambiar-contrasena-form";

vi.mock("./actions", () => ({ solicitarCambioDeContrasena: vi.fn() }));

import { solicitarCambioDeContrasena } from "./actions";

function pedirEnlace() {
  render(<CambiarContrasenaForm />);
  fireEvent.click(screen.getByRole("button", { name: /mandarme el enlace/i }));
}

describe("CambiarContrasenaForm", () => {
  it("no pide la contraseña actual ni una nueva — el cambio pasa por el correo", () => {
    render(<CambiarContrasenaForm />);
    expect(screen.queryByLabelText(/contraseña/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mandarme el enlace/i })).toBeInTheDocument();
  });

  it("confirma el envio y saca el boton, para no gastar el cupo de correos", async () => {
    vi.mocked(solicitarCambioDeContrasena).mockResolvedValue({
      ok: true,
      mensaje: "Te mandamos un enlace a alguien@ceom.lat.",
    });

    pedirEnlace();

    expect(await screen.findByRole("status")).toHaveTextContent(/te mandamos un enlace/i);
    expect(screen.queryByRole("button", { name: /mandarme el enlace/i })).not.toBeInTheDocument();
  });

  it("deja reintentar cuando el envio falla", async () => {
    vi.mocked(solicitarCambioDeContrasena).mockResolvedValue({
      ok: false,
      error: "Pediste varios enlaces seguidos. Esperá un minuto y volvé a intentar.",
    });

    pedirEnlace();

    expect(await screen.findByRole("alert")).toHaveTextContent(/esperá un minuto/i);
    expect(screen.getByRole("button", { name: /mandarme el enlace/i })).toBeInTheDocument();
  });
});
