"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  crearGrupoModificadoresAction,
  crearModificadorAction,
  eliminarGrupoModificadoresAction,
  eliminarModificadorAction,
  ofrecerGrupoAProductoAction,
} from "../actions";

type Tipo = "agrega" | "reemplaza" | "indicacion";
type Seleccion = "una" | "varias";

interface Opcion {
  id: string;
  nombre: string;
  tipo: Tipo;
  esBase: boolean;
  precioExtra: number;
  insumoNombre: string | null;
  cantidad: number | null;
  insumoReemplazadoNombre: string | null;
}

interface Grupo {
  id: string;
  nombre: string;
  seleccion: Seleccion;
  productoIds: string[];
  opciones: Opcion[];
}

interface Props {
  grupos: Grupo[];
  insumos: Array<{ id: string; nombre: string; unidadMedida: string }>;
  productos: Array<{ id: string; nombre: string }>;
}

const ETIQUETA_TIPO: Record<Tipo, string> = {
  agrega: "Agrega un insumo",
  reemplaza: "Reemplaza un insumo",
  indicacion: "Indicación (solo texto)",
};

const ETIQUETA_SELECCION: Record<Seleccion, string> = {
  una: "Elige 1",
  varias: "Elige varias",
};

function describir(o: Opcion): string {
  const partes: string[] = [];
  if (o.tipo === "agrega" && o.insumoNombre) partes.push(`agrega ${o.cantidad} de ${o.insumoNombre}`);
  if (o.tipo === "reemplaza") {
    partes.push(
      o.insumoNombre
        ? `reemplaza ${o.insumoReemplazadoNombre ?? "un insumo"} por ${o.insumoNombre}`
        : `quita ${o.insumoReemplazadoNombre ?? "un insumo"}`
    );
  }
  if (o.tipo === "indicacion") partes.push(o.esBase ? "opción por defecto" : "indicación");
  if (o.precioExtra > 0) partes.push(`+Bs ${o.precioExtra.toFixed(2)}`);
  return partes.join(" · ");
}

