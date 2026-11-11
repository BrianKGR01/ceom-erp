"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

type EstadoPago = "pendiente" | "parcial" | "pagado";

export interface VentaListado {
  id: string;
  fechaVenta: string;
  clienteNombre: string;
  canalId: string;
  canalNombre: string;
  estadoPago: EstadoPago;
  total: number;
}

const BADGE_ESTADO: Record<EstadoPago, "success" | "warning" | "info"> = {
  pagado: "success",
  parcial: "warning",
  pendiente: "info",
};

const LABEL_ESTADO: Record<EstadoPago, string> = {
  pagado: "Pagado",
  parcial: "Pago parcial",
  pendiente: "Pendiente de cobro",
};

/** Cuanto esperamos entre teclas antes de pedirle al servidor la busqueda. */
const ESPERA_BUSQUEDA_MS = 350;

/**
 * El Historial muestra UNA pagina, ya filtrada por la base. Los filtros y la pagina viven en
 * la URL (asi el boton "atras" del navegador y un enlace compartido funcionan), y cada cambio
 * vuelve a pedir esa pagina al servidor. Antes este componente recibia TODAS las ventas del
 * tenant y filtraba en memoria: con 1198 ventas eran ~291 kB de JSON por visita para mostrar
 * 10 filas, y tres filtros sobre el arreglo completo por cada tecla.
 */
export function HistorialCliente({
  ventas,
  canales,
  filtros,
  pagina,
  porPagina,
  cantidadTotal,
}: {
  ventas: VentaListado[];
  canales: { id: string; nombre: string }[];
  filtros: { estado: "todas" | EstadoPago; canalId: string; busqueda: string };
  pagina: number;
  porPagina: number;
  cantidadTotal: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [cargando, iniciarCarga] = useTransition();
  const [busqueda, setBusqueda] = useState(filtros.busqueda);

  function urlCon(cambios: Record<string, string>) {
    const valores: Record<string, string> = {
      estado: filtros.estado === "todas" ? "" : filtros.estado,
      canal: filtros.canalId === "todos" ? "" : filtros.canalId,
      q: filtros.busqueda,
      pagina: String(pagina),
      ...cambios,
    };
    // Un filtro nuevo vuelve a la pagina 1 salvo que se pida una pagina explicita.
    if (!("pagina" in cambios)) valores.pagina = "1";

    const params = new URLSearchParams();
    for (const [clave, valor] of Object.entries(valores)) {
      // La pagina 1 y los filtros vacios no van en la URL: deja el enlace limpio.
      if (!valor || (clave === "pagina" && valor === "1")) continue;
      params.set(clave, valor);
    }
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  function navegar(cambios: Record<string, string>) {
    iniciarCarga(() => router.push(urlCon(cambios), { scroll: false }));
  }

  // La busqueda no dispara una consulta por tecla: espera a que la persona deje de escribir.
  useEffect(() => {
    if (busqueda === filtros.busqueda) return;
    const temporizador = setTimeout(() => {
      iniciarCarga(() => router.push(urlCon({ q: busqueda }), { scroll: false }));
    }, ESPERA_BUSQUEDA_MS);
    return () => clearTimeout(temporizador);
    // urlCon se recalcula en cada render; depender de ella reiniciaria el temporizador siempre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda, filtros.busqueda]);

  const totalPaginas = Math.max(1, Math.ceil(cantidadTotal / porPagina));
  // Una pagina fuera de rango llega de un favorito viejo o de una URL a mano: la base
  // devuelve una lista vacia y, sin acotar, el pie decia cosas como "Mostrando 19981-1199
  // de 1199" con los dos botones trabados. Mostramos la ultima pagina real.
  const paginaVisible = Math.min(pagina, totalPaginas);
  const desde = cantidadTotal === 0 ? 0 : (paginaVisible - 1) * porPagina + 1;
  const hasta = Math.min(paginaVisible * porPagina, cantidadTotal);

  useEffect(() => {
    if (cantidadTotal > 0 && pagina > totalPaginas) {
      iniciarCarga(() => router.replace(urlCon({ pagina: String(totalPaginas) }), { scroll: false }));
    }
    // urlCon se recalcula en cada render; depender de ella repetiria el replace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cantidadTotal, pagina, totalPaginas]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <ToggleGroup
            value={filtros.estado}
            onValueChange={(v) => navegar({ estado: v === "todas" ? "" : String(v) })}
            options={[
              { value: "todas", label: "Todas" },
              ...((Object.keys(LABEL_ESTADO) as EstadoPago[]).map((e) => ({
                value: e,
                label: LABEL_ESTADO[e],
              }))),
            ]}
          />
          {canales.length > 0 && (
            <Select
              items={{
                todos: "Todos los canales",
                ...Object.fromEntries(canales.map((c) => [c.id, c.nombre])),
              }}
              value={filtros.canalId}
              onValueChange={(v) => v && navegar({ canal: v === "todos" ? "" : String(v) })}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los canales</SelectItem>
                {canales.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="relative sm:w-56">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-muted" />
          <Input
            placeholder="Buscar cliente..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            maxLength={80}
            className="pl-8"
          />
        </div>
      </div>

      <div
        className={cn(
          "divide-y divide-gray-border rounded-2xl bg-card shadow-card transition-opacity",
          cargando && "opacity-60"
        )}
      >
        {ventas.length === 0 && (
          <p className="p-6 text-center text-sm text-text-muted">No hay ventas para mostrar.</p>
        )}
        {ventas.map((venta) => (
          <Link
            key={venta.id}
            href={`/app/ventas/${venta.id}`}
            className="flex items-center gap-3 p-4 text-sm hover:bg-gray-bg"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-pastel-blue-bg text-xs font-semibold text-primary">
              {venta.clienteNombre.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-text-body">{venta.clienteNombre}</p>
              <p className="text-xs text-text-muted">
                {new Date(venta.fechaVenta).toLocaleDateString("es-BO")} · {venta.canalNombre}
              </p>
            </div>
            <Badge variant={BADGE_ESTADO[venta.estadoPago]}>{LABEL_ESTADO[venta.estadoPago]}</Badge>
            <span className="w-20 text-right font-medium text-navy">{venta.total.toFixed(2)}</span>
          </Link>
        ))}
      </div>

      {cantidadTotal > porPagina && (
        <div className="flex items-center justify-between text-sm text-text-muted">
          <span>
            Mostrando {desde}-{hasta} de {cantidadTotal} ventas
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={paginaVisible <= 1 || cargando}
              onClick={() => navegar({ pagina: String(paginaVisible - 1) })}
              className="rounded-lg px-2 py-1 hover:bg-gray-bg disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="px-2 font-medium text-navy">
              {paginaVisible} / {totalPaginas}
            </span>
            <button
              type="button"
              disabled={paginaVisible >= totalPaginas || cargando}
              onClick={() => navegar({ pagina: String(paginaVisible + 1) })}
              className="rounded-lg px-2 py-1 hover:bg-gray-bg disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
