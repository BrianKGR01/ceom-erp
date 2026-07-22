"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Info, Plus, Search } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { nombreRolVisible } from "@/lib/vocabulario";
import type { Capacidad } from "@/modules/identidad/actions";
import {
  otorgarCapacidadEspecialPorRolAction,
  otorgarCapacidadEspecialPorUsuarioAction,
} from "../actions";

interface Rol {
  id: string;
  nombre: string;
}

interface Colaborador {
  id: string;
  nombreCompleto: string;
  rol: { nombre: string };
}

interface FilaRol {
  rolId: string;
  capacidad: Capacidad;
  habilitado: boolean;
}

interface FilaUsuario {
  usuarioId: string;
  capacidad: Capacidad;
  habilitado: boolean;
}

const CAPACIDADES: { id: Capacidad; label: string }[] = [
  { id: "vender_sin_stock", label: "Vender sin stock" },
  { id: "gestionar_eventos", label: "Gestionar eventos" },
  { id: "importar_historico", label: "Importar histórico" },
  { id: "producir_sin_stock_insumo", label: "Producir sin stock" },
];

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
      <span className="text-navy">Permisos especiales</span>
      <Link href="/app/mi-negocio/plan" className="text-primary hover:underline">
        Mi Plan
      </Link>
    </div>
  );
}

