import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LoginForm } from "./login-form";

vi.mock("./actions", () => ({
  iniciarSesion: vi.fn(),
}));

import { iniciarSesion } from "./actions";

describe("LoginForm", () => {
  it("renderiza los campos con labels accesibles", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^contraseña$/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /iniciar sesión/i })
    ).toBeInTheDocument();
  });

  it("muestra el error cuando la Server Action devuelve ok:false", async () => {
    vi.mocked(iniciarSesion).mockResolvedValue({
      ok: false,
      error: "Correo o contraseña incorrectos.",
    });

    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
      target: { value: "test@ceom.lat" },
    });
    fireEvent.change(screen.getByLabelText(/^contraseña$/i), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Correo o contraseña incorrectos."
    );
  });

  it("alterna mostrar/ocultar contraseña", () => {
    render(<LoginForm />);
    const passwordInput = screen.getByLabelText(/^contraseña$/i) as HTMLInputElement;
    expect(passwordInput.type).toBe("password");

    fireEvent.click(screen.getByRole("button", { name: /mostrar contraseña/i }));
    expect(passwordInput.type).toBe("text");
  });
});
