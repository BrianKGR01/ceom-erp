import { z } from "zod";

// Schemas compartidos entre los formularios (react-hook-form + zodResolver)
// y las Server Actions que los reciben — mismo criterio que el resto de
// los módulos con UI (ver proveedores/validation.ts, patrimonio/validation.ts).

export const gastoFormSchema = z.object({
  sucursalId: z.string().optional(),
  tipo: z.enum(["fijo", "variable_no_productivo", "unico"]),
  categoriaId: z.string().min(1, "Elegí una categoría."),
  monto: z.number().positive("El monto tiene que ser mayor a 0."),
  fechaGasto: z.string().min(1, "Elegí la fecha del gasto."),
  proveedorId: z.string().optional(),
  descripcion: z.string().trim().optional(),
});

export type GastoFormInput = z.infer<typeof gastoFormSchema>;

export const registrarPagoGastoSchema = z.object({
  monto: z.number().positive("El monto tiene que ser mayor a 0."),
  fechaPago: z.string().min(1, "Elegí la fecha de pago."),
});

export const categoriaGastoFormSchema = z.object({
  nombre: z.string().trim().min(1, "Ponele un nombre a la categoría."),
  categoriaGastoSugeridaId: z.string().optional(),
});

export const gastoRecurrenteFormSchema = z.object({
  sucursalId: z.string().optional(),
  categoriaId: z.string().min(1, "Elegí una categoría."),
  monto: z.number().positive("El monto tiene que ser mayor a 0."),
  frecuencia: z.enum(["mensual", "semanal", "quincenal", "anual"]),
  fechaInicio: z.string().min(1, "Elegí la fecha de inicio."),
  fechaFin: z.string().optional(),
});

export type GastoRecurrenteFormInput = z.infer<typeof gastoRecurrenteFormSchema>;
