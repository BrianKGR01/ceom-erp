import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { listarSucursalesPorTenant, obtenerUsuarioActual } from "@/modules/identidad/actions";
import {
  calcularValorActual,
  consultarValorPatrimonialTotal,
  listarActivos,
} from "@/modules/patrimonio/actions";
import { ActivosCliente } from "./activos-cliente";

export default async function PatrimonioPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const [activosResultado, sucursalesResultado, valorTotalResultado] = await Promise.all([
    listarActivos(usuario, usuario.tenantId),
    listarSucursalesPorTenant(usuario, usuario.tenantId),
    consultarValorPatrimonialTotal(usuario, usuario.tenantId),
  ]);

  const activos = activosResultado.ok ? activosResultado.data : [];
  const sucursales = sucursalesResultado.ok ? sucursalesResultado.data : [];
  const sucursalPorId = new Map(sucursales.map((s) => [s.id, s.nombre]));
  const valorPatrimonialTotal = valorTotalResultado.ok
    ? valorTotalResultado.data.valorPatrimonialTotal
    : 0;

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-5xl space-y-4 py-6">
        <PageHeader title="Activos" description="Gestión del patrimonio físico del negocio." />

        <ActivosCliente
          activos={activos.map((a) => ({
            id: a.id,
            nombre: a.nombre,
            tipo: a.tipo,
            estado: a.estado,
            valorActual: calcularValorActual(a),
            sucursalNombre: a.sucursalId ? (sucursalPorId.get(a.sucursalId) ?? "—") : "Todo el negocio",
          }))}
          valorPatrimonialTotal={valorPatrimonialTotal}
        />
      </div>
    </div>
  );
}
