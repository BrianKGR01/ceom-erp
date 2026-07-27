// Unico lugar de la app para formatear moneda y fecha — ver
// docs/ui/AUDITORIA-UI-UX.md UI-017/UI-030/UI-031/UI-032. Antes existian
// mas de 10 copias casi-identicas de estas dos funciones, cada una con su
// propia pequeña divergencia (con/sin separador de miles, con/sin
// timeZone, con/sin simbolo de moneda) — esta es la version unica que
// decide cada divergencia una sola vez, documentada abajo.

/**
 * Formatea un monto con el codigo/simbolo de moneda real del tenant via
 * Intl.NumberFormat (style: "currency"), en vez de un numero pelado.
 *
 * Decision (UI-030): ninguna de las +10 copias existentes mostraba la
 * moneda — todas asumian implicitamente "BOB" sin decirlo. `moneda` es un
 * parametro explicito (default "BOB" solo para no romper compatibilidad si
 * un consumidor todavia no tiene a mano la moneda real del tenant/plan) en
 * vez de un valor hardcodeado, porque un tenant puede operar en otra
 * moneda (`tenants.monedaPrincipal` / `planes.moneda` ya son texto libre en
 * el schema, no estan atados a "BOB").
 *
 * Decision de separador de miles: la mayoria de las copias existentes
 * usaba `toLocaleString(..., {minimumFractionDigits:2,
 * maximumFractionDigits:2})`, que SI agrupa miles; una minoria usaba
 * `.toFixed(2)`, que no agrupa. Se adopta la version con agrupación
 * (Intl.NumberFormat ya la incluye por defecto) por ser mas legible en
 * montos grandes y ser la mayoritaria.
 */
export function formatMoneda(valor: number | string, moneda: string = "BOB"): string {
  const numero = Number(valor);
  return new Intl.NumberFormat("es-BO", {
    style: "currency",
    currency: moneda,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numero);
}

/**
 * Formatea una fecha en es-BO. Por defecto usa el formato que ya usaba la
 * mayoria de las pantallas ("20 jul 2026"), con `timeZone: "UTC"` SIEMPRE
 * activo salvo que se pasen opciones explicitas.
 *
 * Decision (UI-032): una minoria de copias existentes omitia
 * `timeZone: "UTC"`, lo que ya causo un bug real y verificado (ver
 * docs/ui/pantallas.md, Modulo 7 Ventas: una fecha de solo-dia se anclaba
 * a medianoche UTC y corria un dia hacia atras en husos horarios detras de
 * UTC, incluido Bolivia). El default de esta funcion es siempre seguro;
 * un consumidor que necesite hora (ej. Logs de /admin) pasa sus propias
 * `opciones` con `hour`/`minute` explicitos.
 */
export function formatFecha(
  fecha: string | Date,
  opciones: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }
): string {
  const fechaObj = typeof fecha === "string" ? new Date(fecha) : fecha;
  return fechaObj.toLocaleDateString("es-BO", opciones);
}

/**
 * Para columnas `timestamptz` — un INSTANTE, no un dia calendario.
 *
 * La distincion importa y `formatFecha` sola no la cubre (H-49):
 *
 * - Columna `date` (`gastos.fecha_gasto`, `compras.fecha_compra`,
 *   `pagos_compra.fecha_pago`…): guarda un dia sin hora. `formatFecha` con su
 *   default `timeZone: "UTC"` es lo correcto — mostrarla en huso local la corre
 *   un dia hacia atras.
 * - Columna `timestamptz` (`ventas.fecha_venta`, `pagos_venta.fecha_pago`,
 *   `producciones.fecha_produccion`…): guarda un momento absoluto. Mostrarla en
 *   UTC muestra el dia UTC, no el dia en que el negocio vendio: una venta de las
 *   22:00 de Bolivia aparece con la fecha del dia siguiente. Va esta funcion,
 *   con la zona del negocio.
 *
 * La zona se pasa explicita (la resuelve el servidor con `zonaHorariaTenant`) y
 * nunca se deja al huso del navegador, que viaja con el usuario.
 */
export function formatFechaEnZona(
  instante: string | Date,
  zona: string,
  opciones: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" }
): string {
  const fechaObj = typeof instante === "string" ? new Date(instante) : instante;
  return fechaObj.toLocaleDateString("es-BO", { ...opciones, timeZone: zona });
}
