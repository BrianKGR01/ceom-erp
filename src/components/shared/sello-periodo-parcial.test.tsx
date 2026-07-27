import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hoyLocal, sumarDias, ZONA_HORARIA_NEGOCIO } from "@/lib/periodo";
import { SelloPeriodoParcial } from "./sello-periodo-parcial";

// El sello depende de "hoy", asi que el reloj se congela en un instante
// conocido en vez de leerse. Sin esto el test seria verde o rojo segun la hora
// a la que corriera — que es el defecto que H-49 vino a cerrar.
afterEach(() => vi.useRealTimers());

function congelar(instanteIso: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(instanteIso));
}

describe("SelloPeriodoParcial", () => {
  it("aparece cuando el periodo termina hoy, con la hora local del negocio", () => {
    congelar("2026-07-27T14:32:00Z"); // 10:32 en Bolivia
    render(<SelloPeriodoParcial hasta="2026-07-27" zona={ZONA_HORARIA_NEGOCIO} />);
    expect(screen.getByText(/el día todavía no terminó/i)).toBeInTheDocument();
    expect(screen.getByText(/10:32/)).toBeInTheDocument();
  });

  it("no aparece si el periodo ya cerro", () => {
    congelar("2026-07-27T14:32:00Z");
    render(<SelloPeriodoParcial hasta="2026-06-30" zona={ZONA_HORARIA_NEGOCIO} />);
    expect(screen.queryByText(/el día todavía no terminó/i)).not.toBeInTheDocument();
  });

  it("a las 21:00 locales sigue marcando HOY, no manana", () => {
    // 2026-07-28T01:00:00Z ya es dia 28 en UTC, pero son las 21:00 del 27 en
    // Bolivia. Si el sello leyera el dia UTC, este periodo (que termina el 27)
    // pareceria cerrado y el sello desapareceria justo cuando mas hace falta.
    congelar("2026-07-28T01:00:00Z");
    render(<SelloPeriodoParcial hasta="2026-07-27" zona={ZONA_HORARIA_NEGOCIO} />);
    expect(screen.getByText(/el día todavía no terminó/i)).toBeInTheDocument();
    expect(screen.getByText(/21:00/)).toBeInTheDocument();
  });

  it("el preset del dia en curso siempre lo dispara", () => {
    congelar("2026-07-27T14:32:00Z");
    const hoy = hoyLocal(ZONA_HORARIA_NEGOCIO);
    render(<SelloPeriodoParcial hasta={hoy} zona={ZONA_HORARIA_NEGOCIO} />);
    expect(screen.getByText(/el día todavía no terminó/i)).toBeInTheDocument();
  });

  it("y el dia anterior nunca", () => {
    congelar("2026-07-27T14:32:00Z");
    const ayer = sumarDias(hoyLocal(ZONA_HORARIA_NEGOCIO), -1);
    render(<SelloPeriodoParcial hasta={ayer} zona={ZONA_HORARIA_NEGOCIO} />);
    expect(screen.queryByText(/el día todavía no terminó/i)).not.toBeInTheDocument();
  });
});
