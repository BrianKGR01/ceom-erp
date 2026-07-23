"use server";

import { redirect } from "next/navigation";
import { contrasenaNuevaSchema, mensajeErrorContrasena } from "@/lib/contrasena";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerUsuarioActual, ROL_CEOM_ADMIN_ID } from "@/modules/identidad/actions";

export type ResultadoDefinirContrasena = { ok: false; error: string };

/**
 * Fija la contraseña de quien ya tiene sesion abierta. La prueba de identidad
 * es el token del correo que canjeo /app/auth/callback — por eso acá NO se
 * pide la contraseña actual: el invitado no tiene ninguna, y el que la olvido
 * tampoco puede escribirla. El cambio *dentro* de la sesion es otra pantalla
 * y sí la pide (/app/mi-cuenta), porque ahi no hubo ningun token.
 *
 * Devuelve solo el caso de error: el exito termina en redirect().
 */
export async function definirContrasena(
  _prevState: ResultadoDefinirContrasena | null,
  formData: FormData
): Promise<ResultadoDefinirContrasena> {
  const parseo = contrasenaNuevaSchema.safeParse({
    contrasena: String(formData.get("contrasena") ?? ""),
    confirmacion: String(formData.get("confirmacion") ?? ""),
  });
  if (!parseo.success) {
    return { ok: false, error: parseo.error.issues[0].message };
  }

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Tu sesión expiró — pedí un enlace nuevo." };
  }

  const { error } = await supabase.auth.updateUser({ password: parseo.data.contrasena });
  if (error) {
    return { ok: false, error: mensajeErrorContrasena(error) };
  }

  // Mismo redirect por rol que el login (login/actions.ts): un ceom_admin que
  // fija su contraseña pertenece a /admin, no a /app.
  const usuario = await obtenerUsuarioActual();
  if (!usuario) {
    // La contraseña YA quedo guardada — lo que falta es la fila de usuarios,
    // que solo puede crear CEOM. Mismo mensaje que el login para el mismo
    // estado, asi la persona no lee dos explicaciones distintas del problema.
    redirect("/login?error=cuenta_incompleta");
  }

  redirect(usuario.rolId === ROL_CEOM_ADMIN_ID ? "/admin" : "/app");
}
