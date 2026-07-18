import { redirect } from "next/navigation";
import { listarPlanes } from "@/modules/suscripcion/actions";
import { consultarTenantDetalleAction } from "../actions";
import { FichaTenantAdminCliente } from "./ficha-cliente";

export default async function FichaTenantAdminPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const [res, planes] = await Promise.all([
    consultarTenantDetalleAction(tenantId),
    listarPlanes(),
  ]);
  if (!res.ok) redirect("/admin/tenants");

  return (
    <FichaTenantAdminCliente
      tenantId={tenantId}
      tenant={res.data}
      planes={planes.map((p) => ({ id: p.id, nombre: p.nombre, activo: p.activo }))}
    />
  );
}
