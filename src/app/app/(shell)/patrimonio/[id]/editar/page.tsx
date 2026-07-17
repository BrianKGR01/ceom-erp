import Link from "next/link";
import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { listarSucursalesPorTenant, obtenerUsuarioActual } from "@/modules/identidad/actions";
import { obtenerActivoPorId } from "@/modules/patrimonio/actions";
import { listarProveedores } from "@/modules/proveedores/actions";
import { EditarActivoCliente } from "./editar-activo-cliente";

export default async function EditarActivoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const [activoResultado, sucursalesResultado, proveedoresResultado] = await Promise.all([
    obtenerActivoPorId(usuario, id),
    listarSucursalesPorTenant(usuario, usuario.tenantId),
    listarProveedores(usuario, usuario.tenantId),
  ]);

  if (!activoResultado.ok) redirect("/app/patrimonio");
  const activo = activoResultado.data;
  const sucursales = sucursalesResultado.ok ? sucursalesResultado.data : [];
  const proveedores = proveedoresResultado.ok ? proveedoresResultado.data : [];

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-4xl space-y-4 py-6">
        <Breadcrumb
          items={[
            { label: "Patrimonio", href: "/app/patrimonio" },
            { label: activo.nombre, href: `/app/patrimonio/${id}` },
            { label: "Editar" },
          ]}
        />
        <PageHeader
          title={`Editar ${activo.nombre}`}
          description="Los cambios se aplican al instante."
          action={
            <Button variant="outline" render={<Link href={`/app/patrimonio/${id}`} />} nativeButton={false}>
              Cancelar
            </Button>
          }
        />
        <EditarActivoCliente
          activoId={id}
          sucursales={sucursales.map((s) => ({ id: s.id, nombre: s.nombre }))}
          proveedores={proveedores.map((p) => ({ id: p.id, nombre: p.nombre }))}
          initialValues={{
            nombre: activo.nombre,
            tipo: activo.tipo,
            sucursalId: activo.sucursalId ?? undefined,
            valorCompra: Number(activo.valorCompra),
            fechaAdquisicion: activo.fechaAdquisicion,
            vidaUtilMeses: activo.vidaUtilMeses ? Number(activo.vidaUtilMeses) : undefined,
            proveedorId: activo.proveedorId ?? undefined,
            numeroSerie: activo.numeroSerie ?? undefined,
            vencimientoGarantia: activo.vencimientoGarantia ?? undefined,
            capacidadProduccionCantidad: activo.capacidadProduccionCantidad
              ? Number(activo.capacidadProduccionCantidad)
              : undefined,
            capacidadProduccionUnidad: activo.capacidadProduccionUnidad ?? undefined,
            capacidadAlmacenamientoCantidad: activo.capacidadAlmacenamientoCantidad
              ? Number(activo.capacidadAlmacenamientoCantidad)
              : undefined,
            capacidadAlmacenamientoUnidad: activo.capacidadAlmacenamientoUnidad ?? undefined,
          }}
        />
      </div>
    </div>
  );
}
