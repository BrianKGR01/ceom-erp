import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { consultarAprobacionesPorTenant, obtenerInstitucionPorId } from "@/modules/consentimiento/actions";
import { AprobacionesCliente } from "./aprobaciones-cliente";

export default async function AprobacionesPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const resultado = await consultarAprobacionesPorTenant(usuario, usuario.tenantId);
  if (!resultado.ok) {
    return (
      <div className="min-h-screen bg-gray-bg p-6">
        <div className="mx-auto max-w-3xl py-6">
          <p className="text-sm text-error-text">{resultado.error}</p>
        </div>
      </div>
    );
  }

  // "Vigente" es una propiedad de LA MAS RECIENTE aprobacion por institucion
  // (mismo criterio que tieneConsentimiento()/obtenerAprobacionVigente() en
  // el backend) — una fila mas vieja sin revocar queda "superada" por una
  // mas nueva, no cuenta como vigente aunque su propio revocadoEn sea null.
  const porInstitucion = new Map<string, typeof resultado.data>();
  for (const fila of resultado.data) {
    const grupo = porInstitucion.get(fila.institucionId) ?? [];
    grupo.push(fila);
    porInstitucion.set(fila.institucionId, grupo);
  }
  const masRecientePorInstitucion = new Set<string>();
  for (const grupo of porInstitucion.values()) {
    const masReciente = [...grupo].sort(
      (a, b) => new Date(b.fechaAprobacion).getTime() - new Date(a.fechaAprobacion).getTime()
    )[0];
    masRecientePorInstitucion.add(masReciente.id);
  }

  const institucionIds = [...porInstitucion.keys()];
  const institucionesRes = await Promise.all(
    institucionIds.map((id) => obtenerInstitucionPorId(id))
  );
  const nombrePorInstitucion = Object.fromEntries(
    institucionesRes
      .map((r, i) => (r.ok ? [institucionIds[i], r.data.nombre] : null))
      .filter((x): x is [string, string] => x !== null)
  );

  const filas = resultado.data.map((fila) => ({
    id: fila.id,
    institucionId: fila.institucionId,
    institucionNombre: nombrePorInstitucion[fila.institucionId] ?? "Institución",
    modulosAprobados: fila.modulosAprobados,
    fechaAprobacion: fila.fechaAprobacion,
    revocadoEn: fila.revocadoEn,
    esLaMasReciente: masRecientePorInstitucion.has(fila.id),
  }));

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-3xl space-y-4 py-6">
        <AprobacionesCliente filas={filas} />
      </div>
    </div>
  );
}
