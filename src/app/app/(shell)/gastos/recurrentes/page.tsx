import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { PageHeader } from "@/components/shared/page-header";
import { listarCategoriasGasto, listarGastosRecurrentes } from "@/modules/gastos/actions";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { RecurrentesCliente } from "./recurrentes-cliente";

export default async function GastosRecurrentesPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const [recurrentesResultado, categoriasResultado] = await Promise.all([
    listarGastosRecurrentes(usuario, usuario.tenantId),
    listarCategoriasGasto(usuario, usuario.tenantId),
  ]);

  const recurrentes = recurrentesResultado.ok ? recurrentesResultado.data : [];
  const categorias = categoriasResultado.ok ? categoriasResultado.data : [];
  const categoriaPorId = new Map(categorias.map((c) => [c.id, c.nombre]));

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-5xl space-y-4 py-6">
        <Breadcrumb items={[{ label: "Gastos", href: "/app/gastos" }, { label: "Gastos Recurrentes" }]} />
        <PageHeader
          title="Gestión de Gastos Recurrentes"
          description="Configurá y administrá plantillas para automatizar el registro de tus gastos fijos."
        />

        <RecurrentesCliente
          recurrentes={recurrentes.map((r) => ({
            id: r.id,
            categoriaNombre: categoriaPorId.get(r.categoriaId) ?? "Sin categoría",
            monto: r.monto,
            frecuencia: r.frecuencia,
            fechaInicio: r.fechaInicio,
            fechaFin: r.fechaFin,
            activo: r.activo,
          }))}
          categorias={categorias.map((c) => ({ id: c.id, nombre: c.nombre }))}
        />
      </div>
    </div>
  );
}
