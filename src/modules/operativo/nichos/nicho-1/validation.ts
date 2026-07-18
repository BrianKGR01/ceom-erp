import { z } from "zod";

// Schemas compartidos entre los formularios (react-hook-form + zodResolver)
// y las Server Actions que los reciben — mismo criterio que el resto de
// los módulos con UI (ver productos/validation.ts, proveedores/validation.ts).

export const insumoFormSchema = z.object({
  nombre: z.string().trim().min(1, "Ponele un nombre al insumo."),
  unidadMedida: z.enum(["litros", "ml", "kg", "g", "unidad", "metros"]),
  vidaUtilDias: z.number().int().positive().optional(),
  stockMinimo: z.number().min(0).optional(),
});

export type InsumoFormInput = z.infer<typeof insumoFormSchema>;

export const entradaCompraInsumoSchema = z.object({
  sucursalId: z.string().min(1, "Elegí una sucursal."),
  cantidad: z.number().positive("La cantidad tiene que ser mayor a 0."),
  costoCompra: z.number().positive("El costo tiene que ser mayor a 0."),
  fechaVencimiento: z.string().optional(),
});

export const ajusteInsumoSchema = z.object({
  sucursalId: z.string().min(1, "Elegí una sucursal."),
  tipo: z.enum(["entrada_ajuste_manual", "salida_ajuste_manual"]),
  cantidad: z.number().positive("La cantidad tiene que ser mayor a 0."),
  motivo: z.string().trim().min(1, "Describí el motivo del ajuste."),
});

export const mermaAlmacenamientoSchema = z.object({
  sucursalId: z.string().min(1, "Elegí una sucursal."),
  cantidad: z.number().positive("La cantidad tiene que ser mayor a 0."),
  motivo: z.string().trim().min(1, "Describí el motivo de la merma."),
});

export const recetaFormSchema = z.object({
  nombre: z.string().trim().min(1, "Ponele un nombre a la receta."),
  rendimientoPorLote: z.number().positive("El rendimiento tiene que ser mayor a 0."),
  unidadRendimiento: z.string().trim().min(1, "Indicá la unidad de rendimiento."),
});

export type RecetaFormInput = z.infer<typeof recetaFormSchema>;

export const composicionRecetaSchema = z.array(
  z.object({
    insumoId: z.string().min(1),
    cantidadPorLote: z.number().positive("La cantidad por lote tiene que ser mayor a 0."),
  })
);

export const produccionFormSchema = z.object({
  productoId: z.string().min(1, "Elegí un producto."),
  sucursalId: z.string().min(1, "Elegí una sucursal."),
  activoId: z.string().min(1, "Elegí el equipo de producción."),
  fechaProduccion: z.string().min(1, "Elegí la fecha de producción."),
  cantidadLotesProducidos: z.number().positive("La cantidad de lotes tiene que ser mayor a 0."),
  cantidadRealObtenida: z.number().positive("La cantidad obtenida tiene que ser mayor a 0."),
  fechaVencimientoLote: z.string().optional(),
});

export type ProduccionFormInput = z.infer<typeof produccionFormSchema>;

export const produccionAjusteSchema = z.object({
  costoOperativoCorregido: z.number().min(0).optional(),
  cantidadRealObtenidaCorregida: z.number().positive().optional(),
  motivo: z.string().trim().min(1, "Describí el motivo del ajuste."),
});
