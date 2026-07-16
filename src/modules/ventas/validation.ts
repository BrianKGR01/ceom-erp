import { z } from "zod";

// Schemas usados por las Server Actions delgadas de
// src/app/app/ventas/actions.ts para validar lo que llega del cliente —
// mismo criterio que identidad/validation.ts y productos/validation.ts. El
// carrito del POS no usa react-hook-form (es estado dinámico de líneas, no
// un formulario fijo) — estos schemas se usan con safeParse() directo.

export const lineaVentaSchema = z.object({
  productoId: z.string().min(1),
  cantidad: z.number().positive(),
});

export const registrarVentaSchema = z.object({
  clienteId: z.string().optional(),
  clienteNuevo: z
    .object({
      nombre: z.string().trim().min(1),
      telefono: z.string().optional(),
    })
    .optional(),
  canalVentaId: z.string().min(1, "Elegí un canal de venta."),
  lineas: z.array(lineaVentaSchema).min(1, "Agregá al menos un producto al carrito."),
  pagoInicial: z
    .object({
      metodoPagoId: z.string().min(1),
      monto: z.number().positive(),
    })
    .optional(),
});

export const canalVentaFormSchema = z.object({
  nombre: z.string().trim().min(1, "Ponele un nombre al canal."),
  porcentajeComisionDefault: z.number().min(0).max(100).optional(),
});

export const metodoPagoFormSchema = z.object({
  nombre: z.string().trim().min(1, "Ponele un nombre al método de pago."),
});

export const clienteFormSchema = z.object({
  nombre: z.string().trim().min(1, "Ponele un nombre al cliente."),
  telefono: z.string().optional(),
});

export const registrarPagoVentaSchema = z.object({
  monto: z.number().positive("El monto tiene que ser mayor a 0."),
  metodoPagoId: z.string().min(1, "Elegí un método de pago."),
  fechaPago: z.string().optional(),
});

export const ajusteVentaSchema = z.object({
  tipo: z.enum(["correccion", "devolucion", "descuento_posterior", "anulacion_total"]),
  montoAjuste: z.number(),
  productoId: z.string().optional(),
  cantidadProductoAjustada: z.number().positive().optional(),
  motivo: z.string().trim().min(1, "El motivo es obligatorio."),
  generaPagoNegativo: z.boolean().optional(),
  metodoPagoId: z.string().optional(),
});
