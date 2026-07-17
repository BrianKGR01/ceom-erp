import Link from "next/link";
import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { NuevoInsumoCliente } from "./nuevo-insumo-cliente";

export default async function NuevoInsumoPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-2xl space-y-4 py-6">
        <Breadcrumb
          items={[{ label: "Insumos", href: "/app/produccion/insumos" }, { label: "Nuevo" }]}
        />
        <PageHeader
          title="Nuevo insumo"
          description="Cargá una materia prima para usar en tus recetas."
          action={
            <Button variant="outline" render={<Link href="/app/produccion/insumos" />} nativeButton={false}>
              Cancelar
            </Button>
          }
        />
        <NuevoInsumoCliente />
      </div>
    </div>
  );
}
