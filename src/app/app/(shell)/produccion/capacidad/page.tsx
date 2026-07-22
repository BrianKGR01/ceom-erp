import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { PageHeader } from "@/components/shared/page-header";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { listarActivos } from "@/modules/patrimonio/actions";
import { CapacidadCliente } from "./capacidad-cliente";

export default async function CapacidadPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const resultado = await listarActivos(usuario, usuario.tenantId, { excluirDadosDeBaja: true });
  const activos = resultado.ok
    ? resultado.data.filter((a) => a.capacidadProduccionCantidad || a.capacidadAlmacenamientoCantidad)
    : [];

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-3xl space-y-4 py-6">
        <Breadcrumb items={[{ label: "Producción", href: "/app/produccion" }, { label: "Capacidad de producción" }]} />
        <PageHeader
          title="Capacidad de producción"
          description="Producción y almacenamiento reales frente a la capacidad de tu equipo — solo lectura."
        />
        <CapacidadCliente activos={activos.map((a) => ({ id: a.id, nombre: a.nombre }))} />
      </div>
    </div>
  );
}
