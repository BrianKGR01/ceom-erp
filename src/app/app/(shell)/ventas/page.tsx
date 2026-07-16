import Link from "next/link";
import { redirect } from "next/navigation";
import { Package } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { listarSucursalesPorTenant, obtenerUsuarioActual } from "@/modules/identidad/actions";
import { listarCategorias, listarProductos } from "@/modules/productos/actions";
import { listarCanalesVenta, listarClientes, listarMetodosPago } from "@/modules/ventas/actions";
import { PosCliente } from "./pos-cliente";

export default async function PuntoDeVentaPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const [
    productosResultado,
    sucursalesResultado,
    clientesResultado,
    canalesResultado,
    metodosResultado,
    categoriasResultado,
  ] = await Promise.all([
    listarProductos(usuario, usuario.tenantId),
    listarSucursalesPorTenant(usuario, usuario.tenantId),
    listarClientes(usuario, usuario.tenantId),
    listarCanalesVenta(usuario, usuario.tenantId),
    listarMetodosPago(usuario, usuario.tenantId),
    listarCategorias(usuario, usuario.tenantId),
  ]);

  const productos = (productosResultado.ok ? productosResultado.data : []).filter((p) => p.activo);
  const sucursales = sucursalesResultado.ok ? sucursalesResultado.data : [];
  const clientes = clientesResultado.ok ? clientesResultado.data : [];
  const canales = canalesResultado.ok ? canalesResultado.data : [];
  const metodos = metodosResultado.ok ? metodosResultado.data : [];
  const categorias = categoriasResultado.ok ? categoriasResultado.data : [];

  const sucursalPrincipal = sucursales.find((s) => s.esPrincipal) ?? sucursales[0];

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-5xl space-y-6 py-6">
        <PageHeader
          title="Vender"
          description="Elegí los productos y confirmá la venta."
          action={
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium">
              <Link href="/app/ventas/historial" className="text-primary hover:underline">
                Historial
              </Link>
              <Link href="/app/ventas/clientes" className="text-primary hover:underline">
                Clientes
              </Link>
              <Link href="/app/ventas/canales" className="text-primary hover:underline">
                Canales
              </Link>
              <Link href="/app/ventas/metodos-pago" className="text-primary hover:underline">
                Métodos de pago
              </Link>
              <Link href="/app/ventas/eventos" className="text-primary hover:underline">
                Eventos
              </Link>
              <Link href="/app/ventas/importar" className="text-primary hover:underline">
                Importar historial
              </Link>
            </div>
          }
        />

        {productos.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Todavía no tenés productos para vender"
            description="Cargá tu primer producto para poder empezar a vender."
            action={{ label: "Cargar producto", href: "/app/productos/nuevo" }}
          />
        ) : !sucursalPrincipal ? (
          <p className="text-sm text-text-muted">
            Tu negocio todavía no tiene una sucursal configurada.
          </p>
        ) : (
          <PosCliente
            sucursalId={sucursalPrincipal.id}
            productos={productos.map((p) => ({
              id: p.id,
              categoriaId: p.categoriaId,
              nombre: p.nombre,
              imagenUrl: p.imagenUrl,
              unidadVenta: p.unidadVenta,
              precioVenta: p.precioVenta,
            }))}
            categorias={categorias.map((c) => ({ id: c.id, nombre: c.nombre }))}
            clientesIniciales={clientes.map((c) => ({ id: c.id, nombre: c.nombre }))}
            canalesIniciales={canales.map((c) => ({ id: c.id, nombre: c.nombre }))}
            metodosIniciales={metodos.map((m) => ({ id: m.id, nombre: m.nombre }))}
          />
        )}
      </div>
    </div>
  );
}
