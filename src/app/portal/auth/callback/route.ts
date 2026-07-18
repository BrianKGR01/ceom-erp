import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";
import { vincularInstitucionAutenticada } from "@/modules/consentimiento/actions";

// Primer Route Handler del proyecto (ver CEOM_Arquitectura.md seccion 8.3):
// el link del magic link apunta a esta URL, que el navegador visita directo
// por GET al hacer click en el correo — una Server Action no puede ser el
// destino de un link de email, tiene que ser una ruta real.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/portal?error=enlace_invalido`);
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user?.email) {
    return NextResponse.redirect(`${origin}/portal?error=enlace_invalido`);
  }

  // Vinculo perezoso — primera vez que esta identidad de Auth se resuelve a
  // una Institucion (ver vincularInstitucionAutenticada, consentimiento/actions.ts).
  const institucion = await vincularInstitucionAutenticada(data.user.email, data.user.id);
  if (!institucion) {
    // Caso borde: la sesion de Auth se creo pero no hay Institucion con ese
    // email (o ya estaba vinculada a otro auth_user_id) — no dejar una
    // sesion "huerfana" sin Institucion detras.
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/portal?error=sin_institucion`);
  }

  return NextResponse.redirect(`${origin}/portal`);
}
