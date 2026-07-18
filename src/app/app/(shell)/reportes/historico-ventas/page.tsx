import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { historicoVentas } from "@/modules/reportes/actions";
import { calcularRangoPreset } from "../../periodo-presets";
import { HistoricoVentasCliente } from "./historico-ventas-cliente";

export default async function HistoricoVentasPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const periodo = calcularRangoPreset("mes");
  const resultado = await historicoVentas(usuario, usuario.tenantId, periodo, { incluirEventos: true });

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-5xl space-y-4 py-6">
        <HistoricoVentasCliente datosIniciales={resultado} />
      </div>
    </div>
  );
}
