import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { listarCanalesVenta, listarClientes, listarVentasConTotal } from "@/modules/ventas/actions";
import { HistorialCliente } from "./historial-cliente";

export default async function HistorialVentasPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const [ventasResultado, clientesResultado, canalesResultado] = await Promise.all([
    listarVentasConTotal(usuario, usuario.tenantId),
    listarClientes(usuario, usuario.tenantId),
    listarCanalesVenta(usuario, usuario.tenantId),
  ]);

  const ventas = ventasResultado.ok ? ventasResultado.data : [];
  const clientePorId = new Map(
    (clientesResultado.ok ? clientesResultado.data : []).map((c) => [c.id, c.nombre])
  );
  const canalPorId = new Map(
    (canalesResultado.ok ? canalesResultado.data : []).map((c) => [c.id, c.nombre])
  );

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-3xl space-y-6 py-6">
        <PageHeader title="Historial de ventas" description="Todas tus ventas registradas." />

        <HistorialCliente
          ventas={ventas
            .sort((a, b) => new Date(b.fechaVenta).getTime() - new Date(a.fechaVenta).getTime())
            .map((venta) => ({
              id: venta.id,
              fechaVenta: venta.fechaVenta.toString(),
              clienteNombre: venta.clienteId
                ? (clientePorId.get(venta.clienteId) ?? "Cliente")
                : "Sin cliente",
              canalNombre: canalPorId.get(venta.canalVentaId) ?? "—",
              estadoPago: venta.estadoPago,
              total: venta.total,
            }))}
        />
      </div>
    </div>
  );
}
