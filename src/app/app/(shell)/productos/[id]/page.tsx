import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { PageHeader } from "@/components/shared/page-header";
import { listarSucursalesPorTenant, obtenerUsuarioActual } from "@/modules/identidad/actions";
import { fichaProducto, listarCategorias } from "@/modules/productos/actions";
import { historialPrecio, listarProveedores } from "@/modules/proveedores/actions";
import { FichaCliente } from "./ficha-cliente";

export default async function FichaProductoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const [fichaResultado, sucursalesResultado, categoriasResultado, historialResultado, proveedoresResultado] =
    await Promise.all([
      fichaProducto(usuario, id),
      listarSucursalesPorTenant(usuario, usuario.tenantId),
      listarCategorias(usuario, usuario.tenantId),
      historialPrecio(usuario, usuario.tenantId, { productoId: id }),
      listarProveedores(usuario, usuario.tenantId),
    ]);

  if (!fichaResultado.ok || !fichaResultado.data.producto) redirect("/app/productos");
  const { producto, stockPorSucursal } = fichaResultado.data;
  const sucursales = sucursalesResultado.ok ? sucursalesResultado.data : [];
  const categorias = categoriasResultado.ok ? categoriasResultado.data : [];
  const categoriaNombre = categorias.find((c) => c.id === producto!.categoriaId)?.nombre;
  const historialPrecios = historialResultado.ok ? historialResultado.data : [];
  const proveedores = proveedoresResultado.ok ? proveedoresResultado.data : [];
  const proveedorPorId = new Map(proveedores.map((p) => [p.id, p.nombre]));

  const precio = Number(producto!.precioVenta);
  const costo =
    producto!.costoOperativoVigente !== null ? Number(producto!.costoOperativoVigente) : null;
  const margenPct = costo !== null && precio > 0 ? ((precio - costo) / precio) * 100 : null;
  const ultimaActualizacion = new Date(producto!.modificadoEn ?? producto!.creadoEn).toLocaleDateString(
    "es-BO",
    { day: "2-digit", month: "short", year: "numeric" }
  );

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-4xl space-y-4 py-6">
        <Breadcrumb items={[{ label: "Catálogo", href: "/app/productos" }, { label: producto!.nombre }]} />
        <PageHeader
          title={producto!.nombre}
          description={producto!.activo ? "Visible para la venta" : "Oculto del catálogo"}
        />

        <FichaCliente
          productoId={id}
          imagenUrl={producto!.imagenUrl}
          categoriaNombre={categoriaNombre}
          unidadVenta={producto!.unidadVenta}
          origenCosto={producto!.origenCosto}
          ultimaActualizacion={ultimaActualizacion}
          precio={precio}
          costo={costo}
          margenPct={margenPct}
          costoBloqueado={producto!.tipoOrigenProducto === "produccion_nicho"}
          stockPorSucursal={stockPorSucursal.map((f) => ({
            sucursalId: f.sucursalId,
            cantidadActual: f.cantidadActual,
            stockMinimo: f.stockMinimo,
          }))}
          sucursales={sucursales.map((s) => ({ id: s.id, nombre: s.nombre }))}
          historialPrecios={historialPrecios
            .slice()
            .reverse()
            .map((c) => ({
              id: c.id,
              fechaCompra: c.fechaCompra,
              costoUnitario: c.costoUnitario,
              cantidad: c.cantidad,
              proveedorNombre: c.proveedorId ? (proveedorPorId.get(c.proveedorId) ?? null) : null,
            }))}
        />
      </div>
    </div>
  );
}
