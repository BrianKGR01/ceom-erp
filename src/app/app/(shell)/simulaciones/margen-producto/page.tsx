import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { listarProductos } from "@/modules/productos/actions";
import { MargenProductoCliente } from "./margen-producto-cliente";

export default async function MargenProductoPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const productosRes = await listarProductos(usuario, usuario.tenantId);
  const productos = productosRes.ok ? productosRes.data : [];

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-3xl space-y-4 py-6">
        <MargenProductoCliente productos={productos.map((p) => ({ id: p.id, nombre: p.nombre }))} />
      </div>
    </div>
  );
}
