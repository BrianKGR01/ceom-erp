"use server";

import { contrasenaNuevaSchema, mensajeErrorContrasena } from "@/lib/contrasena";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";

export type ResultadoCambioContrasena =
  | { ok: true; mensaje: string }
  | { ok: false; error: string };

/**
 * Cambia la contraseña de quien ya esta trabajando dentro de la app.
 *
 * A diferencia de definirContrasena() —donde la prueba de identidad es el
 * token del correo— acá no hubo ningun token: la unica prueba es una sesion
 * abierta. Por eso se re-autentica con la contraseña actual antes de cambiar
 * nada. Sin ese paso, un navegador que quedo abierto en un negocio ajeno
 * alcanza para quedarse con la cuenta.
 */
export async function cambiarContrasena(
  _prevState: ResultadoCambioContrasena | null,
  formData: FormData
): Promise<ResultadoCambioContrasena> {
  const actual = String(formData.get("actual") ?? "");
  const parseo = contrasenaNuevaSchema.safeParse({
    contrasena: String(formData.get("contrasena") ?? ""),
    confirmacion: String(formData.get("confirmacion") ?? ""),
  });
  if (!actual) {
    return { ok: false, error: "Escribí tu contraseña actual." };
  }
  if (!parseo.success) {
    return { ok: false, error: parseo.error.issues[0].message };
  }

  // El gate de la app es obtenerUsuarioActual(): no alcanza con tener sesion
  // de Auth, tiene que existir la fila de usuarios detras (mismo criterio que
  // el resto de las Server Actions del proyecto).
  const usuario = await obtenerUsuarioActual();
  if (!usuario) {
    return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  }

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  }

  // El correo sale de Auth y NO de usuarios.email, aunque en la practica sean
  // el mismo: si alguna vez divergieran, re-autenticar contra el de la tabla
  // podria validar la contraseña de otra identidad de Auth.
  const { error: errorReauth } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: actual,
  });
  if (errorReauth) {
    // Mismo texto que el login para el mismo hecho, pero acotado a la
    // contraseña: el correo no lo escribio la persona, sale de la sesion.
    return { ok: false, error: "Esa no es tu contraseña actual." };
  }

  const { error } = await supabase.auth.updateUser({ password: parseo.data.contrasena });
  if (error) {
    return { ok: false, error: mensajeErrorContrasena(error) };
  }

  // Sin redirect: la persona estaba haciendo otra cosa y vuelve a lo suyo.
  return { ok: true, mensaje: "Listo, tu contraseña quedó cambiada." };
}
