import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { listarInstituciones } from "@/modules/consentimiento/actions";
import { listarPlanes } from "@/modules/suscripcion/actions";
import { listarTenantsAction } from "./actions";
import { InstitucionesCliente } from "./instituciones-cliente";

export default async function InstitucionesPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const [institucionesRes, tenantsRes, planes] = await Promise.all([
    listarInstituciones(usuario),
    listarTenantsAction(),
    listarPlanes(),
  ]);

  const instituciones = institucionesRes.ok ? institucionesRes.data : [];
  const tenants = tenantsRes.ok ? tenantsRes.data : [];

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <InstitucionesCliente
        institucionesIniciales={instituciones.map((i) => ({
          id: i.id,
          nombre: i.nombre,
          tipo: i.tipo,
          contacto: i.contacto,
          email: i.email,
        }))}
        tenants={tenants.map((t) => ({
          id: t.id,
          nombreNegocio: t.nombreNegocio,
          planId: t.planId,
          estadoSuscripcion: t.estadoSuscripcion,
        }))}
        planes={planes.map((p) => ({ id: p.id, nombre: p.nombre }))}
      />
    </div>
  );
}
