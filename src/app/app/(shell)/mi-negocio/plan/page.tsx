import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, Check, CreditCard, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { formatFecha, formatMoneda } from "@/lib/format";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { obtenerMiPlanAction } from "../actions";

// No se importa MODULOS_VEEDOR_INFO de consentimiento/generar-cliente.tsx
// (es "use client") — un Server Component que importa un export de un
// archivo "use client" recibe una referencia vacía en el server, no el
// objeto real (bug real encontrado al verificar esta pantalla: "Cannot read
// properties of undefined (reading 'label')"). Se duplica el mapeo acá,
// mismo criterio que CAMPOS_BOOLEANOS más abajo.
const MODULOS_VEEDOR_LABEL: Record<string, string> = {
  financiero: "Módulo Financiero",
  operativo: "Módulo Operativo",
  inventario_operativo: "Inventario Operativo",
};

const ESTADO_INFO: Record<string, { label: string; variant: "success" | "warning" | "error" }> = {
  activo: { label: "Activo", variant: "success" },
  solo_lectura: { label: "Solo lectura", variant: "warning" },
  bloqueado: { label: "Bloqueado", variant: "error" },
  activa: { label: "Activa", variant: "success" },
  pausada: { label: "Pausada", variant: "warning" },
  vencida: { label: "Vencida", variant: "error" },
};

const CAMPOS_BOOLEANOS: { key: "incluyeSucursales" | "permiteMultiplesOwners" | "permiteDowngradeAutogestionado"; label: string; descripcion: string }[] = [
  { key: "incluyeSucursales", label: "Incluye sucursales", descripcion: "El tenant puede operar con más de una sucursal." },
  { key: "permiteMultiplesOwners", label: "Múltiples Owners", descripcion: "El tenant puede tener más de un usuario Owner." },
  { key: "permiteDowngradeAutogestionado", label: "Downgrade autogestionado", descripcion: "El tenant puede bajar de plan sin pasar por CEOM Admin." },
];

function SubnavMiNegocio() {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium">
      <Link href="/app/onboarding" className="text-primary hover:underline">
        Negocio
      </Link>
      <Link href="/app/mi-negocio/colaboradores" className="text-primary hover:underline">
        Colaboradores
      </Link>
      <Link href="/app/mi-negocio/roles" className="text-primary hover:underline">
        Roles
      </Link>
      <Link href="/app/mi-negocio/capacidades" className="text-primary hover:underline">
        Capacidades Especiales
      </Link>
      <span className="text-navy">Mi Plan</span>
    </div>
  );
}

export default async function MiPlanPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const resultado = await obtenerMiPlanAction();

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <SubnavMiNegocio />
      <PageHeader title="Mi Plan" description="El plan vigente de tu negocio — solo lectura." />

      {!resultado.ok || !resultado.data.plan ? (
        <p className="mt-10 text-center text-sm text-text-muted">
          {resultado.ok ? "Este tenant todavía no tiene un plan asignado." : resultado.error}
        </p>
      ) : (
        <MiPlanContenido datos={resultado.data} />
      )}
    </div>
  );
}

type ResultadoMiPlan = Awaited<ReturnType<typeof obtenerMiPlanAction>>;
type DatosMiPlan = Extract<ResultadoMiPlan, { ok: true }>["data"];

function MiPlanContenido({ datos }: { datos: DatosMiPlan }) {
  const plan = datos.plan!;
  const estadoSuscripcion = ESTADO_INFO[datos.estadoSuscripcion] ?? ESTADO_INFO.bloqueado;
  const estadoAcceso = ESTADO_INFO[datos.estadoAcceso] ?? ESTADO_INFO.bloqueado;

  return (
    <div className="mt-4 space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-card">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-pastel-blue-bg text-primary">
            <CreditCard className="size-5" />
          </span>
          <div>
            <p className="text-[11px] font-medium tracking-wide text-text-muted uppercase">Plan</p>
            <p className="font-heading text-xl font-semibold text-navy">{plan.nombre}</p>
            <p className="text-xs text-text-muted">{formatMoneda(plan.precioMensual, plan.moneda)} / mes</p>
          </div>
        </div>

        <div className="rounded-2xl bg-card p-4 shadow-card">
          <p className="text-[11px] font-medium tracking-wide text-text-muted uppercase">Estado</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant={estadoSuscripcion.variant}>{estadoSuscripcion.label}</Badge>
            <Badge variant={estadoAcceso.variant}>{estadoAcceso.label}</Badge>
          </div>
          <p className="mt-2 text-xs text-text-muted">
            Suscripción desde {formatFecha(datos.fechaInicioSuscripcion)}
          </p>
        </div>

        {datos.estadoSuscripcion === "vencida" && (
          <div className="flex items-center gap-3 rounded-2xl bg-warning-bg p-4 shadow-card">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-card text-warning-text">
              <AlertTriangle className="size-5" />
            </span>
            <div>
              <p className="text-[11px] font-medium tracking-wide text-warning-text uppercase">
                Fecha de próximo pago
              </p>
              <p className="font-heading text-xl font-semibold text-warning-text">
                {datos.fechaProximoPago ? formatFecha(datos.fechaProximoPago) : "—"}
              </p>
            </div>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Qué incluye tu plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {CAMPOS_BOOLEANOS.map((campo) => {
              const incluido = plan[campo.key];
              return (
                <div key={campo.key} className="flex items-start gap-2.5">
                  <span
                    className={
                      incluido
                        ? "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success-bg text-success-text"
                        : "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-gray-bg text-text-muted"
                    }
                  >
                    {incluido ? <Check className="size-3" /> : <X className="size-3" />}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-navy">{campo.label}</p>
                    <p className="text-xs text-text-muted">{campo.descripcion}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-gray-border pt-4">
            <p className="text-sm font-medium text-navy">Módulos veedor permitidos</p>
            <p className="text-xs text-text-muted">
              Lo que una Institución externa puede ver de tu negocio si le das consentimiento.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {plan.modulosVeedorPermitidos.length === 0 ? (
                <span className="text-xs text-text-muted">Sin módulos veedor habilitados</span>
              ) : (
                plan.modulosVeedorPermitidos.map((m) => (
                  <Badge key={m} variant="info">
                    {MODULOS_VEEDOR_LABEL[m] ?? m}
                  </Badge>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-text-muted">
        Cambiar de plan es una acción exclusiva de CEOM Admin — contactá a soporte si necesitás
        upgrade o downgrade.
      </p>
    </div>
  );
}
