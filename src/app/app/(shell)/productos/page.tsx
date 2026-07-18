import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { listarCategorias, listarProductos } from "@/modules/productos/actions";
import { CatalogoCliente } from "./catalogo-cliente";
import { GestionarCategoriasBoton } from "./gestionar-categorias-dialog";

export default async function CatalogoPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const [productosResultado, categoriasResultado] = await Promise.all([
    listarProductos(usuario, usuario.tenantId),
    listarCategorias(usuario, usuario.tenantId),
  ]);

  const productos = productosResultado.ok ? productosResultado.data : [];
  const categorias = categoriasResultado.ok ? categoriasResultado.data : [];
  const categoriasConConteo = categorias.map((categoria) => ({
    id: categoria.id,
    nombre: categoria.nombre,
    cantidadProductos: productos.filter((p) => p.categoriaId === categoria.id).length,
  }));

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-6xl space-y-6 py-6">
        <PageHeader
          title="Catálogo"
          description="Los productos que tenés cargados para vender."
          action={
            <div className="flex items-center gap-2">
              <GestionarCategoriasBoton categorias={categoriasConConteo} />
              <Button render={<Link href="/app/productos/nuevo" />} nativeButton={false}>
                <Plus className="size-4" />
                Nuevo producto
              </Button>
            </div>
          }
        />

        {productos.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Todavía no cargaste ningún producto"
            description="Empezá cargando el primero — te toma menos de un minuto."
            action={{ label: "Cargar mi primer producto", href: "/app/productos/nuevo" }}
          />
        ) : (
          <CatalogoCliente productos={productos} categorias={categorias} />
        )}
      </div>
    </div>
  );
}
