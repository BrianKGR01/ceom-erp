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
