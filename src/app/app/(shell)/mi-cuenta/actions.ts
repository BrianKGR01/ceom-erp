"use server";

import { urlCallbackApp } from "@/lib/site-url";
import { crearClienteServidor, crearClienteSinSesion } from "@/lib/supabase/server";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";

export type ResultadoCambioContrasena =
  | { ok: true; mensaje: string }
  | { ok: false; error: string };

/**
 * Manda a la persona logueada un enlace para cambiar su propia contraseña.
 *
 * **Por que un enlace y no un formulario de "contraseña actual + nueva".**
 * Esa version se construyo primero y se cayo en la verificacion contra el
 * dev server: pedir la contraseña actual obliga a re-autenticar, y la unica
 * forma de re-autenticar con Supabase es signInWithPassword(), que abre una
 * sesion nueva. Verificado en la base real: al cambiar la contraseña, GoTrue
 * conserva la sesion que hizo el cambio y **revoca todas las demas** — asi
 * que el formulario terminaba expulsando a la persona al login sin haber
 * cambiado nada. Ver docs/decisiones/recuperacion-de-acceso.md.
 *
 * El enlace por correo no es un rodeo: prueba mas que la contraseña actual
 * (control de la casilla, no de un navegador que quedo abierto) y reusa el
 * unico camino que ya esta verificado end-to-end — el mismo callback y la
 * misma pantalla que usan la invitacion y la recuperacion.
 */
export async function solicitarCambioDeContrasena(): Promise<ResultadoCambioContrasena> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) {
    return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  }

  // El correo sale de Auth y NO de usuarios.email: si alguna vez divergieran,
  // mandar el enlace al de la tabla se lo estaria mandando a otra identidad.
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return { ok: false, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  }

  // Cliente sin cookies, mismo motivo que en recuperar-contrasena: el cliente
  // SSR fuerza PKCE y el token quedaria en un formato que el callback no
  // canjea.
  const { error } = await crearClienteSinSesion().auth.resetPasswordForEmail(user.email, {
    redirectTo: urlCallbackApp(),
  });

  if (error?.code === "over_email_send_rate_limit") {
    return {
      ok: false,
      error: "Pediste varios enlaces seguidos. Esperá un minuto y volvé a intentar.",
    };
  }
  if (error) {
    return { ok: false, error: "No pudimos enviarte el enlace — intentá de nuevo." };
  }

  return {
    ok: true,
    mensaje: `Te mandamos un enlace a ${user.email}. Abrilo para elegir tu contraseña nueva.`,
  };
}
