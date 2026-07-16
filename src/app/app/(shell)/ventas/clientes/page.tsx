import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { PageHeader } from "@/components/shared/page-header";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { listarClientes } from "@/modules/ventas/actions";
import { ClientesCliente } from "./clientes-cliente";

export default async function ClientesPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const clientesResultado = await listarClientes(usuario, usuario.tenantId);
  const clientes = clientesResultado.ok ? clientesResultado.data : [];

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-4xl space-y-4 py-6">
        <Breadcrumb items={[{ label: "Ventas", href: "/app/ventas" }, { label: "Clientes" }]} />
        <PageHeader title="Clientes" description="Gestioná el directorio de clientes de tu negocio." />

        <ClientesCliente
          clientes={clientes.map((c) => ({
            id: c.id,
            nombre: c.nombre,
            telefono: c.telefono,
            email: c.email,
            ultimaCompraEn: c.ultimaCompraEn ? c.ultimaCompraEn.toString() : null,
          }))}
        />
      </div>
    </div>
  );
}
