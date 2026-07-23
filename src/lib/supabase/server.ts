import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Cliente de Supabase para Server Actions / Route Handlers, usado UNICAMENTE
// para leer la sesion de Auth (AGENTS.md: supabase-js nunca para queries de
// negocio, esas van por Drizzle en src/db/client.ts).
export async function crearClienteServidor() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Llamado desde un Server Component sin permiso de escritura de
            // cookies — se ignora si hay middleware refrescando la sesion.
          }
        },
      },
    }
  );
}

/**
 * Cliente publico SIN cookies de sesion, para los correos de Auth que se
 * piden desde una pantalla pre-login (recuperar contraseña).
 *
 * No es crearClienteServidor() a proposito: @supabase/ssr fuerza
 * `flowType: "pkce"`, y en PKCE el verificador queda en una cookie del
 * navegador que PIDIO el correo — pedirlo en el celular y abrir el enlace en
 * la compu no funcionaria. Ademas el token quedaria con prefijo `pkce_`, un
 * formato distinto del que emite inviteUserByEmail(), y el callback de /app
 * tendria que canjear dos formatos en vez de uno. Sin SSR, GoTrue emite el
 * mismo token plano que la invitacion (ver src/app/app/auth/callback/route.ts).
 */
export function crearClienteSinSesion() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Cliente admin (service role) para operaciones privilegiadas de Auth (ej.
// invitar usuarios por email). SUPABASE_SECRET_KEY nunca se expone al
// cliente ni se usa fuera de Server Actions.
export function crearClienteAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
