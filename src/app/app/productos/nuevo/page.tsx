import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
      <div className="mx-auto max-w-lg py-6">
        <Card>
          <CardHeader>
            <CardTitle>Nuevo producto</CardTitle>
            <CardDescription>Cargá lo básico — después podés completar el resto.</CardDescription>
          </CardHeader>
          <CardContent>
            <NuevoCliente categorias={categorias} sucursales={sucursales} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
