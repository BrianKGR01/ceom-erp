import { redirect } from "next/navigation";
import { listarCategoriasGasto, listarCategoriasGastoSugeridas, listarGastos } from "@/modules/gastos/actions";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { listarProveedores } from "@/modules/proveedores/actions";
import { GastosCliente } from "./gastos-cliente";

export default async function GastosPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const [gastosResultado, categoriasResultado, proveedoresResultado, categoriasSugeridas] = await Promise.all([
    listarGastos(usuario, usuario.tenantId),
    listarCategoriasGasto(usuario, usuario.tenantId),
    listarProveedores(usuario, usuario.tenantId),
    listarCategoriasGastoSugeridas({ soloActivas: true }),
  ]);

  const gastos = gastosResultado.ok ? gastosResultado.data : [];
  const categorias = categoriasResultado.ok ? categoriasResultado.data : [];
  const proveedores = proveedoresResultado.ok ? proveedoresResultado.data : [];
  const categoriaPorId = new Map(categorias.map((c) => [c.id, c.nombre]));
  const proveedorPorId = new Map(proveedores.map((p) => [p.id, p.nombre]));

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-5xl space-y-4 py-6">
        <GastosCliente
          gastos={gastos
            .slice()
            .reverse()
            .map((g) => ({
              id: g.id,
              categoriaId: g.categoriaId,
              categoriaNombre: categoriaPorId.get(g.categoriaId) ?? "Sin categoría",
              tipo: g.tipo,
              monto: g.monto,
              fechaGasto: g.fechaGasto,
              proveedorNombre: g.proveedorId ? (proveedorPorId.get(g.proveedorId) ?? null) : null,
              estadoPago: g.estadoPago,
              origen: g.origen,
            }))}
          categorias={categorias.map((c) => ({ id: c.id, nombre: c.nombre }))}
          categoriasSugeridas={categoriasSugeridas.map((c) => ({ id: c.id, nombre: c.nombre }))}
        />
      </div>
    </div>
  );
}
