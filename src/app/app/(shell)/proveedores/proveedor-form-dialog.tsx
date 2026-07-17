"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  proveedorFormSchema,
  type ProveedorFormInput,
} from "@/modules/proveedores/validation";
import { actualizarProveedorAction, crearProveedorAction } from "./actions";

export interface ProveedorEditable {
  id: string;
  nombre: string;
  contacto: string | null;
  notas: string | null;
}

export function ProveedorFormDialog({
  open,
  onOpenChange,
  proveedor,
  onGuardado,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proveedor?: ProveedorEditable;
  onGuardado: (proveedorId: string) => void;
}) {
  const form = useForm<ProveedorFormInput>({
    resolver: zodResolver(proveedorFormSchema),
    values: {
      nombre: proveedor?.nombre ?? "",
      contacto: proveedor?.contacto ?? "",
      notas: proveedor?.notas ?? "",
    },
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(values: ProveedorFormInput) {
    setGuardando(true);
    setError(null);

    if (proveedor) {
      const resultado = await actualizarProveedorAction(proveedor.id, values);
      setGuardando(false);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      onOpenChange(false);
      onGuardado(proveedor.id);
      return;
    }

    const resultado = await crearProveedorAction(values);
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    onOpenChange(false);
    onGuardado(resultado.data.proveedorId);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-pastel-blue-bg text-primary">
              <Building2 className="size-4" />
            </span>
            <DialogTitle>{proveedor ? "Editar proveedor" : "Nuevo proveedor"}</DialogTitle>
          </div>
          <DialogDescription>
            {proveedor ? "Actualizá los datos del proveedor." : "Cargá un proveedor a tu directorio."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" placeholder="Ej. Distribuidora del Norte" {...form.register("nombre")} />
            {form.formState.errors.nombre && (
              <p className="text-xs text-error-text">{form.formState.errors.nombre.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contacto">Contacto (opcional)</Label>
            <Input id="contacto" placeholder="Nombre de la persona de contacto" {...form.register("contacto")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notas">Notas (opcional)</Label>
            <Textarea id="notas" placeholder="Información adicional sobre el proveedor..." {...form.register("notas")} />
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
