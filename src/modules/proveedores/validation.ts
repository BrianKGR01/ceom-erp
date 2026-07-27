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

// Direccion del ajuste segun su tipo — mismo criterio y misma leccion que
// errorSignoAjuste() en ventas/validation.ts (H-30: un ajuste mal firmado
// que sumaba en vez de restar).
//
// Convencion de signo, la que ya insinuaba el placeholder del formulario
// ("Negativo si es a favor del negocio"):
//   positivo -> la compra terminó costando MAS de lo registrado
//   negativo -> a favor del negocio (devolución, anulación, corrección a la baja)
//
// Dos de los tres tipos solo pueden ir a favor del negocio, así que su signo
// se deriva del tipo y el usuario no lo elige. "correccion" es el único
// bidireccional a propósito: un error de carga puede haber sido de más o de
// menos.
export const TIPOS_AJUSTE_COMPRA_A_FAVOR = [
  "devolucion_a_proveedor",
  "anulacion_total",
] as const;

export type TipoAjusteCompra =
  | "correccion"
  | (typeof TIPOS_AJUSTE_COMPRA_A_FAVOR)[number];

export function esTipoAjusteCompraAFavor(tipo: TipoAjusteCompra): boolean {
  return (TIPOS_AJUSTE_COMPRA_A_FAVOR as readonly string[]).includes(tipo);
}

/** Regla de signo compartida por el schema de ruta y el guard del modulo,
 * para que ambos digan exactamente lo mismo. Devuelve el error, o null si el
 * monto es coherente con el tipo. */
export function errorSignoAjusteCompra(
  tipo: TipoAjusteCompra,
  montoAjuste: number
): string | null {
  if (!Number.isFinite(montoAjuste) || montoAjuste === 0) {
    return "El monto del ajuste no puede ser cero.";
  }
  if (esTipoAjusteCompraAFavor(tipo) && montoAjuste > 0) {
    return "Este tipo de ajuste solo puede reducir la compra: el monto tiene que ser negativo.";
  }
  return null;
}

export const compraAjusteSchema = z
  .object({
    tipo: z.enum(["correccion", "devolucion_a_proveedor", "anulacion_total"]),
    montoAjuste: z.number(),
    motivo: z.string().trim().min(1, "Describí el motivo del ajuste."),
  })
  .refine((d) => d.montoAjuste !== 0, {
    path: ["montoAjuste"],
    message: "El monto del ajuste no puede ser cero.",
  })
  .refine((d) => !esTipoAjusteCompraAFavor(d.tipo) || d.montoAjuste < 0, {
    path: ["montoAjuste"],
    message:
      "Este tipo de ajuste solo puede reducir la compra: el monto tiene que ser negativo.",
  });
