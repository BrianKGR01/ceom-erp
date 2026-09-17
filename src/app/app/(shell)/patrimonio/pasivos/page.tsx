import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { listarActivos, listarPasivosConSaldo } from "@/modules/patrimonio/actions";
import { PasivosCliente } from "./pasivos-cliente";

export default async function PasivosPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const [pasivosResultado, activosResultado] = await Promise.all([
    listarPasivosConSaldo(usuario, usuario.tenantId),
    listarActivos(usuario, usuario.tenantId),
  ]);

  const pasivos = pasivosResultado.ok ? pasivosResultado.data : [];
  const activos = activosResultado.ok ? activosResultado.data : [];
  const activoPorId = new Map(activos.map((a) => [a.id, a.nombre]));

  // El saldo pendiente viene agregado en la misma consulta. ⛔ No volver a
  // llamar fichaPasivo() por fila: misma trampa que el directorio de
  // Proveedores en el incidente de pool del 2026-09-17 (patrimonio/ANCLA.md).

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-4xl space-y-4 py-6">
        <PageHeader
          title="Deudas"
          description="Gestioná las deudas y obligaciones financieras del negocio."
          action={
            <Link href="/app/patrimonio" className="text-sm font-medium text-primary hover:underline">
              Ver bienes
            </Link>
          }
        />

        <PasivosCliente
          pasivos={pasivos.map((p) => ({
            id: p.id,
            estado: p.estado,
            montoTotal: p.montoTotal,
            saldoPendiente: p.saldoPendiente,
            fechaInicio: p.fechaInicio,
            activoNombre: p.activoId ? (activoPorId.get(p.activoId) ?? null) : null,
          }))}
        />
      </div>
    </div>
  );
}
