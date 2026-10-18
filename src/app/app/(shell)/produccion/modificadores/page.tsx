import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { listarGruposModificadores, listarInsumos } from "@/modules/operativo/nichos/nicho-1/actions";
import { listarProductos } from "@/modules/productos/actions";
import { ModificadoresCliente } from "./modificadores-cliente";

export default async function ModificadoresPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const [gruposRes, insumosRes, productosRes] = await Promise.all([
    listarGruposModificadores(usuario, usuario.tenantId),
    listarInsumos(usuario, usuario.tenantId),
    listarProductos(usuario, usuario.tenantId),
  ]);

  const insumos = insumosRes.ok ? insumosRes.data : [];
  const nombreInsumo = new Map(insumos.map((i) => [i.id, i.nombre]));
  const productos = productosRes.ok ? productosRes.data : [];

  return (
    <div className="min-h-screen bg-gray-bg p-6 xl:p-8">
      <div className="mx-auto max-w-6xl space-y-6 py-6">
        <PageHeader
          title="Modificadores"
          description="Lo que el cliente puede pedir encima de un producto: otra leche, un shot extra, “extra caliente”. Cada opción puede cambiar el precio, la receta o solo avisar a quien prepara."
        />

        {!gruposRes.ok ? (
          <p className="text-sm text-error-text">{gruposRes.error}</p>
        ) : (
          <ModificadoresCliente
            grupos={gruposRes.data.map((g) => ({
              id: g.id,
              nombre: g.nombre,
              seleccion: g.seleccion,
              productoIds: g.productoIds,
              opciones: g.modificadores.map((m) => ({
                id: m.id,
                nombre: m.nombre,
                tipo: m.tipo,
                esBase: m.esBase,
                precioExtra: Number(m.precioExtra),
                insumoNombre: m.insumoId ? (nombreInsumo.get(m.insumoId) ?? null) : null,
                cantidad: m.cantidad === null ? null : Number(m.cantidad),
                insumoReemplazadoNombre: m.insumoReemplazadoId
                  ? (nombreInsumo.get(m.insumoReemplazadoId) ?? null)
                  : null,
              })),
            }))}
            insumos={insumos.map((i) => ({ id: i.id, nombre: i.nombre, unidadMedida: i.unidadMedida }))}
            productos={productos.filter((p) => p.activo).map((p) => ({ id: p.id, nombre: p.nombre }))}
          />
        )}
      </div>
    </div>
  );
}
