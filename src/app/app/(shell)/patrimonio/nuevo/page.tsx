import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { PageHeader } from "@/components/shared/page-header";
import { listarSucursalesPorTenant, obtenerUsuarioActual } from "@/modules/identidad/actions";
import { listarProveedores } from "@/modules/proveedores/actions";
import { NuevoActivoCliente } from "./nuevo-activo-cliente";

export default async function NuevoActivoPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const [sucursalesResultado, proveedoresResultado] = await Promise.all([
    listarSucursalesPorTenant(usuario, usuario.tenantId),
    listarProveedores(usuario, usuario.tenantId),
  ]);
  const sucursales = sucursalesResultado.ok ? sucursalesResultado.data : [];
  const proveedores = proveedoresResultado.ok ? proveedoresResultado.data : [];

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-4xl space-y-4 py-6">
        <Breadcrumb items={[{ label: "Patrimonio", href: "/app/patrimonio" }, { label: "Nuevo activo" }]} />
        <PageHeader title="Nuevo activo" description="Registrá la información de un nuevo activo en el inventario." />

        <NuevoActivoCliente
          sucursales={sucursales.map((s) => ({ id: s.id, nombre: s.nombre }))}
          proveedores={proveedores.map((p) => ({ id: p.id, nombre: p.nombre }))}
        />
      </div>
    </div>
  );
}
