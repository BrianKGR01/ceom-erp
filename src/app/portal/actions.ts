"use server";

import { redirect } from "next/navigation";
import { canjearCodigoAcceso, solicitarMagicLinkInstitucion } from "@/modules/consentimiento/actions";
import type { DatosInstitucion } from "@/modules/consentimiento/actions";
import { crearClienteServidor } from "@/lib/supabase/server";

export async function canjearCodigoAccesoAction(input: {
  codigo: string;
  institucionNueva: DatosInstitucion;
}) {
  return canjearCodigoAcceso(input);
}

// Delgada: solo resuelve la URL de redirect del magic link (especifica de
// esta ruta) y delega la decision real (¿existe una Institucion con este
// email?) en el modulo — ver solicitarMagicLinkInstitucion,
// consentimiento/actions.ts.
export async function solicitarMagicLinkInstitucionAction(email: string) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return solicitarMagicLinkInstitucion(email, `${siteUrl}/portal/auth/callback`);
}

// La cerrarSesion() compartida (src/lib/supabase/actions.ts) siempre
// redirige a /login — no tiene sentido para una Institucion, que no tiene
// contraseña ni cuenta ahi.
export async function cerrarSesionInstitucionAction() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect("/portal");
}
