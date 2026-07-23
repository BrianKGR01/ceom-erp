import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Landing } from "@/components/landing/landing";
import { obtenerUsuarioActual, ROL_CEOM_ADMIN_ID } from "@/modules/identidad/actions";

/**
 * Esta ruta es el Site URL del proyecto de Supabase, o sea el destino por
 * defecto de cualquier enlace de Auth cuyo `redirectTo` no llegue o no este
 * en la lista de Redirect URLs permitidas. Hasta PR #21 tenia el boilerplate
 * de create-next-app; despues quedo como un desvio puro. Ahora es tambien la
 * pagina publica del producto.
 *
 * - **Con sesion**: sigue siendo un desvio a la superficie que corresponde
 *   por rol, con el mismo criterio de reparto que el login
 *   (login/actions.ts) y que la pantalla de fijar contraseña — un solo lugar
 *   decide a donde va cada rol. No cambiar sin cambiar los otros dos.
 * - **Sin sesion**: se muestra la landing. Su unica accion es contacto,
 *   porque CEOM-ERP no tiene alta de cuenta autoservicio (`crearTenant` esta
 *   gateado a `ceom_admin`); quien ya tiene cuenta entra por /login.
 */
export const metadata: Metadata = {
  title: "CEOM — Vendiste todo el mes. ¿Sabés cuánto te quedó?",
  description:
    "CEOM ordena las ventas, los costos y la producción de tu negocio y hace la cuenta completa: cuánto entró, cuánto costó y cuánto te quedó de verdad.",
};

export default async function Home() {
  const usuario = await obtenerUsuarioActual();
  if (usuario) {
    redirect(usuario.rolId === ROL_CEOM_ADMIN_ID ? "/admin" : "/app");
  }

  return <Landing />;
}
