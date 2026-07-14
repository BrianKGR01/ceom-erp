import { describe, expect, it } from "vitest";
import { calcularValorActual } from "./actions";

describe("calcularValorActual", () => {
  it("sin vida_util_meses no deprecia (ej. un terreno)", () => {
    const valor = calcularValorActual({
      valorCompra: "10000",
      fechaAdquisicion: "2020-01-01",
      vidaUtilMeses: null,
    });
    expect(valor).toBe(10000);
  });

  it("recien adquirido: valor_actual es practicamente el valor de compra", () => {
    const ahora = new Date("2026-01-15T00:00:00Z");
    const valor = calcularValorActual(
      { valorCompra: "1200", fechaAdquisicion: "2026-01-01", vidaUtilMeses: "24" },
      ahora
    );
    expect(valor).toBe(1200);
  });

  it("depreciacion lineal a mitad de la vida util", () => {
    const ahora = new Date("2027-01-01T00:00:00Z");
    const valor = calcularValorActual(
      { valorCompra: "1200", fechaAdquisicion: "2026-01-01", vidaUtilMeses: "24" },
      ahora
    );
    // 12 de 24 meses transcurridos -> 50% del valor.
    expect(valor).toBe(600);
  });

  it("satura en 0 cuando el tiempo transcurrido supera la vida util (caso borde 5.2)", () => {
    const ahora = new Date("2030-01-01T00:00:00Z");
    const valor = calcularValorActual(
      { valorCompra: "1200", fechaAdquisicion: "2026-01-01", vidaUtilMeses: "24" },
      ahora
    );
    expect(valor).toBe(0);
  });
});
