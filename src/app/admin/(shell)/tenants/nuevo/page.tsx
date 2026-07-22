import { Breadcrumb } from "@/components/shared/breadcrumb";
import { PageHeader } from "@/components/shared/page-header";
import { listarPlanes } from "@/modules/suscripcion/actions";
import { NuevoTenantCliente } from "./nuevo-tenant-cliente";

export default async function NuevoTenantPage() {
  const planes = await listarPlanes({ soloActivos: true });

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-2xl space-y-4 py-6">
        <Breadcrumb
          items={[
            { label: "Negocios", href: "/admin/tenants" },
            { label: "Nuevo negocio" },
          ]}
        />
        <PageHeader
          title="Alta de nuevo negocio"
          description="Configura una nueva institución y su administrador principal."
        />

        <NuevoTenantCliente
          planes={planes.map((p) => ({
            id: p.id,
            nombre: p.nombre,
            precioMensual: p.precioMensual,
            moneda: p.moneda,
          }))}
        />
      </div>
    </div>
  );
}
