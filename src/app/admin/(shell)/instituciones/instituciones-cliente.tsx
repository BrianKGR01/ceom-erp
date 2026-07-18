"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  Check,
  GraduationCap,
  Landmark,
  Link2,
  Link2Off,
  Pencil,
  Plus,
  Rocket,
  Search,
  Send,
  Trash2,
} from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ModuloVeedorForm } from "@/modules/consentimiento/validation";
import { MODULOS_VEEDOR_INFO } from "@/app/app/(shell)/consentimiento/generar-cliente";
import {
  actualizarInstitucionAction,
  agregarTenantACarteraAction,
  crearInstitucionAction,
  crearSolicitudSeguimientoAction,
  eliminarInstitucionAction,
  listarCarteraPorInstitucionAction,
  quitarDeCarteraAction,
} from "./actions";

type TipoInstitucion = "universidad" | "incubadora" | "organizacion";

interface Institucion {
  id: string;
  nombre: string;
  tipo: TipoInstitucion;
  contacto: string | null;
  email: string | null;
}

interface Tenant {
  id: string;
  nombreNegocio: string;
  planId: string | null;
  estadoSuscripcion: "activa" | "pausada" | "vencida";
}

interface Plan {
  id: string;
  nombre: string;
}

interface FilaCartera {
  id: string;
  tenantId: string;
  cohorte: string | null;
  fechaInicio: string;
  fechaFin: string | null;
}

const ICONO_TIPO: Record<TipoInstitucion, typeof Landmark> = {
  universidad: GraduationCap,
  incubadora: Rocket,
  organizacion: Building2,
};

const LABEL_TIPO: Record<TipoInstitucion, string> = {
  universidad: "Universidad",
  incubadora: "Incubadora",
  organizacion: "Organización",
};

const BADGE_ESTADO_SUSCRIPCION: Record<Tenant["estadoSuscripcion"], { label: string; variant: "success" | "warning" | "error" }> = {
  activa: { label: "Activa", variant: "success" },
  pausada: { label: "Pausada", variant: "warning" },
  vencida: { label: "Vencida", variant: "error" },
};

