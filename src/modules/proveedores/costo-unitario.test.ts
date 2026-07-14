import { describe, expect, it } from "vitest";
import { calcularCostoUnitario } from "./actions";

describe("calcularCostoUnitario", () => {
  it("monto_total / cantidad", () => {
    expect(calcularCostoUnitario(100, 4)).toBe(25);
  });

  it("acepta strings numericos (como vienen de Postgres numeric)", () => {
    expect(calcularCostoUnitario("150.50", "5")).toBe(30.1);
  });
});
