"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Search, Trash2, Users } from "lucide-react";
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
import { EmptyState } from "@/components/shared/empty-state";
import { clienteFormSchema } from "@/modules/ventas/validation";
import type { z } from "zod";
import {
  actualizarClienteAction,
  crearClienteAction,
  eliminarClienteAction,
} from "../actions";

type ClienteFormInput = z.infer<typeof clienteFormSchema>;

export interface ClienteListado {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  ultimaCompraEn: string | null;
}

const POR_PAGINA = 10;

function textoUltimaCompra(ultimaCompraEn: string | null): string {
  if (!ultimaCompraEn) return "Sin compras todavía";
  const dias = Math.floor((Date.now() - new Date(ultimaCompraEn).getTime()) / 86_400_000);
  if (dias < 0) return new Date(ultimaCompraEn).toLocaleDateString("es-BO");
  if (dias === 0) return "Hoy";
  if (dias === 1) return "Hace 1 día";
  if (dias <= 90) return `Hace ${dias} días`;
  return "Inactivo (> 3 meses)";
}

function ClienteFormDialog({
  open,
  onOpenChange,
  cliente,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente?: ClienteListado;
  onSaved: () => void;
}) {
  const form = useForm<ClienteFormInput>({
    resolver: zodResolver(clienteFormSchema),
    values: {
      nombre: cliente?.nombre ?? "",
      telefono: cliente?.telefono ?? "",
      email: cliente?.email ?? "",
    },
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(values: ClienteFormInput) {
    setGuardando(true);
    setError(null);
    const resultado = cliente
      ? await actualizarClienteAction(cliente.id, values)
      : await crearClienteAction(values);
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{cliente ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
          <DialogDescription>
            {cliente ? "Actualizá los datos de contacto." : "Cargá un cliente a tu directorio."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" placeholder="Ej. Martín Arispe" {...form.register("nombre")} />
            {form.formState.errors.nombre && (
              <p className="text-xs text-error-text">{form.formState.errors.nombre.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="telefono">Teléfono (opcional)</Label>
            <Input id="telefono" placeholder="+54 9 11 ..." {...form.register("telefono")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Correo electrónico (opcional)</Label>
            <Input id="email" type="email" placeholder="cliente@ejemplo.com" {...form.register("email")} />
            {form.formState.errors.email && (
              <p className="text-xs text-error-text">{form.formState.errors.email.message}</p>
            )}
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

export function ClientesCliente({ clientes }: { clientes: ClienteListado[] }) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [clienteEditando, setClienteEditando] = useState<ClienteListado | undefined>(undefined);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtrados = clientes.filter((c) => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return true;
    return (
      c.nombre.toLowerCase().includes(q) ||
      (c.telefono ?? "").toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q)
    );
  });

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = filtrados.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);

  function abrirNuevo() {
    setClienteEditando(undefined);
    setDialogoAbierto(true);
  }

  function abrirEdicion(cliente: ClienteListado) {
    setClienteEditando(cliente);
    setDialogoAbierto(true);
  }

  async function confirmarEliminar(clienteId: string) {
    setEliminando(true);
    setError(null);
    const resultado = await eliminarClienteAction(clienteId);
    setEliminando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    setEliminandoId(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-muted" />
          <Input
            placeholder="Buscar cliente..."
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPagina(1);
            }}
            className="pl-8"
          />
        </div>
        <Button onClick={abrirNuevo}>
          <Plus className="size-4" />
          Nuevo cliente
        </Button>
      </div>

      {error && <p className="text-xs text-error-text">{error}</p>}

      {clientes.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Todavía no tenés clientes cargados"
          description="Se cargan automáticamente al vender, o podés agregarlos acá."
        />
      ) : (
        <>
          <div className="divide-y divide-gray-border rounded-2xl bg-card shadow-card">
            {visibles.length === 0 && (
              <p className="p-6 text-center text-sm text-text-muted">
                Ningún cliente coincide con esta búsqueda.
              </p>
            )}
            {visibles.map((cliente) => (
              <div key={cliente.id} className="flex items-center gap-3 p-4 text-sm">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-pastel-blue-bg text-xs font-semibold text-primary">
                  {cliente.nombre.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-text-body">{cliente.nombre}</p>
                  <p className="truncate text-xs text-text-muted">
                    {[cliente.telefono, cliente.email].filter(Boolean).join(" · ") || "Sin contacto"}
                  </p>
                </div>
                <span className="w-32 shrink-0 text-right text-xs text-text-muted">
                  {textoUltimaCompra(cliente.ultimaCompraEn)}
                </span>

                {eliminandoId === cliente.id ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => confirmarEliminar(cliente.id)}
                      loading={eliminando}
                    >
                      Sí, eliminar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setEliminandoId(null)} disabled={eliminando}>
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => abrirEdicion(cliente)}
                      aria-label="Editar cliente"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        setError(null);
                        setEliminandoId(cliente.id);
                      }}
                      aria-label="Eliminar cliente"
                    >
                      <Trash2 className="size-4 text-error-text" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {filtrados.length > POR_PAGINA && (
            <div className="flex items-center justify-between text-sm text-text-muted">
              <span>
                Mostrando {(paginaActual - 1) * POR_PAGINA + 1}-
                {Math.min(paginaActual * POR_PAGINA, filtrados.length)} de {filtrados.length} clientes
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={paginaActual === 1}
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                  className="rounded-lg px-2 py-1 hover:bg-gray-bg disabled:opacity-40"
                >
                  Anterior
                </button>
                <span className="px-2 font-medium text-navy">
                  {paginaActual} / {totalPaginas}
                </span>
                <button
                  type="button"
                  disabled={paginaActual === totalPaginas}
                  onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                  className="rounded-lg px-2 py-1 hover:bg-gray-bg disabled:opacity-40"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <ClienteFormDialog
        open={dialogoAbierto}
        onOpenChange={setDialogoAbierto}
        cliente={clienteEditando}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
