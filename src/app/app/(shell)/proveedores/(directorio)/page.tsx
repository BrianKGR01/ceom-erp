import { redirect } from "next/navigation";
import { Truck } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { listarProveedores } from "@/modules/proveedores/actions";

// Indice del maestro-detalle: si hay al menos un proveedor, entra directo
// a su ficha (patron tipo cliente de correo) — el estado vacio solo se ve
// cuando el tenant todavia no cargo ningun proveedor.
export default async function ProveedoresIndexPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const resultado = await listarProveedores(usuario, usuario.tenantId);
  const proveedores = resultado.ok ? resultado.data : [];

  if (proveedores.length > 0) {
    redirect(`/app/proveedores/${proveedores[0].id}`);
  }

  return (
    <EmptyState
      icon={Truck}
      title="Todavía no cargaste ningún proveedor"
      description="Usá el botón 'Nuevo' del directorio para cargar el primero."
    />
  );
}
