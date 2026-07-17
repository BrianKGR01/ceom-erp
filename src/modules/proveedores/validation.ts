import { z } from "zod";

// Schemas compartidos entre los formularios (react-hook-form + zodResolver)
// y las Server Actions que los reciben — mismo criterio que el resto de
// los módulos con UI (ver productos/validation.ts, patrimonio/validation.ts).

export const proveedorFormSchema = z.object({
  nombre: z.string().trim().min(1, "Ponele un nombre al proveedor."),
  contacto: z.string().trim().optional(),
  notas: z.string().trim().optional(),
});

export type ProveedorFormInput = z.infer<typeof proveedorFormSchema>;

export const compraFormSchema = z
  .object({
    sucursalId: z.string().min(1, "Elegí una sucursal."),
    proveedorId: z.string().optional(),
    tipo: z.enum(["insumo", "reventa"]),
    insumoId: z.string().optional(),
    productoId: z.string().optional(),
    cantidad: z.number().positive("La cantidad tiene que ser mayor a 0."),
    montoTotal: z.number().positive("El monto tiene que ser mayor a 0."),
    costoAdicionalTraslado: z.number().min(0).optional(),
    fechaCompra: z.string().min(1, "Elegí la fecha de compra."),
    fechaVencimiento: z.string().optional(),
    estado: z.enum(["pedido", "recibido"]),
  })
  .refine((data) => (data.tipo === "insumo" ? Boolean(data.insumoId) : true), {
    message: "Elegí un insumo.",
    path: ["insumoId"],
  })
  .refine((data) => (data.tipo === "reventa" ? Boolean(data.productoId) : true), {
    message: "Elegí un producto.",
    path: ["productoId"],
  });

export type CompraFormInput = z.infer<typeof compraFormSchema>;

export const registrarPagoCompraSchema = z.object({
  monto: z.number().positive("El monto tiene que ser mayor a 0."),
  fechaPago: z.string().min(1, "Elegí la fecha de pago."),
});

export const recibirCompraSchema = z.object({
  fechaRecepcion: z.string().min(1, "Elegí la fecha de recepción."),
});

export const compraAjusteSchema = z.object({
  tipo: z.enum(["correccion", "devolucion_a_proveedor", "anulacion_total"]),
  montoAjuste: z.number(),
  motivo: z.string().trim().min(1, "Describí el motivo del ajuste."),
});
