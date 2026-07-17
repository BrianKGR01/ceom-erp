import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { PageHeader } from "@/components/shared/page-header";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { fichaPasivo, listarActivos } from "@/modules/patrimonio/actions";
import { RefinanciarPasivoCliente } from "./refinanciar-pasivo-cliente";

export default async function RefinanciarPasivoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const [fichaResultado, activosResultado] = await Promise.all([
    fichaPasivo(usuario, id),
    listarActivos(usuario, usuario.tenantId, { excluirDadosDeBaja: true }),
  ]);
  if (!fichaResultado.ok) redirect("/app/patrimonio/pasivos");
  if (fichaResultado.data.pasivo.estado !== "activo") redirect(`/app/patrimonio/pasivos/${id}`);

  const { pasivo } = fichaResultado.data;
  const activos = activosResultado.ok ? activosResultado.data : [];

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-4xl space-y-4 py-6">
        <Breadcrumb
          items={[
            { label: "Patrimonio", href: "/app/patrimonio" },
            { label: "Pasivos", href: "/app/patrimonio/pasivos" },
            { label: "Refinanciar" },
          ]}
        />
        <PageHeader title="Refinanciar pasivo" description="Se crea un pasivo nuevo con estos términos." />

        <RefinanciarPasivoCliente
          pasivoAnteriorId={id}
          activos={activos.map((a) => ({ id: a.id, nombre: a.nombre, tipo: a.tipo }))}
          initialValues={{
            activoId: pasivo.activoId ?? undefined,
            montoTotal: Number(pasivo.montoTotal),
            cuotaPeriodica: Number(pasivo.cuotaPeriodica),
            frecuenciaCuota: pasivo.frecuenciaCuota,
            plazoCuotas: pasivo.plazoCuotas,
            fechaInicio: "",
          }}
        />
      </div>
    </div>
  );
}
