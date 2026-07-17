import { redirect } from "next/navigation";
import { listarProducciones } from "@/modules/operativo/nichos/nicho-1/actions";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { listarProductos } from "@/modules/productos/actions";
import { ProduccionesCliente } from "./producciones-cliente";

export default async function ProduccionPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const [produccionesResultado, productosResultado] = await Promise.all([
    listarProducciones(usuario, usuario.tenantId),
    listarProductos(usuario, usuario.tenantId),
  ]);

  const producciones = produccionesResultado.ok ? produccionesResultado.data : [];
  const productos = productosResultado.ok ? productosResultado.data : [];
  const productoPorId = new Map(productos.map((p) => [p.id, p.nombre]));

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-5xl space-y-4 py-6">
        <ProduccionesCliente
          producciones={producciones
            .slice()
            .reverse()
            .map((p) => ({
              id: p.id,
              productoNombre: productoPorId.get(p.productoId) ?? "Producto eliminado",
              fechaProduccion: p.fechaProduccion,
              cantidadRealObtenida: p.cantidadRealObtenida,
              mermaCantidad: p.mermaCantidad,
              costoOperativoCalculado: p.costoOperativoCalculado,
            }))}
        />
      </div>
    </div>
  );
}
