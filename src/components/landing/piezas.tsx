/**
 * Piezas de dato de los mockups: mosaicos, barras y filas.
 *
 * Las comparten el panel de "el cambio real" (sobre navy) y la ventana de la
 * plataforma (sobre blanco); el tema lo decide el contenedor con la clase
 * `.l-claro-datos`, no un prop, para no duplicar cada pieza en dos variantes.
 *
 * Son ilustracion, no datos: todas las cifras salen del mismo cierre de mayo
 * de la libreta para que la pagina no se contradiga sola.
 */

export type Mosaico = { etiqueta: string; valor: string; tono?: "ok" | "azul" };
export type Barra = { etiqueta: string; pct: number; valor?: string; color?: string };
export type FilaDato = { etiqueta: string; valor: string; tono?: "ok" };

export function Mosaicos({ datos }: { datos: readonly Mosaico[] }) {
  return (
    <div className="l-mosaicos">
      {datos.map(({ etiqueta, valor, tono }) => (
        <div key={etiqueta} className="l-mosaico">
          <p className="l-mosaico__etiqueta">{etiqueta}</p>
          <p className={`l-mosaico__valor${tono ? ` l-mosaico__valor--${tono}` : ""}`}>
            {valor}
          </p>
        </div>
      ))}
    </div>
  );
}

export function Barras({ datos }: { datos: readonly Barra[] }) {
  return (
    <div className="l-barras" role="presentation">
      {datos.map(({ etiqueta, pct, valor, color }, i) => (
        <div key={etiqueta} className="l-barra">
          <span className="l-barra__valor">{valor ?? ""}</span>
          <span
            className="l-barra__cuerpo"
            style={{
              height: `${pct}%`,
              background: color,
              // El escalonado hace que las barras entren de a una.
              ["--l-retraso" as string]: `${i * 80}ms`,
            }}
          />
          <span className="l-barra__etiqueta">{etiqueta}</span>
        </div>
      ))}
    </div>
  );
}

export function Filas({ datos }: { datos: readonly FilaDato[] }) {
  return (
    <div className="l-filas">
      {datos.map(({ etiqueta, valor, tono }, i) => (
        <div
          key={etiqueta}
          className="l-fila-dato"
          style={{ ["--l-retraso" as string]: `${i * 70}ms` }}
        >
          <span className="l-fila-dato__etiqueta">{etiqueta}</span>
          <span className={`l-fila-dato__valor${tono ? ` l-fila-dato__valor--${tono}` : ""}`}>
            {valor}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Barra de progreso con leyenda arriba — se usa para el margen del periodo. */
export function Medidor({
  etiqueta,
  valor,
  pct,
}: {
  etiqueta: string;
  valor: string;
  pct: number;
}) {
  return (
    <div>
      <p className="l-leyenda">
        <span>{etiqueta}</span>
        <b>{valor}</b>
      </p>
      <div className="l-progreso" role="presentation">
        <i style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
