import { describe, expect, it } from "vitest";
import { calcularEstadoAcceso } from "./actions";

describe("calcularEstadoAcceso", () => {
  it("tenant activa -> activo", () => {
    expect(
      calcularEstadoAcceso({ estadoSuscripcion: "activa", fechaProximoPago: null })
    ).toBe("activo");
  });

  it("tenant pausada -> bloqueado", () => {
    expect(
      calcularEstadoAcceso({ estadoSuscripcion: "pausada", fechaProximoPago: null })
    ).toBe("bloqueado");
  });

  it("vencida dentro de la etapa de gracia -> solo_lectura", () => {
    const ahora = new Date("2026-01-10T00:00:00Z");
    expect(
      calcularEstadoAcceso(
        { estadoSuscripcion: "vencida", fechaProximoPago: "2026-01-08" },
        ahora,
        3
      )
    ).toBe("solo_lectura");
  });

  it("vencida despues de agotar la gracia -> bloqueado", () => {
    const ahora = new Date("2026-01-20T00:00:00Z");
    expect(
      calcularEstadoAcceso(
        { estadoSuscripcion: "vencida", fechaProximoPago: "2026-01-08" },
        ahora,
        3
      )
    ).toBe("bloqueado");
  });

  it("duracion de gracia 0 -> bloqueo directo (Modulo_01 seccion 9.5)", () => {
    const ahora = new Date("2026-01-08T00:00:01Z");
    expect(
      calcularEstadoAcceso(
        { estadoSuscripcion: "vencida", fechaProximoPago: "2026-01-08" },
        ahora,
        0
      )
    ).toBe("bloqueado");
  });

  it("vencida sin fecha_proximo_pago -> bloqueado (no se puede calcular gracia)", () => {
    expect(
      calcularEstadoAcceso({ estadoSuscripcion: "vencida", fechaProximoPago: null })
    ).toBe("bloqueado");
  });
});
