import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import {
  listarNombresDeInstituciones,
  listarSolicitudesPorTenant,
} from "@/modules/consentimiento/actions";
import { SolicitudesCliente } from "./solicitudes-cliente";

export default async function SolicitudesPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const resultado = await listarSolicitudesPorTenant(usuario, usuario.tenantId);
  if (!resultado.ok) {
    return (
      <div className="min-h-screen bg-gray-bg p-6 xl:p-8">
        <div className="mx-auto max-w-4xl py-6">
          <p className="text-sm text-error-text">{resultado.error}</p>
        </div>
      </div>
    );
  }

  // Una consulta para todas las instituciones, no una por fila.
  const nombrePorInstitucion = await listarNombresDeInstituciones(
    resultado.data.map((s) => s.institucionId)
  );

  const filas = resultado.data.map((s) => ({
    id: s.id,
    institucionNombre: nombrePorInstitucion[s.institucionId] ?? "Institución",
    modulosSolicitados: s.modulosSolicitados,
    estado: s.estado,
    creadoEn: s.creadoEn,
  }));

  return (
    <div className="min-h-screen bg-gray-bg p-6 xl:p-8">
      <div className="mx-auto max-w-4xl space-y-4 py-6">
        <SolicitudesCliente filas={filas} />
      </div>
    </div>
  );
}
