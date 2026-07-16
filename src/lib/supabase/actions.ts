"use server";

import { redirect } from "next/navigation";
import { crearClienteServidor } from "./server";

// Infra de sesion compartida entre /app y /admin — no es logica de negocio
// de ningun modulo (ver src/lib/supabase/server.ts, mismo criterio).
export async function cerrarSesion() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect("/login");
}
