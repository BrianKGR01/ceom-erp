"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Info, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  crearTenantFormSchema,
  type CrearTenantFormInput,
} from "@/modules/identidad/validation";
import { crearTenantAction } from "../actions";

interface Plan {
  id: string;
  nombre: string;
  precioMensual: string;
  moneda: string;
}

const MONEDAS = [
  { value: "BOB", label: "Boliviano (BOB)" },
  { value: "USD", label: "Dólar estadounidense (USD)" },
];

export function NuevoTenantCliente({ planes }: { planes: Plan[] }) {
  const router = useRouter();
  const form = useForm<CrearTenantFormInput>({
    resolver: zodResolver(crearTenantFormSchema),
    defaultValues: {
      nombreNegocio: "",
      monedaPrincipal: "BOB",
      planId: "",
      fechaInicioSuscripcion: new Date().toISOString().slice(0, 10),
      ownerNombreCompleto: "",
      ownerEmail: "",
    },
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const planId = form.watch("planId");

  async function onSubmit(values: CrearTenantFormInput) {
    setGuardando(true);
    setError(null);
    const resultado = await crearTenantAction(values);
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    router.push("/admin/tenants");
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="rounded-2xl bg-card p-6 shadow-card">
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-primary" />
            <h2 className="font-heading text-base font-semibold text-navy">Datos del Negocio</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="nombreNegocio">Nombre del negocio</Label>
              <Input
                id="nombreNegocio"
                placeholder="Ej. Panadería El Sol"
                {...form.register("nombreNegocio")}
              />
              {form.formState.errors.nombreNegocio && (
                <p className="text-xs text-error-text">{form.formState.errors.nombreNegocio.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="monedaPrincipal">Moneda principal</Label>
              <Select
                items={Object.fromEntries(MONEDAS.map((m) => [m.value, m.label]))}
                value={form.watch("monedaPrincipal")}
                onValueChange={(v) => v && form.setValue("monedaPrincipal", v)}
              >
                <SelectTrigger id="monedaPrincipal" className="w-full">
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
        </div>

        <div className="border-t border-gray-border pt-6">
          <div className="mb-3 flex items-center gap-2">
            <Building2 className="size-4 text-primary" />
            <h2 className="font-heading text-base font-semibold text-navy">Configuración de Plan</h2>
          </div>
          {planes.length === 0 ? (
            <p className="text-sm text-text-muted">No hay planes activos disponibles.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {planes.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => form.setValue("planId", plan.id)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors",
                    planId === plan.id
                      ? "border-primary bg-pastel-blue-bg"
                      : "border-gray-border hover:border-primary/50"
                  )}
                >
                  <p className="font-medium text-navy">{plan.nombre}</p>
                  <p className="mt-1 text-xs text-text-muted">
                    {Number(plan.precioMensual).toFixed(2)} {plan.moneda} / mes
                  </p>
                </button>
              ))}
            </div>
          )}
          {form.formState.errors.planId && (
            <p className="mt-2 text-xs text-error-text">{form.formState.errors.planId.message}</p>
          )}

          <div className="mt-4 max-w-xs space-y-1.5">
            <Label htmlFor="fechaInicioSuscripcion">Fecha de inicio de suscripción</Label>
            <Input
              id="fechaInicioSuscripcion"
              type="date"
              {...form.register("fechaInicioSuscripcion")}
            />
            {form.formState.errors.fechaInicioSuscripcion && (
              <p className="text-xs text-error-text">
                {form.formState.errors.fechaInicioSuscripcion.message}
              </p>
            )}
          </div>
        </div>

        <div className="border-t border-gray-border pt-6">
          <div className="mb-1 flex items-center gap-2">
            <UserPlus className="size-4 text-primary" />
            <h2 className="font-heading text-base font-semibold text-navy">Dueño inicial</h2>
          </div>
          <p className="mb-3 text-sm text-text-muted">La persona que va a administrar este negocio.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ownerNombreCompleto">Nombre completo</Label>
              <Input
                id="ownerNombreCompleto"
                placeholder="Ej: María González"
                {...form.register("ownerNombreCompleto")}
              />
              {form.formState.errors.ownerNombreCompleto && (
                <p className="text-xs text-error-text">
                  {form.formState.errors.ownerNombreCompleto.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ownerEmail">Email corporativo</Label>
              <Input
                id="ownerEmail"
                type="email"
                placeholder="maria@institucion.com"
                {...form.register("ownerEmail")}
              />
              {form.formState.errors.ownerEmail && (
                <p className="text-xs text-error-text">{form.formState.errors.ownerEmail.message}</p>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-xl bg-pastel-blue-bg p-3 text-sm text-primary">
            <Info className="mt-0.5 size-4 shrink-0" />
            <p>
              <span className="font-medium">Nota:</span> Se creará la sucursal principal
              automáticamente y se enviará una invitación por correo a este dueño para que fije su
              contraseña y acceda al sistema.
            </p>
          </div>
        </div>

        {error && <p className="text-xs text-error-text">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-gray-border pt-4">
          <Button type="button" variant="outline" onClick={() => router.push("/admin/tenants")}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardando}>
            {guardando ? "Creando..." : "Crear negocio"}
          </Button>
        </div>
      </div>
    </form>
  );
}
