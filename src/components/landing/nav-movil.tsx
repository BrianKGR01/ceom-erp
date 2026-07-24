"use client";

import { useId, useState } from "react";

type Enlace = { href: string; texto: string };

/**
 * Navegacion del encabezado. En pantalla ancha son enlaces sueltos junto al
 * logo; abajo de 900px se pliegan detras del boton de menu (el corte lo hace
 * landing.css, acá solo vive el estado abierto/cerrado).
 *
 * `children` es el bloque de acciones fijas de la derecha —el boton de entrar—,
 * que se queda visible en todos los anchos: en celular la accion util es entrar
 * o escribir, no navegar la propia landing.
 */
export function NavMovil({
  enlaces,
  children,
}: {
  enlaces: readonly Enlace[];
  children: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const idMenu = useId();

  return (
    <>
      <nav
        id={idMenu}
        aria-label="Secciones"
        className="l-nav"
        data-abierto={abierto ? "1" : "0"}
      >
        {enlaces.map(({ href, texto }) => (
          <a key={href} href={href} onClick={() => setAbierto(false)}>
            {texto}
          </a>
        ))}
      </nav>

      <div className="l-header__acciones">
        {children}
        <button
          type="button"
          className="l-hamburguesa"
          aria-label={abierto ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={abierto}
          aria-controls={idMenu}
          onClick={() => setAbierto((v) => !v)}
        >
          <i aria-hidden />
          <i aria-hidden />
          <i aria-hidden />
        </button>
      </div>
    </>
  );
}
