import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CambiarContrasenaForm } from "./cambiar-contrasena-form";

vi.mock("./actions", () => ({ cambiarContrasena: vi.fn() }));

import { cambiarContrasena } from "./actions";

function completarYEnviar() {
  fireEvent.change(screen.getByLabelText(/contraseña actual/i), {
    target: { value: "laVieja123" },
  });
  fireEvent.change(screen.getByLabelText(/^contraseña nueva$/i), {
    target: { value: "unaClaveLarga1" },
  });
  fireEvent.change(screen.getByLabelText(/repetí la contraseña nueva/i), {
    target: { value: "unaClaveLarga1" },
  });
  fireEvent.click(screen.getByRole("button", { name: /guardar contraseña/i }));
}

describe("CambiarContrasenaForm", () => {
  it("pide la contraseña actual — acá no hay token de correo que pruebe nada", () => {
    render(<CambiarContrasenaForm />);
    expect(screen.getByLabelText(/contraseña actual/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^contraseña nueva$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/repetí la contraseña nueva/i)).toBeInTheDocument();
  });

  it("confirma el cambio sin sacar a la persona de lo que estaba haciendo", async () => {
    vi.mocked(cambiarContrasena).mockResolvedValue({
      ok: true,
      mensaje: "Listo, tu contraseña quedó cambiada.",
    });

    render(<CambiarContrasenaForm />);
    completarYEnviar();

    expect(await screen.findByRole("status")).toHaveTextContent(/quedó cambiada/i);
    // El formulario sigue en pantalla: es una pagina de la app, no un paso
    // de un flujo del que haya que salir.
    expect(screen.getByRole("button", { name: /guardar contraseña/i })).toBeInTheDocument();
  });

  it("muestra el rechazo cuando la contraseña actual no es la correcta", async () => {
    vi.mocked(cambiarContrasena).mockResolvedValue({
      ok: false,
      error: "Esa no es tu contraseña actual.",
    });

    render(<CambiarContrasenaForm />);
    completarYEnviar();

    expect(await screen.findByRole("alert")).toHaveTextContent("Esa no es tu contraseña actual.");
  });
});
