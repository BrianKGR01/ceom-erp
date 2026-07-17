import { z } from "zod";

// Schemas compartidos entre los formularios (react-hook-form + zodResolver)
// y las Server Actions de ruta que los reciben — mismo criterio que el
// resto de los módulos con UI (ver operativo/nichos/nicho-1/validation.ts).

export const FRECUENCIAS_SIMULACION = ["semanal", "mensual"] as const;

export const simularPrecioFormSchema = z.object({
  productoId: z.string().min(1, "Elegí un producto."),
  frecuencia: z.enum(FRECUENCIAS_SIMULACION),
  margenDeseadoPct: z
    .number()
    .min(0, "El margen no puede ser negativo.")
    .max(99, "El margen deseado tiene que ser menor a 100%."),
  costoManual: z.number().positive("El costo tiene que ser mayor a 0.").optional(),
});

export type SimularPrecioFormInput = z.infer<typeof simularPrecioFormSchema>;

export const puntoEquilibrioFormSchema = z.object({
  productoId: z.string().min(1, "Elegí un producto."),
  frecuencia: z.enum(FRECUENCIAS_SIMULACION),
});

export type PuntoEquilibrioFormInput = z.infer<typeof puntoEquilibrioFormSchema>;

export const umbralAlertaSchema = z.object({
  umbralMargenAlertaPct: z
    .number()
    .min(1, "El umbral tiene que ser mayor a 0.")
    .max(100, "El umbral no puede superar 100%."),
});

export type UmbralAlertaInput = z.infer<typeof umbralAlertaSchema>;
