import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { listarInsumos } from "@/modules/operativo/nichos/nicho-1/actions";
import { listarProductos } from "@/modules/productos/actions";
import { fichaProveedor } from "@/modules/proveedores/actions";
import { FichaProveedorCliente } from "./ficha-proveedor-cliente";

export default async function FichaProveedorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const [fichaResultado, productosResultado, insumosResultado] = await Promise.all([
    fichaProveedor(usuario, id),
    listarProductos(usuario, usuario.tenantId),
    listarInsumos(usuario, usuario.tenantId),
  ]);

  if (!fichaResultado.ok || !fichaResultado.data.proveedor) redirect("/app/proveedores");
  const { proveedor, cantidadCompras, montoTotalComprado, compras } = fichaResultado.data;
  const productos = productosResultado.ok ? productosResultado.data : [];
  const insumos = insumosResultado.ok ? insumosResultado.data : [];
  const nombrePorItem = new Map<string, string>([
    ...productos.map((p) => [p.id, p.nombre] as const),
    ...insumos.map((i) => [i.id, i.nombre] as const),
  ]);

  return (
    <FichaProveedorCliente
      proveedor={{
        id: proveedor!.id,
        nombre: proveedor!.nombre,
        contacto: proveedor!.contacto,
        notas: proveedor!.notas,
      }}
      cantidadCompras={cantidadCompras}
      montoTotalComprado={montoTotalComprado}
      compras={compras.map((c) => ({
        id: c.id,
        itemNombre: nombrePorItem.get((c.insumoId ?? c.productoId)!) ?? "Ítem eliminado",
        cantidad: c.cantidad,
        costoUnitario: c.costoUnitario,
        montoTotal: c.montoTotal,
        fechaCompra: c.fechaCompra,
        estado: c.estado,
        estadoPago: c.estadoPago,
      }))}
    />
  );
}
