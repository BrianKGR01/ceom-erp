import Link from "next/link";
import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { PageHeader } from "@/components/shared/page-header";
import { zonaHorariaTenant } from "@/lib/periodo";
import { listarTurnos } from "@/modules/caja/actions";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { cn } from "@/lib/utils";

const bs = (n: number) => `Bs ${n.toFixed(2)}`;

export default async function HistorialTurnosPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; dif?: string }>;
}) {
  const filtros = await searchParams;
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const estado = filtros.estado === "abierto" || filtros.estado === "cerrado" ? filtros.estado : undefined;
  const conDiferencia = filtros.dif === "1" ? true : filtros.dif === "0" ? false : undefined;
  const [resultado, zona] = await Promise.all([
    listarTurnos(usuario, usuario.tenantId, { estado, conDiferencia }),
    zonaHorariaTenant(usuario.tenantId),
  ]);
  const formato = new Intl.DateTimeFormat("es-BO", {
    timeZone: zona,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const enlace = (params: { estado?: string; dif?: string }) => {
    const q = new URLSearchParams();
    if (params.estado) q.set("estado", params.estado);
    if (params.dif) q.set("dif", params.dif);
    const s = q.toString();
    return s ? `/app/caja/historial?${s}` : "/app/caja/historial";
  };
  const chip = (activo: boolean) =>
    cn(
      "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
      activo ? "bg-primary text-white" : "bg-pastel-blue-bg text-text-body hover:bg-pastel-blue-bg/70"
    );

  return (
    <div className="min-h-screen bg-gray-bg p-6 xl:p-8">
      <div className="mx-auto max-w-5xl space-y-4 py-6">
        <Breadcrumb items={[{ label: "Caja", href: "/app/caja" }, { label: "Historial de turnos" }]} />
        <PageHeader title="Historial de turnos" description="Qué pasó en cada turno de caja y si el efectivo cuadró." />

        <div className="flex flex-wrap gap-2">
          <Link href={enlace({})} className={chip(!estado && conDiferencia === undefined)}>
            Todos
          </Link>
          <Link href={enlace({ estado: "abierto" })} className={chip(estado === "abierto")}>
            Abiertos
          </Link>
          <Link href={enlace({ estado: "cerrado" })} className={chip(estado === "cerrado" && conDiferencia === undefined)}>
            Cerrados
          </Link>
          <Link href={enlace({ dif: "1" })} className={chip(conDiferencia === true)}>
            Con diferencia
          </Link>
          <Link href={enlace({ dif: "0" })} className={chip(conDiferencia === false)}>
            Sin diferencia
          </Link>
        </div>

        {!resultado.ok ? (
          <p className="text-sm text-error-text">{resultado.error}</p>
        ) : resultado.data.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-muted">No hay turnos con este filtro.</p>
        ) : (
          <div className="divide-y divide-gray-border rounded-2xl bg-card shadow-card">
            {resultado.data.map(({ turno, cajaNombre }) => {
              const diferencia = turno.diferencia === null ? null : Number(turno.diferencia);
              return (
                <Link
                  key={turno.id}
                  href={`/app/caja/turnos/${turno.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm hover:bg-gray-bg"
                >
                  <div>
                    <p className="font-medium text-navy">
                      Turno #{turno.numero} · {cajaNombre}
                    </p>
                    <p className="text-xs text-text-muted">
                      {formato.format(turno.abiertoEn)}
                      {turno.cerradoEn ? ` → ${formato.format(turno.cerradoEn)}` : " · abierto"}
                    </p>
                  </div>
                  <div className="text-right">
                    {turno.estado === "abierto" ? (
                      <span className="text-xs font-medium text-primary">En curso</span>
                    ) : diferencia !== null && Math.abs(diferencia) > 0.005 ? (
                      <span className="font-medium text-warning-text">
                        {diferencia > 0 ? "Sobran" : "Faltan"} {bs(Math.abs(diferencia))}
                      </span>
                    ) : (
                      <span className="font-medium text-success-text">Cuadra</span>
                    )}
                    {turno.ventasCantidad !== null && (
                      <p className="text-xs text-text-muted">
                        {turno.ventasCantidad} {turno.ventasCantidad === 1 ? "venta" : "ventas"} ·{" "}
                        {bs(Number(turno.ventasTotal ?? 0))}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
