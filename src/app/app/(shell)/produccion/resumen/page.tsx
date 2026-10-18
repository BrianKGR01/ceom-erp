import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { cn } from "@/lib/utils";
import {
  calcularRangoPreset,
  PERIODOS_PRESET,
  type PeriodoPresetId,
  zonaHorariaTenant,
} from "@/lib/periodo";
import { listarUsuarios, obtenerUsuarioActual } from "@/modules/identidad/actions";
import { consultarBajasPorMotivo } from "@/modules/operativo/nichos/nicho-1/actions";
import { ETIQUETA_MOTIVO_BAJA } from "@/modules/operativo/nichos/nicho-1/motivos-baja";
import { listarProductos } from "@/modules/productos/actions";
import { rankingProductos } from "@/modules/reportes/actions";
import { consultarActividadVentas, consultarBonificacionesPorMotivo } from "@/modules/ventas/actions";
import { ETIQUETA_MOTIVO_BONIFICACION } from "@/modules/ventas/components/bonificar-dialog";

/**
 * Roadmap Cafiatto, Fase 6 — resumen operativo del dia a dia: cuanto y cuando se vende,
 * quien vende, que deja margen y cuanto se pierde (bonificaciones y bajas). Todo viene de las
 * acciones publicas de cada modulo; aca no se calcula ningun margen (regla 10), y cada numero
 * cuyo costo no se conoce lo dice (regla 9).
 */
