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

  it("el costo extra de los ajustes de compra RESTA (H-31)", () => {
    expect(calcularEstadoResultados(1000, 400, 200, -50, 70)).toBe(280);
  });

  it("sin ajustes de compra da lo mismo que antes de H-31", () => {
    expect(calcularEstadoResultados(1000, 400, 200, -50, 0)).toBe(
      calcularEstadoResultados(1000, 400, 200, -50)
    );
  });

  // La red de seguridad estructural: aunque llegara un valor negativo (un
  // agregado mal firmado aguas arriba), NO puede sumarle al resultado. Es la
  // clase de error que ya costo H-30 y H-24 — un costo inflando la utilidad.
  it("un ajuste de compra nunca puede subir el resultado, ni con un monto negativo", () => {
    const sinAjustes = calcularEstadoResultados(1000, 400, 200, -50);
    expect(calcularEstadoResultados(1000, 400, 200, -50, -999)).toBe(sinAjustes);
    for (const monto of [-1, 0, 1, 500]) {
      expect(calcularEstadoResultados(1000, 400, 200, -50, monto)).toBeLessThanOrEqual(
        sinAjustes
      );
    }
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
