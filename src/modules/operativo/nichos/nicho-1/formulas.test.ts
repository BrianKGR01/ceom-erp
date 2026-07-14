import { describe, expect, it } from "vitest";
import {
  calcularCapacidadProduccionPeriodo,
  calcularCostoOperativoProduccion,
  calcularCostoPromedioPonderado,
  calcularMerma,
  calcularPorcentajeCapacidadUsada,
  calcularRendimientoTeorico,
} from "./actions";

describe("calcularCostoPromedioPonderado", () => {
  it("promedia stock existente con la compra nueva (Modulo_06 seccion 3.1)", () => {
    // 10 unidades a 5 + 10 unidades a 7 -> promedio 6
    expect(calcularCostoPromedioPonderado(10, 5, 10, 7)).toBe(6);
  });

  it("primera compra (sin stock previo) usa el costo de compra tal cual", () => {
    expect(calcularCostoPromedioPonderado(0, null, 20, 8)).toBe(8);
  });
});

describe("calcularRendimientoTeorico", () => {
  it("rendimiento_por_lote x lotes / cantidad_base_consumida_por_unidad", () => {
    // receta rinde 3L por lote, 2 lotes -> 6L base; presentacion consume 0.1L -> 60 unidades
    expect(calcularRendimientoTeorico(3, 2, 0.1)).toBe(60);
  });
});

describe("calcularMerma", () => {
  it("diferencia entre teorico y real obtenido", () => {
    expect(calcularMerma(60, 55)).toBe(5);
  });

  it("nunca negativa", () => {
    expect(calcularMerma(60, 65)).toBe(0);
  });
});

describe("calcularCostoOperativoProduccion", () => {
  it("costo total de insumos / cantidad real obtenida (con merma incorporada)", () => {
    // mismo costo total de insumos, menos cantidad real -> costo por unidad sube
    expect(calcularCostoOperativoProduccion(600, 60)).toBe(10);
    expect(calcularCostoOperativoProduccion(600, 55)).toBeCloseTo(10.909, 3);
  });
});

describe("calcularCapacidadProduccionPeriodo", () => {
  it("escala disponibilidad semanal a la cantidad de semanas del periodo", () => {
    // 40h/semana, 1 semana, ciclo de 30 min, 2 unidades por ciclo
    // -> (40*60/30) ciclos = 80 ciclos * 2 = 160
    expect(calcularCapacidadProduccionPeriodo(40, 30, 2, 1)).toBe(160);
  });

  it("null si al Activo le falta algun dato de ciclo", () => {
    expect(calcularCapacidadProduccionPeriodo(null, 30, 2, 1)).toBeNull();
    expect(calcularCapacidadProduccionPeriodo(40, null, 2, 1)).toBeNull();
    expect(calcularCapacidadProduccionPeriodo(40, 30, null, 1)).toBeNull();
  });
});

describe("calcularPorcentajeCapacidadUsada", () => {
  it("uso real / capacidad total", () => {
    expect(calcularPorcentajeCapacidadUsada(50, 200)).toBe(0.25);
  });

  it("null si no hay capacidad total (evita division por 0)", () => {
    expect(calcularPorcentajeCapacidadUsada(50, null)).toBeNull();
    expect(calcularPorcentajeCapacidadUsada(50, 0)).toBeNull();
  });
});
