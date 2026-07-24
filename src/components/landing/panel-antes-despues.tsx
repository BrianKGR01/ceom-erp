"use client";

import { useEffect, useState } from "react";
import { CIERRE, FilaLibreta, HojaLibreta, LINEAS_CIERRE } from "./libreta";

const CICLO_MS = 6000;

const ANTES = [
  "¿Cuánto ganaste? No sabés.",
  "El precio lo pusiste a ojo.",
  "Los gastos fijos están en tu cabeza.",
  "El costo de cada producto, tampoco.",
] as const;

const DESPUES = [
  "Margen del período: 25%.",
  "Cada producto con su costo y su margen.",
  "Y el mes que viene, la misma cuenta sola.",
] as const;

const CARAS = [
  { id: "antes", etiqueta: "Antes · el cuaderno" },
  { id: "despues", etiqueta: "Después · con CEOM" },
] as const;

/**
 * El mismo mes en sus dos estados, con la transicion entre ellos hecha —
 * no dos cajas quietas una al lado de la otra.
 *
 * El truco es que las dos caras son **la misma cuenta**: la libreta del hero
 * vuelve acá tal cual, y al pasar a "después" el papel se va hacia atras y en
 * su lugar entra la misma planilla ya resuelta. Eso es lo que hace legible el
 * cambio: no cambia la informacion, cambia quién la sostiene.
 *
 * Las dos caras estan siempre en el DOM y apiladas en la misma celda de grid,
 * asi que la altura la fija la mas alta y no hay salto al alternar.
 */
export function PanelAntesDespues() {
  const [cara, setCara] = useState(0);
  const [quieto, setQuieto] = useState(false);

  useEffect(() => {
    if (quieto) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const t = window.setInterval(() => setCara((c) => (c + 1) % CARAS.length), CICLO_MS);
    return () => window.clearInterval(t);
  }, [quieto]);

  return (
    <div
      className="l-ad"
      onMouseEnter={() => setQuieto(true)}
      onMouseLeave={() => setQuieto(false)}
      onFocusCapture={() => setQuieto(true)}
      onBlurCapture={() => setQuieto(false)}
    >
      <div className="l-ad__control" role="tablist" aria-label="El mismo mes, antes y después">
        {CARAS.map(({ id, etiqueta }, i) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`ad-tab-${id}`}
            aria-selected={i === cara}
            aria-controls={`ad-panel-${id}`}
            tabIndex={i === cara ? 0 : -1}
            className="l-ad__opcion"
            onClick={() => setCara(i)}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      <div className="l-ad__escenario">
        {/* Antes: el cuaderno. **Solo tiene lo que se anoto** —lo que entro— y
            despues las preguntas sin responder, escritas en la misma hoja. No
            lleva el resultado ni el margen: si los llevara estaria
            contradiciendo la linea de al lado ("¿Cuánto ganaste? No sabés.").
            Tampoco lleva el sello de "Ejemplo": acá el marco de la seccion ya
            deja claro que es una ilustracion, y repetirlo ensuciaba la
            transicion. */}
        <div
          className="l-ad__cara l-ad__papel"
          data-activa={cara === 0 ? "1" : "0"}
          role="tabpanel"
          id="ad-panel-antes"
          aria-labelledby="ad-tab-antes"
          // `hidden` cortaria la transicion (display:none no se puede animar).
          // `inert` la deja cruzar y aun asi saca la cara oculta del orden de
          // tabulacion y del arbol de accesibilidad.
          inert={cara !== 0}
          aria-hidden={cara !== 0}
        >
          <HojaLibreta inclinacion="-0.8deg">
            <FilaLibreta {...CIERRE.ventas} />
            <ul className="l-ad__lista-papel">
              {ANTES.map((linea) => (
                <li key={linea}>{linea}</li>
              ))}
            </ul>
          </HojaLibreta>
        </div>

        {/* Después: la misma cuenta, ya resuelta. */}
        <div
          className="l-ad__cara l-ad__app"
          data-activa={cara === 1 ? "1" : "0"}
          role="tabpanel"
          id="ad-panel-despues"
          aria-labelledby="ad-tab-despues"
          inert={cara !== 1}
          aria-hidden={cara !== 1}
        >
          <div className="l-ad__app-cabecera">
            <h3 className="l-ad__app-titulo">{CIERRE.negocio}</h3>
            <span className="l-ad__app-meta">Mayo</span>
          </div>

          <dl className="l-ad__cuentas">
            {LINEAS_CIERRE.map(({ concepto, monto }) => (
              <div key={concepto} className="l-ad__cuenta">
                <dt>{concepto}</dt>
                <dd>{monto}</dd>
              </div>
            ))}
            <div className="l-ad__cuenta l-ad__cuenta--total">
              <dt>{CIERRE.total.concepto}</dt>
              <dd>{CIERRE.total.monto}</dd>
            </div>
          </dl>

          <ul className="l-ad__lista-app">
            {DESPUES.map((linea) => (
              <li key={linea}>
                <svg
                  className="l-ad__tilde"
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                {linea}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
