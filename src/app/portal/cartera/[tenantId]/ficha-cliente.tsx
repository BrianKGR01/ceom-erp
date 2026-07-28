"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Boxes,
  Factory,
  Lock,
  MinusCircle,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PortalTopbar } from "@/components/shared/portal-topbar";
import { calcularRangoPreset, PERIODOS_PRESET, type PeriodoPresetId } from "@/lib/periodo";
import { cn } from "@/lib/utils";
import {
  detalleFinancieroAction,
  detalleInventarioOperativoAction,
  detalleOperativoAction,
  resumenAccesosPropiosAction,
  tendenciaVentasAction,
} from "../../actions";

type ConAutorizacion<T> =
  | { autorizado: true; detalle: T }
  | { autorizado: false; motivo: "sin_consentimiento" | "modulo_no_aplica" };

/**
 * G-15 — el estado de error, que hasta la tanda 3.3a no existía.
 *
 * Las cuatro cargas hacían `if (vigente && r.ok) setX(r.data)`: si la acción
 * devolvía `{ok:false}`, el estado quedaba en `null` **para siempre** y la
 * pestaña mostraba "Cargando..." sin fin, sin mensaje y sin reintento. Alcanzaba
 * a cosas que sí tenían texto escrito y que nadie veía nunca — entre ellas
 * "Tu sesión expiró — iniciá sesión de nuevo" — y al `throw` deliberadamente
 * ruidoso de `solicitanteGateway()`, escrito para cortar antes que servir
 * números incompletos: cortaba en el servidor y en el cliente se veía como un
 * spinner eterno.
 */
type Cargando<T> = { estado: "cargando" } | { estado: "error"; mensaje: string } | { estado: "listo"; dato: T };

interface Produccion {
  id: string;
  fechaProduccion: string | Date;
  cantidadRealObtenida: string;
}

interface Insumo {
  id: string;
  nombre: string;
  unidadMedida: string;
  costoUnitarioVigente: string | null;
}

type TabId = "ventas" | "financiero" | "operativo" | "inventario";

const TABS: { id: TabId; label: string; icono: typeof TrendingUp }[] = [
  { id: "ventas", label: "Tendencia de Ventas", icono: TrendingUp },
  { id: "financiero", label: "Ventas y finanzas", icono: Banknote },
  { id: "operativo", label: "Producción", icono: Factory },
  { id: "inventario", label: "Insumos y stock", icono: Boxes },
];

const ESTADO_INFO: Record<string, { label: string; variant: "success" | "warning" | "error" }> = {
  activo: { label: "Activo", variant: "success" },
  solo_lectura: { label: "Solo lectura", variant: "warning" },
  bloqueado: { label: "Bloqueado", variant: "error" },
};

