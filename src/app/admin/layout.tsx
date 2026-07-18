import { redirect } from "next/navigation";
import { obtenerUsuarioActual, ROL_CEOM_ADMIN_ID } from "@/modules/identidad/actions";

// Gate server-side de la superficie /admin (docs/ui/pantallas.md seccion 0):
// exclusivo de ceom_admin. Un usuario autenticado pero sin ese rol se manda
// a /app, no a /login — ya esta identificado, solo no tiene acceso acá.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");
  if (usuario.rolId !== ROL_CEOM_ADMIN_ID) redirect("/app");

  return <>{children}</>;
}
