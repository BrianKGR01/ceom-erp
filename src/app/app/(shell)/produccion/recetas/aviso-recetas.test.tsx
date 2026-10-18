import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AvisoRecetas } from "./aviso-recetas";

describe("AvisoRecetas", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(cleanup);

  it("se muestra la primera vez y se cierra con la X", () => {
    render(<AvisoRecetas />);
    expect(screen.getByText(/Revisen las recetas/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar aviso" }));
    expect(screen.queryByText(/Revisen las recetas/)).toBeNull();
  });

  it("recuerda que ya se cerró en este navegador", () => {
    window.localStorage.setItem("ceom:aviso-recetas-al-vender:v1", "1");
    render(<AvisoRecetas />);
    expect(screen.queryByText(/Revisen las recetas/)).toBeNull();
  });
});
