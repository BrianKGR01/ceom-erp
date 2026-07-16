import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { fichaProducto, listarCategorias } from "@/modules/productos/actions";
import { EditarCliente } from "./editar-cliente";

export default async function EditarProductoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const [fichaResultado, categoriasResultado] = await Promise.all([
    fichaProducto(usuario, id),
    listarCategorias(usuario, usuario.tenantId),
  ]);

  if (!fichaResultado.ok || !fichaResultado.data.producto) redirect("/app/productos");
  const { producto } = fichaResultado.data;
  const categorias = categoriasResultado.ok ? categoriasResultado.data : [];

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-lg py-6">
        <Card>
          <CardHeader>
            <CardTitle>Editar {producto!.nombre}</CardTitle>
            <CardDescription>Los cambios se aplican al instante.</CardDescription>
          </CardHeader>
          <CardContent>
            <EditarCliente
              productoId={id}
              categorias={categorias}
              costoBloqueado={producto!.tipoOrigenProducto === "produccion_nicho"}
              initialValues={{
                categoriaId: producto!.categoriaId ?? undefined,
                nombre: producto!.nombre,
                unidadVenta: producto!.unidadVenta,
                precioVenta: Number(producto!.precioVenta),
                costoOperativoVigente:
                  producto!.costoOperativoVigente !== null
                    ? Number(producto!.costoOperativoVigente)
                    : undefined,
                vidaUtilDias: producto!.vidaUtilDias ?? undefined,
                activo: producto!.activo,
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
