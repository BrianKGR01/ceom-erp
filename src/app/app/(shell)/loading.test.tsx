import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CargandoPantallaDeApp from "./loading";

/**
 * H-50: el síntoma que reportaron las usuarias del incidente del 2026-09-17 no
 * fue "tarda" sino "no pasa nada" — sin `loading.tsx`, Next deja la pantalla
 * anterior mientras la nueva no llega. Este test fija lo mínimo que hace que
 * ese estado sea perceptible, incluso sin ver la pantalla.
 */
describe("loading.tsx de /app", () => {
  it("anuncia que está cargando y se marca como ocupado para lectores de pantalla", () => {
    const { container } = render(<CargandoPantallaDeApp />);

    expect(screen.getByText("Cargando…")).toBeInTheDocument();
    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
    // El esqueleto tiene que verse sobre los dos fondos del shell: si alguien
    // le saca las clases de color queda un bloque invisible sobre la tarjeta.
    const skeletons = container.querySelectorAll("[data-slot='skeleton']");
    expect(skeletons.length).toBeGreaterThan(3);
    for (const s of skeletons) {
      expect(s.className).toMatch(/bg-(card|gray-bg)/);
    }
  });
});
