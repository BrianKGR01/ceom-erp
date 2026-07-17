import { z } from "zod";

// Schemas compartidos entre el formulario (react-hook-form + zodResolver) y
// la Server Action que los recibe — una sola fuente de verdad sobre que es
// un dato valido (docs/dev-practices/dev-practices.md seccion 9). No van en
// schema.ts a proposito: ese archivo es el esquema de Drizzle (tablas), no
// validacion de input.

export const actualizarTenantSchema = z.object({
  nombreNegocio: z.string().trim().min(1, "Contanos cómo se llama tu negocio."),
  ciudadBase: z.string().trim().optional(),
  monedaPrincipal: z
    .string()
    .trim()
    .length(3, "Usá el código de 3 letras de tu moneda (ej. BOB, USD).")
    .toUpperCase(),
  canalesVenta: z.array(z.string()),
  logoUrl: z.string().trim().optional(),
});

export type ActualizarTenantInput = z.infer<typeof actualizarTenantSchema>;

export const asignarNichoSchema = z.object({
  nicho: z.enum(["nicho_1", "nicho_4"]),
});

export type AsignarNichoInput = z.infer<typeof asignarNichoSchema>;
