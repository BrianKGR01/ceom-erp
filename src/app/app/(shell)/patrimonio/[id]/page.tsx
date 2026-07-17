import { redirect } from "next/navigation";
import { obtenerUsuarioActual, listarSucursalesPorTenant } from "@/modules/identidad/actions";
import { listarProveedores } from "@/modules/proveedores/actions";
import {
  calcularValorActual,
  consultarPasivoDeActivo,
  obtenerActivoPorId,
  obtenerPasivoPorId,
} from "@/modules/patrimonio/actions";
import { FichaActivoCliente } from "./ficha-activo-cliente";

export default async function FichaActivoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const [activoResultado, pasivosResultado, sucursalesResultado, proveedoresResultado] =
    await Promise.all([
      obtenerActivoPorId(usuario, id),
      consultarPasivoDeActivo(usuario, id),
      listarSucursalesPorTenant(usuario, usuario.tenantId),
      listarProveedores(usuario, usuario.tenantId),
    ]);

  if (!activoResultado.ok) redirect("/app/patrimonio");
  const activo = activoResultado.data;
  const sucursales = sucursalesResultado.ok ? sucursalesResultado.data : [];
  const proveedores = proveedoresResultado.ok ? proveedoresResultado.data : [];
  const sucursalPorId = new Map(sucursales.map((s) => [s.id, s.nombre]));
  const proveedorPorId = new Map(proveedores.map((p) => [p.id, p.nombre]));

  const pasivosResumen = pasivosResultado.ok ? pasivosResultado.data : [];
  const pasivosCompletos = (
    await Promise.all(
      pasivosResumen.map(async (resumen) => {
        const pasivo = await obtenerPasivoPorId(usuario, resumen.pasivoId);
        if (!pasivo.ok) return null;
        return {
          id: pasivo.data.id,
          estado: pasivo.data.estado,
          montoTotal: pasivo.data.montoTotal,
          cuotaPeriodica: pasivo.data.cuotaPeriodica,
          frecuenciaCuota: pasivo.data.frecuenciaCuota,
          saldoPendiente: resumen.saldoPendiente,
        };
      })
    )
  ).filter((p) => p !== null);

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-5xl space-y-4 py-6">
        <FichaActivoCliente
          activo={{
            id: activo.id,
            nombre: activo.nombre,
            tipo: activo.tipo,
            estado: activo.estado,
            valorActual: calcularValorActual(activo),
            valorCompra: activo.valorCompra,
            fechaAdquisicion: activo.fechaAdquisicion,
            vidaUtilMeses: activo.vidaUtilMeses,
            sucursalNombre: activo.sucursalId
              ? (sucursalPorId.get(activo.sucursalId) ?? "—")
              : "Todo el negocio",
            proveedorNombre: activo.proveedorId ? (proveedorPorId.get(activo.proveedorId) ?? "—") : null,
            numeroSerie: activo.numeroSerie,
            vencimientoGarantia: activo.vencimientoGarantia,
            capacidadProduccionCantidad: activo.capacidadProduccionCantidad,
            capacidadProduccionUnidad: activo.capacidadProduccionUnidad,
            capacidadAlmacenamientoCantidad: activo.capacidadAlmacenamientoCantidad,
            capacidadAlmacenamientoUnidad: activo.capacidadAlmacenamientoUnidad,
            motivoBaja: activo.motivoBaja,
          }}
          pasivos={pasivosCompletos}
          sucursales={sucursales.map((s) => ({ id: s.id, nombre: s.nombre }))}
        />
      </div>
    </div>
  );
}
