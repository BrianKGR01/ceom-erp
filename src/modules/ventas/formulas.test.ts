import { describe, expect, it } from "vitest";
import { calcularComision, calcularSubtotal } from "./actions";

describe("calcularSubtotal", () => {
  it("cantidad x precio_venta_snapshot", () => {
    expect(calcularSubtotal(3, 25)).toBe(75);
  });
});

describe("calcularComision", () => {
  it("total x (porcentaje / 100)", () => {
    expect(calcularComision(1000, 20)).toBe(200);
  });

  it("null si no hay porcentaje aplicable (ni canal ni evento lo definen)", () => {
    expect(calcularComision(1000, null)).toBeNull();
  });

  it("0 es un porcentaje valido, no lo mismo que null", () => {
    expect(calcularComision(1000, 0)).toBe(0);
  });
});
