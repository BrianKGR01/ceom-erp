import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";

// Gate server-side de la superficie /app (docs/ui/pantallas.md seccion 0):
// cualquier usuario autenticado del tenant puede entrar. El layout real con
// sidebar/Context de sesion se construye en el siguiente paso de Etapa B —
// esto solo prueba que el login realmente autentica y protege la ruta.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  return <>{children}</>;
}
