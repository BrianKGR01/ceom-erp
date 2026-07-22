import { describe, expect, it } from "vitest";
import {
  ajusteVentaSchema,
  errorSignoAjuste,
  esTipoAjusteReductor,
  TIPOS_AJUSTE_REDUCTORES,
} from "./validation";

// H-30. El estado de resultados SUMA los ajustes
// (`ingresos - costos - gastos + ajustes`, financiero/actions.ts), asi que un
// ajuste que reduce la venta tiene que quedar guardado en negativo. Antes no
// se validaba en ningun lado.

const BASE = { motivo: "Motivo de prueba" };

describe("esTipoAjusteReductor", () => {
  it("devolucion, descuento_posterior y anulacion_total solo reducen", () => {
    for (const tipo of TIPOS_AJUSTE_REDUCTORES) {
      expect(esTipoAjusteReductor(tipo)).toBe(true);
    }
  });

  it("correccion es el unico bidireccional (Modulo_03 1.3: puede corregir un cobro de menos)", () => {
    expect(esTipoAjusteReductor("correccion")).toBe(false);
  });
});

describe("errorSignoAjuste", () => {
  it("rechaza un tipo reductor cargado en positivo — el caso que inflaba el resultado", () => {
    expect(errorSignoAjuste("anulacion_total", 500)).toMatch(/negativo/);
    expect(errorSignoAjuste("devolucion", 0.01)).toMatch(/negativo/);
    expect(errorSignoAjuste("descuento_posterior", 20)).toMatch(/negativo/);
  });

  it("acepta un tipo reductor en negativo", () => {
    for (const tipo of TIPOS_AJUSTE_REDUCTORES) {
      expect(errorSignoAjuste(tipo, -500)).toBeNull();
    }
  });

  it("acepta correccion en ambos sentidos", () => {
    expect(errorSignoAjuste("correccion", -30)).toBeNull();
    expect(errorSignoAjuste("correccion", 30)).toBeNull();
  });

  it("rechaza cero para cualquier tipo — un ajuste de 0 no significa nada", () => {
    expect(errorSignoAjuste("correccion", 0)).toMatch(/cero/);
    expect(errorSignoAjuste("devolucion", 0)).toMatch(/cero/);
  });

  it("rechaza NaN (llega de un Number('') en la UI)", () => {
    expect(errorSignoAjuste("correccion", Number(""))).not.toBeNull();
    expect(errorSignoAjuste("correccion", Number("abc"))).not.toBeNull();
  });
});

describe("ajusteVentaSchema", () => {
  it("rechaza la anulacion de 500 cargada como +500", () => {
    const r = ajusteVentaSchema.safeParse({
      ...BASE,
      tipo: "anulacion_total",
      montoAjuste: 500,
    });
    expect(r.success).toBe(false);
  });

  it("acepta la misma anulacion como -500", () => {
    const r = ajusteVentaSchema.safeParse({
      ...BASE,
      tipo: "anulacion_total",
      montoAjuste: -500,
    });
    expect(r.success).toBe(true);
  });

  it("acepta correccion positiva (se cobro de menos)", () => {
    const r = ajusteVentaSchema.safeParse({
      ...BASE,
      tipo: "correccion",
      montoAjuste: 45.5,
    });
    expect(r.success).toBe(true);
  });

  it("sigue exigiendo motivo", () => {
    const r = ajusteVentaSchema.safeParse({
      tipo: "devolucion",
      montoAjuste: -10,
      motivo: "   ",
    });
    expect(r.success).toBe(false);
  });
});
