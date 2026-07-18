import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { PageHeader } from "@/components/shared/page-header";
import { listarSucursalesPorTenant, obtenerUsuarioActual } from "@/modules/identidad/actions";
import { obtenerRecetaDeProducto } from "@/modules/operativo/nichos/nicho-1/actions";
import { listarActivos } from "@/modules/patrimonio/actions";
import { listarProductos } from "@/modules/productos/actions";
import { NuevaProduccionCliente } from "./nueva-produccion-cliente";

export default async function NuevaProduccionPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const [productosResultado, activosResultado, sucursalesResultado] = await Promise.all([
    listarProductos(usuario, usuario.tenantId),
    listarActivos(usuario, usuario.tenantId, { excluirDadosDeBaja: true }),
    listarSucursalesPorTenant(usuario, usuario.tenantId),
  ]);

  const productos = productosResultado.ok ? productosResultado.data : [];
  const activos = activosResultado.ok ? activosResultado.data : [];
  const sucursales = sucursalesResultado.ok ? sucursalesResultado.data : [];

  // Solo productos ya vinculados a una receta (tipo_origen_producto =
  // produccion_nicho) pueden producirse — se resuelve la receta de cada uno
  // de una sola vez server-side (mismo criterio que la composicion en
  // Gestion de Recetas), asi el wizard no necesita un fetch client-side
  // para el resumen en vivo.
  const productosVinculados = productos.filter((p) => p.tipoOrigenProducto === "produccion_nicho");
  const fichas = await Promise.all(
    productosVinculados.map((p) => obtenerRecetaDeProducto(usuario, p.id))
  );

  const productosConReceta = productosVinculados
    .map((producto, index) => {
      const ficha = fichas[index];
      if (!ficha.ok || !ficha.data) return null;
      return {
        id: producto.id,
        nombre: producto.nombre,
        imagenUrl: producto.imagenUrl,
        vidaUtilDias: producto.vidaUtilDias,
        recetaNombre: ficha.data.receta?.nombre ?? "Receta",
        rendimientoPorLote: ficha.data.receta?.rendimientoPorLote ?? "0",
        cantidadBaseConsumidaPorUnidad: ficha.data.cantidadBaseConsumidaPorUnidad,
        composicion: ficha.data.composicion.map((c) => ({
          cantidadPorLote: c.cantidadPorLote,
          costoUnitarioVigente: c.costoUnitarioVigente,
        })),
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-6xl space-y-4 py-6">
        <Breadcrumb items={[{ label: "Producción", href: "/app/produccion" }, { label: "Registrar Lote" }]} />
        <PageHeader
          title="Registrar Producción de un lote"
          description="Completá los pasos para documentar un nuevo lote de producción."
        />

        <NuevaProduccionCliente
          productos={productosConReceta}
          activos={activos.map((a) => ({ id: a.id, nombre: a.nombre }))}
          sucursales={sucursales.map((s) => ({ id: s.id, nombre: s.nombre }))}
        />
      </div>
    </div>
  );
}
