/**
 * La ficha de venta tiene su propio `loading.tsx` aunque exista el de `(shell)`.
 *
 * El de `(shell)` no se muestra al ir del punto de venta (`/app/ventas`) a una
 * venta (`/app/ventas/[id]`): el segmento `ventas` no cambia, así que Next deja
 * visible la pantalla anterior hasta que llega la nueva. Esa ventana, con el
 * punto de venta todavía en pantalla, es la que produjo las ventas duplicadas
 * del informe del 2026-09-23. Acá `[id]` sí es un segmento nuevo, así que este
 * esqueleto aparece apenas empieza la navegación.
 */
export { default } from "../../loading";
