import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { PageHeader } from "@/components/shared/page-header";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { listarActivos } from "@/modules/patrimonio/actions";
import { NuevoPasivoCliente } from "./nuevo-pasivo-cliente";

export default async function NuevoPasivoPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const activosResultado = await listarActivos(usuario, usuario.tenantId, {
    excluirDadosDeBaja: true,
  });
  const activos = activosResultado.ok ? activosResultado.data : [];

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-4xl space-y-4 py-6">
        <Breadcrumb
          items={[
            { label: "Patrimonio", href: "/app/patrimonio" },
            { label: "Pasivos", href: "/app/patrimonio/pasivos" },
            { label: "Nuevo pasivo" },
          ]}
        />
        <PageHeader
          title="Nuevo pasivo"
          description="Ingresá los detalles para registrar la obligación."
        />

        <NuevoPasivoCliente
          activos={activos.map((a) => ({ id: a.id, nombre: a.nombre, tipo: a.tipo }))}
        />
      </div>
    </div>
  );
}
