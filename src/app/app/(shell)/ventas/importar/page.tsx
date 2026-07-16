import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { PageHeader } from "@/components/shared/page-header";
import { listarSucursalesPorTenant, obtenerUsuarioActual } from "@/modules/identidad/actions";
import { listarProductos } from "@/modules/productos/actions";
import { listarCanalesVenta, listarClientes } from "@/modules/ventas/actions";
import { ImportarCliente } from "./importar-cliente";

export default async function ImportarVentaHistoricaPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const [canalesResultado, clientesResultado, productosResultado, sucursalesResultado] = await Promise.all([
    listarCanalesVenta(usuario, usuario.tenantId),
    listarClientes(usuario, usuario.tenantId),
    listarProductos(usuario, usuario.tenantId),
    listarSucursalesPorTenant(usuario, usuario.tenantId),
  ]);

  const canales = canalesResultado.ok ? canalesResultado.data : [];
  const clientes = clientesResultado.ok ? clientesResultado.data : [];
  const productos = productosResultado.ok ? productosResultado.data : [];
  const sucursales = sucursalesResultado.ok ? sucursalesResultado.data : [];

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-4xl space-y-4 py-6">
        <Breadcrumb items={[{ label: "Ventas", href: "/app/ventas" }, { label: "Importar historial" }]} />
        <PageHeader
          title="Importar ventas históricas"
          description="Cargá de forma masiva el historial de ventas desde un archivo CSV."
        />

        <ImportarCliente
          canales={canales.map((c) => ({ id: c.id, nombre: c.nombre }))}
          clientes={clientes.map((c) => ({ id: c.id, nombre: c.nombre }))}
          productos={productos.map((p) => ({ id: p.id, nombre: p.nombre }))}
          sucursales={sucursales.map((s) => ({ id: s.id, nombre: s.nombre }))}
        />
      </div>
    </div>
  );
}
