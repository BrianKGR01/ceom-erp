"use client";

import { useState } from "react";
import Link from "next/link";
import { Beaker, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type UnidadMedidaInsumo = "litros" | "ml" | "kg" | "g" | "unidad" | "metros";

const LABEL_UNIDAD: Record<UnidadMedidaInsumo, string> = {
  litros: "L",
  ml: "ml",
  kg: "kg",
  g: "g",
  unidad: "unidad",
  metros: "m",
};

export interface InsumoListado {
  id: string;
  nombre: string;
  unidadMedida: UnidadMedidaInsumo;
  costoUnitarioVigente: string | null;
  stockMinimo: string | null;
}

export function InsumosCliente({ insumos }: { insumos: InsumoListado[] }) {
  const [busqueda, setBusqueda] = useState("");

  const filtrados = insumos.filter((i) =>
    i.nombre.toLowerCase().includes(busqueda.trim().toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="relative sm:w-64">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-muted" />
        <Input
          placeholder="Buscar por nombre..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="pl-8"
        />
      </div>

      {filtrados.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-muted">
          Ningún insumo coincide con esta búsqueda.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {filtrados.map((insumo) => (
            <Link key={insumo.id} href={`/app/produccion/insumos/${insumo.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <div className="flex h-20 items-center justify-center rounded-t-2xl bg-pastel-blue-bg">
                  <Beaker className="size-7 text-primary" />
                </div>
                <CardContent className="space-y-1">
                  <p className="line-clamp-1 text-sm font-medium text-navy">{insumo.nombre}</p>
                  <div className="flex items-baseline justify-between">
                    <p className="text-base font-semibold text-navy">
                      {insumo.costoUnitarioVigente !== null
                        ? Number(insumo.costoUnitarioVigente).toFixed(2)
                        : "—"}{" "}
                      <span className="text-xs font-normal text-text-muted">
                        / {LABEL_UNIDAD[insumo.unidadMedida]}
                      </span>
                    </p>
                  </div>
                  {insumo.stockMinimo !== null && (
                    <p className="text-xs text-text-muted">
                      Mínimo: {Number(insumo.stockMinimo)} {LABEL_UNIDAD[insumo.unidadMedida]}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
