import Link from "next/link";
import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
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
      <div className="mx-auto max-w-4xl space-y-4 py-6">
        <Breadcrumb
          items={[
            { label: "Catálogo", href: "/app/productos" },
            { label: producto!.nombre, href: `/app/productos/${id}` },
            { label: "Editar" },
          ]}
        />
        <PageHeader
          title={`Editar ${producto!.nombre}`}
          description="Los cambios se aplican al instante."
          action={
            <Button variant="outline" render={<Link href={`/app/productos/${id}`} />} nativeButton={false}>
              Cancelar
            </Button>
          }
        />
        <EditarCliente
          productoId={id}
          categorias={categorias}
          costoBloqueado={producto!.tipoOrigenProducto === "produccion_nicho"}
          initialValues={{
            categoriaId: producto!.categoriaId ?? undefined,
            nombre: producto!.nombre,
            imagenUrl: producto!.imagenUrl ?? undefined,
            unidadVenta: producto!.unidadVenta,
            precioVenta: Number(producto!.precioVenta),
            costoOperativoVigente:
              producto!.costoOperativoVigente !== null
                ? Number(producto!.costoOperativoVigente)
                : undefined,
            vidaUtilDias: producto!.vidaUtilDias ?? undefined,
            fechaVencimientoReferencia: producto!.fechaVencimientoReferencia ?? undefined,
            activo: producto!.activo,
          }}
        />
      </div>
    </div>
  );
}
