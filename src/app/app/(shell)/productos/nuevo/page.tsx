import Link from "next/link";
import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { listarSucursalesPorTenant, obtenerUsuarioActual } from "@/modules/identidad/actions";
import { listarCategorias } from "@/modules/productos/actions";
import { NuevoCliente } from "./nuevo-cliente";

export default async function NuevoProductoPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const [categoriasResultado, sucursalesResultado] = await Promise.all([
    listarCategorias(usuario, usuario.tenantId),
    listarSucursalesPorTenant(usuario, usuario.tenantId),
  ]);

  const categorias = categoriasResultado.ok ? categoriasResultado.data : [];
  const sucursales = sucursalesResultado.ok ? sucursalesResultado.data : [];

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-4xl space-y-4 py-6">
        <Breadcrumb items={[{ label: "Catálogo", href: "/app/productos" }, { label: "Nuevo producto" }]} />
        <PageHeader
          title="Nuevo producto"
          description="Cargá lo básico — después podés completar el resto."
          action={
            <Button variant="outline" render={<Link href="/app/productos" />} nativeButton={false}>
              Cancelar
            </Button>
          }
        />
        <NuevoCliente categorias={categorias} sucursales={sucursales} />
      </div>
    </div>
  );
}
