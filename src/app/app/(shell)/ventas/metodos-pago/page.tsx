import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { PageHeader } from "@/components/shared/page-header";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { listarMetodosPago } from "@/modules/ventas/actions";
import { MetodosPagoCliente } from "./metodos-pago-cliente";

export default async function MetodosPagoPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const metodosResultado = await listarMetodosPago(usuario, usuario.tenantId);
  const metodos = metodosResultado.ok ? metodosResultado.data : [];

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-3xl space-y-4 py-6">
        <Breadcrumb items={[{ label: "Ventas", href: "/app/ventas" }, { label: "Métodos de pago" }]} />
        <PageHeader
          title="Métodos de pago"
          description="Gestioná los métodos de pago disponibles en tu negocio."
        />

        <MetodosPagoCliente
          metodos={metodos.map((m) => ({ id: m.id, nombre: m.nombre, activo: m.activo }))}
        />
      </div>
    </div>
  );
}
