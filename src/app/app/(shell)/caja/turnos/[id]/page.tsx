import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { PageHeader } from "@/components/shared/page-header";
import { zonaHorariaTenant } from "@/lib/periodo";
import { fichaTurno } from "@/modules/caja/actions";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";

const bs = (n: number) => `Bs ${n.toFixed(2)}`;

export default async function FichaTurnoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const ficha = await fichaTurno(usuario, usuario.tenantId, id);
  if (!ficha.ok) notFound();
  const { resumen, movimientos, ventas } = ficha.data;

  const zona = await zonaHorariaTenant(usuario.tenantId);
  const formato = new Intl.DateTimeFormat("es-BO", {
    timeZone: zona,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const cerrado = resumen.estado === "cerrado";
  const diferencia = resumen.diferencia;

  return (
    <div className="min-h-screen bg-gray-bg p-6 xl:p-8">
      <div className="mx-auto max-w-4xl space-y-6 py-6">
        <Breadcrumb
          items={[
            { label: "Caja", href: "/app/caja" },
            { label: "Historial", href: "/app/caja/historial" },
            { label: `Turno #${resumen.numero}` },
          ]}
        />
        <PageHeader
          title={`Turno #${resumen.numero} · ${resumen.cajaNombre}`}
          description={`Abierto ${formato.format(resumen.abiertoEn)}${
            resumen.cerradoEn ? ` · cerrado ${formato.format(resumen.cerradoEn)}` : " · sigue abierto"
          }`}
        />

        <div className="grid grid-cols-2 gap-4 rounded-2xl bg-card p-5 shadow-card sm:grid-cols-3">
          <Dato titulo="Fondo inicial" valor={bs(resumen.fondoInicial)} />
          <Dato titulo="Efectivo cobrado" valor={bs(resumen.efectivoCobrado)} />
          <Dato titulo="Entradas" valor={bs(resumen.entradas)} />
          <Dato titulo="Salidas" valor={bs(resumen.salidas)} />
          <Dato titulo="Esperado" valor={bs(resumen.efectivoEsperado)} />
          <Dato titulo="Contado" valor={resumen.efectivoContado === null ? "—" : bs(resumen.efectivoContado)} />
        </div>

        {cerrado && diferencia !== null && (
          <div
            className={
              Math.abs(diferencia) > 0.005
                ? "rounded-2xl bg-warning-bg p-4 text-sm text-warning-text"
                : "rounded-2xl bg-pastel-blue-bg p-4 text-sm text-success-text"
            }
          >
            <p className="font-medium">
              {Math.abs(diferencia) > 0.005
                ? `${diferencia > 0 ? "Sobraron" : "Faltaron"} ${bs(Math.abs(diferencia))}`
                : "El efectivo cuadró."}
            </p>
            {resumen.observaciones && <p className="mt-1 text-text-body">{resumen.observaciones}</p>}
          </div>
        )}

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-navy">Cobros por medio de pago</h2>
          {resumen.porMedio.length === 0 ? (
            <p className="text-sm text-text-muted">Sin cobros en este turno.</p>
          ) : (
            <ul className="divide-y divide-gray-border rounded-2xl bg-card shadow-card">
              {resumen.porMedio.map((m) => (
                <li key={m.metodoPagoId} className="flex justify-between p-3 text-sm">
                  <span className="text-text-body">
                    {m.nombre}
                    {m.esEfectivo && <span className="text-xs text-text-muted"> · efectivo</span>}
                  </span>
                  <span className="font-medium text-navy">{bs(m.monto)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-navy">Movimientos de efectivo</h2>
          {movimientos.length === 0 ? (
            <p className="text-sm text-text-muted">Sin movimientos.</p>
          ) : (
            <ul className="divide-y divide-gray-border rounded-2xl bg-card shadow-card">
              {movimientos.map((m) => (
                <li key={m.id} className="flex justify-between gap-3 p-3 text-sm">
                  <span className="text-text-body">
                    {m.tipo === "entrada" ? "Entrada" : "Salida"} · {m.motivo}
                    <span className="block text-xs text-text-muted">{formato.format(m.creadoEn)}</span>
                  </span>
                  <span className={m.tipo === "entrada" ? "font-medium text-success-text" : "font-medium text-navy"}>
                    {m.tipo === "entrada" ? "+" : "−"}
                    {bs(Number(m.monto))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-navy">
            Ventas del turno ({ventas.length}) · {bs(resumen.ventasTotal)}
          </h2>
          {ventas.length === 0 ? (
            <p className="text-sm text-text-muted">Sin ventas en este turno.</p>
          ) : (
            <ul className="divide-y divide-gray-border rounded-2xl bg-card shadow-card">
              {ventas.map((v) => (
                <li key={v.id}>
                  <Link href={`/app/ventas/${v.id}`} className="flex justify-between p-3 text-sm hover:bg-gray-bg">
                    <span className="text-text-body">
                      {formato.format(v.fechaVenta)}
                      <span className="block text-xs text-text-muted">{v.estadoPago}</span>
                    </span>
                    <span className="font-medium text-navy">{bs(Number(v.total))}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div>
      <p className="text-xs text-text-muted uppercase">{titulo}</p>
      <p className="text-base font-medium text-navy">{valor}</p>
    </div>
  );
}
