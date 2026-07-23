import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DefinirContrasenaForm } from "./definir-contrasena-form";

vi.mock("./actions", () => ({ definirContrasena: vi.fn() }));

import { definirContrasena } from "./actions";

describe("DefinirContrasenaForm", () => {
  it("le habla al dueño invitado de crear su contraseña", () => {
    render(<DefinirContrasenaForm motivo="invitacion" />);
    expect(screen.getByRole("heading", { name: /creá tu contraseña/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /crear contraseña y entrar/i })
    ).toBeInTheDocument();
  });

  it("le habla de elegir una nueva a quien la esta recuperando", () => {
    render(<DefinirContrasenaForm motivo="recuperacion" />);
    expect(
      screen.getByRole("heading", { name: /elegí una contraseña nueva/i })
    ).toBeInTheDocument();
  });

  it("pide la contraseña dos veces, con labels accesibles", () => {
    render(<DefinirContrasenaForm motivo="invitacion" />);
    expect(screen.getByLabelText(/contraseña nueva/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/repetí la contraseña/i)).toBeInTheDocument();
  });

  it("nunca pide la contraseña actual — el token del correo ya probo la identidad", () => {
    render(<DefinirContrasenaForm motivo="recuperacion" />);
    expect(screen.queryByLabelText(/contraseña actual/i)).not.toBeInTheDocument();
  });

  it("muestra el error que devuelve la Server Action", async () => {
    vi.mocked(definirContrasena).mockResolvedValue({
      ok: false,
      error: "Las dos contraseñas no coinciden.",
    });

    render(<DefinirContrasenaForm motivo="invitacion" />);
    fireEvent.change(screen.getByLabelText(/contraseña nueva/i), {
      target: { value: "unaClaveLarga1" },
    });
    fireEvent.change(screen.getByLabelText(/repetí la contraseña/i), {
      target: { value: "otraClaveLarga1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /crear contraseña y entrar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Las dos contraseñas no coinciden."
    );
  });
});
