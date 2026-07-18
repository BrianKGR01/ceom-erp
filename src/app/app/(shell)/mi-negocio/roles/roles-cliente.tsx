"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Shield, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { cn } from "@/lib/utils";
import type { Accion, Modulo } from "@/modules/identidad/actions";
import {
  actualizarPermisosRolAction,
  crearRolAction,
  eliminarRolAction,
  editarColaboradorAction,
  listarPermisosPorRolAction,
} from "../actions";

interface Rol {
  id: string;
  nombre: string;
  esRolSistema: boolean;
  tenantId: string | null;
  colaboradores: number;
}

interface Colaborador {
  id: string;
  nombreCompleto: string;
  rolId: string;
  esOwner: boolean;
}

const MODULOS: { id: Modulo; label: string }[] = [
  { id: "productos", label: "Productos" },
  { id: "inventario", label: "Inventario" },
  { id: "ventas", label: "Ventas" },
  { id: "costos_gastos", label: "Costos y Gastos" },
  { id: "patrimonio", label: "Patrimonio" },
  { id: "operativo", label: "Operativo" },
  { id: "financiero", label: "Financiero" },
  { id: "simulaciones", label: "Simulaciones" },
  { id: "reportes", label: "Reportes" },
  { id: "proveedores", label: "Proveedores" },
];

const ACCIONES: { id: Accion; label: string }[] = [
  { id: "ver", label: "Ver" },
  { id: "crear", label: "Crear" },
  { id: "editar", label: "Editar" },
  { id: "anular_ajustar", label: "Anular/Ajustar" },
];

const DESCRIPCION_SISTEMA: Record<string, string> = {
  Owner: "Acceso total a todas las configuraciones y módulos de la plataforma.",
  "CEOM Admin": "Gestión administrativa y soporte de la instancia CEOM (equipo interno).",
};

type Matriz = Record<Modulo, Record<Accion, boolean>>;

function matrizVacia(): Matriz {
  const m = {} as Matriz;
  for (const modulo of MODULOS) {
    m[modulo.id] = { ver: false, crear: false, editar: false, anular_ajustar: false };
  }
  return m;
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
      <span className="text-navy">Roles</span>
      <Link href="/app/mi-negocio/capacidades" className="text-primary hover:underline">
        Capacidades Especiales
      </Link>
    </div>
  );
}

