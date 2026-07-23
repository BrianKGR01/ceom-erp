import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * Callback de Auth de /app — canjea el token de un correo por una sesion.
 *
 * Es un Route Handler y no una Server Action por el mismo motivo que
 * /portal/auth/callback (CEOM_Arquitectura.md seccion 8.3): el navegador
 * llega por GET desde el correo, y una Server Action no puede ser el destino
 * de un link.
 *
 * **Pero NO usa exchangeCodeForSession como el del portal, y la diferencia
 * es deliberada.** El magic link de Instituciones sale de signInWithOtp()
 * llamado desde el cliente SSR, que fuerza PKCE y devuelve `?code=`. Los
 * correos de /app salen de inviteUserByEmail() (cliente service-role) y de
 * resetPasswordForEmail(), sin PKCE: GoTrue los resuelve por flujo implicito
 * y devuelve los tokens en el fragmento `#access_token=...`, que nunca llega
 * al servidor. Verificado en los logs de Auth del proyecto real
 * (`login_method: "implicit"`, 2026-07-23) y anotado antes en
 * consentimiento/ANCLA.md a proposito de generateLink().
 *
 * Por eso las plantillas de correo apuntan acá con `token_hash` + `type`
 * (patron server-side documentado de Supabase) y esta ruta lo canjea con
 * verifyOtp(). Efecto lateral util: `generateLink()` devuelve ese mismo
 * `hashed_token`, asi que el camino entero se puede probar sin bandeja de
 * entrada — ver docs/decisiones/recuperacion-de-acceso.md.
 */

// Solo los tipos que este proyecto realmente emite. Cualquier otro se trata
// como enlace invalido en vez de canjearse a ciegas.
const TIPOS_SOPORTADOS = ["invite", "recovery"] as const;
type TipoSoportado = (typeof TIPOS_SOPORTADOS)[number];

function esTipoSoportado(valor: string | null): valor is TipoSoportado {
  return valor !== null && (TIPOS_SOPORTADOS as readonly string[]).includes(valor);
}

// Ambos tipos terminan en la misma pantalla — el motivo solo cambia el copy
// (ver src/app/app/definir-contrasena/page.tsx).
const DESTINO: Record<TipoSoportado, string> = {
  invite: "/app/definir-contrasena?motivo=invitacion",
  recovery: "/app/definir-contrasena?motivo=recuperacion",
};

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const tipo = searchParams.get("type");

  if (!tokenHash || !esTipoSoportado(tipo)) {
    return NextResponse.redirect(`${origin}/login?error=enlace_invalido`);
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.verifyOtp({
    type: tipo as EmailOtpType,
    token_hash: tokenHash,
  });

  if (error) {
    // Un enlace vencido o ya usado es el caso frecuente y tiene salida
    // (pedir otro); uno con el token roto no. Se distinguen para no decirle
    // "pedí uno nuevo" a alguien que pegó mal la URL.
    const vencido = error.code === "otp_expired" || error.status === 403;
    return NextResponse.redirect(
      `${origin}/login?error=${vencido ? "enlace_vencido" : "enlace_invalido"}`
    );
  }

  return NextResponse.redirect(`${origin}${DESTINO[tipo]}`);
}
