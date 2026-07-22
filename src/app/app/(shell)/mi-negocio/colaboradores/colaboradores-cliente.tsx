"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Crown, Pencil, Plus, PowerOff, Search, UserPlus } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { nombreRolVisible } from "@/lib/vocabulario";
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
import { PageHeader } from "@/components/shared/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  editarColaboradorSchema,
  invitarColaboradorSchema,
  type EditarColaboradorInput,
  type InvitarColaboradorInput,
} from "@/modules/identidad/validation";
import {
  editarColaboradorAction,
  invitarColaboradorAction,
  reactivarColaboradorAction,
  suspenderColaboradorAction,
  transferirOwnerAction,
} from "../actions";

interface Colaborador {
  id: string;
  nombreCompleto: string;
  email: string;
  rolId: string;
  esOwner: boolean;
  activo: boolean;
  rol: { id: string; nombre: string };
}

interface RolOpcion {
  id: string;
  nombre: string;
  esRolSistema: boolean;
}

function SubnavMiNegocio() {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium">
      <Link href="/app/onboarding" className="text-primary hover:underline">
        Negocio
      </Link>
      <span className="text-navy">Colaboradores</span>
      <Link href="/app/mi-negocio/roles" className="text-primary hover:underline">
        Roles
      </Link>
      <Link href="/app/mi-negocio/capacidades" className="text-primary hover:underline">
        Permisos especiales
      </Link>
      <Link href="/app/mi-negocio/plan" className="text-primary hover:underline">
        Mi Plan
      </Link>
    </div>
  );
}

