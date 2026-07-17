"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Plus, ShoppingCart, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProveedorFormDialog } from "./proveedor-form-dialog";

export interface ProveedorDirectorio {
  id: string;
  nombre: string;
  contacto: string | null;
  cantidadCompras: number;
}

export function DirectorioCliente({ proveedores }: { proveedores: ProveedorDirectorio[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [busqueda, setBusqueda] = useState("");
  const [dialogoAbierto, setDialogoAbierto] = useState(false);

  const filtrados = proveedores.filter((p) =>
    p.nombre.toLowerCase().includes(busqueda.trim().toLowerCase())
  );

  return (
    <aside className="w-72 shrink-0 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-heading text-sm font-semibold text-navy">
          Directorio <span className="text-xs font-normal text-text-muted">({proveedores.length})</span>
        </h2>
        <Button size="sm" onClick={() => setDialogoAbierto(true)}>
          <Plus className="size-3.5" />
          Nuevo
        </Button>
      </div>

      <Input
        placeholder="Buscar proveedores..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      {proveedores.length === 0 ? (
        <p className="rounded-2xl bg-card p-4 text-center text-xs text-text-muted shadow-card">
          Todavía no cargaste ningún proveedor.
        </p>
      ) : (
        <div className="space-y-2">
          {filtrados.map((proveedor) => {
            const activo = pathname === `/app/proveedores/${proveedor.id}`;
            return (
              <Link
                key={proveedor.id}
                href={`/app/proveedores/${proveedor.id}`}
                className={`flex items-center gap-2.5 rounded-xl border p-3 text-sm transition-colors ${
                  activo
                    ? "border-primary bg-pastel-blue-bg"
                    : "border-gray-border bg-card hover:border-primary/50"
                }`}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-pastel-blue-bg text-primary">
                  <Truck className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-text-body">{proveedor.nombre}</p>
                  {proveedor.contacto && (
                    <p className="truncate text-xs text-text-muted">{proveedor.contacto}</p>
                  )}
                </div>
                <Badge variant="outline" className="shrink-0 gap-1">
                  <ShoppingCart className="size-3" />
                  {proveedor.cantidadCompras}
                </Badge>
              </Link>
            );
          })}
        </div>
      )}

      <ProveedorFormDialog
        open={dialogoAbierto}
        onOpenChange={setDialogoAbierto}
        onGuardado={(proveedorId) => router.push(`/app/proveedores/${proveedorId}`)}
      />
    </aside>
  );
}
