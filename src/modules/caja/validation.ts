import { z } from "zod";

// Schemas de las Server Actions de la caja (src/app/app/(shell)/caja/actions.ts):
// validan lo que llega del cliente antes de llamar al modulo.

export const configurarCajaSchema = z.object({
  habilitada: z.boolean(),
  exigirTurno: z.boolean().optional(),
});

export const abrirTurnoSchema = z.object({
  cajaId: z.string().min(1, "Elegí una caja."),
  fondoInicial: z.number().min(0, "El fondo inicial no puede ser negativo."),
});

export const movimientoCajaSchema = z.object({
  turnoId: z.string().min(1),
  tipo: z.enum(["entrada", "salida"]),
  monto: z.number().positive("El monto tiene que ser mayor a cero."),
  motivo: z.string().trim().min(1, "Contá el motivo del movimiento."),
});

export const cerrarTurnoSchema = z.object({
  turnoId: z.string().min(1),
  efectivoContado: z.number().min(0, "El efectivo contado no puede ser negativo."),
  observaciones: z.string().trim().max(500).optional(),
});
