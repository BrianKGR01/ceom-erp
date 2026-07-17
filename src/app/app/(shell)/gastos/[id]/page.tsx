import { redirect } from "next/navigation";
import { fichaGasto, listarCategoriasGasto } from "@/modules/gastos/actions";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { listarProveedores } from "@/modules/proveedores/actions";
import { FichaGastoCliente } from "./ficha-gasto-cliente";

export default async function FichaGastoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const [fichaResultado, categoriasResultado, proveedoresResultado] = await Promise.all([
    fichaGasto(usuario, id),
    listarCategoriasGasto(usuario, usuario.tenantId),
    listarProveedores(usuario, usuario.tenantId),
  ]);

  if (!fichaResultado.ok || !fichaResultado.data.gasto) redirect("/app/gastos");
  const { gasto, pagos } = fichaResultado.data;
  const categorias = categoriasResultado.ok ? categoriasResultado.data : [];
  const proveedores = proveedoresResultado.ok ? proveedoresResultado.data : [];
  const categoriaNombre = categorias.find((c) => c.id === gasto.categoriaId)?.nombre ?? "Sin categoría";
  const proveedorNombre = gasto.proveedorId
    ? (proveedores.find((p) => p.id === gasto.proveedorId)?.nombre ?? null)
    : null;
  const totalPagado = pagos.reduce((acc, p) => acc + Number(p.monto), 0);

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-4xl space-y-4 py-6">
        <FichaGastoCliente
          gasto={{
            id: gasto.id,
            tipo: gasto.tipo,
            categoriaNombre,
            monto: gasto.monto,
            fechaGasto: gasto.fechaGasto,
            proveedorNombre,
            origen: gasto.origen,
            estadoPago: gasto.estadoPago,
            descripcion: gasto.descripcion,
          }}
          pagos={pagos.map((p) => ({ id: p.id, monto: p.monto, fechaPago: p.fechaPago }))}
          totalPagado={totalPagado}
        />
      </div>
    </div>
  );
}
