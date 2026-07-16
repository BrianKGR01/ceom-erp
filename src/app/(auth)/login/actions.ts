"use server";

import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerUsuarioActual, ROL_CEOM_ADMIN_ID } from "@/modules/identidad/actions";

export type ResultadoLogin = { ok: true } | { ok: false; error: string };

export async function iniciarSesion(
  _prevState: ResultadoLogin | null,
  formData: FormData
): Promise<ResultadoLogin> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { ok: false, error: "Completá tu correo y contraseña." };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { ok: false, error: "Correo o contraseña incorrectos." };
  }

  // Redirect por rol (docs/ui/pantallas.md seccion 0): mismo login para
  // /app y /admin, el destino depende de con que rol quedo autenticado el
  // usuario recien logueado.
  const usuario = await obtenerUsuarioActual();
  if (!usuario) {
    return {
      ok: false,
      error:
        "Tu cuenta no está completamente configurada todavía. Contactá a soporte.",
    };
  }

  redirect(usuario.rolId === ROL_CEOM_ADMIN_ID ? "/admin" : "/app");
}
