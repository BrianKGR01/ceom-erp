/**
 * Motivos de baja (Roadmap Cafiatto, Fase 2). Archivo sin dependencias a
 * proposito: lo importan tanto las acciones del servidor como las pantallas de
 * cliente, y `actions.ts` arrastra `db` y no puede entrar al bundle de cliente.
 *
 * El "consumo del personal" NO esta aca: se modela como bonificacion de venta
 * (decision 1 del roadmap, Fase 5).
 */
export const MOTIVOS_BAJA = [
  "error_preparacion",
  "derrame_desperdicio",
  "queja_reposicion",
  "vencimiento",
  "danio",
  "otro",
] as const;

export type MotivoBajaUI = (typeof MOTIVOS_BAJA)[number];

export const ETIQUETA_MOTIVO_BAJA: Record<MotivoBajaUI, string> = {
  error_preparacion: "Error de preparación",
  derrame_desperdicio: "Derrame / desperdicio",
  queja_reposicion: "Queja o reposición",
  vencimiento: "Vencimiento",
  danio: "Daño",
  otro: "Otro",
};
