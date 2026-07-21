import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { PageHeader } from "@/components/shared/page-header";
import { listarSucursalesPorTenant, obtenerUsuarioActual } from "@/modules/identidad/actions";
import { listarCanalesVenta, listarEventos } from "@/modules/ventas/actions";
import { EventosCliente } from "./eventos-cliente";

export default async function EventosPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const [eventosResultado, canalesResultado, sucursalesResultado] = await Promise.all([
    listarEventos(usuario, usuario.tenantId),
    listarCanalesVenta(usuario, usuario.tenantId),
    listarSucursalesPorTenant(usuario, usuario.tenantId),
  ]);

  const eventos = eventosResultado.ok ? eventosResultado.data : [];
  const canales = canalesResultado.ok ? canalesResultado.data : [];
  const sucursales = sucursalesResultado.ok ? sucursalesResultado.data : [];
  const canalPorId = new Map(canales.map((c) => [c.id, c.nombre]));
  const sucursalPorId = new Map(sucursales.map((s) => [s.id, s.nombre]));

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      {/* max-w-4xl: listado denso, ver docs/design-system.md §7.2 */}
      <div className="mx-auto max-w-4xl space-y-4 py-6">
        <Breadcrumb items={[{ label: "Ventas", href: "/app/ventas" }, { label: "Eventos" }]} />
        <PageHeader
          title="Eventos"
          description="Listado de ferias y pop-ups activos e históricos."
        />

        <EventosCliente
          canales={canales.map((c) => ({
            id: c.id,
            nombre: c.nombre,
            porcentajeComisionDefault: c.porcentajeComisionDefault,
          }))}
          sucursales={sucursales.map((s) => ({ id: s.id, nombre: s.nombre }))}
          eventos={eventos.map((e) => ({
            id: e.id,
            nombre: e.nombre,
            sucursalNombre: sucursalPorId.get(e.sucursalId) ?? "—",
            canalNombre: canalPorId.get(e.canalVentaId) ?? "—",
            porcentajeComision: e.porcentajeComision,
            fechaInicio: e.fechaInicio.toString(),
            fechaFin: e.fechaFin.toString(),
            estado: e.estado,
          }))}
        />
      </div>
    </div>
  );
}
