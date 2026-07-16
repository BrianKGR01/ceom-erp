import { z } from "zod";

// Schemas compartidos entre el formulario (react-hook-form + zodResolver) y
// la Server Action que los recibe — mismo criterio que
// identidad/validation.ts. Los campos numericos opcionales se resuelven a
// `undefined` en el propio input (setValueAs en product-form.tsx) en vez de
// con z.preprocess() acá — evita el desajuste de tipos input/output de zod
// contra el generic de useForm.

export const productoFormSchema = z.object({
  categoriaId: z.string().optional(),
  nombre: z.string().trim().min(1, "Ponele un nombre a tu producto."),
  unidadVenta: z.enum(["unidad", "kg", "g", "l", "ml", "docena"]),
  precioVenta: z.number().positive("El precio tiene que ser mayor a 0."),
  costoOperativoVigente: z.number().min(0).optional(),
  vidaUtilDias: z.number().int().positive().optional(),
  fechaVencimientoReferencia: z.string().optional(),
  activo: z.boolean(),
  // Solo se usan en el Alta (stock inicial opcional) — se ignoran al editar.
  stockInicial: z.number().min(0).optional(),
  sucursalId: z.string().optional(),
});

export type ProductoFormInput = z.infer<typeof productoFormSchema>;
