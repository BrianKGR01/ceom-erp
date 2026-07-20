import { describe, expect, it } from "vitest";
import { formatFecha, formatMoneda } from "./format";

// Intl.NumberFormat con style:"currency" separa el codigo/simbolo de moneda
// del numero con un espacio de no-quiebre (U+00A0), no un espacio comun --
// se construye con fromCharCode para no depender de como se guarde un
// caracter invisible en el archivo fuente.
const NBSP = String.fromCharCode(160);

describe("formatMoneda", () => {
  it("formatea un monto positivo en BOB (default) con simbolo/codigo de moneda", () => {
    expect(formatMoneda(150)).toBe(["Bs", NBSP, "150,00"].join(""));
  });

  it("acepta un string numerico (los montos de la DB llegan como string)", () => {
    expect(formatMoneda("150.5")).toBe(["Bs", NBSP, "150,50"].join(""));
  });

  it("cero no se muestra vacio ni como guion -- es un monto real", () => {
    expect(formatMoneda(0)).toBe(["Bs", NBSP, "0,00"].join(""));
  });

  it("un monto negativo (ej. un margen o ajuste negativo) muestra el signo, no lo esconde", () => {
    expect(formatMoneda(-465.5)).toBe(["-Bs", NBSP, "465,50"].join(""));
  });

  it("un monto grande agrupa miles (no un numero pelado sin separador)", () => {
    expect(formatMoneda(1234567.899)).toBe(["Bs", NBSP, "1.234.567,90"].join(""));
  });

  it("respeta la moneda explicita del tenant/plan en vez de asumir BOB", () => {
    expect(formatMoneda(150, "USD")).toBe(["USD", NBSP, "150,00"].join(""));
  });
});

describe("formatFecha", () => {
  it("formatea con el patron corto default (dia/mes-abreviado/anio)", () => {
    expect(formatFecha("2026-07-20")).toBe("20 jul 2026");
  });

  it("ancla a UTC por default -- una fecha de solo-dia no corre un dia hacia atras (bug real ya encontrado en Ventas, ver docs/ui/pantallas.md)", () => {
    // "2026-01-01" sin hora se interpreta como medianoche UTC. Sin
    // timeZone:"UTC" explicito, en un huso detras de UTC (ej. America/La_Paz,
    // UTC-4) toLocaleDateString mostraria "31 dic 2025".
    expect(formatFecha("2026-01-01")).toBe("01 ene 2026");
  });

  it("acepta un objeto Date ademas de un string", () => {
    expect(formatFecha(new Date("2026-03-05T00:00:00Z"))).toBe("05 mar 2026");
  });

  it("permite opciones explicitas para casos que si necesitan hora (ej. Logs de /admin)", () => {
    expect(
      formatFecha("2026-07-20T15:30:00Z", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      })
    ).toContain("20 jul 2026");
  });
});
