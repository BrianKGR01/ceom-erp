import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { listarSolicitudesPorTenant, obtenerInstitucionPorId } from "@/modules/consentimiento/actions";
import { SolicitudesCliente } from "./solicitudes-cliente";

export default async function SolicitudesPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const resultado = await listarSolicitudesPorTenant(usuario, usuario.tenantId);
  if (!resultado.ok) {
    return (
      <div className="min-h-screen bg-gray-bg p-6">
        <div className="mx-auto max-w-3xl py-6">
          <p className="text-sm text-error-text">{resultado.error}</p>
        </div>
      </div>
    );
  }

  const institucionIds = [...new Set(resultado.data.map((s) => s.institucionId))];
  const institucionesRes = await Promise.all(institucionIds.map((id) => obtenerInstitucionPorId(id)));
  const nombrePorInstitucion = Object.fromEntries(
    institucionesRes
      .map((r, i) => (r.ok ? [institucionIds[i], r.data.nombre] : null))
      .filter((x): x is [string, string] => x !== null)
  );

  const filas = resultado.data.map((s) => ({
    id: s.id,
    institucionNombre: nombrePorInstitucion[s.institucionId] ?? "Institución",
    modulosSolicitados: s.modulosSolicitados,
    estado: s.estado,
    creadoEn: s.creadoEn,
  }));

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-3xl space-y-4 py-6">
        <SolicitudesCliente filas={filas} />
      </div>
    </div>
  );
}
