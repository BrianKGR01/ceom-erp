import { describe, expect, it } from "vitest";
import {
  calcularImpactoProyectado,
  calcularMargenContribucionUnitario,
  calcularPrecioSugerido,
  unidadesParaCubrir,
} from "./actions";

describe("calcularPrecioSugerido", () => {
  it("costo / (1 - margen_deseado_pct/100)", () => {
    // costo 50, margen deseado 50% -> precio 100
    expect(calcularPrecioSugerido(50, 50)).toBe(100);
  });

  it("margen deseado bajo produce un precio cercano al costo", () => {
    expect(calcularPrecioSugerido(80, 20)).toBe(100);
  });
});

describe("calcularImpactoProyectado", () => {
  it("(precio_sugerido - precio_actual) x rotacion", () => {
    expect(calcularImpactoProyectado(120, 100, 30)).toBe(600);
  });

  it("precio sugerido menor al actual da impacto negativo", () => {
    expect(calcularImpactoProyectado(90, 100, 10)).toBe(-100);
  });
});

describe("calcularMargenContribucionUnitario", () => {
  it("precio_venta - costo_variable_unitario", () => {
    expect(calcularMargenContribucionUnitario(50, 30)).toBe(20);
  });
});

describe("unidadesParaCubrir", () => {
  it("monto_a_cubrir / margen_contribucion_unitario", () => {
    expect(unidadesParaCubrir(1000, 20)).toBe(50);
  });

  it("caso borde 2: margen de contribucion cero -> null", () => {
    expect(unidadesParaCubrir(1000, 0)).toBeNull();
  });

  it("caso borde 2: margen de contribucion negativo -> null", () => {
    expect(unidadesParaCubrir(1000, -5)).toBeNull();
  });

  it("caso borde 3: costo fijo total en cero es matematicamente valido (0)", () => {
    expect(unidadesParaCubrir(0, 20)).toBe(0);
  });
});
