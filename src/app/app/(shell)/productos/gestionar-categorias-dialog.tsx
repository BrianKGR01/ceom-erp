"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, Tags, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { actualizarCategoriaAction, crearCategoriaAction, eliminarCategoriaAction } from "./actions";

export interface CategoriaConConteo {
  id: string;
  nombre: string;
  cantidadProductos: number;
}

// Categoria solo tiene "nombre" en el schema (sin estado activa/inactiva ni
// color) — por eso un Dialog alcanza, no hace falta una ruta nueva. Mismo
// criterio que Ajustar/Transferir/Eliminar stock en la ficha de producto.
export function GestionarCategoriasDialog({
  open,
  onOpenChange,
  categorias,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categorias: CategoriaConConteo[];
}) {
  const router = useRouter();
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombreEditado, setNombreEditado] = useState("");
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function empezarEdicion(categoria: CategoriaConConteo) {
    setError(null);
    setEliminandoId(null);
    setEditandoId(categoria.id);
    setNombreEditado(categoria.nombre);
  }

  async function guardarEdicion(categoriaId: string) {
    if (!nombreEditado.trim()) return;
    setGuardando(true);
    setError(null);
    const resultado = await actualizarCategoriaAction(categoriaId, nombreEditado.trim());
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    setEditandoId(null);
    router.refresh();
  }

  async function confirmarEliminar(categoriaId: string) {
    setGuardando(true);
    setError(null);
    const resultado = await eliminarCategoriaAction(categoriaId);
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    setEliminandoId(null);
    router.refresh();
  }

  async function agregarCategoria() {
    if (!nuevoNombre.trim()) return;
    setGuardando(true);
    setError(null);
    const resultado = await crearCategoriaAction(nuevoNombre.trim());
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    setNuevoNombre("");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gestionar categorías</DialogTitle>
          <DialogDescription>
            Organizá tu catálogo — podés renombrar o eliminar en cualquier momento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {categorias.length === 0 && (
            <p className="text-sm text-text-muted">Todavía no creaste ninguna categoría.</p>
          )}
          {categorias.map((categoria) => (
            <div
              key={categoria.id}
              className="flex items-center gap-2 rounded-lg border border-gray-border px-3 py-2"
            >
              {editandoId === categoria.id ? (
                <>
                  <Input
                    autoFocus
                    value={nombreEditado}
                    onChange={(e) => setNombreEditado(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && guardarEdicion(categoria.id)}
                    className="h-8 flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => guardarEdicion(categoria.id)}
                    disabled={guardando}
                    aria-label="Guardar nombre"
                  >
                    <Check className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setEditandoId(null)}
                    aria-label="Cancelar edición"
                  >
                    <X className="size-4" />
                  </Button>
                </>
              ) : eliminandoId === categoria.id ? (
                <>
                  <p className="flex-1 text-sm text-text-body">
                    ¿Eliminar <span className="font-medium">{categoria.nombre}</span>?
                  </p>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => confirmarEliminar(categoria.id)}
                    disabled={guardando}
                  >
                    Sí, eliminar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setEliminandoId(null)}>
                    Cancelar
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-text-body">{categoria.nombre}</span>
                  <span className="text-xs text-text-muted">{categoria.cantidadProductos} prod.</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => empezarEdicion(categoria)}
                    aria-label="Renombrar categoría"
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      setError(null);
                      setEditandoId(null);
                      setEliminandoId(categoria.id);
                    }}
                    aria-label="Eliminar categoría"
                  >
                    <Trash2 className="size-4 text-error-text" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>

        {error && <p className="text-xs text-error-text">{error}</p>}

        <div className="flex items-center gap-2 border-t border-gray-border pt-3">
          <Input
            placeholder="Nueva categoría"
            value={nuevoNombre}
            onChange={(e) => setNuevoNombre(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && agregarCategoria()}
            className="h-8 flex-1"
          />
          <Button size="sm" onClick={agregarCategoria} disabled={guardando || !nuevoNombre.trim()}>
            <Plus className="size-4" />
            Agregar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Boton + estado propio para vivir en PageHeader.action, aparte de
// CatalogoCliente — asi sigue accesible aunque el catalogo este vacio.
export function GestionarCategoriasBoton({ categorias }: { categorias: CategoriaConConteo[] }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setAbierto(true)}>
        <Tags className="size-4" />
        Gestionar categorías
      </Button>
      <GestionarCategoriasDialog open={abierto} onOpenChange={setAbierto} categorias={categorias} />
    </>
  );
}
