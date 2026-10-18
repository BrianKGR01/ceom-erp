import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { estadoDeCajas } from "@/modules/caja/actions";
import { obtenerUsuarioActual, tienePermiso } from "@/modules/identidad/actions";
import { CajaCliente } from "./caja-cliente";

export default async function CajaPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const [estado, esSupervisor] = await Promise.all([
    estadoDeCajas(usuario, usuario.tenantId),
    tienePermiso(usuario, usuario.tenantId, "ventas", "anular_ajustar"),
  ]);

  return (
    <div className="min-h-screen bg-gray-bg p-6 xl:p-8">
      <div className="mx-auto max-w-5xl space-y-6 py-6">
        <PageHeader
          title="Caja"
          description="Abrí el turno, registrá los movimientos de efectivo y cerrá comparando lo esperado con lo contado."
        />

        {!estado.ok ? (
          <p className="text-sm text-error-text">{estado.error}</p>
        ) : (
          <CajaCliente
            habilitada={estado.data.habilitada}
            exigirTurno={estado.data.exigirTurno}
            esSupervisor={esSupervisor}
            cajas={estado.data.cajas.map((c) => ({
              cajaId: c.cajaId,
              nombre: c.nombre,
              turno: c.turno && {
                turnoId: c.turno.turnoId,
                numero: c.turno.numero,
                abiertoEn: c.turno.abiertoEn.toISOString(),
                fondoInicial: c.turno.fondoInicial,
                ventasCantidad: c.turno.ventasCantidad,
                ventasTotal: c.turno.ventasTotal,
                porMedio: c.turno.porMedio,
                efectivoCobrado: c.turno.efectivoCobrado,
                entradas: c.turno.entradas,
                salidas: c.turno.salidas,
                efectivoEsperado: c.turno.efectivoEsperado,
              },
            }))}
          />
        )}
      </div>
    </div>
  );
}
