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

// Sin "tasa de interes": el doc del modulo (Modulo_05 seccion 6.1) confirma
// "cuota fija sin desglose de interes/capital" para el MVP — cuotaPeriodica
// se carga directo, no se calcula. No incluir ese campo aunque la
// referencia visual lo muestre.
export const pasivoFormSchema = z.object({
  activoId: z.string().optional(),
  montoTotal: z.number().positive("El monto tiene que ser mayor a 0."),
  cuotaPeriodica: z.number().positive("La cuota tiene que ser mayor a 0."),
  frecuenciaCuota: z.enum(["mensual", "semanal", "quincenal", "anual"]),
  plazoCuotas: z.number().int().positive("El plazo tiene que ser mayor a 0."),
  fechaInicio: z.string().min(1, "Elegí la fecha de inicio."),
});

export type PasivoFormInput = z.infer<typeof pasivoFormSchema>;

export const registrarPagoPasivoSchema = z.object({
  monto: z.number().positive("El monto tiene que ser mayor a 0."),
  fechaPago: z.string().min(1, "Elegí la fecha de pago."),
});
