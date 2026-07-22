"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Pencil, Plus, PowerOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SwitchRow } from "@/components/ui/switch-row";
import { cn } from "@/lib/utils";
import { MODULOS_VEEDOR_INFO } from "@/app/app/(shell)/consentimiento/generar-cliente";
import type { ModuloVeedorForm } from "@/modules/consentimiento/validation";
import {
  actualizarPlanAction,
  crearPlanAction,
  desactivarPlanAction,
  reactivarPlanAction,
} from "./actions";

export interface Plan {
  id: string;
  nombre: string;
  precioMensual: string;
  moneda: string;
  incluyeSucursales: boolean;
  permiteMultiplesOwners: boolean;
  permiteDowngradeAutogestionado: boolean;
  duracionInvitacionDias: number;
  duracionEtapaSoloLecturaDias: number;
  modulosVeedorPermitidos: ModuloVeedorForm[];
  activo: boolean;
}

const MONEDAS = [
  { value: "BOB", label: "Boliviano (BOB)" },
  { value: "USD", label: "Dólar estadounidense (USD)" },
];

const CAMPOS_BOOLEANOS: { key: keyof Plan & ("incluyeSucursales" | "permiteMultiplesOwners" | "permiteDowngradeAutogestionado"); label: string; descripcion: string }[] = [
  { key: "incluyeSucursales", label: "Incluye sucursales", descripcion: "El tenant puede operar con más de una sucursal." },
  { key: "permiteMultiplesOwners", label: "Múltiples Owners", descripcion: "El tenant puede tener más de un usuario Owner." },
  { key: "permiteDowngradeAutogestionado", label: "Downgrade autogestionado", descripcion: "El tenant puede bajar de plan sin pasar por CEOM Admin." },
];

interface FormState {
  nombre: string;
  precioMensual: string;
  moneda: string;
  incluyeSucursales: boolean;
  permiteMultiplesOwners: boolean;
  permiteDowngradeAutogestionado: boolean;
  duracionInvitacionDias: string;
  duracionEtapaSoloLecturaDias: string;
  modulosVeedorPermitidos: ModuloVeedorForm[];
}

const FORM_VACIO: FormState = {
  nombre: "",
  precioMensual: "",
  moneda: "BOB",
  incluyeSucursales: false,
  permiteMultiplesOwners: false,
  permiteDowngradeAutogestionado: false,
  duracionInvitacionDias: "7",
  duracionEtapaSoloLecturaDias: "3",
  modulosVeedorPermitidos: [],
};

