import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { PageHeader } from "@/components/shared/page-header";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { listarInsumos } from "@/modules/operativo/nichos/nicho-1/actions";
import { listarProductos } from "@/modules/productos/actions";
import { listarCompras, listarProveedores } from "@/modules/proveedores/actions";
import { ComprasCliente } from "./compras-cliente";

export default async function ComprasPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const [comprasResultado, proveedoresResultado, productosResultado, insumosResultado] =
    await Promise.all([
      listarCompras(usuario, usuario.tenantId),
      listarProveedores(usuario, usuario.tenantId),
      listarProductos(usuario, usuario.tenantId),
      listarInsumos(usuario, usuario.tenantId),
    ]);

  const compras = comprasResultado.ok ? comprasResultado.data : [];
  const proveedores = proveedoresResultado.ok ? proveedoresResultado.data : [];
  const productos = productosResultado.ok ? productosResultado.data : [];
  const insumos = insumosResultado.ok ? insumosResultado.data : [];
  const proveedorPorId = new Map(proveedores.map((p) => [p.id, p.nombre]));
  const nombrePorItem = new Map<string, string>([
    ...productos.map((p) => [p.id, p.nombre] as const),
    ...insumos.map((i) => [i.id, i.nombre] as const),
  ]);

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-5xl space-y-4 py-6">
        <Breadcrumb items={[{ label: "Proveedores", href: "/app/proveedores" }, { label: "Compras" }]} />
        <PageHeader title="Compras" description="Gestioná tus órdenes, recepciones y pagos a proveedores." />

        <ComprasCliente
          compras={compras.map((c) => ({
            id: c.id,
            itemNombre: nombrePorItem.get((c.insumoId ?? c.productoId)!) ?? "Ítem eliminado",
            proveedorNombre: c.proveedorId ? (proveedorPorId.get(c.proveedorId) ?? "—") : null,
            cantidad: c.cantidad,
            montoTotal: c.montoTotal,
            fechaCompra: c.fechaCompra,
            estado: c.estado,
            estadoPago: c.estadoPago,
          }))}
        />
      </div>
    </div>
  );
}
