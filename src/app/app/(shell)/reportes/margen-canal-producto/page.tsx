import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { margenPorCanalYProducto } from "@/modules/reportes/actions";
import { listarCanalesVenta } from "@/modules/ventas/actions";
import { listarProductos } from "@/modules/productos/actions";
import { calcularRangoPreset } from "../../periodo-presets";
import { MargenCanalProductoCliente } from "./margen-canal-producto-cliente";

export default async function MargenCanalProductoPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const periodo = calcularRangoPreset("mes");
  const [margenRes, canalesRes, productosRes] = await Promise.all([
    margenPorCanalYProducto(usuario, usuario.tenantId, periodo),
    listarCanalesVenta(usuario, usuario.tenantId),
    listarProductos(usuario, usuario.tenantId),
  ]);

  const canales = canalesRes.ok ? canalesRes.data : [];
  const productos = productosRes.ok ? productosRes.data : [];

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-6xl space-y-4 py-6">
        <MargenCanalProductoCliente
          datosIniciales={margenRes}
          canales={canales.map((c) => ({ id: c.id, nombre: c.nombre }))}
          productos={productos.map((p) => ({ id: p.id, nombre: p.nombre }))}
        />
      </div>
    </div>
  );
}