function formatoMoneda(valor: number): string {
  return valor.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function StatCard({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-card">
      <p className="text-[11px] font-medium tracking-wide text-text-muted uppercase">{label}</p>
      <p className="mt-1 font-heading text-xl font-semibold text-navy">{valor}</p>
    </div>
  );
}

/**
 * X-01 — el marcador de completitud de H-15, con al menos la misma prominencia
 * que tiene para el dueño (principio rector #9).
 *
 * El dueño ve exactamente esta advertencia en su Resumen Financiero
 * (`reportes/resumen-financiero-cliente.tsx`); hasta la tanda 3.3a la
 * institución veía el mismo `estadoResultados` **presentado como completo**,
 * porque el campo se descartaba en la capa de proyección. Y el error de lectura
 * no es simétrico: falta costo, nunca sobra, así que el número siempre se lee
 * mejor de lo que es.
 *
 * La diferencia con la versión del dueño es deliberada: **no hay enlace para
 * arreglarlo.** El dueño puede ir a cargar los costos; la institución no puede
 * hacer nada al respecto, y ofrecerle una acción que no tiene sería ruido. Lo
 * que sí necesita es saber cómo leer el número.
 */
function MarcadorSinCosto({ monto }: { monto: number }) {
  if (monto <= 0) return null;
  return (
    <div className="flex items-start gap-2 rounded-xl bg-warning-bg p-3">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-text" />
      <p className="text-xs text-text-body">
        <span className="font-medium text-warning-text">
          {formatoMoneda(monto)} de los ingresos de este período son de productos sin costo
          cargado.
        </span>{" "}
        Esa parte se está contando sin costo, así que el resultado real de este negocio es{" "}
        <strong>menor</strong> que el de arriba. Leelo como un techo, no como la ganancia.
      </p>
    </div>
  );
}

/**
 * X-02 — la cobertura del resumen, cuando el negocio tiene sucursales que ya no
 * pueden registrar (D-9, tanda 3.3a).
 *
 * **El encuadre importa y define qué dice este cartel.** Una sucursal congelada
 * no es una sucursal cerrada: el local puede seguir operando, lo que no puede
 * es registrarse en CEOM. Así que esto NO explica una caída de actividad — dice
 * **sobre qué parte del negocio está calculado todo lo que hay en esta ficha**.
 * Es un marcador de completitud, hermano del de H-15, sobre otro eje.
 *
 * Por eso no menciona el plan, ni el downgrade, ni el motivo: eso es
 * información comercial entre el negocio y CEOM. Lo único publicable a un
 * tercero es la cobertura del dato.
 *
 * Va arriba de las pestañas y no dentro de una: alcanza a las cuatro.
 */
function CoberturaDeSucursales({
  totales,
  operables,
}: {
  totales: number;
  operables: number;
}) {
  if (totales <= operables) return null;
  return (
    <div className="mt-4 flex items-start gap-2 rounded-xl bg-warning-bg p-3">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-text" />
      <p className="text-xs text-text-body">
        <span className="font-medium text-warning-text">
          Este negocio tiene {totales} sucursales y {operables === 1 ? "solo 1 está" : `solo ${operables} están`}{" "}
          registrando operaciones.
        </span>{" "}
        Todo lo que ves en esta ficha cubre esa parte: el histórico de las demás sigue contado, pero
        no suman actividad nueva. No quiere decir que hayan cerrado — quiere decir que su operación
        no se está registrando acá.
      </p>
    </div>
  );
}

function NoAutorizado({ modulo }: { modulo: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl bg-card py-16 text-center shadow-card">
      <span className="flex size-12 items-center justify-center rounded-full bg-gray-bg text-text-muted">
        <Lock className="size-5" />
      </span>
      <p className="font-heading text-sm font-semibold text-navy">No autorizado</p>
      <p className="max-w-xs text-xs text-text-muted">
        Este negocio no aprobó el módulo {modulo} para tu institución todavía.
      </p>
    </div>
  );
}

/**
 * G-14 — el TERCER estado, distinto de candado y de vacío.
 *
 * El candado dice "tiene estos datos y decidió no compartirlos". Una tabla
 * vacía dice "tenés acceso y no registró actividad" — y el manual enseña
 * textualmente a leerla así. Para un negocio de otro nicho las dos son falsas:
 * no hay nada que compartir ni ahora ni nunca, porque el módulo no es parte de
 * su operación.
 *
 * Icono y tono deliberadamente distintos del candado: no es una decisión del
 * negocio ni algo que pueda cambiar mañana.
 */
function ModuloNoAplica({ modulo }: { modulo: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl bg-card py-16 text-center shadow-card">
      <span className="flex size-12 items-center justify-center rounded-full bg-gray-bg text-text-muted">
        <MinusCircle className="size-5" />
      </span>
      <p className="font-heading text-sm font-semibold text-navy">Este negocio no usa este módulo</p>
      <p className="max-w-sm text-xs text-text-muted">
        Por su rubro, {modulo} no forma parte de su operación. No es que no haya registrado nada:
        no hay nada que registrar acá.
      </p>
    </div>
  );
}

/** G-15 — lo que se ve cuando una pestaña falla, en vez de "Cargando..." eterno. */
function ErrorDePestana({ mensaje }: { mensaje: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl bg-card py-16 text-center shadow-card">
      <span className="flex size-12 items-center justify-center rounded-full bg-error-bg text-error-text">
        <AlertTriangle className="size-5" />
      </span>
      <p className="font-heading text-sm font-semibold text-navy">No pudimos cargar esta pestaña</p>
      <p className="max-w-sm text-xs text-text-muted">{mensaje}</p>
    </div>
  );
}

/**
 * Las CUATRO ramas de "no hay dato para mostrar", en un solo lugar para que las
 * 4 pestañas se comporten igual: cargando, error (G-15), módulo no aplica
 * (G-14) y sin consentimiento.
 *
 * Recibe el estado entero y no una rama ya elegida: así el llamador no puede
 * olvidarse de una, y agregar una quinta rama mañana es un solo cambio.
 */
function SinDato({
  seccion,
  modulo,
}: {
  seccion: Cargando<ConAutorizacion<unknown>>;
  modulo: string;
}) {
  if (seccion.estado === "cargando")
    return <p className="py-10 text-center text-sm text-text-muted">Cargando...</p>;
  if (seccion.estado === "error") return <ErrorDePestana mensaje={seccion.mensaje} />;
  if (seccion.dato.autorizado) return null;
  return seccion.dato.motivo === "modulo_no_aplica" ? (
    <ModuloNoAplica modulo={modulo} />
  ) : (
    <NoAutorizado modulo={modulo} />
  );
}

export function FichaTenantCliente({
  tenantId,
  tenant,
  zona,
}: {
  tenantId: string;
  tenant: {
    nombreNegocio: string;
    estadoAcceso: string;
    /** X-02: cobertura del dato. */
    sucursalesTotales: number;
    sucursalesOperables: number;
  };
  /** Zona horaria del negocio OBSERVADO, no la de la institucion que mira. */
  zona: string;
}) {
  const [tabActivo, setTabActivo] = useState<TabId>("ventas");
  const [presetId, setPresetId] = useState<PeriodoPresetId>("mes");
  const periodo = calcularRangoPreset(presetId, zona);

  const CARGANDO = { estado: "cargando" } as const;
  const [ventas, setVentas] = useState<Cargando<ConAutorizacion<{ ingresos: number }>>>(CARGANDO);
  const [financiero, setFinanciero] = useState<
    Cargando<
      ConAutorizacion<{
        flujoCaja: number;
        estadoResultados: number;
        costoFijoTotal: number;
        /** X-01: el marcador de completitud de H-15. */
        ingresosSinCostoConocido: number;
      }>
    >
  >(CARGANDO);
  const [operativo, setOperativo] = useState<
    Cargando<ConAutorizacion<{ producciones: Produccion[]; mermaCostoTotal: number }>>
  >(CARGANDO);
  const [inventario, setInventario] = useState<Cargando<ConAutorizacion<{ insumos: Insumo[] }>>>(
    CARGANDO
  );
  const [resumenAccesos, setResumenAccesos] = useState<{
    consultas: number;
    dias: number;
  } | null>(null);

  // G-15: el `else` de cada `.then` es lo que faltaba. Antes, un `{ok:false}`
  // dejaba el estado en `null` y la pestaña en "Cargando..." para siempre.
  // `.catch` además cubre el rechazo de la Server Action, que tampoco tenía
  // quién lo recogiera (no hay error.tsx en todo src/app/).
  useEffect(() => {
    let vigente = true;
    const cargar = <T,>(
      promesa: Promise<{ ok: true; data: T } | { ok: false; error: string }>,
      set: (v: Cargando<T>) => void
    ) => {
      promesa
        .then((r) => {
          if (!vigente) return;
          set(r.ok ? { estado: "listo", dato: r.data } : { estado: "error", mensaje: r.error });
        })
        .catch(() => {
          if (vigente) set({ estado: "error", mensaje: "Probá de nuevo en un momento." });
        });
    };
    cargar(tendenciaVentasAction(tenantId, periodo), setVentas);
    cargar(detalleFinancieroAction(tenantId, periodo), setFinanciero);
    cargar(
      detalleOperativoAction(tenantId, periodo) as Promise<
        | { ok: true; data: ConAutorizacion<{ producciones: Produccion[]; mermaCostoTotal: number }> }
        | { ok: false; error: string }
      >,
      setOperativo
    );
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, presetId]);

  useEffect(() => {
    let vigente = true;
    resumenAccesosPropiosAction(tenantId).then((r) => {
      if (vigente && r.ok) setResumenAccesos(r.data);
    });
    return () => {
      vigente = false;
    };
  }, [tenantId, presetId]);

  useEffect(() => {
    let vigente = true;
    detalleInventarioOperativoAction(tenantId)
      .then((r) => {
        if (!vigente) return;
        setInventario(
          r.ok
            ? { estado: "listo", dato: r.data as ConAutorizacion<{ insumos: Insumo[] }> }
            : { estado: "error", mensaje: r.error }
        );
      })
      .catch(() => {
        if (vigente) setInventario({ estado: "error", mensaje: "Probá de nuevo en un momento." });
      });
    return () => {
      vigente = false;
    };
  }, [tenantId]);

  const estado = ESTADO_INFO[tenant.estadoAcceso] ?? ESTADO_INFO.bloqueado;
  const conCandado = (s: Cargando<ConAutorizacion<unknown>>) =>
    s.estado === "listo" && !s.dato.autorizado && s.dato.motivo === "sin_consentimiento";
  const bloqueado: Record<TabId, boolean> = {
    ventas: conCandado(ventas),
    financiero: conCandado(financiero),
    operativo: conCandado(operativo),
    inventario: conCandado(inventario),
  };

  return (
    <div className="min-h-screen bg-gray-bg">
      <PortalTopbar />

      <div className="p-6">
        <Link
          href="/portal"
          className="flex w-fit items-center gap-1.5 text-xs font-medium text-text-muted hover:text-navy"
        >
          <ArrowLeft className="size-3.5" />
          Volver a Mi Cartera
        </Link>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-semibold text-navy">{tenant.nombreNegocio}</h1>
            <p className="text-sm text-text-muted">Ficha de Tenant</p>
          </div>
          <Badge variant={estado.variant}>{estado.label}</Badge>
        </div>

        <CoberturaDeSucursales
          totales={tenant.sucursalesTotales}
          operables={tenant.sucursalesOperables}
        />

        <div className="mt-6 rounded-2xl bg-card shadow-card">
          <div className="flex items-center gap-1 overflow-x-auto border-b border-gray-border px-4">
            {TABS.map((tab) => {
              const Icono = tab.icono;
              const activo = tabActivo === tab.id;
              const locked = bloqueado[tab.id];
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTabActivo(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 border-b-2 px-3 py-3.5 text-sm font-medium whitespace-nowrap transition-colors",
                    activo
                      ? "border-primary text-primary"
                      : "border-transparent text-text-muted hover:text-navy",
                    locked && !activo && "text-text-muted/60"
                  )}
                >
                  {locked ? <Lock className="size-3.5" /> : <Icono className="size-3.5" />}
                  {tab.label}
                </button>
              );
            })}
          </div>

          {tabActivo !== "inventario" && (
            <div className="flex flex-wrap gap-1.5 px-4 pt-4">
              {PERIODOS_PRESET.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPresetId(p.id)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    presetId === p.id
                      ? "bg-primary text-white"
                      : "bg-gray-bg text-text-muted hover:bg-pastel-blue-bg"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          <div className="p-4">
            {tabActivo === "ventas" &&
              (ventas.estado !== "listo" || !ventas.dato.autorizado ? (
                <SinDato seccion={ventas} modulo="Ventas y finanzas" />
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <StatCard label="Ingresos del período" valor={formatoMoneda(ventas.dato.detalle.ingresos)} />
                </div>
              ))}

            {tabActivo === "financiero" &&
              (financiero.estado !== "listo" || !financiero.dato.autorizado ? (
                <SinDato seccion={financiero} modulo="Ventas y finanzas" />
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <StatCard label="Flujo de Caja" valor={formatoMoneda(financiero.dato.detalle.flujoCaja)} />
                    <StatCard label="Estado de Resultados" valor={formatoMoneda(financiero.dato.detalle.estadoResultados)} />
                    <StatCard label="Costo Fijo Total" valor={formatoMoneda(financiero.dato.detalle.costoFijoTotal)} />
                  </div>
                  <MarcadorSinCosto monto={financiero.dato.detalle.ingresosSinCostoConocido} />
                </div>
              ))}

            {tabActivo === "operativo" &&
              (operativo.estado !== "listo" || !operativo.dato.autorizado ? (
                <SinDato seccion={operativo} modulo="Producción" />
              ) : (
                <div className="space-y-4">
                  <StatCard label="Costo de Merma del período" valor={formatoMoneda(operativo.dato.detalle.mermaCostoTotal)} />
                  {operativo.dato.detalle.producciones.length === 0 ? (
                    <p className="py-6 text-center text-sm text-text-muted">Sin producciones registradas.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-gray-border">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-gray-bg text-xs text-text-muted uppercase">
                          <tr>
                            <th className="px-3 py-2 font-medium">Fecha</th>
                            <th className="px-3 py-2 font-medium">Cantidad obtenida</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-border">
                          {operativo.dato.detalle.producciones.map((p) => (
                            <tr key={p.id}>
                              <td className="px-3 py-2 text-navy">
                                {new Date(p.fechaProduccion).toLocaleDateString("es-BO")}
                              </td>
                              <td className="px-3 py-2 text-navy">{p.cantidadRealObtenida}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}

            {tabActivo === "inventario" &&
              (inventario.estado !== "listo" || !inventario.dato.autorizado ? (
                <SinDato seccion={inventario} modulo="Insumos y stock" />
              ) : inventario.dato.detalle.insumos.length === 0 ? (
                <p className="py-10 text-center text-sm text-text-muted">Sin insumos cargados.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-bg text-xs text-text-muted uppercase">
                      <tr>
                        <th className="px-3 py-2 font-medium">Insumo</th>
                        <th className="px-3 py-2 font-medium">Unidad</th>
                        <th className="px-3 py-2 font-medium">Costo vigente</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-border">
                      {inventario.dato.detalle.insumos.map((i) => (
                        <tr key={i.id}>
                          <td className="px-3 py-2 text-navy">{i.nombre}</td>
                          <td className="px-3 py-2 text-navy">{i.unidadMedida}</td>
                          <td className="px-3 py-2 text-navy">
                            {i.costoUnitarioVigente !== null ? formatoMoneda(Number(i.costoUnitarioVigente)) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
          </div>
        </div>

        {/* D-1 — la mitad simétrica del registro de acceso.
            El negocio ve qué consultó esta institución y cuándo; decírselo a la
            institución es lo que vuelve esto TRANSPARENCIA y no vigilancia. Y
            tiene un efecto concreto de privacidad para el negocio: una
            institución que sabe que cada consulta queda a la vista del dueño
            consulta distinto. La disuasión es parte del mecanismo, no un efecto
            secundario — y solo funciona si se dice. */}
        <p className="mt-4 text-xs text-text-muted">
          El dueño de este negocio puede ver qué tipo de información consultaste y en qué días
          {resumenAccesos !== null && resumenAccesos.consultas > 0 ? (
            <>
              {" "}
              — hasta ahora, <strong>{resumenAccesos.consultas}</strong>{" "}
              {resumenAccesos.consultas === 1 ? "consulta" : "consultas"} en{" "}
              <strong>{resumenAccesos.dias}</strong> {resumenAccesos.dias === 1 ? "día" : "días"}.
            </>
          ) : (
            "."
          )}{" "}
          No ve los números que viste, ni qué pestaña miraste más.
        </p>
      </div>
    </div>
  );
}
