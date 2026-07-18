import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { obtenerModulosPermitidosAction } from "./actions";
import { GenerarCodigoCliente } from "./generar-cliente";

export default async function ConsentimientoPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const modulosRes = await obtenerModulosPermitidosAction();
  const modulosPermitidos = modulosRes.ok ? modulosRes.data.modulosVeedorPermitidos : [];

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-3xl space-y-4 py-6">
        <GenerarCodigoCliente modulosPermitidos={modulosPermitidos} />
      </div>
    </div>
  );
}