function PlanFormDialog({
  open,
  onOpenChange,
  plan,
  onGuardado,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: Plan | null;
  onGuardado: () => void;
}) {
  const [form, setForm] = useState<FormState>(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function abrir(nuevoAbierto: boolean) {
    if (nuevoAbierto) {
      setError(null);
      setForm(
        plan
          ? {
              nombre: plan.nombre,
              precioMensual: plan.precioMensual,
              moneda: plan.moneda,
              incluyeSucursales: plan.incluyeSucursales,
              permiteMultiplesOwners: plan.permiteMultiplesOwners,
              permiteDowngradeAutogestionado: plan.permiteDowngradeAutogestionado,
              duracionInvitacionDias: String(plan.duracionInvitacionDias),
              duracionEtapaSoloLecturaDias: String(plan.duracionEtapaSoloLecturaDias),
              modulosVeedorPermitidos: plan.modulosVeedorPermitidos,
            }
          : FORM_VACIO
      );
    }
    onOpenChange(nuevoAbierto);
  }

  function toggleModulo(modulo: ModuloVeedorForm) {
    setForm((f) => ({
      ...f,
      modulosVeedorPermitidos: f.modulosVeedorPermitidos.includes(modulo)
        ? f.modulosVeedorPermitidos.filter((m) => m !== modulo)
        : [...f.modulosVeedorPermitidos, modulo],
    }));
  }

  async function guardar() {
    if (!form.nombre.trim()) {
      setError("Ponele un nombre al plan.");
      return;
    }
    if (!form.precioMensual.trim() || Number.isNaN(Number(form.precioMensual))) {
      setError("Ingresá un precio mensual válido.");
      return;
    }
    setGuardando(true);
    setError(null);

    const input = {
      nombre: form.nombre.trim(),
      precioMensual: form.precioMensual,
      moneda: form.moneda,
      incluyeSucursales: form.incluyeSucursales,
      permiteMultiplesOwners: form.permiteMultiplesOwners,
      permiteDowngradeAutogestionado: form.permiteDowngradeAutogestionado,
      duracionInvitacionDias: Number(form.duracionInvitacionDias) || 7,
      duracionEtapaSoloLecturaDias: Number(form.duracionEtapaSoloLecturaDias) || 3,
      modulosVeedorPermitidos: form.modulosVeedorPermitidos,
    };

    const resultado = plan ? await actualizarPlanAction(plan.id, input) : await crearPlanAction(input);
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    onOpenChange(false);
    onGuardado();
  }

  return (
    <Dialog open={open} onOpenChange={abrir}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{plan ? "Editar plan" : "Nuevo plan"}</DialogTitle>
          <DialogDescription>
            Definí el precio y las funciones incluidas del plan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nombre-plan">Nombre</Label>
            <Input
              id="nombre-plan"
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              placeholder="Ej. Pro"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="precio-plan">Precio mensual</Label>
              <Input
                id="precio-plan"
                type="number"
                step="0.01"
                min="0"
                value={form.precioMensual}
                onChange={(e) => setForm((f) => ({ ...f, precioMensual: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="moneda-plan">Moneda</Label>
              <Select
                items={Object.fromEntries(MONEDAS.map((m) => [m.value, m.label]))}
                value={form.moneda}
                onValueChange={(v) => v && setForm((f) => ({ ...f, moneda: v }))}
              >
                <SelectTrigger id="moneda-plan" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONEDAS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dias-invitacion">Días de invitación</Label>
              <Input
                id="dias-invitacion"
                type="number"
                min="1"
                value={form.duracionInvitacionDias}
                onChange={(e) => setForm((f) => ({ ...f, duracionInvitacionDias: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dias-gracia">Días de gracia (solo lectura)</Label>
              <Input
                id="dias-gracia"
                type="number"
                min="0"
                value={form.duracionEtapaSoloLecturaDias}
                onChange={(e) => setForm((f) => ({ ...f, duracionEtapaSoloLecturaDias: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-gray-border p-3">
            {CAMPOS_BOOLEANOS.map((campo) => (
              <div key={campo.key} className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-navy">{campo.label}</p>
                  <p className="text-xs text-text-muted">{campo.descripcion}</p>
                </div>
                <Switch
                  checked={form[campo.key]}
                  onCheckedChange={(checked) => setForm((f) => ({ ...f, [campo.key]: checked }))}
                />
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label>Módulos veedor permitidos</Label>
            <p className="text-xs text-text-muted">
              Qué puede habilitar un tenant con este plan al generar un Código de Acceso para una Institución.
            </p>
            <div className="space-y-2">
              {(Object.keys(MODULOS_VEEDOR_INFO) as ModuloVeedorForm[]).map((modulo) => {
                const info = MODULOS_VEEDOR_INFO[modulo];
                return (
                  <SwitchRow
                    key={modulo}
                    checked={form.modulosVeedorPermitidos.includes(modulo)}
                    onCheckedChange={() => toggleModulo(modulo)}
                    label={info.label}
                    icon={info.icon}
                  />
                );
              })}
            </div>
          </div>

          {error && <p className="text-xs text-error-text">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PlanesCliente({ planesIniciales }: { planesIniciales: Plan[] }) {
  const router = useRouter();
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [planEditando, setPlanEditando] = useState<Plan | null>(null);
  const [cambiandoActivo, setCambiandoActivo] = useState<string | null>(null);

  function abrirNuevo() {
    setPlanEditando(null);
    setDialogoAbierto(true);
  }

  function abrirEditar(plan: Plan) {
    setPlanEditando(plan);
    setDialogoAbierto(true);
  }

  async function alternarActivo(plan: Plan) {
    setCambiandoActivo(plan.id);
    const resultado = plan.activo ? await desactivarPlanAction(plan.id) : await reactivarPlanAction(plan.id);
    setCambiandoActivo(null);
    if (resultado.ok) router.refresh();
  }

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-navy">Planes</h1>
          <p className="mt-1 text-sm text-text-muted">Catálogo de planes disponibles para los tenants.</p>
        </div>
        <Button onClick={abrirNuevo}>
          <Plus className="size-4" />
          Nuevo Plan
        </Button>
      </div>

      {planesIniciales.length === 0 ? (
        <p className="mt-10 text-center text-sm text-text-muted">Todavía no creaste ningún plan.</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {planesIniciales.map((plan) => (
            <div key={plan.id} className={cn("rounded-2xl bg-card p-5 shadow-card", !plan.activo && "opacity-60")}>
              <div className="flex items-start justify-between">
                <span className="flex size-11 items-center justify-center rounded-lg bg-pastel-blue-bg text-primary">
                  <CreditCard className="size-5" />
                </span>
                <Badge variant={plan.activo ? "success" : "outline"}>{plan.activo ? "Activo" : "Inactivo"}</Badge>
              </div>
              <h2 className="mt-3 font-heading text-base font-semibold text-navy">{plan.nombre}</h2>
              <p className="text-sm text-text-muted">
                {Number(plan.precioMensual).toFixed(2)} {plan.moneda} / mes
              </p>
              <div className="mt-3 flex flex-wrap gap-1">
                {plan.modulosVeedorPermitidos.length === 0 ? (
                  <span className="text-xs text-text-muted">Sin módulos veedor habilitados</span>
                ) : (
                  plan.modulosVeedorPermitidos.map((m) => (
                    <Badge key={m} variant="info">
                      {MODULOS_VEEDOR_INFO[m].label}
                    </Badge>
                  ))
                )}
              </div>
              <div className="mt-4 flex gap-2 border-t border-gray-border pt-3">
                <Button variant="outline" size="sm" className="flex-1 justify-center" onClick={() => abrirEditar(plan)}>
                  <Pencil className="size-3.5" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 justify-center"
                  onClick={() => alternarActivo(plan)}
                  disabled={cambiandoActivo === plan.id}
                >
                  <PowerOff className="size-3.5" />
                  {plan.activo ? "Desactivar" : "Reactivar"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <PlanFormDialog
        open={dialogoAbierto}
        onOpenChange={setDialogoAbierto}
        plan={planEditando}
        onGuardado={() => router.refresh()}
      />
    </div>
  );
}
