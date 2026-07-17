import Link from "next/link";
import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { fichaGasto, listarCategoriasGasto } from "@/modules/gastos/actions";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { listarProveedores } from "@/modules/proveedores/actions";
import { EditarGastoCliente } from "./editar-gasto-cliente";

export default async function EditarGastoPage({
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
  const { gasto } = fichaResultado.data;
  // Regla 2 (Modulo_04 seccion 3.2): un gasto de origen automatico nunca se
  // edita directo — bloqueo defensivo aca ademas del botón oculto en la
  // Ficha, por si alguien entra por URL directa.
  if (gasto.origen !== "manual") redirect(`/app/gastos/${id}`);

  const categorias = categoriasResultado.ok ? categoriasResultado.data : [];
  const proveedores = proveedoresResultado.ok ? proveedoresResultado.data : [];

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-2xl space-y-4 py-6">
        <Breadcrumb
          items={[
            { label: "Gastos", href: "/app/gastos" },
            { label: "Detalle", href: `/app/gastos/${id}` },
            { label: "Editar" },
          ]}
        />
        <PageHeader
          title="Editar Gasto"
          description="Los cambios se aplican al instante."
          action={
            <Button variant="outline" render={<Link href={`/app/gastos/${id}`} />} nativeButton={false}>
              Cancelar
            </Button>
          }
        />
        <EditarGastoCliente
          gastoId={id}
          categorias={categorias.map((c) => ({ id: c.id, nombre: c.nombre }))}
          proveedores={proveedores.map((p) => ({ id: p.id, nombre: p.nombre }))}
          initialValues={{
            tipo: gasto.tipo,
            categoriaId: gasto.categoriaId,
            monto: Number(gasto.monto),
            fechaGasto: gasto.fechaGasto,
            proveedorId: gasto.proveedorId ?? undefined,
            descripcion: gasto.descripcion ?? undefined,
          }}
        />
      </div>
    </div>
  );
}