export function InstitucionesCliente({
  institucionesIniciales,
  tenants,
  planes,
}: {
  institucionesIniciales: Institucion[];
  tenants: Tenant[];
  planes: Plan[];
}) {
  const [instituciones, setInstituciones] = useState(institucionesIniciales);
  const [busqueda, setBusqueda] = useState("");
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(instituciones[0]?.id ?? null);
  const [dialogoNueva, setDialogoNueva] = useState(false);

  const filtradas = instituciones.filter((i) =>
    i.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );
  const seleccionada = instituciones.find((i) => i.id === seleccionadaId) ?? null;

  return (
    <div className="mx-auto flex max-w-6xl gap-4 py-6">
      <div className="w-72 shrink-0 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-heading text-lg font-semibold text-navy">Instituciones</h1>
          <Button size="sm" onClick={() => setDialogoNueva(true)}>
            <Plus className="size-4" />
            Nueva
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar institución..."
            className="pl-9"
          />
        </div>
        <div className="space-y-2">
          {filtradas.length === 0 ? (
            <p className="p-4 text-center text-sm text-text-muted">Sin resultados.</p>
          ) : (
            filtradas.map((institucion) => {
              const Icon = ICONO_TIPO[institucion.tipo];
              return (
                <button
                  key={institucion.id}
                  type="button"
                  onClick={() => setSeleccionadaId(institucion.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                    seleccionadaId === institucion.id
                      ? "border-primary bg-card shadow-card"
                      : "border-transparent hover:bg-card/60"
                  )}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-pastel-blue-bg text-primary">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-navy">{institucion.nombre}</p>
                    <p className="text-xs text-text-muted">{LABEL_TIPO[institucion.tipo]}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="flex-1">
        {!seleccionada ? (
          <div className="flex h-full items-center justify-center rounded-2xl bg-card p-12 text-center shadow-card">
            <p className="text-sm text-text-muted">
              {instituciones.length === 0 ? "Todavía no diste de alta ninguna institución." : "Elegí una institución."}
            </p>
          </div>
        ) : (
          <InstitucionDetalle
            key={seleccionada.id}
            institucion={seleccionada}
            tenants={tenants}
            planes={planes}
            onActualizada={(actualizada) => {
              setInstituciones((prev) => prev.map((i) => (i.id === actualizada.id ? actualizada : i)));
            }}
            onEliminada={() => {
              setInstituciones((prev) => prev.filter((i) => i.id !== seleccionada.id));
              setSeleccionadaId(null);
            }}
          />
        )}
      </div>

      <InstitucionFormDialog
        open={dialogoNueva}
        onOpenChange={setDialogoNueva}
        onGuardada={(nueva) => {
          setDialogoNueva(false);
          setInstituciones((prev) => [...prev, nueva]);
          setSeleccionadaId(nueva.id);
        }}
      />
    </div>
  );
}

function InstitucionDetalle({
  institucion,
  tenants,
  planes,
  onActualizada,
  onEliminada,
}: {
  institucion: Institucion;
  tenants: Tenant[];
  planes: Plan[];
  onActualizada: (institucion: Institucion) => void;
  onEliminada: () => void;
}) {
  const [tab, setTab] = useState<"cartera" | "contacto">("cartera");
  const [eliminando, setEliminando] = useState(false);
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const Icon = ICONO_TIPO[institucion.tipo];

  async function confirmarEliminar() {
    setEliminando(true);
    setError(null);
    const resultado = await eliminarInstitucionAction(institucion.id);
    setEliminando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    onEliminada();
  }

  return (
    <div className="rounded-2xl bg-card shadow-card">
      <div className="flex items-center justify-between gap-3 p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-pastel-blue-bg text-primary">
            <Icon className="size-6" />
          </span>
          <div>
            <p className="font-heading text-lg font-semibold text-navy">{institucion.nombre}</p>
            <p className="text-xs text-text-muted">{LABEL_TIPO[institucion.tipo]}</p>
          </div>
        </div>
        {confirmandoEliminar ? (
          <div className="flex items-center gap-1.5">
            <Button variant="destructive" size="sm" onClick={confirmarEliminar} disabled={eliminando}>
              Sí, eliminar
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmandoEliminar(false)}>
              Cancelar
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setConfirmandoEliminar(true)}
            aria-label="Eliminar institución"
          >
            <Trash2 className="size-4 text-error-text" />
          </Button>
        )}
      </div>

      {error && <p className="px-5 pb-2 text-xs text-error-text">{error}</p>}

      <div className="flex border-t border-b border-gray-border px-5">
        <button
          type="button"
          onClick={() => setTab("cartera")}
          className={cn(
            "border-b-2 px-3 py-2.5 text-sm font-medium",
            tab === "cartera" ? "border-primary text-navy" : "border-transparent text-text-muted"
          )}
        >
          Cartera
        </button>
        <button
          type="button"
          onClick={() => setTab("contacto")}
          className={cn(
            "border-b-2 px-3 py-2.5 text-sm font-medium",
            tab === "contacto" ? "border-primary text-navy" : "border-transparent text-text-muted"
          )}
        >
          Datos de contacto
        </button>
      </div>

      <div className="p-5">
        {tab === "cartera" ? (
          <CarteraTab institucion={institucion} tenants={tenants} planes={planes} />
        ) : (
          <DatosContactoTab institucion={institucion} onActualizada={onActualizada} />
        )}
      </div>
    </div>
  );
}

function CarteraTab({
  institucion,
  tenants,
  planes,
}: {
  institucion: Institucion;
  tenants: Tenant[];
  planes: Plan[];
}) {
  const [cartera, setCartera] = useState<FilaCartera[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogoVincular, setDialogoVincular] = useState(false);
  const [dialogoSolicitud, setDialogoSolicitud] = useState(false);
  const [quitandoId, setQuitandoId] = useState<string | null>(null);

  useEffect(() => {
    async function cargar() {
      setCargando(true);
      setError(null);
      const resultado = await listarCarteraPorInstitucionAction(institucion.id);
      setCargando(false);
      if (resultado.ok) setCartera(resultado.data);
      else setError(resultado.error);
    }
    cargar();
  }, [institucion.id]);

  async function refrescar() {
    const resultado = await listarCarteraPorInstitucionAction(institucion.id);
    if (resultado.ok) setCartera(resultado.data);
  }

  async function confirmarQuitar(carteraId: string) {
    setError(null);
    const resultado = await quitarDeCarteraAction(carteraId);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    setQuitandoId(null);
    refrescar();
  }

  const tenantPorId = new Map(tenants.map((t) => [t.id, t]));
  const planPorId = new Map(planes.map((p) => [p.id, p.nombre]));
  const tenantsEnCartera = new Set((cartera ?? []).map((c) => c.tenantId));
  const tenantsDisponibles = tenants.filter((t) => !tenantsEnCartera.has(t.id));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-heading text-sm font-semibold text-navy">Tenants Asignados</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setDialogoSolicitud(true)} disabled={!cartera || cartera.length === 0}>
            <Send className="size-4" />
            Nueva Solicitud
          </Button>
          <Button size="sm" onClick={() => setDialogoVincular(true)}>
            <Link2 className="size-4" />
            Vincular Tenant
          </Button>
        </div>
      </div>

      {error && <p className="text-xs text-error-text">{error}</p>}

      {cargando ? (
        <p className="py-6 text-center text-sm text-text-muted">Cargando...</p>
      ) : !cartera || cartera.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-muted">Sin tenants asignados todavía.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-border text-left text-[11px] tracking-wide text-text-muted uppercase">
              <th className="py-2 font-medium">Tenant</th>
              <th className="py-2 font-medium">Estado</th>
              <th className="py-2 font-medium">Plan</th>
              <th className="py-2 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cartera.map((fila) => {
              const tenant = tenantPorId.get(fila.tenantId);
              const badge = tenant ? BADGE_ESTADO_SUSCRIPCION[tenant.estadoSuscripcion] : null;
              return (
                <tr key={fila.id} className="border-b border-gray-border last:border-0">
                  <td className="py-2.5 font-medium text-navy">{tenant?.nombreNegocio ?? "Tenant"}</td>
                  <td className="py-2.5">
                    {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
                  </td>
                  <td className="py-2.5 text-text-body">
                    {tenant?.planId ? (planPorId.get(tenant.planId) ?? "—") : "—"}
                  </td>
                  <td className="py-2.5 text-right">
                    {quitandoId === fila.id ? (
                      <div className="inline-flex items-center gap-1.5">
                        <Button variant="destructive" size="sm" onClick={() => confirmarQuitar(fila.id)}>
                          Sí, quitar
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setQuitandoId(null)}>
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <Button variant="ghost" size="icon-sm" onClick={() => setQuitandoId(fila.id)} aria-label="Quitar de cartera">
                        <Link2Off className="size-4 text-error-text" />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <VincularTenantDialog
        open={dialogoVincular}
        onOpenChange={setDialogoVincular}
        institucionId={institucion.id}
        tenantsDisponibles={tenantsDisponibles}
        onVinculado={() => {
          setDialogoVincular(false);
          refrescar();
        }}
      />
      {cartera && cartera.length > 0 && (
        <NuevaSolicitudDialog
          open={dialogoSolicitud}
          onOpenChange={setDialogoSolicitud}
          institucionId={institucion.id}
          tenantsEnCartera={cartera
            .map((c) => tenantPorId.get(c.tenantId))
            .filter((t): t is Tenant => t !== undefined)}
          onCreada={() => setDialogoSolicitud(false)}
        />
      )}
    </div>
  );
}

function DatosContactoTab({
  institucion,
  onActualizada,
}: {
  institucion: Institucion;
  onActualizada: (institucion: Institucion) => void;
}) {
  const [nombre, setNombre] = useState(institucion.nombre);
  const [tipo, setTipo] = useState<TipoInstitucion>(institucion.tipo);
  const [contacto, setContacto] = useState(institucion.contacto ?? "");
  const [email, setEmail] = useState(institucion.email ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  async function guardar() {
    if (!nombre.trim()) {
      setError("Ponele un nombre a la institución.");
      return;
    }
    setGuardando(true);
    setError(null);
    setGuardado(false);
    const resultado = await actualizarInstitucionAction(institucion.id, {
      nombre: nombre.trim(),
      tipo,
      contacto: contacto.trim() || undefined,
      email: email.trim() || undefined,
    });
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    onActualizada({
      id: institucion.id,
      nombre: nombre.trim(),
      tipo,
      contacto: contacto.trim() || null,
      email: email.trim() || null,
    });
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2000);
  }

  return (
    <div className="max-w-sm space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="nombre-contacto">Nombre</Label>
        <Input id="nombre-contacto" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tipo-contacto">Tipo</Label>
        <Select
          items={Object.fromEntries((Object.keys(LABEL_TIPO) as TipoInstitucion[]).map((t) => [t, LABEL_TIPO[t]]))}
          value={tipo}
          onValueChange={(v) => v && setTipo(v as TipoInstitucion)}
        >
          <SelectTrigger id="tipo-contacto" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(LABEL_TIPO) as TipoInstitucion[]).map((t) => (
              <SelectItem key={t} value={t}>
                {LABEL_TIPO[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email-contacto">Email</Label>
        <Input
          id="email-contacto"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Habilita el magic link de reingreso a /portal"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="contacto-contacto">Otro contacto (opcional)</Label>
        <Input id="contacto-contacto" value={contacto} onChange={(e) => setContacto(e.target.value)} placeholder="Teléfono, por ejemplo" />
      </div>
      {error && <p className="text-xs text-error-text">{error}</p>}
      {guardado && <p className="text-xs text-success-text">Guardado.</p>}
      <Button onClick={guardar} disabled={guardando}>
        <Pencil className="size-4" />
        {guardando ? "Guardando..." : "Guardar cambios"}
      </Button>
    </div>
  );
}

function InstitucionFormDialog({
  open,
  onOpenChange,
  onGuardada,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGuardada: (institucion: Institucion) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<TipoInstitucion>("organizacion");
  const [contacto, setContacto] = useState("");
  const [email, setEmail] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    if (!nombre.trim()) {
      setError("Ponele un nombre a la institución.");
      return;
    }
    setGuardando(true);
    setError(null);
    const resultado = await crearInstitucionAction({
      nombre: nombre.trim(),
      tipo,
      contacto: contacto.trim() || undefined,
      email: email.trim() || undefined,
    });
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    onGuardada({
      id: resultado.data.institucionId,
      nombre: nombre.trim(),
      tipo,
      contacto: contacto.trim() || null,
      email: email.trim() || null,
    });
    setNombre("");
    setContacto("");
    setEmail("");
    setTipo("organizacion");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva institución</DialogTitle>
          <DialogDescription>Alta manual — la institución también puede crearse sola al canjear un código.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="nombre-nueva">Nombre</Label>
            <Input id="nombre-nueva" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tipo-nueva">Tipo</Label>
            <Select
              items={Object.fromEntries((Object.keys(LABEL_TIPO) as TipoInstitucion[]).map((t) => [t, LABEL_TIPO[t]]))}
              value={tipo}
              onValueChange={(v) => v && setTipo(v as TipoInstitucion)}
            >
              <SelectTrigger id="tipo-nueva" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(LABEL_TIPO) as TipoInstitucion[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {LABEL_TIPO[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email-nueva">Email (opcional)</Label>
            <Input
              id="email-nueva"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Habilita el magic link de reingreso a /portal"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contacto-nueva">Otro contacto (opcional)</Label>
            <Input id="contacto-nueva" value={contacto} onChange={(e) => setContacto(e.target.value)} placeholder="Teléfono, por ejemplo" />
          </div>
          {error && <p className="text-xs text-error-text">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? "Creando..." : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VincularTenantDialog({
  open,
  onOpenChange,
  institucionId,
  tenantsDisponibles,
  onVinculado,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  institucionId: string;
  tenantsDisponibles: Tenant[];
  onVinculado: () => void;
}) {
  const [tenantId, setTenantId] = useState("");
  const [cohorte, setCohorte] = useState("");
  const [fechaInicio, setFechaInicio] = useState(() => new Date().toISOString().slice(0, 10));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    if (!tenantId) {
      setError("Elegí un tenant.");
      return;
    }
    setGuardando(true);
    setError(null);
    const resultado = await agregarTenantACarteraAction({
      institucionId,
      tenantId,
      cohorte: cohorte.trim() || undefined,
      fechaInicio,
    });
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    setTenantId("");
    setCohorte("");
    onVinculado();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vincular tenant a la cartera</DialogTitle>
          <DialogDescription>Asigná un tenant existente a esta institución.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="tenant-vincular">Tenant</Label>
            {tenantsDisponibles.length === 0 ? (
              <p className="text-xs text-text-muted">Todos los tenants ya están en esta cartera.</p>
            ) : (
              <Select
                items={Object.fromEntries(tenantsDisponibles.map((t) => [t.id, t.nombreNegocio]))}
                value={tenantId}
                onValueChange={(v) => v && setTenantId(v)}
              >
                <SelectTrigger id="tenant-vincular" className="w-full">
                  <SelectValue placeholder="Elegí un tenant" />
                </SelectTrigger>
                <SelectContent>
                  {tenantsDisponibles.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nombreNegocio}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fecha-inicio-vincular">Fecha de inicio</Label>
            <Input
              id="fecha-inicio-vincular"
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cohorte-vincular">Cohorte (opcional)</Label>
            <Input id="cohorte-vincular" value={cohorte} onChange={(e) => setCohorte(e.target.value)} placeholder="Ej. 2026-A" />
          </div>
          {error && <p className="text-xs text-error-text">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando || tenantsDisponibles.length === 0}>
            {guardando ? "Vinculando..." : "Vincular"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NuevaSolicitudDialog({
  open,
  onOpenChange,
  institucionId,
  tenantsEnCartera,
  onCreada,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  institucionId: string;
  tenantsEnCartera: Tenant[];
  onCreada: () => void;
}) {
  const [tenantId, setTenantId] = useState("");
  const [modulos, setModulos] = useState<ModuloVeedorForm[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(modulo: ModuloVeedorForm) {
    setModulos((prev) => (prev.includes(modulo) ? prev.filter((m) => m !== modulo) : [...prev, modulo]));
  }

  async function guardar() {
    if (!tenantId) {
      setError("Elegí un tenant.");
      return;
    }
    if (modulos.length === 0) {
      setError("Elegí al menos un módulo a solicitar.");
      return;
    }
    setGuardando(true);
    setError(null);
    const resultado = await crearSolicitudSeguimientoAction({ institucionId, tenantId, modulosSolicitados: modulos });
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    setTenantId("");
    setModulos([]);
    onCreada();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva Solicitud de Seguimiento</DialogTitle>
          <DialogDescription>
            CEOM registra el pedido en nombre de la institución — el Owner del tenant decide qué aprueba.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="tenant-solicitud">Tenant</Label>
            <Select
              items={Object.fromEntries(tenantsEnCartera.map((t) => [t.id, t.nombreNegocio]))}
              value={tenantId}
              onValueChange={(v) => v && setTenantId(v)}
            >
              <SelectTrigger id="tenant-solicitud" className="w-full">
                <SelectValue placeholder="Elegí un tenant" />
              </SelectTrigger>
              <SelectContent>
                {tenantsEnCartera.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nombreNegocio}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Módulos a solicitar</Label>
            {(Object.keys(MODULOS_VEEDOR_INFO) as ModuloVeedorForm[]).map((modulo) => {
              const info = MODULOS_VEEDOR_INFO[modulo];
              const marcado = modulos.includes(modulo);
              return (
                <button
                  key={modulo}
                  type="button"
                  onClick={() => toggle(modulo)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                    marcado ? "border-primary bg-pastel-blue-bg" : "border-gray-border hover:border-primary/50"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-md border",
                      marcado ? "border-primary bg-primary text-white" : "border-gray-border bg-card"
                    )}
                  >
                    {marcado && <Check className="size-3.5" />}
                  </span>
                  <p className="text-sm font-medium text-navy">{info.label}</p>
                </button>
              );
            })}
          </div>
          {error && <p className="text-xs text-error-text">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? "Enviando..." : "Crear solicitud"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
