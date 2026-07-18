"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
  compraFormSchema,
  type CompraFormInput,
} from "@/modules/proveedores/validation";
import { registrarCompraAction } from "../../actions";

export function NuevaCompraCliente({
  sucursales,
  proveedores,
  productos,
  insumos,
}: {
  sucursales: { id: string; nombre: string }[];
  proveedores: { id: string; nombre: string }[];
  productos: { id: string; nombre: string }[];
  insumos: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const form = useForm<CompraFormInput>({
    resolver: zodResolver(compraFormSchema),
    defaultValues: {
      sucursalId: sucursales.length === 1 ? sucursales[0].id : "",
      proveedorId: "",
      tipo: "reventa",
      insumoId: "",
      productoId: "",
      cantidad: undefined,
      montoTotal: undefined,
      costoAdicionalTraslado: undefined,
      fechaCompra: "",
      fechaVencimiento: "",
      estado: "recibido",
    },
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tipo = form.watch("tipo");

  async function onSubmit(values: CompraFormInput) {
    setGuardando(true);
    setError(null);
    const resultado = await registrarCompraAction(values);
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    router.push("/app/proveedores/compras");
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="rounded-2xl bg-card p-6 shadow-card">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Tipo de compra</Label>
          <div className="grid grid-cols-2 gap-2">
            {(["reventa", "insumo"] as const).map((valor) => (
              <button
                key={valor}
                type="button"
                onClick={() => form.setValue("tipo", valor)}
                className={cn(
                  "rounded-xl border p-2.5 text-center text-sm font-medium transition-colors",
                  tipo === valor
                    ? "border-primary bg-pastel-blue-bg text-primary"
                    : "border-gray-border text-text-muted hover:border-primary/50"
                )}
              >
                {valor === "reventa" ? "Producto para reventa" : "Insumo de producción"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="sucursalId">Sucursal</Label>
            <Select
              items={Object.fromEntries(sucursales.map((s) => [s.id, s.nombre]))}
              value={form.watch("sucursalId")}
              onValueChange={(value) => value && form.setValue("sucursalId", value)}
            >
              <SelectTrigger id="sucursalId" className="w-full">
                <SelectValue placeholder="Elegí una sucursal" />
              </SelectTrigger>
              <SelectContent>
                {sucursales.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.sucursalId && (
              <p className="text-xs text-error-text">{form.formState.errors.sucursalId.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="proveedorId">Proveedor (opcional)</Label>
            <Select
              items={Object.fromEntries(proveedores.map((p) => [p.id, p.nombre]))}
              value={form.watch("proveedorId") ?? ""}
              onValueChange={(value) => form.setValue("proveedorId", value ?? undefined)}
            >
              <SelectTrigger id="proveedorId" className="w-full">
                <SelectValue placeholder="Sin proveedor" />
              </SelectTrigger>
              <SelectContent>
                {proveedores.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="item">{tipo === "insumo" ? "Insumo" : "Producto"}</Label>
          {tipo === "insumo" ? (
            <Select
              items={Object.fromEntries(insumos.map((i) => [i.id, i.nombre]))}
              value={form.watch("insumoId") ?? ""}
              onValueChange={(value) => form.setValue("insumoId", value ?? "")}
            >
              <SelectTrigger id="item" className="w-full">
                <SelectValue placeholder="Elegí un insumo" />
              </SelectTrigger>
              <SelectContent>
                {insumos.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Select
              items={Object.fromEntries(productos.map((p) => [p.id, p.nombre]))}
              value={form.watch("productoId") ?? ""}
              onValueChange={(value) => form.setValue("productoId", value ?? "")}
            >
              <SelectTrigger id="item" className="w-full">
                <SelectValue placeholder="Elegí un producto" />
              </SelectTrigger>
              <SelectContent>
                {productos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {(form.formState.errors.insumoId || form.formState.errors.productoId) && (
            <p className="text-xs text-error-text">
              {form.formState.errors.insumoId?.message ?? form.formState.errors.productoId?.message}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="cantidad">Cantidad</Label>
            <Input
              id="cantidad"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              {...form.register("cantidad", { valueAsNumber: true })}
            />
            {form.formState.errors.cantidad && (
              <p className="text-xs text-error-text">{form.formState.errors.cantidad.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="montoTotal">Monto total</Label>
            <Input
              id="montoTotal"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              {...form.register("montoTotal", { valueAsNumber: true })}
            />
            {form.formState.errors.montoTotal && (
              <p className="text-xs text-error-text">{form.formState.errors.montoTotal.message}</p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="costoAdicionalTraslado">Costo adicional de traslado (opcional)</Label>
          <Input
            id="costoAdicionalTraslado"
            type="number"
            step="0.01"
            min="0"
            placeholder="Flete, envío, etc."
            {...form.register("costoAdicionalTraslado", {
              setValueAs: (v) => (v === "" ? undefined : Number(v)),
            })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="fechaCompra">Fecha de compra</Label>
            <Input id="fechaCompra" type="date" {...form.register("fechaCompra")} />
            {form.formState.errors.fechaCompra && (
              <p className="text-xs text-error-text">{form.formState.errors.fechaCompra.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fechaVencimiento">Fecha de vencimiento (opcional)</Label>
            <Input id="fechaVencimiento" type="date" {...form.register("fechaVencimiento")} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Estado</Label>
          <div className="grid grid-cols-2 gap-2">
            {(["recibido", "pedido"] as const).map((valor) => (
              <button
                key={valor}
                type="button"
                onClick={() => form.setValue("estado", valor)}
                className={cn(
                  "rounded-xl border p-2.5 text-center text-sm font-medium transition-colors",
                  form.watch("estado") === valor
                    ? "border-primary bg-pastel-blue-bg text-primary"
                    : "border-gray-border text-text-muted hover:border-primary/50"
                )}
              >
                {valor === "recibido" ? "Ya recibida" : "Pedido (por recibir)"}
              </button>
            ))}
          </div>
          <p className="text-xs text-text-muted">
            &ldquo;Pedido&rdquo; no descuenta ni suma stock todavía — recién entra al inventario
            cuando se confirma la recepción.
          </p>
        </div>
      </div>

      {error && <p className="mt-4 text-xs text-error-text">{error}</p>}

      <div className="mt-6 flex justify-end gap-2 border-t border-gray-border pt-4">
        <Button type="submit" disabled={guardando}>
          {guardando ? "Guardando..." : "Guardar compra"}
        </Button>
      </div>
    </form>
  );
}
