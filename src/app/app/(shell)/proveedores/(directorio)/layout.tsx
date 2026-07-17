import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { fichaProveedor, listarProveedores } from "@/modules/proveedores/actions";
import { DirectorioCliente } from "../directorio-cliente";

// Maestro-detalle (design-system.md seccion 5.6): el panel izquierdo
// (Directorio) vive en este layout, siempre visible — {children} es el
// panel derecho (Ficha de Proveedor o el estado vacio de page.tsx).
export default async function ProveedoresLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const proveedoresResultado = await listarProveedores(usuario, usuario.tenantId);
  const proveedores = proveedoresResultado.ok ? proveedoresResultado.data : [];

  // cantidadCompras por proveedor (fichaProveedor por fila) — mismo
  // criterio de "volumen esperado bajo" ya aceptado en Pasivos/Ventas para
  // agregados que no vienen en el listado base.
  const conteos = await Promise.all(
    proveedores.map(async (p) => {
      const ficha = await fichaProveedor(usuario, p.id);
      return ficha.ok ? ficha.data.cantidadCompras : 0;
    })
  );

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto flex max-w-6xl gap-4 py-6">
        <DirectorioCliente
          proveedores={proveedores.map((p, i) => ({
            id: p.id,
            nombre: p.nombre,
            contacto: p.contacto,
            cantidadCompras: conteos[i],
          }))}
        />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
