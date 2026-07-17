import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { fichaPasivo, obtenerActivoPorId } from "@/modules/patrimonio/actions";
import { FichaPasivoCliente } from "./ficha-pasivo-cliente";

export default async function FichaPasivoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const fichaResultado = await fichaPasivo(usuario, id);
  if (!fichaResultado.ok) redirect("/app/patrimonio/pasivos");
  const { pasivo, saldoPendiente, pagos } = fichaResultado.data;

  const activoResultado = pasivo.activoId ? await obtenerActivoPorId(usuario, pasivo.activoId) : null;
  const activoNombre = activoResultado?.ok ? activoResultado.data.nombre : null;

  // "Restante" por pago: saldo corrido despues de cada pago (pagos ya
  // vienen ordenados ascendente por fechaPago, mas antiguo primero).
  // reduce() en vez de un `let` reasignado en .map() — el lint del React
  // Compiler rechaza mutar una variable externa durante el render.
  const pagosConRestante = pagos.reduce<{
    acumulado: number;
    filas: Array<{ id: string; monto: string; fechaPago: string; origen: string; restante: number; numeroCuota: number }>;
  }>(
    (estado, pago, i) => {
      const acumulado = estado.acumulado + Number(pago.monto);
      return {
        acumulado,
        filas: [
          ...estado.filas,
          {
            id: pago.id,
            monto: pago.monto,
            fechaPago: pago.fechaPago,
            origen: pago.origen,
            restante: Number(pasivo.montoTotal) - acumulado,
            numeroCuota: i + 1,
          },
        ],
      };
    },
    { acumulado: 0, filas: [] }
  ).filas;

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-4xl space-y-4 py-6">
        <FichaPasivoCliente
          pasivo={{
            id: pasivo.id,
            estado: pasivo.estado,
            montoTotal: pasivo.montoTotal,
            cuotaPeriodica: pasivo.cuotaPeriodica,
            frecuenciaCuota: pasivo.frecuenciaCuota,
            plazoCuotas: pasivo.plazoCuotas,
            fechaInicio: pasivo.fechaInicio,
            saldoPendiente,
            activoNombre,
          }}
          pagos={pagosConRestante.reverse()}
        />
      </div>
    </div>
  );
}
