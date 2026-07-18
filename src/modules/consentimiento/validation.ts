import { z } from "zod";

// Schemas compartidos entre los formularios (react-hook-form + zodResolver)
// y las Server Actions de ruta que los reciben — mismo criterio que el
// resto de los módulos con UI.

export const MODULOS_VEEDOR = ["financiero", "operativo", "inventario_operativo"] as const;
export type ModuloVeedorForm = (typeof MODULOS_VEEDOR)[number];

export const TIPOS_INSTITUCION = ["universidad", "incubadora", "organizacion"] as const;

export const generarCodigoAccesoSchema = z.object({
  modulosHabilitados: z
    .array(z.enum(MODULOS_VEEDOR))
    .min(1, "Elegí al menos un módulo para compartir."),
});
export type GenerarCodigoAccesoInput = z.infer<typeof generarCodigoAccesoSchema>;

export const aprobarSolicitudSchema = z.object({
  modulosAprobados: z
    .array(z.enum(MODULOS_VEEDOR))
    .min(1, "Elegí al menos un módulo para aprobar."),
});
export type AprobarSolicitudInput = z.infer<typeof aprobarSolicitudSchema>;

export const institucionFormSchema = z.object({
  nombre: z.string().trim().min(1, "Ponele un nombre a la institución."),
  tipo: z.enum(TIPOS_INSTITUCION),
  contacto: z.string().trim().optional(),
  // Habilita el magic link de reingreso a /portal — opcional (ver
  // CEOM_Arquitectura.md 8.3, consentimiento/ANCLA.md).
  email: z.string().trim().email("Ingresá un email válido.").optional(),
});
export type InstitucionFormInput = z.infer<typeof institucionFormSchema>;

export const canjearCodigoFormSchema = z.object({
  codigo: z.string().trim().min(1, "Ingresá el código de acceso."),
});
export type CanjearCodigoFormInput = z.infer<typeof canjearCodigoFormSchema>;

export const solicitarMagicLinkSchema = z.object({
  email: z.string().trim().email("Ingresá un email válido."),
});
export type SolicitarMagicLinkInput = z.infer<typeof solicitarMagicLinkSchema>;

export const carteraFormSchema = z.object({
  tenantId: z.string().min(1, "Elegí un tenant."),
  cohorte: z.string().trim().optional(),
  fechaInicio: z.string().min(1, "Elegí una fecha de inicio."),
  fechaFin: z.string().optional(),
});
export type CarteraFormInput = z.infer<typeof carteraFormSchema>;

export const crearSolicitudSeguimientoSchema = z.object({
  tenantId: z.string().min(1, "Elegí un tenant."),
  modulosSolicitados: z
    .array(z.enum(MODULOS_VEEDOR))
    .min(1, "Elegí al menos un módulo a solicitar."),
});
export type CrearSolicitudSeguimientoInput = z.infer<typeof crearSolicitudSeguimientoSchema>;
