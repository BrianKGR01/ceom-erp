import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { listarProductos } from "@/modules/productos/actions";
import { fichaVenta, listarMetodosPago } from "@/modules/ventas/actions";
import { FichaVentaCliente } from "./ficha-cliente";

export default async function FichaVentaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const [fichaResultado, metodosResultado] = await Promise.all([
    fichaVenta(usuario, id),
    listarMetodosPago(usuario, usuario.tenantId),
  ]);

  if (!fichaResultado.ok || !fichaResultado.data.venta) redirect("/app/ventas/historial");
  const { venta, detalles, pagos, ajustes, totalVenta } = fichaResultado.data;
  const metodos = metodosResultado.ok ? metodosResultado.data : [];

  const productosResultado = await listarProductos(usuario, usuario.tenantId);
  const productos = productosResultado.ok ? productosResultado.data : [];
  const productoPorId = new Map(productos.map((p) => [p.id, p.nombre]));
  const metodoPorId = new Map(metodos.map((m) => [m.id, m.nombre]));

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-2xl space-y-6 py-6">
        <PageHeader
          title="Venta"
          description={new Date(venta!.fechaVenta).toLocaleString("es-BO")}
        />

        <FichaVentaCliente
          ventaId={id}
          estadoPagoInicial={venta!.estadoPago}
          totalVenta={totalVenta}
          detalles={detalles.map((d) => ({
            id: d.id,
            productoNombre: productoPorId.get(d.productoId) ?? "Producto",
            cantidad: d.cantidad,
            precioVentaSnapshot: d.precioVentaSnapshot,
            subtotal: d.subtotal,
          }))}
          pagosIniciales={pagos.map((p) => ({
            id: p.id,
            monto: p.monto,
            metodoPagoNombre: metodoPorId.get(p.metodoPagoId) ?? "—",
            fechaPago: p.fechaPago.toString(),
          }))}
          ajustesIniciales={ajustes.map((a) => ({
            id: a.id,
            tipo: a.tipo,
            montoAjuste: a.montoAjuste,
            motivo: a.motivo,
            creadoEn: a.creadoEn.toString(),
          }))}
          metodos={metodos.map((m) => ({ id: m.id, nombre: m.nombre }))}
          productos={detalles.map((d) => ({
            id: d.productoId,
            nombre: productoPorId.get(d.productoId) ?? "Producto",
          }))}
        />
      </div>
    </div>
  );
}
