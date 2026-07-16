import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

// Refresca el token de sesion de Supabase Auth en cada request server-side
// (patron recomendado de @supabase/ssr) — sin esto, las cookies de sesion
// pueden quedar desactualizadas y un usuario logueado aparece deslogueado
// en medio de la navegacion. No implementa gates de rol/superficie (eso es
// responsabilidad de cada layout, ver docs/ui/pantallas.md seccion 0).
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // El efecto secundario de refrescar la cookie ocurre dentro de getUser();
  // no se usa el resultado acá — cada layout protegido vuelve a resolver la
  // sesión con obtenerUsuarioActual().
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
