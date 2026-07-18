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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  actualizarCategoriaGastoAction,
  crearCategoriaGastoAction,
  eliminarCategoriaGastoAction,
} from "./actions";

export interface CategoriaGasto {
  id: string;
  nombre: string;
}

export interface CategoriaGastoSugerida {
  id: string;
  nombre: string;
}

// Mismo patron que Gestionar categorias de Productos
// (src/app/app/(shell)/productos/gestionar-categorias-dialog.tsx) — Dialog,
// no ruta propia. Unica diferencia: categoria_gasto_sugerida_id opcional al
// crear (el schema de Gastos lo tiene, el de Productos no).
export function GestionarCategoriasGastoDialog({
  open,
  onOpenChange,
  categorias,
  categoriasSugeridas,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categorias: CategoriaGasto[];
  categoriasSugeridas: CategoriaGastoSugerida[];
}) {
  const router = useRouter();
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombreEditado, setNombreEditado] = useState("");
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevaSugeridaId, setNuevaSugeridaId] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function empezarEdicion(categoria: CategoriaGasto) {
    setError(null);
    setEliminandoId(null);
    setEditandoId(categoria.id);
    setNombreEditado(categoria.nombre);
  }

  async function guardarEdicion(categoriaId: string) {
    if (!nombreEditado.trim()) return;
    setGuardando(true);
    setError(null);
    const resultado = await actualizarCategoriaGastoAction(categoriaId, nombreEditado.trim());
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
    const resultado = await eliminarCategoriaGastoAction(categoriaId);
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
    const resultado = await crearCategoriaGastoAction({
      nombre: nuevoNombre.trim(),
      categoriaGastoSugeridaId: nuevaSugeridaId || undefined,
    });
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    setNuevoNombre("");
    setNuevaSugeridaId("");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gestionar categorías de gasto</DialogTitle>
          <DialogDescription>
            Organizá tus categorías — podés renombrar o eliminar en cualquier momento.
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

        <div className="space-y-2 border-t border-gray-border pt-3">
          <div className="flex items-center gap-2">
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
          {categoriasSugeridas.length > 0 && (
            <Select
              items={{ "": "Categoría sugerida (opcional)", ...Object.fromEntries(categoriasSugeridas.map((c) => [c.id, c.nombre])) }}
              value={nuevaSugeridaId}
              onValueChange={(value) => setNuevaSugeridaId(value ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Categoría sugerida (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {categoriasSugeridas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function GestionarCategoriasGastoBoton({
  categorias,
  categoriasSugeridas,
}: {
  categorias: CategoriaGasto[];
  categoriasSugeridas: CategoriaGastoSugerida[];
}) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setAbierto(true)}>
        <Tags className="size-4" />
        Categorías
      </Button>
      <GestionarCategoriasGastoDialog
        open={abierto}
        onOpenChange={setAbierto}
        categorias={categorias}
        categoriasSugeridas={categoriasSugeridas}
      />
    </>
  );
}
