import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { PageHeader } from "@/components/shared/page-header";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { listarCanalesVenta } from "@/modules/ventas/actions";
import { CanalesCliente } from "./canales-cliente";

export default async function CanalesDeVentaPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const canalesResultado = await listarCanalesVenta(usuario, usuario.tenantId);
  const canales = canalesResultado.ok ? canalesResultado.data : [];

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-4xl space-y-4 py-6">
        <Breadcrumb items={[{ label: "Ventas", href: "/app/ventas" }, { label: "Canales de venta" }]} />
        <PageHeader
          title="Canales de venta"
          description="Gestioná las plataformas donde ofrecés tus productos."
        />

        <CanalesCliente
          canales={canales.map((c) => ({
            id: c.id,
            nombre: c.nombre,
            porcentajeComisionDefault: c.porcentajeComisionDefault,
            activo: c.activo,
          }))}
        />
      </div>
    </div>
  );
}