export function ModificadoresCliente({ grupos, insumos, productos }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const [grupoNombre, setGrupoNombre] = useState("");
  const [grupoSeleccion, setGrupoSeleccion] = useState<Seleccion>("varias");

  async function ejecutar(accion: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    setOcupado(true);
    const r = await accion();
    setOcupado(false);
    if (!r.ok) {
      setError(r.error ?? "No se pudo completar.");
      return false;
    }
    router.refresh();
    return true;
  }

  async function crearGrupo() {
    const ok = await ejecutar(() =>
      crearGrupoModificadoresAction({ nombre: grupoNombre, seleccion: grupoSeleccion })
    );
    if (ok) setGrupoNombre("");
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-error-text">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-navy">Nuevo grupo</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label>Nombre</Label>
            <Input
              placeholder="Ej. Leche, Extras, Indicaciones"
              value={grupoNombre}
              onChange={(e) => setGrupoNombre(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:w-48">
            <Label>Cómo se elige</Label>
            <Select
              items={ETIQUETA_SELECCION}
              value={grupoSeleccion}
              onValueChange={(v) => v && setGrupoSeleccion(v as Seleccion)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="una">{ETIQUETA_SELECCION.una}</SelectItem>
                <SelectItem value="varias">{ETIQUETA_SELECCION.varias}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={crearGrupo} disabled={ocupado}>
            <Plus className="size-4" />
            Crear grupo
          </Button>
        </CardContent>
      </Card>

      {grupos.length === 0 && (
        <p className="py-6 text-center text-sm text-text-muted">
          Todavía no creaste ningún grupo. Empezá con uno, por ejemplo &quot;Extras&quot;.
        </p>
      )}

      {grupos.map((grupo) => (
        <GrupoCard
          key={grupo.id}
          grupo={grupo}
          insumos={insumos}
          productos={productos}
          ocupado={ocupado}
          ejecutar={ejecutar}
        />
      ))}
    </div>
  );
}

function GrupoCard({
  grupo,
  insumos,
  productos,
  ocupado,
  ejecutar,
}: {
  grupo: Grupo;
  insumos: Props["insumos"];
  productos: Props["productos"];
  ocupado: boolean;
  ejecutar: (accion: () => Promise<{ ok: boolean; error?: string }>) => Promise<boolean>;
}) {
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<Tipo>("agrega");
  const [esBase, setEsBase] = useState(false);
  const [precio, setPrecio] = useState("");
  const [insumoId, setInsumoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [reemplazadoId, setReemplazadoId] = useState("");

  const itemsInsumo = Object.fromEntries(insumos.map((i) => [i.id, `${i.nombre} (${i.unidadMedida})`]));

  async function agregar() {
    const ok = await ejecutar(() =>
      crearModificadorAction(grupo.id, {
        nombre,
        tipo,
        esBase: tipo === "indicacion" ? esBase : undefined,
        precioExtra: tipo === "indicacion" ? undefined : precio ? Number(precio) : 0,
        insumoId: tipo !== "indicacion" && insumoId ? insumoId : undefined,
        cantidad: tipo !== "indicacion" && cantidad ? Number(cantidad) : undefined,
        insumoReemplazadoId: tipo === "reemplaza" && reemplazadoId ? reemplazadoId : undefined,
      })
    );
    if (ok) {
      setNombre("");
      setPrecio("");
      setCantidad("");
      setInsumoId("");
      setReemplazadoId("");
      setEsBase(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base text-navy">{grupo.nombre}</CardTitle>
          <p className="text-xs text-text-muted">{ETIQUETA_SELECCION[grupo.seleccion]}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={ocupado}
          onClick={() => ejecutar(() => eliminarGrupoModificadoresAction(grupo.id))}
        >
          <Trash2 className="size-4" />
          Eliminar grupo
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {grupo.opciones.length === 0 ? (
          <p className="text-sm text-text-muted">Este grupo todavía no tiene opciones.</p>
        ) : (
          <ul className="divide-y divide-gray-border">
            {grupo.opciones.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <div>
                  <p className="font-medium text-navy">{o.nombre}</p>
                  <p className="text-xs text-text-muted">{describir(o)}</p>
                </div>
                <Button
                  variant="outline"
                  size="icon-xs"
                  aria-label={`Eliminar ${o.nombre}`}
                  disabled={ocupado}
                  onClick={() => ejecutar(() => eliminarModificadorAction(o.id))}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-3 rounded-lg border border-gray-border p-3">
          <p className="text-xs font-medium text-text-muted uppercase">Agregar una opción</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input placeholder="Ej. Almendra" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Qué hace</Label>
              <Select items={ETIQUETA_TIPO} value={tipo} onValueChange={(v) => v && setTipo(v as Tipo)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ETIQUETA_TIPO) as Tipo[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {ETIQUETA_TIPO[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {tipo === "reemplaza" && (
              <div className="space-y-2">
                <Label>Insumo de la receta que sale</Label>
                <Select items={itemsInsumo} value={reemplazadoId} onValueChange={(v) => v && setReemplazadoId(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Elegí uno..." />
                  </SelectTrigger>
                  <SelectContent>
                    {insumos.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {tipo !== "indicacion" && (
              <>
                <div className="space-y-2">
                  <Label>{tipo === "reemplaza" ? "Insumo que entra (opcional)" : "Insumo que se agrega"}</Label>
                  <Select items={itemsInsumo} value={insumoId} onValueChange={(v) => v && setInsumoId(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Elegí uno..." />
                    </SelectTrigger>
                    <SelectContent>
                      {insumos.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>
                    Cantidad por unidad vendida{tipo === "reemplaza" ? " (vacío = la misma que sale)" : ""}
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.0001"
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Precio extra (Bs)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    value={precio}
                    onChange={(e) => setPrecio(e.target.value)}
                  />
                </div>
              </>
            )}

            {tipo === "indicacion" && grupo.seleccion === "una" && (
              <label className="flex items-center gap-2 text-sm text-text-body sm:col-span-2">
                <input type="checkbox" checked={esBase} onChange={(e) => setEsBase(e.target.checked)} />
                Es la opción por defecto del grupo (por ejemplo, la leche entera)
              </label>
            )}
          </div>
          <Button size="sm" onClick={agregar} disabled={ocupado}>
            <Plus className="size-4" />
            Agregar opción
          </Button>
        </div>

        <div className="space-y-2">
          <Label>Se ofrece en estos productos</Label>
          <div className="flex flex-wrap gap-2">
            {productos.map((p) => {
              const activo = grupo.productoIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={ocupado}
                  aria-pressed={activo}
                  onClick={() => ejecutar(() => ofrecerGrupoAProductoAction(grupo.id, p.id, !activo))}
                  className={cn(
                    "rounded-full px-3 py-1 text-sm transition-colors",
                    activo
                      ? "bg-primary text-white"
                      : "bg-pastel-blue-bg text-text-body hover:bg-pastel-blue-bg/70"
                  )}
                >
                  {p.nombre}
                </button>
              );
            })}
            {productos.length === 0 && (
              <p className="text-sm text-text-muted">Todavía no hay productos activos.</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
