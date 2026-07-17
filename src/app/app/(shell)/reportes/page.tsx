import { redirect } from "next/navigation";
import { obtenerUsuarioActual, listarSucursalesPorTenant } from "@/modules/identidad/actions";
import { consultarValorPatrimonialTotal } from "@/modules/patrimonio/actions";
import { estadoResultados, flujoCaja } from "@/modules/reportes/actions";
import { calcularRangoPreset } from "../periodo-presets";
import { ResumenFinancieroCliente } from "./resumen-financiero-cliente";

export default async function ReportesPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const periodo = calcularRangoPreset("mes");
  const [estadoRes, flujoRes, patrimonioRes, sucursalesRes] = await Promise.all([
    estadoResultados(usuario, usuario.tenantId, periodo),
    flujoCaja(usuario, usuario.tenantId, periodo),
    consultarValorPatrimonialTotal(usuario, usuario.tenantId),
    listarSucursalesPorTenant(usuario, usuario.tenantId),
  ]);

  const sucursales = sucursalesRes.ok ? sucursalesRes.data : [];

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-5xl space-y-4 py-6">
        <ResumenFinancieroCliente
          datosIniciales={{ estado: estadoRes, flujo: flujoRes, patrimonio: patrimonioRes }}
          sucursales={sucursales.map((s) => ({ id: s.id, nombre: s.nombre }))}
        />
      </div>
    </div>
  );
}
