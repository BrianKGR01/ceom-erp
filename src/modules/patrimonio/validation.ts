import { z } from "zod";

// Schema compartido entre el formulario (react-hook-form + zodResolver) y
// la Server Action que lo recibe — mismo criterio que
// productos/validation.ts. No incluye `estado`: el contrato de
// `actualizarActivo()` no lo acepta (las transiciones de estado pasan por
// acciones dedicadas — `darDeBajaActivo` es la única implementada hoy).
export const activoFormSchema = z.object({
  nombre: z.string().trim().min(1, "Ponele un nombre al activo."),
  tipo: z.enum(["equipo_productivo", "mobiliario", "vehiculo", "otro"]),
  sucursalId: z.string().optional(),
  valorCompra: z.number().positive("El valor tiene que ser mayor a 0."),
  fechaAdquisicion: z.string().min(1, "Elegí la fecha de adquisición."),
  vidaUtilMeses: z.number().positive().optional(),
  proveedorId: z.string().optional(),
  numeroSerie: z.string().trim().optional(),
  vencimientoGarantia: z.string().optional(),
  capacidadProduccionCantidad: z.number().min(0).optional(),
  capacidadProduccionUnidad: z.string().trim().optional(),
  capacidadAlmacenamientoCantidad: z.number().min(0).optional(),
  capacidadAlmacenamientoUnidad: z.string().trim().optional(),
});

export type ActivoFormInput = z.infer<typeof activoFormSchema>;

export const transferirActivoSchema = z.object({
  nuevaSucursalId: z.string().min(1, "Elegí una sucursal de destino."),
});

export const darDeBajaActivoSchema = z.object({
  motivo: z.string().trim().min(1, "Describí el motivo de la baja."),
});
