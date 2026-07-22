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
  eventoId: z.string().optional(),
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
  email: z.string().trim().email("Ingresá un email válido.").optional().or(z.literal("")),
});

export const registrarPagoVentaSchema = z.object({
  monto: z.number().positive("El monto tiene que ser mayor a 0."),
  metodoPagoId: z.string().min(1, "Elegí un método de pago."),
  fechaPago: z.string().optional(),
});

export const eventoFormSchema = z.object({
  sucursalId: z.string().min(1, "Elegí una sucursal."),
  canalVentaId: z.string().min(1, "Elegí un canal de venta."),
  nombre: z.string().trim().min(1, "Ponele un nombre al evento."),
  porcentajeComision: z.number().min(0).max(100).optional(),
  fechaInicio: z.string().min(1, "Elegí la fecha de inicio."),
  fechaFin: z.string().min(1, "Elegí la fecha de fin."),
});

export const importarVentaHistoricaFilaSchema = z.object({
  fechaVenta: z.string().min(1),
  canalVentaId: z.string().min(1),
  clienteId: z.string().optional(),
  productoId: z.string().min(1),
  cantidad: z.number().positive(),
  precioVentaSnapshot: z.number().min(0),
  costoUnitarioSnapshot: z.number().min(0),
});

// Direccion del ajuste segun su tipo (Modulo_03 seccion 1.3). El estado de
// resultados SUMA los ajustes (`ingresos - costos - gastos + ajustes`, ver
// financiero/actions.ts), asi que un ajuste que reduce la venta tiene que
// quedar guardado en negativo. Antes esto no se validaba en ningun lado y la
// unica guia era un placeholder del input: una anulacion de 500 cargada como
// "500" le sumaba 500 al resultado en vez de restarlos.
//
// Tres de los cuatro tipos solo pueden reducir, asi que su signo se deriva
// del tipo y el usuario nunca lo elige. "correccion" es el unico
// bidireccional a proposito: el doc del modulo lo define como "error de
// tipeo" y dice explicitamente que el monto puede ser "positivo (corrige un
// monto cobrado de menos)" — ahi la direccion se pide explicita.
export const TIPOS_AJUSTE_REDUCTORES = [
  "devolucion",
  "descuento_posterior",
  "anulacion_total",
] as const;

export type TipoAjusteVenta =
  | "correccion"
  | (typeof TIPOS_AJUSTE_REDUCTORES)[number];

export function esTipoAjusteReductor(tipo: TipoAjusteVenta): boolean {
  return (TIPOS_AJUSTE_REDUCTORES as readonly string[]).includes(tipo);
}

/** Regla de signo compartida por el schema de ruta y el guard del modulo,
 * para que ambos digan exactamente lo mismo. Devuelve el error, o null si el
 * monto es coherente con el tipo. */
export function errorSignoAjuste(tipo: TipoAjusteVenta, montoAjuste: number): string | null {
  if (!Number.isFinite(montoAjuste) || montoAjuste === 0) {
    return "El monto del ajuste no puede ser cero.";
  }
  if (esTipoAjusteReductor(tipo) && montoAjuste > 0) {
    return "Este tipo de ajuste solo puede reducir la venta: el monto tiene que ser negativo.";
  }
  return null;
}

export const ajusteVentaSchema = z
  .object({
    tipo: z.enum(["correccion", "devolucion", "descuento_posterior", "anulacion_total"]),
    montoAjuste: z.number(),
    productoId: z.string().optional(),
    cantidadProductoAjustada: z.number().positive().optional(),
    motivo: z.string().trim().min(1, "El motivo es obligatorio."),
    generaPagoNegativo: z.boolean().optional(),
    metodoPagoId: z.string().optional(),
  })
  .refine((d) => d.montoAjuste !== 0, {
    path: ["montoAjuste"],
    message: "El monto del ajuste no puede ser cero.",
  })
  .refine((d) => !esTipoAjusteReductor(d.tipo) || d.montoAjuste < 0, {
    path: ["montoAjuste"],
    message:
      "Este tipo de ajuste solo puede reducir la venta: el monto tiene que ser negativo.",
  });
