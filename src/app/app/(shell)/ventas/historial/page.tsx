import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/shared/breadcrumb";
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
  const canales = canalesResultado.ok ? canalesResultado.data : [];
  const clientePorId = new Map(
    (clientesResultado.ok ? clientesResultado.data : []).map((c) => [c.id, c.nombre])
  );
  const canalPorId = new Map(canales.map((c) => [c.id, c.nombre]));

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-4xl space-y-4 py-6">
        <Breadcrumb items={[{ label: "Ventas", href: "/app/ventas" }, { label: "Historial de ventas" }]} />
        <PageHeader title="Historial de ventas" description="Todas tus ventas registradas." />

        <HistorialCliente
          canales={canales.map((c) => ({ id: c.id, nombre: c.nombre }))}
          ventas={ventas
            .sort((a, b) => new Date(b.fechaVenta).getTime() - new Date(a.fechaVenta).getTime())
            .map((venta) => ({
              id: venta.id,
              fechaVenta: venta.fechaVenta.toString(),
              clienteNombre: venta.clienteId
                ? (clientePorId.get(venta.clienteId) ?? "Cliente")
                : "Sin cliente",
              canalId: venta.canalVentaId,
              canalNombre: canalPorId.get(venta.canalVentaId) ?? "—",
              estadoPago: venta.estadoPago,
              total: venta.total,
            }))}
        />
      </div>
    </div>
  );
}
