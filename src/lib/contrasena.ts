import { z } from "zod";

// Regla propia de la app, mas estricta que el minimo por defecto de Supabase
// Auth (6). Si el proyecto de Supabase exigiera mas, gana el suyo y el error
// llega traducido por mensajeErrorContrasena().
export const LARGO_MINIMO_CONTRASENA = 8;

export const contrasenaNuevaSchema = z
  .object({
    contrasena: z
      .string()
      .min(LARGO_MINIMO_CONTRASENA, `Usá al menos ${LARGO_MINIMO_CONTRASENA} caracteres.`),
    confirmacion: z.string(),
  })
  .refine((datos) => datos.contrasena === datos.confirmacion, {
    message: "Las dos contraseñas no coinciden.",
    path: ["confirmacion"],
  });

export type ContrasenaNuevaInput = z.infer<typeof contrasenaNuevaSchema>;

/**
 * Supabase Auth responde en ingles y con vocabulario tecnico. Se traduce acá
 * en vez de en cada pantalla para que el copy quede consistente con el
 * glosario (docs/manual/glosario.md: voseo, "correo" y no "email").
 */
export function mensajeErrorContrasena(error: { code?: string; message?: string }): string {
  switch (error.code) {
    case "same_password":
      return "Esa es la contraseña que ya tenías — elegí una distinta.";
    case "weak_password":
      return "Esa contraseña es demasiado fácil de adivinar — probá con una más larga.";
    case "session_not_found":
    case "session_expired":
      return "Tu sesión expiró — pedí un enlace nuevo.";
    default:
      return "No pudimos guardar la contraseña — intentá de nuevo.";
  }
}