const bs = (n: number) => `Bs ${n.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function ResumenOperativoPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const { p } = await searchParams;
  const preset: PeriodoPresetId = PERIODOS_PRESET.some((x) => x.id === p) ? (p as PeriodoPresetId) : "7dias";
  const zona = await zonaHorariaTenant(usuario.tenantId);
  const periodo = calcularRangoPreset(preset, zona);

  const [actividadRes, rankingRes, bonifRes, bajasRes, productosRes, usuariosRes] = await Promise.all([
    consultarActividadVentas(usuario, usuario.tenantId, periodo),
    rankingProductos(usuario, usuario.tenantId, periodo, { criterio: "margen" }),
    consultarBonificacionesPorMotivo(usuario, usuario.tenantId, periodo),
    consultarBajasPorMotivo(usuario, usuario.tenantId, periodo),
    listarProductos(usuario, usuario.tenantId),
    // Solo el dueño puede listar al equipo; para los demas el vendedor sale sin nombre.
    listarUsuarios(usuario),
  ]);

  const nombreProducto = new Map((productosRes.ok ? productosRes.data : []).map((x) => [x.id, x.nombre]));
  const nombreUsuario = new Map((usuariosRes.ok ? usuariosRes.data : []).map((u) => [u.id, u.nombreCompleto]));

  const actividad = actividadRes.ok ? actividadRes.data : null;
  const ticket = actividad && actividad.cantidad > 0 ? actividad.ingresos / actividad.cantidad : null;
  const maxHora = Math.max(1, ...(actividad?.porHora.map((h) => h.ingresos) ?? [0]));
  const vendedores = [...(actividad?.porVendedor ?? [])].sort((a, b) => b.ingresos - a.ingresos);
  const mejores = rankingRes.ok ? rankingRes.data.filter((f) => f.margenPct !== null).slice(0, 5) : [];
  const sinCosto = rankingRes.ok ? rankingRes.data.filter((f) => f.margenPct === null && f.ingresos > 0).length : 0;
  const bonif = bonifRes.ok ? bonifRes.data : null;
  const bajas = bajasRes.ok ? bajasRes.data : null;

  return (
    <div className="min-h-screen bg-gray-bg p-6 xl:p-8">
      <div className="mx-auto max-w-5xl space-y-6 py-6">
        <PageHeader title="Resumen operativo" description="Cuánto y cuándo se vende, quién vende, qué deja margen y qué se pierde." />

        <nav className="flex flex-wrap gap-2" aria-label="Periodo">
          {PERIODOS_PRESET.map((x) => (
            <Link
              key={x.id}
              href={`/app/produccion/resumen?p=${x.id}`}
              aria-current={x.id === preset ? "page" : undefined}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs transition-colors",
                x.id === preset ? "border-primary bg-pastel-blue-bg font-medium text-navy" : "border-gray-border text-text-body hover:border-primary/50"
              )}
            >
              {x.label}
            </Link>
          ))}
        </nav>

        {!actividad ? (
          <p className="rounded-2xl bg-card p-5 text-sm text-text-muted shadow-card">
            {actividadRes.ok ? "" : actividadRes.error}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 rounded-2xl bg-card p-5 shadow-card sm:grid-cols-4">
              <Dato titulo="Ventas" valor={String(actividad.cantidad)} />
              <Dato titulo="Ingresos" valor={bs(actividad.ingresos)} />
              <Dato titulo="Ticket promedio" valor={ticket === null ? "—" : bs(ticket)} />
              <Dato
                titulo="Bonificado"
                valor={bonif ? bs(bonif.montoBonificado) : "—"}
                nota={bonif && bonif.montoBonificado > 0 ? `costo real ${bs(bonif.costo)}` : undefined}
              />
            </div>

            {bonif && bonif.ventasSinCostoConocido > 0 && (
              <p className="rounded-2xl bg-warning-bg p-4 text-sm text-warning-text">
                {bonif.ventasSinCostoConocido} venta(s) bonificada(s) tienen productos sin costo cargado: el costo real
                de lo bonificado es mayor al que se muestra.
              </p>
            )}

            <section className="space-y-3 rounded-2xl bg-card p-5 shadow-card">
              <h2 className="text-sm font-semibold text-navy">Ventas por hora</h2>
              {actividad.porHora.length === 0 ? (
                <p className="text-sm text-text-muted">Sin ventas en el periodo.</p>
              ) : (
                <ul className="space-y-1.5">
                  {actividad.porHora.map((h) => (
                    <li key={h.hora} className="flex items-center gap-3 text-xs">
                      <span className="w-12 shrink-0 text-text-muted">{String(h.hora).padStart(2, "0")}:00</span>
                      <span className="h-3 flex-1 overflow-hidden rounded bg-gray-bg">
                        <span className="block h-full rounded bg-primary" style={{ width: `${(h.ingresos / maxHora) * 100}%` }} />
                      </span>
                      <span className="w-40 shrink-0 text-right text-text-body">
                        {bs(h.ingresos)} · {h.cantidad} {h.cantidad === 1 ? "venta" : "ventas"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="grid gap-6 md:grid-cols-2">
              <section className="space-y-3 rounded-2xl bg-card p-5 shadow-card">
                <h2 className="text-sm font-semibold text-navy">Por vendedor</h2>
                {vendedores.length === 0 ? (
                  <p className="text-sm text-text-muted">Sin ventas en el periodo.</p>
                ) : (
                  <ul className="divide-y divide-gray-border text-sm">
                    {vendedores.map((v) => (
                      <li key={v.vendedorId ?? "sin"} className="flex items-center justify-between py-2">
                        <span className="text-text-body">
                          {(v.vendedorId && nombreUsuario.get(v.vendedorId)) || "Sin identificar"}
                          <span className="ml-2 text-xs text-text-muted">{v.cantidad} ventas</span>
                        </span>
                        <span className="font-medium text-navy">{bs(v.ingresos)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="space-y-3 rounded-2xl bg-card p-5 shadow-card">
                <h2 className="text-sm font-semibold text-navy">Mayor margen</h2>
                {mejores.length === 0 ? (
                  <p className="text-sm text-text-muted">Todavía no hay productos con costo conocido y ventas.</p>
                ) : (
                  <ul className="divide-y divide-gray-border text-sm">
                    {mejores.map((f) => (
                      <li key={f.productoId} className="flex items-center justify-between py-2">
                        <span className="text-text-body">{nombreProducto.get(f.productoId) ?? "Producto"}</span>
                        <span className="font-medium text-navy">{f.margenPct!.toFixed(1)}%</span>
                      </li>
                    ))}
                  </ul>
                )}
                {sinCosto > 0 && (
                  <p className="text-xs text-warning-text">
                    {sinCosto} producto(s) vendidos no tienen costo cargado: su margen no se puede afirmar y no
                    aparece aquí.
                  </p>
                )}
                <Link href="/app/reportes/ranking-productos" className="block text-xs text-primary underline">
                  Ver el ranking completo
                </Link>
              </section>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <section className="space-y-3 rounded-2xl bg-card p-5 shadow-card">
                <h2 className="text-sm font-semibold text-navy">Bonificaciones por motivo</h2>
                {!bonif || bonif.porMotivo.length === 0 ? (
                  <p className="text-sm text-text-muted">Sin bonificaciones en el periodo.</p>
                ) : (
                  <ul className="divide-y divide-gray-border text-sm">
                    {bonif.porMotivo.map((m) => (
                      <li key={m.motivo} className="flex items-center justify-between py-2">
                        <span className="text-text-body">
                          {ETIQUETA_MOTIVO_BONIFICACION[m.motivo]}
                          <span className="ml-2 text-xs text-text-muted">{m.cantidadVentas} ventas</span>
                        </span>
                        <span className="text-right">
                          <span className="block font-medium text-navy">{bs(m.montoBonificado)}</span>
                          <span className="block text-[11px] text-text-muted">costo {bs(m.costo)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="space-y-3 rounded-2xl bg-card p-5 shadow-card">
                <h2 className="text-sm font-semibold text-navy">Bajas por motivo</h2>
                {!bajas || bajas.porMotivo.length === 0 ? (
                  <p className="text-sm text-text-muted">Sin bajas en el periodo.</p>
                ) : (
                  <ul className="divide-y divide-gray-border text-sm">
                    {bajas.porMotivo.map((m) => (
                      <li key={m.motivo} className="flex items-center justify-between py-2">
                        <span className="text-text-body">
                          {ETIQUETA_MOTIVO_BAJA[m.motivo as keyof typeof ETIQUETA_MOTIVO_BAJA] ?? m.motivo}
                          <span className="ml-2 text-xs text-text-muted">{m.cantidadBajas} bajas</span>
                        </span>
                        <span className="font-medium text-navy">{bs(m.costoTotal)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {bajas && bajas.bajasSinCostoConocido > 0 && (
                  <p className="text-xs text-warning-text">
                    {bajas.bajasSinCostoConocido} baja(s) sin costo conocido: la pérdida real es mayor a la mostrada.
                  </p>
                )}
              </section>
            </div>

            <p className="text-xs text-text-muted">
              Los ingresos suman las líneas de venta netas de bonificación y no restan ajustes posteriores (H-26).
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Dato({ titulo, valor, nota }: { titulo: string; valor: string; nota?: string }) {
  return (
    <div>
      <p className="text-xs text-text-muted">{titulo}</p>
      <p className="text-lg font-semibold text-navy">{valor}</p>
      {nota && <p className="text-[11px] text-text-muted">{nota}</p>}
    </div>
  );
}
