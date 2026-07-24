"use client";

import { useEffect, useRef, useState } from "react";
import { Barras, Filas, Medidor, Mosaicos } from "./piezas";

/** Cada milisegundo del ciclo tambien alimenta la barrita de progreso del item
 *  activo (landing.css, `--l-ciclo`), asi que se declara una sola vez. */
const CICLO_MS = 5200;

/**
 * El contraste "de como trabajás hoy" → "con CEOM", como panel en vez de como
 * cuatro tarjetas quietas: la lista de la izquierda tacha el habito de hoy y la
 * pantalla de la derecha muestra qué pone CEOM en su lugar.
 *
 * De los cuatro pares de la referencia se reescribio el tercero: decia
 * "Te enterás tarde" → "El sistema te avisa", y **no existe ningun aviso
 * automatico** en el producto (H-10 gastos recurrentes, H-28 stock minimo,
 * H-37 sobreventa, H-45 vencimiento). Lo que si es cierto es que el dato esta
 * disponible cuando lo mires, no que algo te empuje una alerta — por eso la
 * pantalla del tercero es un grafico que se mira, sin ninguna alerta.
 */
const CONTRASTES = [
  {
    // La referencia decia "Ves el resultado completo". **Completo es justo lo
    // que no es**: la comision del canal (H-24), la cuota de una deuda (H-27),
    // el ajuste de una compra (H-31) y un producto sin costo (H-15) no llegan
    // al resultado, y los cuatro huecos van en la direccion optimista. Se
    // promete lo que si hace: juntar venta y costo.
    hoy: "Confundís venta con ganancia",
    con: "Ves la venta y su costo juntos",
    detalle:
      "Cada venta se guarda con el precio y el costo que tenía el producto en ese momento, y el margen sale de ahí.",
    pantalla: "resultado",
  },
  {
    hoy: "Ponés precio por intuición",
    con: "Ponés el margen y sale el precio",
    detalle:
      "Decís cuánto querés ganar y el simulador te dice a cuánto vender, partiendo del costo real del producto. No toca el precio que ya tenés cargado.",
    pantalla: "simulador",
  },
  {
    hoy: "Cerrás el mes sin saber cómo venías",
    con: "Mirás cómo venís cuando quieras",
    detalle:
      "El resultado del período está armado en todo momento; no hay que esperar a fin de mes para verlo.",
    pantalla: "avance",
  },
  {
    hoy: "Aprendés a los golpes",
    con: "Aprendés con tus números",
    detalle:
      "Margen, punto de equilibrio y flujo de caja dejan de ser palabras: son tus datos, en tu pantalla.",
    pantalla: "conceptos",
  },
] as const;

/** El contenido de la pantalla derecha, uno por contraste. */
function Pantalla({ tipo }: { tipo: (typeof CONTRASTES)[number]["pantalla"] }) {
  if (tipo === "resultado") {
    return (
      <>
        <Mosaicos
          datos={[
            { etiqueta: "Ventas del mes", valor: "Bs 24.500" },
            { etiqueta: "Resultado del mes", valor: "Bs 6.200", tono: "ok" },
          ]}
        />
        <Medidor etiqueta="Margen del período" valor="25%" pct={25} />
      </>
    );
  }

  if (tipo === "simulador") {
    // El simulador va del margen al precio, no al reves: `simularPrecio` toma
    // `margenDeseadoPct` y devuelve `precioSugerido`
    // (= costo / (1 - margen/100), simulaciones/actions.ts:23-28).
    // 8,00 / (1 − 0,35) = 12,31.
    return (
      <>
        <Mosaicos
          datos={[
            { etiqueta: "Margen que querés", valor: "35%" },
            { etiqueta: "Precio sugerido", valor: "Bs 12,31", tono: "ok" },
          ]}
        />
        <Filas
          datos={[
            { etiqueta: "Costo real del producto", valor: "Bs 8,00" },
            { etiqueta: "Margen deseado", valor: "35%" },
            { etiqueta: "A qué precio vender", valor: "Bs 12,31", tono: "ok" },
          ]}
        />
      </>
    );
  }

  if (tipo === "avance") {
    return (
      <>
        <Mosaicos datos={[{ etiqueta: "Resultado al día de hoy", valor: "Bs 6.200", tono: "ok" }]} />
        <Barras
          datos={[
            { etiqueta: "Sem 1", pct: 52, valor: "Bs 5.400" },
            { etiqueta: "Sem 2", pct: 70, valor: "Bs 7.100" },
            { etiqueta: "Sem 3", pct: 46, valor: "Bs 4.800" },
            { etiqueta: "Sem 4", pct: 88, valor: "Bs 7.200" },
          ]}
        />
      </>
    );
  }

  return (
    <Filas
      datos={[
        { etiqueta: "Margen del período", valor: "25%" },
        { etiqueta: "Punto de equilibrio", valor: "380 unidades/mes" },
        { etiqueta: "Flujo de caja", valor: "Mayo en positivo", tono: "ok" },
      ]}
    />
  );
}

