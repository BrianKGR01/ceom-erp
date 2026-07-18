import Link from "next/link";
import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { fichaInsumo } from "@/modules/operativo/nichos/nicho-1/actions";
import { EditarInsumoCliente } from "./editar-insumo-cliente";

export default async function EditarInsumoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const resultado = await fichaInsumo(usuario, id);
  if (!resultado.ok || !resultado.data.insumo) redirect("/app/produccion/insumos");
  const { insumo } = resultado.data;

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-2xl space-y-4 py-6">
        <Breadcrumb
          items={[
            { label: "Insumos", href: "/app/produccion/insumos" },
            { label: insumo!.nombre, href: `/app/produccion/insumos/${id}` },
            { label: "Editar" },
          ]}
        />
        <PageHeader
          title={`Editar ${insumo!.nombre}`}
          description="Los cambios se aplican al instante."
          action={
            <Button
              variant="outline"
              render={<Link href={`/app/produccion/insumos/${id}`} />}
              nativeButton={false}
            >
              Cancelar
            </Button>
          }
        />
        <EditarInsumoCliente
          insumoId={id}
          initialValues={{
            nombre: insumo!.nombre,
            unidadMedida: insumo!.unidadMedida,
            vidaUtilDias: insumo!.vidaUtilDias ?? undefined,
            stockMinimo: insumo!.stockMinimo !== null ? Number(insumo!.stockMinimo) : undefined,
          }}
        />
      </div>
    </div>
  );
}