function AgregarOverrideDialog({
  open,
  onOpenChange,
  colaboradoresSinOverride,
  onAgregado,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  colaboradoresSinOverride: Colaborador[];
  onAgregado: () => void;
}) {
  const [usuarioId, setUsuarioId] = useState("");
  const [capacidad, setCapacidad] = useState<Capacidad | "">("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmar() {
    if (!usuarioId || !capacidad) {
      setError("Elegí un colaborador y una capacidad.");
      return;
    }
    setGuardando(true);
    setError(null);
    const resultado = await otorgarCapacidadEspecialPorUsuarioAction(usuarioId, capacidad, true);
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    setUsuarioId("");
    setCapacidad("");
    onOpenChange(false);
    onAgregado();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar una excepción</DialogTitle>
          <DialogDescription>Excepción puntual — anula el permiso del rol solo para esta persona.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Colaborador</Label>
            <Select
              items={Object.fromEntries(colaboradoresSinOverride.map((c) => [c.id, c.nombreCompleto]))}
              value={usuarioId}
              onValueChange={(v) => v && setUsuarioId(v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Elegí un colaborador" />
              </SelectTrigger>
              <SelectContent>
                {colaboradoresSinOverride.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombreCompleto} ({nombreRolVisible(c.rol.nombre)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Capacidad</Label>
            <Select
              items={Object.fromEntries(CAPACIDADES.map((c) => [c.id, c.label]))}
              value={capacidad}
              onValueChange={(v) => v && setCapacidad(v as Capacidad)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Elegí una capacidad" />
              </SelectTrigger>
              <SelectContent>
                {CAPACIDADES.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-xs text-error-text">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={guardando}>
            {guardando ? "Guardando..." : "Agregar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CapacidadesCliente({
  capacidadesPorRol,
  capacidadesPorUsuario,
  roles,
  colaboradores,
}: {
  capacidadesPorRol: FilaRol[];
  capacidadesPorUsuario: FilaUsuario[];
  roles: Rol[];
  colaboradores: Colaborador[];
}) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState("");
  const [dialogoAgregar, setDialogoAgregar] = useState(false);
  const [pendiente, setPendiente] = useState<string | null>(null);

  const mapaPorRol = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const f of capacidadesPorRol) m.set(`${f.rolId}:${f.capacidad}`, f.habilitado);
    return m;
  }, [capacidadesPorRol]);

  const mapaPorUsuario = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const f of capacidadesPorUsuario) m.set(`${f.usuarioId}:${f.capacidad}`, f.habilitado);
    return m;
  }, [capacidadesPorUsuario]);

  const usuariosConOverride = useMemo(
    () => colaboradores.filter((c) => capacidadesPorUsuario.some((f) => f.usuarioId === c.id)),
    [colaboradores, capacidadesPorUsuario]
  );
  const usuariosSinOverride = useMemo(
    () => colaboradores.filter((c) => !capacidadesPorUsuario.some((f) => f.usuarioId === c.id)),
    [colaboradores, capacidadesPorUsuario]
  );
  const filtrados = usuariosConOverride.filter((c) =>
    c.nombreCompleto.toLowerCase().includes(busqueda.trim().toLowerCase())
  );

  async function toggleRol(rolId: string, capacidad: Capacidad, actual: boolean) {
    const key = `rol:${rolId}:${capacidad}`;
    setPendiente(key);
    const resultado = await otorgarCapacidadEspecialPorRolAction(rolId, capacidad, !actual);
    setPendiente(null);
    if (resultado.ok) router.refresh();
  }

  async function toggleUsuario(usuarioId: string, capacidad: Capacidad, actual: boolean) {
    const key = `usuario:${usuarioId}:${capacidad}`;
    setPendiente(key);
    const resultado = await otorgarCapacidadEspecialPorUsuarioAction(usuarioId, capacidad, !actual);
    setPendiente(null);
    if (resultado.ok) router.refresh();
  }

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <SubnavMiNegocio />
      <PageHeader title="Permisos especiales" description="Configura los permisos globales por cada rol de tu negocio." />

      <div className="mt-6 rounded-2xl bg-card shadow-card">
        <div className="border-b border-gray-border p-4">
          <h2 className="font-heading text-base font-semibold text-navy">Permisos por rol</h2>
        </div>
        {roles.length === 0 ? (
          <p className="p-6 text-center text-sm text-text-muted">
            Todavía no creaste ningún rol personalizado — el dueño y el equipo CEOM siempre tienen
            acceso total y no pasan por esta tabla.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-bg text-xs text-text-muted uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">Rol</th>
                  {CAPACIDADES.map((c) => (
                    <th key={c.id} className="px-4 py-3 font-medium">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-border">
                {roles.map((rol) => (
                  <tr key={rol.id}>
                    <td className="px-4 py-3 font-medium text-navy">{nombreRolVisible(rol.nombre)}</td>
                    {CAPACIDADES.map((c) => {
                      const actual = mapaPorRol.get(`${rol.id}:${c.id}`) ?? false;
                      return (
                        <td key={c.id} className="px-4 py-3">
                          <Switch
                            checked={actual}
                            disabled={pendiente === `rol:${rol.id}:${c.id}`}
                            onCheckedChange={() => toggleRol(rol.id, c.id, actual)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-base font-semibold text-navy">Excepciones por colaborador</h2>
          <p className="text-sm text-text-muted">Excepciones específicas asignadas a colaboradores individuales.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-muted" />
            <Input
              placeholder="Buscar colaborador..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button onClick={() => setDialogoAgregar(true)} disabled={usuariosSinOverride.length === 0}>
            <Plus className="size-4" />
            Agregar
          </Button>
        </div>
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-xl bg-pastel-blue-bg p-3 text-sm text-primary">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>Este ajuste anula los permisos del rol, aplicándose solo a esta persona.</p>
      </div>

      {filtrados.length === 0 ? (
        <p className="mt-6 text-center text-sm text-text-muted">
          {usuariosConOverride.length === 0
            ? "Todavía no hay excepciones cargadas."
            : "Ningún colaborador coincide con esta búsqueda."}
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filtrados.map((c) => (
            <div key={c.id} className="rounded-2xl bg-card p-5 shadow-card">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-pastel-blue-bg text-sm font-semibold text-primary">
                  {c.nombreCompleto.charAt(0).toUpperCase()}
                </span>
                <div>
                  <p className="font-medium text-navy">{c.nombreCompleto}</p>
                  <p className="text-xs text-text-muted">{nombreRolVisible(c.rol.nombre)}</p>
                </div>
              </div>
              <div className="mt-4 space-y-2 border-t border-gray-border pt-3">
                {CAPACIDADES.map((cap) => {
                  const actual = mapaPorUsuario.get(`${c.id}:${cap.id}`) ?? false;
                  return (
                    <div key={cap.id} className="flex items-center justify-between">
                      <span className="text-sm text-navy">{cap.label}</span>
                      <Switch
                        checked={actual}
                        disabled={pendiente === `usuario:${c.id}:${cap.id}`}
                        onCheckedChange={() => toggleUsuario(c.id, cap.id, actual)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <AgregarOverrideDialog
        open={dialogoAgregar}
        onOpenChange={setDialogoAgregar}
        colaboradoresSinOverride={usuariosSinOverride}
        onAgregado={() => router.refresh()}
      />
    </div>
  );
}
