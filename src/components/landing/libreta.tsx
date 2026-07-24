/**
 * La libreta: papel rayado, margen rojo y letra a mano.
 *
 * Es el mockup del hero y la pieza que sostiene la metafora de toda la pagina
 * — el "antes" que el H1 pregunta ("¿Sabés cuánto te quedó?").
 *
 * La hoja es un contenedor y las filas se pasan desde afuera **a proposito**,
 * porque las dos veces que aparece dice cosas distintas y no puede decir la
 * misma:
 *   - en el hero es el cierre entero, o sea el ejemplo de la cuenta hecha;
 *   - en "antes y después" es un cuaderno de verdad, que solo tiene lo que se
 *     anoto (las ventas) y ninguna de las respuestas. Poner ahi el resultado
 *     contradiria de plano el texto que va al lado ("¿Cuánto ganaste? No
 *     sabés.").
 *
 * Los numeros del cierre cierran entre si con la formula que usa el sistema
 * (financiero/actions.ts:37-44): ingresos - costos - gastos.
 * 24.500 - 12.300 - 6.000 = 6.200, y 6.200 / 24.500 = 25%. El sello de
 * "Ejemplo" esta para que no se lean como el dato de un negocio real.
 *
 * Server Component: es markup y CSS, no necesita JS.
 */

export const CIERRE = {
  negocio: "Panadería La Esquina",
  periodo: "Cierre de mes · Mayo",
  ventas: { concepto: "Ventas del mes", monto: "Bs 24.500" },
  restas: [
    { concepto: "Costo de lo vendido", monto: "− Bs 12.300" },
    { concepto: "Gastos", monto: "− Bs 6.000" },
  ],
  total: { concepto: "Resultado del mes", monto: "Bs 6.200" },
  margen: "25%",
} as const;

/** Todas las lineas del cierre, para la tarjeta de la aplicacion. */
export const LINEAS_CIERRE = [CIERRE.ventas, ...CIERRE.restas] as const;

export function HojaLibreta({
  children,
  conSello = false,
  inclinacion = "-1.15deg",
}: {
  children: React.ReactNode;
  conSello?: boolean;
  inclinacion?: string;
}) {
  return (
    <figure className="l-libreta" style={{ "--l-giro": inclinacion } as React.CSSProperties}>
      <div className="l-libreta__hoja">
        <span className="l-libreta__margen" aria-hidden />

        <div className="l-libreta__cabecera">
          <span className="l-libreta__meta">{CIERRE.periodo}</span>
          <b className="l-libreta__negocio">{CIERRE.negocio}</b>
        </div>

        {children}
      </div>

      {conSello && <figcaption className="l-libreta__sello">Ejemplo</figcaption>}
    </figure>
  );
}

export function FilaLibreta({
  concepto,
  monto,
  resta = false,
  total = false,
}: {
  concepto: string;
  monto: string;
  resta?: boolean;
  total?: boolean;
}) {
  return (
    <div className={`l-libreta__fila${total ? " l-libreta__fila--total" : ""}`}>
      <span className="l-libreta__concepto">{concepto}</span>
      <b className={`l-libreta__monto${resta ? " l-libreta__monto--resta" : ""}`}>{monto}</b>
    </div>
  );
}

/** El cierre completo, escrito a mano. Es el mockup del hero. */
export function LibretaCierre() {
  return (
    <HojaLibreta conSello>
      <FilaLibreta {...CIERRE.ventas} />
      {CIERRE.restas.map((linea) => (
        <FilaLibreta key={linea.concepto} {...linea} resta />
      ))}
      <FilaLibreta {...CIERRE.total} total />

      {/* "Margen real" era el rotulo de la referencia. Se evita "real": el
          margen no descuenta comisiones (H-24) ni cuotas de deuda (H-27). Es
          el margen del periodo. */}
      <p className="l-libreta__margen-nota">
        <span>Margen del período</span>
        <span className="l-libreta__barra" aria-hidden>
          <i />
        </span>
        <span>{CIERRE.margen}</span>
      </p>
    </HojaLibreta>
  );
}
