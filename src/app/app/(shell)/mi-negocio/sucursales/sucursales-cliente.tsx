"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Lock, Pencil, Plus } from "lucide-react";
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
import { PageHeader } from "@/components/shared/page-header";
import {
  actualizarSucursalSchema,
  crearSucursalSchema,
  type ActualizarSucursalInput,
  type CrearSucursalInput,
} from "@/modules/identidad/validation";
import { actualizarSucursalAction, crearSucursalAction } from "../actions";

interface Sucursal {
  id: string;
  nombre: string;
  direccion: string | null;
  esPrincipal: boolean;
  congeladaEn: string | Date | null;
  congeladaMotivo: string | null;
}

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
        Permisos especiales
      </Link>
      <span className="text-navy">Sucursales</span>
      <Link href="/app/mi-negocio/plan" className="text-primary hover:underline">
        Mi Plan
      </Link>
    </div>
  );
}

function NuevaSucursalDialog({
  open,
  onOpenChange,
  onCreada,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreada: () => void;
}) {
  const form = useForm<CrearSucursalInput>({
    resolver: zodResolver(crearSucursalSchema),
    defaultValues: { nombre: "", direccion: "" },
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(values: CrearSucursalInput) {
    setGuardando(true);
    setError(null);
    const resultado = await crearSucursalAction(values);
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    form.reset();
    onOpenChange(false);
    onCreada();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-pastel-blue-bg text-primary">
              <Building2 className="size-4" />
            </span>
            <DialogTitle>Nueva sucursal</DialogTitle>
          </div>
          <DialogDescription>El stock, las ventas y los reportes se pueden ver por sucursal.</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="nombre-sucursal">Nombre</Label>
            <Input id="nombre-sucursal" placeholder="Ej. Sucursal Centro" autoFocus {...form.register("nombre")} />
            {form.formState.errors.nombre && (
              <p className="text-xs text-error-text">{form.formState.errors.nombre.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="direccion-sucursal">Dirección (opcional)</Label>
            <Input id="direccion-sucursal" placeholder="Ej. Av. Siempre Viva 123" {...form.register("direccion")} />
          </div>

          {error && <p className="text-xs text-error-text">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={guardando}>
              {guardando ? "Creando..." : "Crear sucursal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditarSucursalDialog({
  open,
  onOpenChange,
  sucursal,
  onGuardado,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sucursal: Sucursal | null;
  onGuardado: () => void;
}) {
  const form = useForm<ActualizarSucursalInput>({
    resolver: zodResolver(actualizarSucursalSchema),
    values: { nombre: sucursal?.nombre ?? "", direccion: sucursal?.direccion ?? "" },
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(values: ActualizarSucursalInput) {
    if (!sucursal) return;
    setGuardando(true);
    setError(null);
    const resultado = await actualizarSucursalAction(sucursal.id, values);
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    onOpenChange(false);
    onGuardado();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar sucursal</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="nombre-sucursal-editar">Nombre</Label>
            <Input id="nombre-sucursal-editar" {...form.register("nombre")} />
            {form.formState.errors.nombre && (
              <p className="text-xs text-error-text">{form.formState.errors.nombre.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="direccion-sucursal-editar">Dirección (opcional)</Label>
            <Input id="direccion-sucursal-editar" {...form.register("direccion")} />
          </div>

          {error && <p className="text-xs text-error-text">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SucursalesCliente({
  sucursales,
  maxSucursales,
}: {
  sucursales: Sucursal[];
  maxSucursales: number | null;
}) {
  const router = useRouter();
  const [dialogoNueva, setDialogoNueva] = useState(false);
  const [sucursalEditando, setSucursalEditando] = useState<Sucursal | null>(null);

  const operables = sucursales.filter((s) => !s.congeladaEn).length;
  const limiteAlcanzado = maxSucursales !== null && operables >= maxSucursales;

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <SubnavMiNegocio />
      <PageHeader
        title="Sucursales"
        description={
          maxSucursales === null
            ? "Tu plan permite sucursales ilimitadas."
            : `Tu plan permite hasta ${maxSucursales} sucursal(es) — hoy usás ${operables}.`
        }
        action={
          <Button onClick={() => setDialogoNueva(true)} disabled={limiteAlcanzado}>
            <Plus className="size-4" />
            Nueva sucursal
          </Button>
        }
      />
      {limiteAlcanzado && (
        <p className="mt-2 text-xs text-text-muted">
          Llegaste al tope de tu plan — contactá a soporte si necesitás más sucursales.
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sucursales.map((s) => (
          <div key={s.id} className="rounded-2xl bg-card p-5 shadow-card">
            <div className="flex items-start justify-between">
              <span className="flex size-11 items-center justify-center rounded-lg bg-pastel-blue-bg text-primary">
                <Building2 className="size-5" />
              </span>
              <div className="flex flex-col items-end gap-1">
                {s.esPrincipal && <Badge variant="info">Principal</Badge>}
                {s.congeladaEn && (
                  <Badge variant="warning">
                    <Lock className="size-3" />
                    Congelada
                  </Badge>
                )}
              </div>
            </div>
            <h2 className="mt-3 font-heading text-base font-semibold text-navy">{s.nombre}</h2>
            <p className="text-xs text-text-muted">{s.direccion || "Sin dirección cargada"}</p>
            {s.congeladaEn && s.congeladaMotivo && (
              <p className="mt-2 text-xs text-warning-text">{s.congeladaMotivo}</p>
            )}

            <div className="mt-4 flex gap-2 border-t border-gray-border pt-3">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 justify-center"
                onClick={() => setSucursalEditando(s)}
              >
                <Pencil className="size-3.5" />
                Editar
              </Button>
            </div>
          </div>
        ))}
      </div>

      <NuevaSucursalDialog open={dialogoNueva} onOpenChange={setDialogoNueva} onCreada={() => router.refresh()} />
      <EditarSucursalDialog
        open={sucursalEditando !== null}
        onOpenChange={(open) => !open && setSucursalEditando(null)}
        sucursal={sucursalEditando}
        onGuardado={() => router.refresh()}
      />
    </div>
  );
}