export function PanelCambio() {
  const [activo, setActivo] = useState(0);
  const [quieto, setQuieto] = useState(false);
  const idBase = "cambio";
  const listaRef = useRef<HTMLDivElement>(null);

  // Auto-avance: se detiene si el mouse esta encima o si hay foco dentro (no
  // le pasa el turno a alguien que esta leyendo), y no arranca nunca si el
  // sistema pide menos movimiento.
  useEffect(() => {
    if (quieto) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const t = window.setInterval(
      () => setActivo((i) => (i + 1) % CONTRASTES.length),
      CICLO_MS
    );
    return () => window.clearInterval(t);
  }, [quieto]);

  // Flechas para moverse entre pestañas, como espera el patron de tablist.
  const alTeclear = (e: React.KeyboardEvent) => {
    const salto = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!salto) return;
    e.preventDefault();
    const siguiente = (activo + salto + CONTRASTES.length) % CONTRASTES.length;
    setActivo(siguiente);
    listaRef.current
      ?.querySelectorAll<HTMLButtonElement>("[role='tab']")
      [siguiente]?.focus();
  };

  return (
    <div
      className="l-panel-cambio"
      onMouseEnter={() => setQuieto(true)}
      onMouseLeave={() => setQuieto(false)}
      onFocusCapture={() => setQuieto(true)}
      onBlurCapture={() => setQuieto(false)}
    >
      <div
        ref={listaRef}
        className="l-panel-cambio__lista"
        role="tablist"
        aria-label="De cómo trabajás hoy a cómo trabajás con CEOM"
        aria-orientation="vertical"
        onKeyDown={alTeclear}
      >
        <p className="l-panel-cambio__titulo-lista">De cómo trabajás hoy…</p>

        {CONTRASTES.map(({ hoy, con }, i) => {
          const seleccionado = i === activo;
          return (
            <button
              key={hoy}
              type="button"
              role="tab"
              id={`${idBase}-tab-${i}`}
              aria-selected={seleccionado}
              aria-controls={`${idBase}-panel-${i}`}
              tabIndex={seleccionado ? 0 : -1}
              className="l-item-cambio"
              onClick={() => setActivo(i)}
            >
              <span className="l-item-cambio__hoy">
                <span className="l-item-cambio__n">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="l-item-cambio__texto">{hoy}</span>
              </span>

              {seleccionado && (
                <>
                  <span className="l-item-cambio__con">
                    <span className="l-item-cambio__flecha" aria-hidden>
                      ↳
                    </span>
                    {con}
                  </span>
                  <span
                    className="l-item-cambio__progreso"
                    aria-hidden
                    style={{ ["--l-ciclo" as string]: `${CICLO_MS}ms` }}
                  >
                    <i />
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>

      <div className="l-panel-cambio__pantalla">
        {CONTRASTES.map(({ hoy, con, detalle, pantalla }, i) =>
          i === activo ? (
            <div
              key={hoy}
              className="l-pantalla"
              role="tabpanel"
              id={`${idBase}-panel-${i}`}
              aria-labelledby={`${idBase}-tab-${i}`}
              tabIndex={0}
            >
              <div className="l-pantalla__cabecera">
                <span className="l-pantalla__insignia">Con CEOM</span>
                <strong className="l-pantalla__titulo">{con}</strong>
              </div>
              <Pantalla tipo={pantalla} />
              <p className="l-pantalla__pie">{detalle}</p>
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}
