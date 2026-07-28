import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { listarAccesosInstitucion, obtenerInstitucionPorId } from "@/modules/consentimiento/actions";
import { AccesosCliente } from "./accesos-cliente";

// D-1 (tanda 3.3b). Server Component: la lista se resuelve del lado del
// servidor y llega renderizada, mismo patrón que Aprobaciones.
export default async function AccesosPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const accesos = await listarAccesosInstitucion(usuario, usuario.tenantId);
  if (!accesos.ok) {
    return <AccesosCliente filas={[]} error={accesos.error} />;
  }

  // El nombre de la institución no está en el registro (es metadato del
  // catálogo global, no del acceso): se resuelve acá, una vez por institución
  // distinta y no una por fila.
  const ids = [...new Set(accesos.data.map((a) => a.institucionId))];
  const nombres = new Map<string, string>();
  for (const id of ids) {
    const inst = await obtenerInstitucionPorId(id);
    nombres.set(id, inst.ok ? inst.data.nombre : "Institución");
  }

  return (
    <AccesosCliente
      filas={accesos.data.map((a) => ({
        id: a.id,
        institucion: nombres.get(a.institucionId) ?? "Institución",
        modulo: a.modulo,
        dia: a.dia,
        consultas: a.consultas,
        ultimaConsultaEn: a.ultimaConsultaEn.toISOString(),
      }))}
    />
  );
}
