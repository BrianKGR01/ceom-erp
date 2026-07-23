"use server";

import { urlCallbackApp } from "@/lib/site-url";
import { crearClienteSinSesion } from "@/lib/supabase/server";

export type ResultadoRecuperacion =
  | { ok: true; mensaje: string }
  | { ok: false; error: string };

// Un solo mensaje para "existe" y "no existe". Si el texto cambiara segun el
// caso, cualquiera podria averiguar que correos tienen cuenta escribiendolos
// uno por uno — mismo criterio que solicitarMagicLinkInstitucion()
// (consentimiento/actions.ts).
const MENSAJE_GENERICO =
  "Si ese correo tiene una cuenta, te mandamos un enlace para crear una contraseña nueva. Revisá tu bandeja — y el correo no deseado, por las dudas.";

export async function solicitarRecuperacion(
  _prevState: ResultadoRecuperacion | null,
  formData: FormData
): Promise<ResultadoRecuperacion> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { ok: false, error: "Escribí tu correo electrónico." };
  }

  // A diferencia del magic link de Instituciones, acá NO se consulta antes si
  // el correo existe: resetPasswordForEmail() nunca crea un usuario, asi que
  // no hay riesgo de dejar un auth.users huerfano y la consulta previa solo
  // agregaria una forma de enumerar cuentas.
  const supabase = crearClienteSinSesion();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: urlCallbackApp(),
  });

  // El unico error que se muestra distinto es el cupo de envios: no depende
  // de si la cuenta existe, asi que decirlo no filtra nada, y callarlo dejaria
  // a la persona esperando un correo que no va a llegar.
  if (error?.code === "over_email_send_rate_limit") {
    return {
      ok: false,
      error: "Pediste varios enlaces seguidos. Esperá un minuto y volvé a intentar.",
    };
  }

  return { ok: true, mensaje: MENSAJE_GENERICO };
}
