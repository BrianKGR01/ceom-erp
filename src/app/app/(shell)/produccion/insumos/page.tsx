import Link from "next/link";
import { redirect } from "next/navigation";
import { Beaker, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { listarInsumos } from "@/modules/operativo/nichos/nicho-1/actions";
import { InsumosCliente } from "./insumos-cliente";

export default async function InsumosPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const resultado = await listarInsumos(usuario, usuario.tenantId);
  const insumos = resultado.ok ? resultado.data : [];

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-6xl space-y-6 py-6">
        <PageHeader
          title="Catálogo de Insumos"
          description="Las materias primas que usás para producir."
          action={
            <Button render={<Link href="/app/produccion/insumos/nuevo" />} nativeButton={false}>
              <Plus className="size-4" />
              Nuevo insumo
            </Button>
          }
        />

        {insumos.length === 0 ? (
          <EmptyState
            icon={Beaker}
            title="Todavía no cargaste ningún insumo"
            description="Empezá cargando el primero — te toma menos de un minuto."
            action={{ label: "Cargar mi primer insumo", href: "/app/produccion/insumos/nuevo" }}
          />
        ) : (
          <InsumosCliente
            insumos={insumos.map((i) => ({
              id: i.id,
              nombre: i.nombre,
              unidadMedida: i.unidadMedida,
              costoUnitarioVigente: i.costoUnitarioVigente,
              stockMinimo: i.stockMinimo,
            }))}
          />
        )}
      </div>
    </div>
  );
}
