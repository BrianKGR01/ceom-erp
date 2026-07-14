import { describe, expect, it } from "vitest";
import { calcularEstadoResultados, calcularFlujoCaja, calcularMargenPorcentaje } from "./actions";

describe("calcularFlujoCaja", () => {
  it("pagos de venta menos pagos de compra menos pagos de gasto", () => {
    expect(calcularFlujoCaja(1000, 300, 200)).toBe(500);
  });
});

describe("calcularEstadoResultados", () => {
  it("ingresos - costos - gastos + ajustes", () => {
    expect(calcularEstadoResultados(1000, 400, 200, -50)).toBe(350);
  });
});

describe("calcularMargenPorcentaje", () => {
  it("(ingresos_ajustados - costos) / ingresos_ajustados x 100", () => {
    expect(calcularMargenPorcentaje(200, 80)).toBe(60);
  });

  it("null si no hubo ingresos en el periodo (evita division por 0)", () => {
    expect(calcularMargenPorcentaje(0, 0)).toBeNull();
  });
});
