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

export const invitarColaboradorSchema = z.object({
  email: z.string().trim().email("Ingresá un email válido."),
  nombreCompleto: z.string().trim().min(1, "Ponele un nombre al colaborador."),
  rolId: z.string().min(1, "Elegí un rol."),
});

export type InvitarColaboradorInput = z.infer<typeof invitarColaboradorSchema>;

export const editarColaboradorSchema = z.object({
  rolId: z.string().min(1, "Elegí un rol."),
});

export type EditarColaboradorInput = z.infer<typeof editarColaboradorSchema>;

export const crearRolFormSchema = z.object({
  nombre: z.string().trim().min(1, "Ponele un nombre al rol."),
});

export type CrearRolFormInput = z.infer<typeof crearRolFormSchema>;

export const crearTenantFormSchema = z.object({
  nombreNegocio: z.string().trim().min(1, "Contanos cómo se llama el negocio."),
  monedaPrincipal: z
    .string()
    .trim()
    .length(3, "Usá el código de 3 letras de la moneda (ej. BOB, USD).")
    .toUpperCase(),
  planId: z.string().min(1, "Elegí un plan."),
  fechaInicioSuscripcion: z.string().min(1, "Elegí la fecha de inicio."),
  ownerNombreCompleto: z.string().trim().min(1, "Ponele un nombre al Owner inicial."),
  ownerEmail: z.string().trim().email("Ingresá un email válido."),
});

export type CrearTenantFormInput = z.infer<typeof crearTenantFormSchema>;

export const cambiarEstadoSuscripcionSchema = z
  .object({
    nuevoEstado: z.enum(["activa", "pausada", "vencida"]),
    fechaProximoPago: z.string().trim().optional(),
  })
  .refine((data) => (data.nuevoEstado === "vencida" ? Boolean(data.fechaProximoPago) : true), {
    message: "Ingresá la fecha de próximo pago — es el ancla de la etapa de gracia.",
    path: ["fechaProximoPago"],
  });

export type CambiarEstadoSuscripcionInput = z.infer<typeof cambiarEstadoSuscripcionSchema>;
