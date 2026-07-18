import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { PageHeader } from "@/components/shared/page-header";
import { listarSucursalesPorTenant, obtenerUsuarioActual } from "@/modules/identidad/actions";
import { listarInsumos } from "@/modules/operativo/nichos/nicho-1/actions";
import { listarProductos } from "@/modules/productos/actions";
import { listarProveedores } from "@/modules/proveedores/actions";
import { NuevaCompraCliente } from "./nueva-compra-cliente";

export default async function NuevaCompraPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const [sucursalesResultado, proveedoresResultado, productosResultado, insumosResultado] =
    await Promise.all([
      listarSucursalesPorTenant(usuario, usuario.tenantId),
      listarProveedores(usuario, usuario.tenantId),
      listarProductos(usuario, usuario.tenantId),
      listarInsumos(usuario, usuario.tenantId),
    ]);

  const sucursales = sucursalesResultado.ok ? sucursalesResultado.data : [];
  const proveedores = proveedoresResultado.ok ? proveedoresResultado.data : [];
  const productos = productosResultado.ok ? productosResultado.data : [];
  const insumos = insumosResultado.ok ? insumosResultado.data : [];

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-2xl space-y-4 py-6">
        <Breadcrumb
          items={[
            { label: "Proveedores", href: "/app/proveedores" },
            { label: "Compras", href: "/app/proveedores/compras" },
            { label: "Nueva compra" },
          ]}
        />
        <PageHeader title="Nueva compra" description="Registrá una compra a proveedor." />

        <NuevaCompraCliente
          sucursales={sucursales.map((s) => ({ id: s.id, nombre: s.nombre }))}
          proveedores={proveedores.map((p) => ({ id: p.id, nombre: p.nombre }))}
          productos={productos.map((p) => ({ id: p.id, nombre: p.nombre }))}
          insumos={insumos.map((i) => ({ id: i.id, nombre: i.nombre }))}
        />
      </div>
    </div>
  );
}
