// URL publica de la app, unica fuente de verdad para armar los `redirectTo`
// que viajan dentro de un correo de Supabase Auth. Vive fuera de los modulos
// a proposito: es configuracion de infra (como src/lib/supabase/), no una
// regla de negocio de Identidad — los modulos reciben la URL ya resuelta por
// su Server Action delgada, mismo criterio que
// solicitarMagicLinkInstitucionAction (src/app/portal/actions.ts).
export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/**
 * Destino de los enlaces de correo que abren una sesion de /app (invitacion
 * y recuperacion de contraseña). Tiene que estar en la lista de Redirect URLs
 * del proyecto de Supabase, si no GoTrue redirige al Site URL y se pierde.
 */
export function urlCallbackApp(): string {
  return `${siteUrl()}/app/auth/callback`;
}
