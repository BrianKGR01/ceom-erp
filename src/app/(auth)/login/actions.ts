"use server";

import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";

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

  // Placeholder hasta que exista una ruta de dashboard real (ver plan de
  // esta fase de UI).
  redirect("/");
}
