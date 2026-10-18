"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Trash2 } from "lucide-react";
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
  ETIQUETA_MOTIVO_BAJA,
  MOTIVOS_BAJA,
  type MotivoBajaUI,
} from "@/modules/operativo/nichos/nicho-1/motivos-baja";
import { registrarBajaAction } from "../actions";

type TipoBaja = "insumo" | "producto";

export interface BajaListada {
  id: string;
  fecha: string;
  sucursal: string;
  tipo: TipoBaja;
  nombre: string;
  cantidad: string;
  motivo: MotivoBajaUI;
  nota: string | null;
  costoTotal: string | null;
  costoDesconocido: boolean;
}

interface Props {
  sucursales: Array<{ id: string; nombre: string }>;
  insumos: Array<{ id: string; nombre: string; unidadMedida: string }>;
  productos: Array<{ id: string; nombre: string }>;
  bajas: BajaListada[];
  resumen: { costoTotal: number; bajasSinCostoConocido: number } | null;
}

const ETIQUETA_TIPO: Record<TipoBaja, string> = {
  insumo: "Insumo",
  producto: "Producto preparado",
};

const formatoFecha = new Intl.DateTimeFormat("es-BO", {
  timeZone: ZONA_HORARIA_NEGOCIO,
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const bs = (n: number) => `Bs ${n.toFixed(2)}`;

export function BajasCliente({ sucursales, insumos, productos, bajas, resumen }: Props) {
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoBaja>("insumo");
  const [objetoId, setObjetoId] = useState("");
  const [sucursalId, setSucursalId] = useState(sucursales[0]?.id ?? "");
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState<MotivoBajaUI>("derrame_desperdicio");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<{ costoTotal: number | null; avisos: string[] } | null>(null);

  const opciones = tipo === "insumo" ? insumos : productos;
  const unidad = tipo === "insumo" ? insumos.find((i) => i.id === objetoId)?.unidadMedida : "unidad";

  function cambiarTipo(nuevo: TipoBaja) {
    setTipo(nuevo);
    setObjetoId("");
  }

  async function registrar() {
    setError(null);
    setExito(null);
    if (!objetoId) {
      setError(tipo === "insumo" ? "Elegí el insumo." : "Elegí el producto.");
      return;
    }
    if (!cantidad || Number(cantidad) <= 0) {
      setError("Ingresá una cantidad mayor a 0.");
      return;
    }
    setGuardando(true);
    const resultado = await registrarBajaAction({
      tipo,
      objetoId,
      sucursalId,
      cantidad: Number(cantidad),
      motivo,
      nota: nota || undefined,
    });
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    setExito({ costoTotal: resultado.data.costoTotal, avisos: resultado.data.avisos });
    setObjetoId("");
    setCantidad("");
    setNota("");
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-navy">
            <Trash2 className="size-4" />
            Registrar una baja
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>¿Qué se perdió?</Label>
            <div className="flex gap-2">
              {(Object.keys(ETIQUETA_TIPO) as TipoBaja[]).map((t) => (
                <Button
                  key={t}
                  type="button"
                  size="sm"
                  variant={tipo === t ? "default" : "outline"}
                  onClick={() => cambiarTipo(t)}
                >
                  {ETIQUETA_TIPO[t]}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>{tipo === "insumo" ? "Insumo" : "Producto"}</Label>
            <Select
              items={Object.fromEntries(opciones.map((o) => [o.id, o.nombre]))}
              value={objetoId}
              onValueChange={(v) => v && setObjetoId(v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Elegí uno..." />
              </SelectTrigger>
              <SelectContent>
                {opciones.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {sucursales.length > 1 && (
            <div className="space-y-2">
              <Label>Sucursal</Label>
              <Select
                items={Object.fromEntries(sucursales.map((s) => [s.id, s.nombre]))}
                value={sucursalId}
                onValueChange={(v) => v && setSucursalId(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sucursales.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Cantidad{unidad ? ` (${unidad})` : ""}</Label>
            <Input
              type="number"
              min="0"
              step="0.0001"
              placeholder="Ej. 1"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Motivo</Label>
            <Select
              items={ETIQUETA_MOTIVO_BAJA}
              value={motivo}
              onValueChange={(v) => v && setMotivo(v as MotivoBajaUI)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOTIVOS_BAJA.map((m) => (
                  <SelectItem key={m} value={m}>
                    {ETIQUETA_MOTIVO_BAJA[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Nota {motivo === "otro" ? "(obligatoria)" : "(opcional)"}</Label>
            <Input
              placeholder="Qué pasó"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
            />
          </div>

          {error && <p className="text-xs text-error-text">{error}</p>}
          {exito && (
            <div className="space-y-1 rounded-lg border border-gray-border p-3 text-xs">
              <p className="flex items-center gap-1.5 font-medium text-navy">
                <CheckCircle2 className="size-4 text-success-text" />
                Baja registrada
                {exito.costoTotal !== null ? ` · costo ${bs(exito.costoTotal)}` : " · costo desconocido"}
              </p>
              {exito.avisos.map((a) => (
                <p key={a} className="flex items-start gap-1.5 text-warning-text">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  {a}
                </p>
              ))}
            </div>
          )}

          <Button className="w-full" onClick={registrar} disabled={guardando}>
            {guardando ? "Registrando..." : "Registrar baja"}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4 lg:col-span-2">
        {resumen && (
          <Card>
            <CardContent className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="text-xs text-text-muted uppercase">Costo de bajas · últimos 7 días</p>
                <p className="text-2xl font-semibold text-navy">{bs(resumen.costoTotal)}</p>
              </div>
              {resumen.bajasSinCostoConocido > 0 && (
                <p className="flex items-center gap-1.5 text-xs text-warning-text">
                  <AlertTriangle className="size-3.5" />
                  {resumen.bajasSinCostoConocido === 1
                    ? "1 baja no tiene costo conocido y no está sumada."
                    : `${resumen.bajasSinCostoConocido} bajas no tienen costo conocido y no están sumadas.`}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base text-navy">Últimas bajas</CardTitle>
          </CardHeader>
          <CardContent>
            {bajas.length === 0 ? (
              <p className="py-6 text-center text-sm text-text-muted">
                No hay bajas en los últimos 7 días.
              </p>
            ) : (
              <ul className="divide-y divide-gray-border">
                {bajas.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-navy">
                        {b.nombre}{" "}
                        <span className="font-normal text-text-muted">
                          × {Number(b.cantidad)} · {ETIQUETA_TIPO[b.tipo].toLowerCase()}
                        </span>
                      </p>
                      <p className="text-xs text-text-muted">
                        {ETIQUETA_MOTIVO_BAJA[b.motivo]}
                        {b.nota ? ` · ${b.nota}` : ""}
                        {b.sucursal ? ` · ${b.sucursal}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-navy">
                        {b.costoDesconocido || b.costoTotal === null
                          ? "Costo desconocido"
                          : bs(Number(b.costoTotal))}
                      </p>
                      <p className="text-xs text-text-muted">{formatoFecha.format(new Date(b.fecha))}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
