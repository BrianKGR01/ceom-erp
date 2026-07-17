import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { listarProductos } from "@/modules/productos/actions";
import { listarSimulaciones } from "@/modules/simulaciones/actions";
import { HistorialCliente } from "./historial-cliente";

export default async function HistorialSimulacionesPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const [simulacionesRes, productosRes] = await Promise.all([
    listarSimulaciones(usuario, usuario.tenantId),
    listarProductos(usuario, usuario.tenantId),
  ]);
  const productos = productosRes.ok ? productosRes.data : [];

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-4xl space-y-4 py-6">
        <HistorialCliente
          datosIniciales={simulacionesRes}
          productos={productos.map((p) => ({ id: p.id, nombre: p.nombre }))}
        />
      </div>
    </div>
  );
}
