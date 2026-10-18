"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, History, Lock, Wallet } from "lucide-react";
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
import { ZONA_HORARIA_NEGOCIO } from "@/lib/periodo";
import {
  abrirTurnoAction,
  cerrarTurnoAction,
  configurarCajaAction,
  registrarMovimientoCajaAction,
} from "./actions";

interface TurnoVivo {
  turnoId: string;
  numero: number;
  abiertoEn: string;
  fondoInicial: number;
  ventasCantidad: number;
  ventasTotal: number;
  porMedio: Array<{ metodoPagoId: string; nombre: string; esEfectivo: boolean; monto: number; cantidad: number }>;
  efectivoCobrado: number;
  entradas: number;
  salidas: number;
  efectivoEsperado: number;
}

interface Props {
  habilitada: boolean;
  exigirTurno: boolean;
  esSupervisor: boolean;
  cajas: Array<{ cajaId: string; nombre: string; turno: TurnoVivo | null }>;
}

const bs = (n: number) => `Bs ${n.toFixed(2)}`;
const formatoHora = new Intl.DateTimeFormat("es-BO", {
  timeZone: ZONA_HORARIA_NEGOCIO,
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function CajaCliente({ habilitada, exigirTurno, esSupervisor, cajas }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

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

  if (!habilitada) {
    return (
      <Card>
        <CardContent className="space-y-4 py-8 text-center">
          <Wallet className="mx-auto size-8 text-text-muted" />
          <div className="space-y-1">
            <p className="font-medium text-navy">La caja está apagada</p>
            <p className="text-sm text-text-muted">
              Con la caja activa, cada venta y cada cobro quedan asociados a un turno, y al cerrarlo
              se compara el efectivo esperado con el contado.
            </p>
          </div>
          {esSupervisor ? (
            <Button disabled={ocupado} onClick={() => ejecutar(() => configurarCajaAction({ habilitada: true }))}>
              Activar caja y turnos
            </Button>
          ) : (
            <p className="text-xs text-text-muted">Pedile a un administrador que la active.</p>
          )}
          {error && <p className="text-xs text-error-text">{error}</p>}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-error-text">{error}</p>}

      {cajas.map((caja) =>
        caja.turno ? (
          <TurnoAbierto key={caja.cajaId} nombre={caja.nombre} turno={caja.turno} ocupado={ocupado} ejecutar={ejecutar} />
        ) : (
          <AbrirTurno key={caja.cajaId} caja={caja} ocupado={ocupado} ejecutar={ejecutar} />
        )
      )}

      {esSupervisor && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-navy">Configuración</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-text-body">
              <input
                type="checkbox"
                checked={exigirTurno}
                disabled={ocupado}
                onChange={(e) =>
                  ejecutar(() => configurarCajaAction({ habilitada: true, exigirTurno: e.target.checked }))
                }
              />
              No se puede vender ni cobrar sin un turno abierto
            </label>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" render={<Link href="/app/caja/historial" />} nativeButton={false}>
                <History className="size-4" />
                Historial de turnos
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={ocupado}
                onClick={() => ejecutar(() => configurarCajaAction({ habilitada: false }))}
              >
                Apagar la caja
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

type Ejecutar = (accion: () => Promise<{ ok: boolean; error?: string }>) => Promise<boolean>;

function AbrirTurno({
  caja,
  ocupado,
  ejecutar,
}: {
  caja: { cajaId: string; nombre: string };
  ocupado: boolean;
  ejecutar: Ejecutar;
}) {
  const [fondo, setFondo] = useState("");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-navy">
          <Lock className="size-4" />
          {caja.nombre} · sin turno abierto
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label>Fondo inicial en efectivo (Bs)</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="Con cuánto efectivo empieza la caja"
            value={fondo}
            onChange={(e) => setFondo(e.target.value)}
          />
        </div>
        <Button
          disabled={ocupado || fondo === ""}
          onClick={() => ejecutar(() => abrirTurnoAction({ cajaId: caja.cajaId, fondoInicial: Number(fondo) }))}
        >
          Abrir turno
        </Button>
      </CardContent>
    </Card>
  );
}

function TurnoAbierto({
  nombre,
  turno,
  ocupado,
  ejecutar,
}: {
  nombre: string;
  turno: TurnoVivo;
  ocupado: boolean;
  ejecutar: Ejecutar;
}) {
  const [tipo, setTipo] = useState<"entrada" | "salida">("salida");
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [contado, setContado] = useState("");
  const [observaciones, setObservaciones] = useState("");

  const diferencia = contado === "" ? null : Math.round((Number(contado) - turno.efectivoEsperado) * 100) / 100;

  async function registrarMovimiento() {
    const ok = await ejecutar(() =>
      registrarMovimientoCajaAction({ turnoId: turno.turnoId, tipo, monto: Number(monto), motivo })
    );
    if (ok) {
      setMonto("");
      setMotivo("");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-baseline justify-between gap-2 text-base text-navy">
          <span>
            {nombre} · Turno #{turno.numero}
          </span>
          <span className="text-xs font-normal text-text-muted">
            abierto {formatoHora.format(new Date(turno.abiertoEn))}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Dato titulo="Fondo inicial" valor={bs(turno.fondoInicial)} />
          <Dato titulo="Efectivo cobrado" valor={bs(turno.efectivoCobrado)} />
          <Dato titulo="Entradas" valor={bs(turno.entradas)} />
          <Dato titulo="Salidas" valor={bs(turno.salidas)} />
          <Dato titulo="Efectivo esperado" valor={bs(turno.efectivoEsperado)} destacado />
        </div>

        <div className="space-y-1 text-sm">
          <p className="text-xs font-medium text-text-muted uppercase">
            {turno.ventasCantidad} {turno.ventasCantidad === 1 ? "venta" : "ventas"} · {bs(turno.ventasTotal)}
          </p>
          {turno.porMedio.length === 0 ? (
            <p className="text-text-muted">Todavía no hay cobros en este turno.</p>
          ) : (
            <ul className="divide-y divide-gray-border">
              {turno.porMedio.map((m) => (
                <li key={m.metodoPagoId} className="flex justify-between py-1.5">
                  <span className="text-text-body">
                    {m.nombre}
                    {m.esEfectivo && <span className="text-xs text-text-muted"> · efectivo</span>}
                  </span>
                  <span className="font-medium text-navy">{bs(m.monto)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-3 rounded-lg border border-gray-border p-3">
          <p className="text-xs font-medium text-text-muted uppercase">Movimiento de efectivo</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <Select
              items={{ entrada: "Entrada", salida: "Salida" }}
              value={tipo}
              onValueChange={(v) => v && setTipo(v as "entrada" | "salida")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="entrada">Entrada</SelectItem>
                <SelectItem value="salida">Salida</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="Monto"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
            />
            <Input
              className="sm:col-span-2"
              placeholder="Motivo (ej. compra de hielo)"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
          <Button size="sm" variant="outline" disabled={ocupado || !monto || !motivo.trim()} onClick={registrarMovimiento}>
            Registrar movimiento
          </Button>
        </div>

        <div className="space-y-3 rounded-lg border border-gray-border p-3">
          <p className="text-xs font-medium text-text-muted uppercase">Cerrar turno</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Efectivo contado (Bs)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Contá el efectivo de la caja"
                value={contado}
                onChange={(e) => setContado(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Diferencia</Label>
              <p
                className={
                  diferencia === null
                    ? "pt-2 text-sm text-text-muted"
                    : Math.abs(diferencia) > 0.005
                      ? "pt-2 text-sm font-semibold text-warning-text"
                      : "pt-2 text-sm font-semibold text-success-text"
                }
              >
                {diferencia === null
                  ? "—"
                  : Math.abs(diferencia) <= 0.005
                    ? "Cuadra"
                    : `${diferencia > 0 ? "Sobran" : "Faltan"} ${bs(Math.abs(diferencia))}`}
              </p>
            </div>
          </div>
          {diferencia !== null && Math.abs(diferencia) > 0.005 && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs text-warning-text">
                <AlertTriangle className="size-3.5" />
                La diferencia queda registrada para revisión; las ventas no se modifican. Explicala para cerrar.
              </p>
              <Input
                placeholder="Observaciones (obligatorio con diferencia)"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
              />
            </div>
          )}
          <Button
            disabled={ocupado || contado === ""}
            onClick={() =>
              ejecutar(() =>
                cerrarTurnoAction({
                  turnoId: turno.turnoId,
                  efectivoContado: Number(contado),
                  observaciones: observaciones || undefined,
                })
              )
            }
          >
            Cerrar turno
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Dato({ titulo, valor, destacado }: { titulo: string; valor: string; destacado?: boolean }) {
  return (
    <div>
      <p className="text-xs text-text-muted uppercase">{titulo}</p>
      <p className={destacado ? "text-xl font-semibold text-navy" : "text-base font-medium text-navy"}>{valor}</p>
    </div>
  );
}
