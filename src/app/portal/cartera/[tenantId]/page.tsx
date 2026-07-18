import { redirect } from "next/navigation";
import { obtenerInstitucionActual } from "@/modules/consentimiento/actions";
import { estadoTenantAction } from "../../actions";
import { FichaTenantCliente } from "./ficha-cliente";

export default async function FichaTenantPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const institucion = await obtenerInstitucionActual();
  if (!institucion) redirect("/portal");

  const { tenantId } = await params;
  const estadoRes = await estadoTenantAction(tenantId);
  if (!estadoRes.ok) redirect("/portal");

  return <FichaTenantCliente tenantId={tenantId} tenant={estadoRes.data} />;
}
