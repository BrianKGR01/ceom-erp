import { describe, expect, it } from "vitest";
import { calcularCostoUnitario } from "./actions";

describe("calcularCostoUnitario", () => {
  it("monto_total / cantidad", () => {
    expect(calcularCostoUnitario(100, 4)).toBe(25);
  });

  it("acepta strings numericos (como vienen de Postgres numeric)", () => {
    expect(calcularCostoUnitario("150.50", "5")).toBe(30.1);
  });

  it("roadmap #12: prorratea costoAdicionalTraslado (Landed Cost simple)", () => {
    expect(calcularCostoUnitario(100, 10, 20)).toBe(12);
  });

  it("roadmap #12: sin costoAdicionalTraslado equivale a la formula original", () => {
    expect(calcularCostoUnitario(100, 10, null)).toBe(10);
  });
});