function ReasignarYEliminarDialog({
  open,
  onOpenChange,
  rol,
  colaboradoresDelRol,
  rolesDestino,
  onEliminado,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rol: Rol | null;
  colaboradoresDelRol: Colaborador[];
  rolesDestino: Rol[];
  onEliminado: () => void;
}) {
  const [reasignaciones, setReasignaciones] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function abrir(nuevoAbierto: boolean) {
    if (nuevoAbierto) {
      setReasignaciones({});
      setError(null);
    }
    onOpenChange(nuevoAbierto);
  }

  async function confirmar() {
    if (!rol) return;
    if (colaboradoresDelRol.some((c) => !reasignaciones[c.id])) {
      setError("Elegí un rol nuevo para cada colaborador antes de eliminar.");
      return;
    }
    setGuardando(true);
    setError(null);

    for (const c of colaboradoresDelRol) {
      const resultado = await editarColaboradorAction(c.id, { rolId: reasignaciones[c.id] });
      if (!resultado.ok) {
        setGuardando(false);
        setError(resultado.error);
        return;
      }
    }

    const eliminado = await eliminarRolAction(rol.id);
    setGuardando(false);
    if (!eliminado.ok) {
      setError(eliminado.error);
      return;
    }
    onOpenChange(false);
    onEliminado();
  }

  return (
    <Dialog open={open} onOpenChange={abrir}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reasigná antes de eliminar &ldquo;{rol?.nombre}&rdquo;</DialogTitle>
          <DialogDescription>
            {colaboradoresDelRol.length} colaborador(es) todavía tienen este rol — elegí a dónde
            los movés para poder eliminarlo (Módulo 1, sección 6.3).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {colaboradoresDelRol.map((c) => (
            <div key={c.id} className="space-y-1.5">
              <Label>{c.nombreCompleto}</Label>
              <Select
                items={Object.fromEntries(rolesDestino.map((r) => [r.id, r.nombre]))}
                value={reasignaciones[c.id] ?? ""}
                onValueChange={(v) => v && setReasignaciones((prev) => ({ ...prev, [c.id]: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Elegí el nuevo rol" />
                </SelectTrigger>
                <SelectContent>
                  {rolesDestino.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
          {error && <p className="text-xs text-error-text">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirmar} disabled={guardando}>
            {guardando ? "Guardando..." : "Reasignar y eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RolesCliente({ roles, colaboradores }: { roles: Rol[]; colaboradores: Colaborador[] }) {
  const router = useRouter();
  const [seleccionId, setSeleccionId] = useState<string | "nuevo" | null>(null);
  const [nombre, setNombre] = useState("");
  const [matriz, setMatriz] = useState<Matriz>(matrizVacia());
  const [cargandoMatriz, setCargandoMatriz] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rolAEliminar, setRolAEliminar] = useState<Rol | null>(null);
  const [confirmandoEliminarSimple, setConfirmandoEliminarSimple] = useState<Rol | null>(null);

  const rolSeleccionado = seleccionId && seleccionId !== "nuevo" ? roles.find((r) => r.id === seleccionId) : null;

  // Funcion async declarada-e-invocada (pasa react-hooks/set-state-in-effect,
  // mismo patron ya usado en Simulaciones).
  useEffect(() => {
    async function cargar() {
      if (seleccionId === "nuevo") {
        setNombre("");
        setMatriz(matrizVacia());
        return;
      }
      if (!seleccionId) return;
      setCargandoMatriz(true);
      setNombre(rolSeleccionado?.nombre ?? "");
      const res = await listarPermisosPorRolAction(seleccionId);
      setCargandoMatriz(false);
      if (!res.ok) return;
      const nueva = matrizVacia();
      for (const fila of res.data) {
        nueva[fila.modulo][fila.accion] = fila.permitido;
      }
      setMatriz(nueva);
    }
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccionId]);

  function toggle(modulo: Modulo, accion: Accion) {
    setMatriz((prev) => ({
      ...prev,
      [modulo]: { ...prev[modulo], [accion]: !prev[modulo][accion] },
    }));
  }

  async function guardar() {
    if (!nombre.trim()) {
      setError("Ponele un nombre al rol.");
      return;
    }
    setGuardando(true);
    setError(null);

    const permisos = MODULOS.flatMap((modulo) =>
      ACCIONES.map((accion) => ({
        modulo: modulo.id,
        accion: accion.id,
        permitido: matriz[modulo.id][accion.id],
      }))
    );

    if (seleccionId === "nuevo") {
      const resultado = await crearRolAction({ nombre: nombre.trim() }, permisos);
      setGuardando(false);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      setSeleccionId(null);
      router.refresh();
      return;
    }

    if (rolSeleccionado) {
      const resultado = await actualizarPermisosRolAction(rolSeleccionado.id, permisos);
      setGuardando(false);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      router.refresh();
    }
  }

  async function pedirEliminar(rol: Rol) {
    if (rol.colaboradores > 0) {
      setRolAEliminar(rol);
    } else {
      setConfirmandoEliminarSimple(rol);
    }
  }

  async function confirmarEliminarSimple() {
    if (!confirmandoEliminarSimple) return;
    const resultado = await eliminarRolAction(confirmandoEliminarSimple.id);
    if (resultado.ok) {
      if (seleccionId === confirmandoEliminarSimple.id) setSeleccionId(null);
      setConfirmandoEliminarSimple(null);
      router.refresh();
    } else {
      setError(resultado.error);
      setConfirmandoEliminarSimple(null);
    }
  }

  const rolesPersonalizados = roles.filter((r) => !r.esRolSistema);

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <SubnavMiNegocio />
      <PageHeader
        title="Gestión de Roles"
        description="Administra los accesos y permisos de tu equipo."
        action={
          <Button onClick={() => setSeleccionId("nuevo")}>
            <Plus className="size-4" />
            Nuevo Rol
          </Button>
        }
      />

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {roles.map((rol) => (
          <button
            key={rol.id}
            type="button"
            onClick={() => !rol.esRolSistema && setSeleccionId(rol.id)}
            className={cn(
              "rounded-2xl bg-card p-5 text-left shadow-card transition-shadow",
              !rol.esRolSistema && "hover:shadow-md",
              seleccionId === rol.id && "ring-2 ring-primary"
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-base font-semibold text-navy">{rol.nombre}</h2>
                {rol.esRolSistema && <Badge variant="warning">Rol de sistema</Badge>}
              </div>
              {!rol.esRolSistema && (
                <div className="flex gap-1">
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSeleccionId(rol.id);
                    }}
                    className="rounded p-1 text-text-muted hover:bg-gray-bg hover:text-primary"
                  >
                    <Pencil className="size-4" />
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      pedirEliminar(rol);
                    }}
                    className="rounded p-1 text-text-muted hover:bg-error-bg hover:text-error-text"
                  >
                    <Trash2 className="size-4" />
                  </span>
                </div>
              )}
            </div>
            <p className="mt-2 text-sm text-text-muted">
              {DESCRIPCION_SISTEMA[rol.nombre] ?? `Rol personalizado de tu negocio.`}
            </p>
            <p className="mt-3 text-xs text-text-muted">
              {rol.colaboradores} Colaborador{rol.colaboradores === 1 ? "" : "es"}
            </p>
          </button>
        ))}
      </div>

      {seleccionId && (
        <div className="mt-6 rounded-2xl bg-card p-5 shadow-card">
          <div className="flex items-center justify-between border-b border-gray-border pb-4">
            <div>
              <h2 className="font-heading text-lg font-semibold text-navy">
                {seleccionId === "nuevo" ? "Nuevo Rol" : `Editar Rol: ${rolSeleccionado?.nombre}`}
              </h2>
              <p className="text-sm text-text-muted">Configurá los permisos específicos para este rol.</p>
            </div>
            <Button onClick={guardar} disabled={guardando || cargandoMatriz}>
              {guardando ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>

          <div className="mt-4 max-w-sm space-y-1.5">
            <Label htmlFor="nombre-rol">Nombre del rol</Label>
            <Input id="nombre-rol" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Cajero" />
          </div>

          {error && <p className="mt-3 text-xs text-error-text">{error}</p>}

          <div className="mt-5">
            <h3 className="mb-2 text-sm font-semibold text-navy">Matriz de Permisos</h3>
            {cargandoMatriz ? (
              <p className="py-8 text-center text-sm text-text-muted">Cargando...</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-bg text-xs text-text-muted uppercase">
                    <tr>
                      <th className="px-4 py-2 font-medium">Módulo</th>
                      {ACCIONES.map((a) => (
                        <th key={a.id} className="px-4 py-2 font-medium">
                          {a.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-border">
                    {MODULOS.map((modulo) => (
                      <tr key={modulo.id}>
                        <td className="px-4 py-2.5 text-navy">{modulo.label}</td>
                        {ACCIONES.map((accion) => (
                          <td key={accion.id} className="px-4 py-2.5">
                            <Checkbox
                              checked={matriz[modulo.id][accion.id]}
                              onCheckedChange={() => toggle(modulo.id, accion.id)}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <ReasignarYEliminarDialog
        open={rolAEliminar !== null}
        onOpenChange={(open) => !open && setRolAEliminar(null)}
        rol={rolAEliminar}
        colaboradoresDelRol={colaboradores.filter((c) => rolAEliminar && c.rolId === rolAEliminar.id)}
        rolesDestino={rolesPersonalizados.filter((r) => r.id !== rolAEliminar?.id)}
        onEliminado={() => {
          setRolAEliminar(null);
          setSeleccionId(null);
          router.refresh();
        }}
      />

      <Dialog open={confirmandoEliminarSimple !== null} onOpenChange={(open) => !open && setConfirmandoEliminarSimple(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar &ldquo;{confirmandoEliminarSimple?.nombre}&rdquo;?</DialogTitle>
            <DialogDescription>No tiene colaboradores asignados — se puede eliminar directamente.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmandoEliminarSimple(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmarEliminarSimple}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {roles.length === 0 && (
        <p className="mt-10 flex items-center justify-center gap-2 text-center text-sm text-text-muted">
          <Shield className="size-4" />
          No hay roles todavía.
        </p>
      )}
    </div>
  );
}
