import { redirect } from "next/navigation";
import { fichaInsumo } from "@/modules/operativo/nichos/nicho-1/actions";
import { obtenerUsuarioActual, listarSucursalesPorTenant } from "@/modules/identidad/actions";
import { FichaInsumoCliente } from "./ficha-insumo-cliente";

export default async function FichaInsumoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const [fichaResultado, sucursalesResultado] = await Promise.all([
    fichaInsumo(usuario, id),
    listarSucursalesPorTenant(usuario, usuario.tenantId),
  ]);

  if (!fichaResultado.ok || !fichaResultado.data.insumo) redirect("/app/produccion/insumos");
  const { insumo, stockPorSucursal } = fichaResultado.data;
  const sucursales = sucursalesResultado.ok ? sucursalesResultado.data : [];

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-4xl space-y-4 py-6">
        <FichaInsumoCliente
          insumoId={id}
          nombre={insumo!.nombre}
          unidadMedida={insumo!.unidadMedida}
          vidaUtilDias={insumo!.vidaUtilDias}
          costoUnitarioVigente={insumo!.costoUnitarioVigente}
          stockMinimo={insumo!.stockMinimo}
          stockPorSucursal={stockPorSucursal.map((f) => ({
            sucursalId: f.sucursalId,
            cantidadActual: f.cantidadActual,
          }))}
          sucursales={sucursales.map((s) => ({ id: s.id, nombre: s.nombre }))}
        />
      </div>
    </div>
  );
}
