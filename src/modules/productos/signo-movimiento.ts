// Funcion pura, sin ninguna dependencia de servidor/DB — a proposito, para
// que tanto repository.ts (server) como componentes Client ("use client",
// ej. la Ficha de Producto) puedan importarla sin arrastrar todo el
// modulo de acceso a datos (que rompe en el cliente por importar
// next/headers vía identidad/actions.ts).

export type TipoMovimientoStock =
  | "entrada_produccion"
  | "entrada_compra_reventa"
  | "entrada_ajuste_manual"
  | "entrada_transferencia"
  | "salida_venta"
  | "salida_merma"
  | "salida_ajuste_manual"
  | "salida_transferencia";

// "entrada_*" suma, "salida_*" resta (Modulo_02 seccion 2.5) — unica fuente
// de verdad de esta regla.
const TIPOS_ENTRADA = new Set<TipoMovimientoStock>([
  "entrada_produccion",
  "entrada_compra_reventa",
  "entrada_ajuste_manual",
  "entrada_transferencia",
]);

export function signoMovimiento(tipo: TipoMovimientoStock): 1 | -1 {
  return TIPOS_ENTRADA.has(tipo) ? 1 : -1;
}
