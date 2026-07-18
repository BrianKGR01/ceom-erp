import { redirect } from "next/navigation";
import { consultarTenantDetalleAction } from "../actions";
import { FichaTenantAdminCliente } from "./ficha-cliente";

export default async function FichaTenantAdminPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const res = await consultarTenantDetalleAction(tenantId);
  if (!res.ok) redirect("/admin/tenants");

  return <FichaTenantAdminCliente tenantId={tenantId} tenant={res.data} />;
}
