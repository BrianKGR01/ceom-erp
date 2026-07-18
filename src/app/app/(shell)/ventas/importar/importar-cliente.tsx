"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileUp, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { importarVentaHistoricaLoteAction } from "../actions";

interface FilaImportacion {
  fila: number;
  fecha: string;
  canalNombre: string;
  canalVentaId: string | null;
  productoNombre: string;
  productoId: string | null;
  clienteNombre: string;
  clienteId: string | null;
  cantidad: number | null;
  precioVenta: number | null;
  costoUnitario: number | null;
  motivoInvalida: string | null;
}

const COLUMNAS_ESPERADAS = "fecha,canal,producto,cantidad,precioVenta,costoUnitario,cliente";

// Parser propio (sin librería) — formato interno fijo, sin campos con comas
// escapadas. Alcanza para el uso real (exportar desde una planilla simple).
function parsearCsv(texto: string): { headers: string[]; filas: string[][] } {
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const parsearLinea = (linea: string) =>
    linea.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
  const [lineaEncabezado, ...resto] = lineas;
  return { headers: parsearLinea(lineaEncabezado ?? ""), filas: resto.map(parsearLinea) };
}

function resolverFilas(
  texto: string,
  canales: { id: string; nombre: string }[],
  productos: { id: string; nombre: string }[],
  clientes: { id: string; nombre: string }[]
): FilaImportacion[] {
  const { headers, filas } = parsearCsv(texto);
  const idx = (col: string) => headers.findIndex((h) => h.toLowerCase() === col);
  const iFecha = idx("fecha");
  const iCanal = idx("canal");
  const iProducto = idx("producto");
  const iCantidad = idx("cantidad");
  const iPrecio = idx("precioventa");
  const iCosto = idx("costounitario");
  const iCliente = idx("cliente");

  const canalPorNombre = new Map(canales.map((c) => [c.nombre.toLowerCase(), c.id]));
  const productoPorNombre = new Map(productos.map((p) => [p.nombre.toLowerCase(), p.id]));
  const clientePorNombre = new Map(clientes.map((c) => [c.nombre.toLowerCase(), c.id]));

  return filas.map((valores, i) => {
    const fecha = iFecha >= 0 ? valores[iFecha] ?? "" : "";
    const canalNombre = iCanal >= 0 ? valores[iCanal] ?? "" : "";
    const productoNombre = iProducto >= 0 ? valores[iProducto] ?? "" : "";
    const clienteNombre = iCliente >= 0 ? valores[iCliente] ?? "" : "";
    const cantidad = iCantidad >= 0 ? Number(valores[iCantidad]) : NaN;
    const precioVenta = iPrecio >= 0 ? Number(valores[iPrecio]) : NaN;
    const costoUnitario = iCosto >= 0 ? Number(valores[iCosto]) : NaN;

    const canalVentaId = canalPorNombre.get(canalNombre.toLowerCase()) ?? null;
    const productoId = productoPorNombre.get(productoNombre.toLowerCase()) ?? null;
    const clienteId = clienteNombre ? (clientePorNombre.get(clienteNombre.toLowerCase()) ?? null) : null;

    let motivoInvalida: string | null = null;
    if (!fecha) motivoInvalida = "Falta la fecha.";
    else if (!canalVentaId) motivoInvalida = `Canal "${canalNombre}" no existe.`;
    else if (!productoId) motivoInvalida = `Producto "${productoNombre}" no existe.`;
    else if (!Number.isFinite(cantidad) || cantidad <= 0) motivoInvalida = "Cantidad inválida.";
    else if (!Number.isFinite(precioVenta) || precioVenta < 0) motivoInvalida = "Precio de venta inválido.";
    else if (!Number.isFinite(costoUnitario) || costoUnitario < 0) motivoInvalida = "Costo unitario inválido.";

    return {
      fila: i + 1,
      fecha,
      canalNombre,
      canalVentaId,
      productoNombre,
      productoId,
      clienteNombre,
      clienteId,
      cantidad: Number.isFinite(cantidad) ? cantidad : null,
      precioVenta: Number.isFinite(precioVenta) ? precioVenta : null,
      costoUnitario: Number.isFinite(costoUnitario) ? costoUnitario : null,
      motivoInvalida,
    };
  });
}

