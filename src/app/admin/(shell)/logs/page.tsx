import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { listarLogsAcceso } from "@/modules/consentimiento/actions";
import { listarTenantsAction } from "../instituciones/actions";
import { LogsCliente } from "./logs-cliente";

export default async function LogsAccesoPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const [logsRes, tenantsRes] = await Promise.all([
    listarLogsAcceso(usuario, {}),
    listarTenantsAction(),
  ]);
  const tenants = tenantsRes.ok ? tenantsRes.data : [];

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-4xl space-y-4 py-6">
        <LogsCliente
          datosIniciales={logsRes}
          tenants={tenants.map((t) => ({ id: t.id, nombreNegocio: t.nombreNegocio }))}
        />
      </div>
    </div>
  );
}
