import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { listarProductos } from "@/modules/productos/actions";
import { SimuladorCliente } from "./simulador-cliente";

export default async function SimuladorPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const productosRes = await listarProductos(usuario, usuario.tenantId);
  const productos = productosRes.ok ? productosRes.data : [];

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-5xl space-y-4 py-6">
        <SimuladorCliente
          productos={productos.map((p) => ({ id: p.id, nombre: p.nombre }))}
        />
      </div>
    </div>
  );
}
