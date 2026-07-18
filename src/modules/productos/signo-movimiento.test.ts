import { describe, expect, it } from "vitest";
import { signoMovimiento } from "./actions";

describe("signoMovimiento", () => {
  it("entrada_* suma", () => {
    expect(signoMovimiento("entrada_produccion")).toBe(1);
    expect(signoMovimiento("entrada_compra_reventa")).toBe(1);
    expect(signoMovimiento("entrada_ajuste_manual")).toBe(1);
    expect(signoMovimiento("entrada_transferencia")).toBe(1);
  });

  it("salida_* resta", () => {
    expect(signoMovimiento("salida_venta")).toBe(-1);
    expect(signoMovimiento("salida_merma")).toBe(-1);
    expect(signoMovimiento("salida_ajuste_manual")).toBe(-1);
    expect(signoMovimiento("salida_transferencia")).toBe(-1);
  });
});