export function ImportarCliente({
  canales,
  clientes,
  productos,
  sucursales,
}: {
  canales: { id: string; nombre: string }[];
  clientes: { id: string; nombre: string }[];
  productos: { id: string; nombre: string }[];
  sucursales: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);
  const [filas, setFilas] = useState<FilaImportacion[]>([]);
  const [sucursalId, setSucursalId] = useState(sucursales.length === 1 ? sucursales[0].id : "");
  const [error, setError] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<{ importadas: number; errores: { fila: number; motivo: string }[] } | null>(
    null
  );

  function procesarArchivo(file: File) {
    setError(null);
    setResultado(null);
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Solo se acepta formato .csv por ahora.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const texto = String(reader.result ?? "");
      const parseadas = resolverFilas(texto, canales, productos, clientes);
      if (parseadas.length === 0) {
        setError("No se detectaron filas de datos en el archivo.");
        return;
      }
      setNombreArchivo(file.name);
      setFilas(parseadas);
    };
    reader.readAsText(file);
  }

  const validas = filas.filter((f) => !f.motivoInvalida);
  const invalidas = filas.filter((f) => f.motivoInvalida);

  async function confirmarImportacion() {
    setImportando(true);
    setError(null);
    const payload = validas.map((f) => ({
      fechaVenta: f.fecha,
      canalVentaId: f.canalVentaId,
      clienteId: f.clienteId ?? undefined,
      productoId: f.productoId,
      cantidad: f.cantidad,
      precioVentaSnapshot: f.precioVenta,
      costoUnitarioSnapshot: f.costoUnitario,
    }));
    const resultadoAccion = await importarVentaHistoricaLoteAction(sucursalId, payload);
    setImportando(false);
    if (!resultadoAccion.ok) {
      setError(resultadoAccion.error);
      return;
    }
    setResultado(resultadoAccion.data);
    router.refresh();
  }

  function cancelar() {
    setNombreArchivo(null);
    setFilas([]);
    setResultado(null);
    setError(null);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl bg-card p-5 shadow-card">
        <p className="text-sm font-semibold text-navy">1. Cargar archivo</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) procesarArchivo(file);
          }}
        />
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setArrastrando(true);
          }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastrando(false);
            const file = e.dataTransfer.files?.[0];
            if (file) procesarArchivo(file);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center transition-colors",
            arrastrando ? "border-primary bg-pastel-blue-bg" : "border-gray-border hover:border-primary/50"
          )}
        >
          {nombreArchivo ? (
            <>
              <CheckCircle2 className="size-6 text-success-text" />
              <p className="text-sm font-medium text-navy">{nombreArchivo}</p>
              <p className="text-xs text-text-muted">Hacé clic para elegir otro archivo.</p>
            </>
          ) : (
            <>
              <Upload className="size-6 text-primary" />
              <p className="text-sm font-medium text-navy">Arrastrá y soltá tu archivo aquí</p>
              <p className="text-xs text-text-muted">
                Formato soportado: .csv — columnas: {COLUMNAS_ESPERADAS}
              </p>
              <Button type="button" size="sm" variant="outline" className="mt-1">
                <FileUp className="size-4" />
                Seleccionar archivo
              </Button>
            </>
          )}
        </div>
        {error && <p className="text-xs text-error-text">{error}</p>}
      </div>

      {filas.length > 0 && (
        <div className="space-y-3 rounded-2xl bg-card p-5 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-navy">2. Vista previa de datos</p>
            <Badge variant={invalidas.length > 0 ? "warning" : "success"}>
              {validas.length} válidas{invalidas.length > 0 ? ` · ${invalidas.length} con error` : ""}
            </Badge>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-muted" htmlFor="sucursalId">
              Sucursal donde se registran estas ventas
            </label>
            <Select
              items={Object.fromEntries(sucursales.map((s) => [s.id, s.nombre]))}
              value={sucursalId}
              onValueChange={(value) => setSucursalId(value ?? "")}
            >
              <SelectTrigger id="sucursalId" className="w-full">
                <SelectValue placeholder="Elegí una sucursal" />
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

          <div className="overflow-x-auto rounded-xl border border-gray-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-bg text-text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Canal</th>
                  <th className="px-3 py-2 font-medium">Producto</th>
                  <th className="px-3 py-2 font-medium">Cliente</th>
                  <th className="px-3 py-2 text-right font-medium">Cant.</th>
                  <th className="px-3 py-2 text-right font-medium">Precio</th>
                  <th className="px-3 py-2 text-right font-medium">Costo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-border">
                {filas.slice(0, 8).map((fila) => (
                  <tr key={fila.fila} className={fila.motivoInvalida ? "bg-error-bg/40" : undefined}>
                    <td className="px-3 py-2">{fila.fecha}</td>
                    <td className="px-3 py-2">{fila.canalNombre}</td>
                    <td className="px-3 py-2">{fila.productoNombre}</td>
                    <td className="px-3 py-2">{fila.clienteNombre || "—"}</td>
                    <td className="px-3 py-2 text-right">{fila.cantidad ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{fila.precioVenta ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{fila.costoUnitario ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filas.length > 8 && (
            <p className="text-center text-xs text-text-muted">Ver {filas.length - 8} filas más...</p>
          )}
          {invalidas.length > 0 && (
            <div className="space-y-1">
              {invalidas.slice(0, 5).map((fila) => (
                <p key={fila.fila} className="text-xs text-error-text">
                  Fila {fila.fila}: {fila.motivoInvalida}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {resultado && (
        <div className="rounded-2xl bg-card p-5 shadow-card">
          <p className="text-sm font-semibold text-navy">
            Importación completa — {resultado.importadas} venta(s) cargada(s)
          </p>
          {resultado.errores.length > 0 && (
            <div className="mt-2 space-y-1">
              {resultado.errores.map((e) => (
                <p key={e.fila} className="text-xs text-error-text">
                  Fila {e.fila}: {e.motivo}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {filas.length > 0 && !resultado && (
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={cancelar}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={confirmarImportacion}
            disabled={importando || validas.length === 0 || !sucursalId}
          >
            {importando ? "Importando..." : "Confirmar importación"}
          </Button>
        </div>
      )}
    </div>
  );
}
