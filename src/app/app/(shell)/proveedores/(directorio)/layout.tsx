import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { listarProveedoresConCantidadCompras } from "@/modules/proveedores/actions";
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

  // Una sola consulta con el conteo por fila. ⛔ No volver a llamar
  // fichaProveedor() por proveedor acá: fue el disparador del incidente de
  // pool del 2026-09-17 (proveedores/ANCLA.md) — con 10 proveedores la
  // pantalla se colgaba 300 s.
  const resultado = await listarProveedoresConCantidadCompras(usuario, usuario.tenantId);
  const proveedores = resultado.ok ? resultado.data : [];

  return (
    <div className="min-h-screen bg-gray-bg p-6 xl:p-8">
      <div className="mx-auto flex max-w-6xl gap-4 py-6">
        <DirectorioCliente
          proveedores={proveedores.map((p) => ({
            id: p.id,
            nombre: p.nombre,
            contacto: p.contacto,
            cantidadCompras: p.cantidadCompras,
          }))}
        />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
