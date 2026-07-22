"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  Copy,
  Inbox,
  KeyRound,
  Lock,
  Package,
  ShieldCheck,
  Wallet,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SwitchRow } from "@/components/ui/switch-row";
import { PageHeader } from "@/components/shared/page-header";
import type { ModuloVeedorForm } from "@/modules/consentimiento/validation";
import { generarCodigoAccesoAction } from "./actions";

export const MODULOS_VEEDOR_INFO: Record<
  ModuloVeedorForm,
  { label: string; descripcion: string; icon: typeof Wallet }
> = {
  financiero: {
    label: "Ventas y finanzas",
    descripcion: "Acceso a ventas, flujo de caja y estado de resultados.",
    icon: Wallet,
  },
  operativo: {
    label: "Producción",
    descripcion: "Acceso a producciones y control de merma.",
    icon: Wrench,
  },
  inventario_operativo: {
    label: "Insumos y stock",
    descripcion: "Acceso al catálogo de insumos y su costo vigente.",
    icon: Package,
  },
};

export function NavConsentimiento({
  activo,
}: {
  activo: "generar" | "codigos" | "aprobaciones" | "solicitudes";
}) {
  const items = [
    { href: "/app/consentimiento", key: "generar", label: "Generar Código", icon: KeyRound },
    { href: "/app/consentimiento/codigos", key: "codigos", label: "Códigos Generados", icon: ClipboardList },
    { href: "/app/consentimiento/aprobaciones", key: "aprobaciones", label: "Aprobaciones", icon: ShieldCheck },
    { href: "/app/consentimiento/solicitudes", key: "solicitudes", label: "Solicitudes", icon: Inbox },
  ] as const;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Button
          key={item.key}
          render={<Link href={item.href} />}
          nativeButton={false}
          variant={activo === item.key ? "default" : "outline"}
        >
          <item.icon className="size-4" />
          {item.label}
        </Button>
      ))}
    </div>
  );
}

export function GenerarCodigoCliente({
  modulosPermitidos,
}: {
  modulosPermitidos: ModuloVeedorForm[];
}) {
  const [seleccionados, setSeleccionados] = useState<ModuloVeedorForm[]>([]);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codigoGenerado, setCodigoGenerado] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  function toggleModulo(modulo: ModuloVeedorForm) {
    setSeleccionados((prev) =>
      prev.includes(modulo) ? prev.filter((m) => m !== modulo) : [...prev, modulo]
    );
  }

  async function generar() {
    if (seleccionados.length === 0) {
      setError("Elegí al menos un módulo para compartir.");
      return;
    }
    setGenerando(true);
    setError(null);
    setCodigoGenerado(null);
    const resultado = await generarCodigoAccesoAction({ modulosHabilitados: seleccionados });
    setGenerando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    setCodigoGenerado(resultado.data.codigo);
  }

  async function copiarCodigo() {
    if (!codigoGenerado) return;
    await navigator.clipboard.writeText(codigoGenerado);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Compartir Datos"
        description="Generá un código temporal para que un proveedor, socio o asesor vea datos de tu negocio."
      />
      <NavConsentimiento activo="generar" />

      <div className="rounded-2xl bg-card p-5 shadow-card">
        <h2 className="font-heading text-base font-semibold text-navy">Generar Código de Acceso</h2>
        <p className="mt-1 text-sm text-text-muted">
          Seleccioná los módulos a los que querés otorgar acceso temporal. Generá un código seguro
          para compartir con tu equipo o asesores.
        </p>

        <div className="mt-4 space-y-2.5">
          {(Object.keys(MODULOS_VEEDOR_INFO) as ModuloVeedorForm[]).map((modulo) => {
            const info = MODULOS_VEEDOR_INFO[modulo];
            const permitido = modulosPermitidos.includes(modulo);
            const marcado = seleccionados.includes(modulo);
            return (
              <SwitchRow
                key={modulo}
                checked={marcado && permitido}
                onCheckedChange={() => toggleModulo(modulo)}
                disabled={!permitido}
                label={info.label}
                description={info.descripcion}
                icon={info.icon}
                className="p-4"
                trailing={
                  permitido ? (
                    <span className="shrink-0 rounded-full bg-success-bg px-2 py-0.5 text-xs font-medium text-success-text">
                      Disponible
                    </span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-gray-bg px-2 py-0.5 text-xs font-medium text-text-muted">
                      <Lock className="size-3" />
                      Deshabilitado
                    </span>
                  )
                }
              />
            );
          })}
        </div>

        {modulosPermitidos.length === 0 && (
          <p className="mt-3 text-xs text-warning-text">
            Tu plan actual no permite compartir ningún módulo todavía.
          </p>
        )}

        {error && <p className="mt-3 text-xs text-error-text">{error}</p>}

        {codigoGenerado && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-navy p-4 text-white">
            <div>
              <p className="text-[11px] tracking-wide text-white/60 uppercase">Código generado</p>
              <p className="font-heading text-2xl font-bold tracking-widest">{codigoGenerado}</p>
            </div>
            <Button variant="outline" size="sm" onClick={copiarCodigo} className="border-white/30 bg-white/10 text-white hover:bg-white/20">
              <Copy className="size-4" />
              {copiado ? "Copiado" : "Copiar"}
            </Button>
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <Button onClick={generar} disabled={generando || seleccionados.length === 0}>
            <KeyRound className="size-4" />
            {generando ? "Generando..." : "Generar código"}
          </Button>
        </div>
      </div>
    </div>
  );
}
