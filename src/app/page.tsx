import { redirect } from "next/navigation";
import { obtenerUsuarioActual, ROL_CEOM_ADMIN_ID } from "@/modules/identidad/actions";

/**
 * Hasta ahora acá vivia el boilerplate de create-next-app, y no es una
 * pantalla cualquiera: es el Site URL del proyecto de Supabase, o sea el
 * destino por defecto de cualquier enlace de Auth cuyo `redirectTo` no llegue
 * o no este en la lista de Redirect URLs permitidas. Quien caia acá con un
 * token recien canjeado leia "To get started, edit the page.tsx file".
 *
 * No es una landing — CEOM-ERP no tiene alta de cuenta autoservicio
 * (crearTenant esta gateado a ceom_admin). Es solo un desvio: con sesion, a
 * la superficie que corresponda por rol; sin sesion, al login.
 */
export default async function Home() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  // Mismo criterio de reparto que el login (login/actions.ts) y que la
  // pantalla de fijar contraseña — un solo lugar decide a donde va cada rol.
  redirect(usuario.rolId === ROL_CEOM_ADMIN_ID ? "/admin" : "/app");
}
