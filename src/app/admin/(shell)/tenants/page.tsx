import { listarPlanes } from "@/modules/suscripcion/actions";
import { listarTenantsConEstadoAction, saludAgregadaPlataformaAction } from "./actions";
import { TenantsCliente } from "./tenants-cliente";

export default async function TenantsPage() {
  const [saludRes, tenantsRes, planes] = await Promise.all([
    saludAgregadaPlataformaAction(),
    listarTenantsConEstadoAction(),
    listarPlanes(),
  ]);

  const salud = saludRes.ok
    ? saludRes.data
    : { totalTenants: 0, porEstadoAcceso: {}, porPlan: [], porNicho: [] };
  const tenants = tenantsRes.ok ? tenantsRes.data : [];

  return (
    <TenantsCliente
      tenants={tenants}
      planes={planes.map((p) => ({ id: p.id, nombre: p.nombre }))}
      porEstadoAcceso={salud.porEstadoAcceso}
      porPlan={salud.porPlan}
      porNicho={salud.porNicho}
    />
  );
}