function InvitarColaboradorDialog({
  open,
  onOpenChange,
  roles,
  onInvitado,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: RolOpcion[];
  onInvitado: () => void;
}) {
  const form = useForm<InvitarColaboradorInput>({
    resolver: zodResolver(invitarColaboradorSchema),
    defaultValues: { email: "", nombreCompleto: "", rolId: "" },
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(values: InvitarColaboradorInput) {
    setGuardando(true);
    setError(null);
    const resultado = await invitarColaboradorAction(values);
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    form.reset();
    onOpenChange(false);
    onInvitado();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-pastel-blue-bg text-primary">
              <UserPlus className="size-4" />
            </span>
            <DialogTitle>Invitar colaborador</DialogTitle>
          </div>
          <DialogDescription>
            Le enviamos un email para que fije su contraseña y pueda entrar.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="nombreCompleto">Nombre completo</Label>
            <Input id="nombreCompleto" placeholder="Ej. Carlos Gómez" {...form.register("nombreCompleto")} />
            {form.formState.errors.nombreCompleto && (
              <p className="text-xs text-error-text">{form.formState.errors.nombreCompleto.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input id="email" type="email" placeholder="colaborador@correo.com" {...form.register("email")} />
            {form.formState.errors.email && (
              <p className="text-xs text-error-text">{form.formState.errors.email.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rolId">Rol</Label>
            <Select
              items={Object.fromEntries(roles.map((r) => [r.id, r.nombre]))}
              value={form.watch("rolId")}
              onValueChange={(v) => v && form.setValue("rolId", v)}
            >
              <SelectTrigger id="rolId" className="w-full">
                <SelectValue placeholder="Elegí un rol" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.rolId && (
              <p className="text-xs text-error-text">{form.formState.errors.rolId.message}</p>
            )}
          </div>

          {error && <p className="text-xs text-error-text">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={guardando}>
              {guardando ? "Invitando..." : "Invitar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditarRolDialog({
  open,
  onOpenChange,
  colaborador,
  roles,
  onGuardado,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  colaborador: Colaborador | null;
  roles: RolOpcion[];
  onGuardado: () => void;
}) {
  const form = useForm<EditarColaboradorInput>({
    resolver: zodResolver(editarColaboradorSchema),
    values: { rolId: colaborador?.rolId ?? "" },
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(values: EditarColaboradorInput) {
    if (!colaborador) return;
    setGuardando(true);
    setError(null);
    const resultado = await editarColaboradorAction(colaborador.id, values);
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    onOpenChange(false);
    onGuardado();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cambiar rol de {colaborador?.nombreCompleto}</DialogTitle>
          <DialogDescription>El nuevo rol se aplica de inmediato.</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="rolId-editar">Rol</Label>
            <Select
              items={Object.fromEntries(roles.map((r) => [r.id, r.nombre]))}
              value={form.watch("rolId")}
              onValueChange={(v) => v && form.setValue("rolId", v)}
            >
              <SelectTrigger id="rolId-editar" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

function TransferirOwnerDialog({
  open,
  onOpenChange,
  colaboradores,
  roles,
  ownerId,
  onTransferido,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  colaboradores: Colaborador[];
  roles: RolOpcion[];
  ownerId: string;
  onTransferido: () => void;
}) {
  const [destinoId, setDestinoId] = useState("");
  const [rolSalienteId, setRolSalienteId] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const candidatos = colaboradores.filter((c) => c.id !== ownerId && c.activo);
  const rolesElegibles = roles.filter((r) => !r.esRolSistema);

  async function confirmar() {
    if (!destinoId || !rolSalienteId) {
      setError("Elegí a quién transferís y qué rol vas a tener vos.");
      return;
    }
    setGuardando(true);
    setError(null);
    const resultado = await transferirOwnerAction(destinoId, rolSalienteId);
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    setDestinoId("");
    setRolSalienteId("");
    onOpenChange(false);
    onTransferido();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-warning-bg text-warning-text">
              <Crown className="size-4" />
            </span>
            <DialogTitle>Pasar el negocio a otra persona</DialogTitle>
          </div>
          <DialogDescription>
            Es irreversible desde acá — el colaborador elegido pasa a tener acceso total, y vos
            quedás con el rol que elijas. Solo puede haber un dueño por negocio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="destino-owner">Transferir a</Label>
            <Select
              items={Object.fromEntries(candidatos.map((c) => [c.id, `${c.nombreCompleto} (${nombreRolVisible(c.rol.nombre)})`]))}
              value={destinoId}
              onValueChange={(v) => v && setDestinoId(v)}
            >
              <SelectTrigger id="destino-owner" className="w-full">
                <SelectValue placeholder="Elegí un colaborador activo" />
              </SelectTrigger>
              <SelectContent>
                {candidatos.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombreCompleto} ({nombreRolVisible(c.rol.nombre)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {candidatos.length === 0 && (
              <p className="text-xs text-text-muted">
                No hay colaboradores activos a quienes pasarles el negocio.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rol-saliente">Tu nuevo rol</Label>
            <Select
              items={Object.fromEntries(rolesElegibles.map((r) => [r.id, nombreRolVisible(r.nombre)]))}
              value={rolSalienteId}
              onValueChange={(v) => v && setRolSalienteId(v)}
            >
              <SelectTrigger id="rol-saliente" className="w-full">
                <SelectValue placeholder="Elegí qué rol vas a tener" />
              </SelectTrigger>
              <SelectContent>
                {rolesElegibles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {rolesElegibles.length === 0 && (
              <p className="text-xs text-text-muted">
                Creá un rol personalizado primero — no podés quedar sin ninguno.
              </p>
            )}
          </div>

          {error && <p className="text-xs text-error-text">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirmar} disabled={guardando}>
            {guardando ? "Transfiriendo..." : "Pasar el negocio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ColaboradoresCliente({
  usuarioActualId,
  colaboradores,
  roles,
}: {
  usuarioActualId: string;
  colaboradores: Colaborador[];
  roles: RolOpcion[];
}) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState("");
  const [dialogoInvitar, setDialogoInvitar] = useState(false);
  const [dialogoTransferir, setDialogoTransferir] = useState(false);
  const [colaboradorEditando, setColaboradorEditando] = useState<Colaborador | null>(null);
  const [cambiandoEstado, setCambiandoEstado] = useState<string | null>(null);

  const ownerActual = useMemo(() => colaboradores.find((c) => c.esOwner), [colaboradores]);
  const filtrados = colaboradores.filter((c) =>
    c.nombreCompleto.toLowerCase().includes(busqueda.trim().toLowerCase())
  );

  async function alternarEstado(colaborador: Colaborador) {
    setCambiandoEstado(colaborador.id);
    const resultado = colaborador.activo
      ? await suspenderColaboradorAction(colaborador.id)
      : await reactivarColaboradorAction(colaborador.id);
    setCambiandoEstado(null);
    if (resultado.ok) router.refresh();
  }

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <SubnavMiNegocio />
      <PageHeader
        title="Colaboradores"
        description="Gestioná quién tiene acceso a tu negocio."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setDialogoTransferir(true)}>
              <Crown className="size-4" />
              Pasar el negocio
            </Button>
            <Button onClick={() => setDialogoInvitar(true)}>
              <Plus className="size-4" />
              Invitar Colaborador
            </Button>
          </div>
        }
      />

      <div className="mt-4 relative sm:w-64">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-muted" />
        <Input
          placeholder="Buscar colaborador..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="pl-8"
        />
      </div>

      {filtrados.length === 0 ? (
        <p className="mt-10 text-center text-sm text-text-muted">Ningún colaborador coincide con esta búsqueda.</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((c) => (
            <div key={c.id} className="rounded-2xl bg-card p-5 shadow-card">
              <div className="flex items-start justify-between">
                <Avatar nombre={c.nombreCompleto} size="lg" />
                <div className="flex flex-col items-end gap-1">
                  {c.esOwner && <Badge variant="warning">Dueño</Badge>}
                  <Badge variant={c.activo ? "success" : "error"}>{c.activo ? "Activo" : "Suspendido"}</Badge>
                </div>
              </div>
              <h2 className="mt-3 font-heading text-base font-semibold text-navy">{c.nombreCompleto}</h2>
              <p className="text-xs text-text-muted">{c.email}</p>
              <p className="mt-2 text-sm text-navy">{nombreRolVisible(c.rol.nombre)}</p>

              <div className="mt-4 flex gap-2 border-t border-gray-border pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 justify-center"
                  onClick={() => setColaboradorEditando(c)}
                  disabled={c.esOwner}
                >
                  <Pencil className="size-3.5" />
                  Rol
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 justify-center"
                  onClick={() => alternarEstado(c)}
                  disabled={c.esOwner || cambiandoEstado === c.id}
                >
                  <PowerOff className="size-3.5" />
                  {c.activo ? "Suspender" : "Reactivar"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <InvitarColaboradorDialog
        open={dialogoInvitar}
        onOpenChange={setDialogoInvitar}
        roles={roles.filter((r) => !r.esRolSistema)}
        onInvitado={() => router.refresh()}
      />
      <EditarRolDialog
        open={colaboradorEditando !== null}
        onOpenChange={(open) => !open && setColaboradorEditando(null)}
        colaborador={colaboradorEditando}
        roles={roles.filter((r) => !r.esRolSistema)}
        onGuardado={() => router.refresh()}
      />
      {ownerActual && (
        <TransferirOwnerDialog
          open={dialogoTransferir}
          onOpenChange={setDialogoTransferir}
          colaboradores={colaboradores}
          roles={roles}
          ownerId={ownerActual.id}
          onTransferido={() => router.refresh()}
        />
      )}
    </div>
  );
}
