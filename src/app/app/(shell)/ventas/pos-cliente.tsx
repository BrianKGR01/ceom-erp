"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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
import { CartPanel, type LineaCarrito } from "@/modules/ventas/components/cart-panel";
import { MetodoPagoIcon } from "@/modules/ventas/components/metodo-pago-icon";
import {
  ProductPickerCard,
  type ProductoParaVenta,
} from "@/modules/ventas/components/product-picker-card";
import {
  crearCanalVentaAction,
  crearMetodoPagoAction,
  registrarVentaAction,
} from "./actions";

interface Opcion {
  id: string;
  nombre: string;
}

export function PosCliente({
  sucursalId,
  productos,
  categorias,
  clientesIniciales,
  canalesIniciales,
  metodosIniciales,
  eventosIniciales,
}: {
  sucursalId: string;
  productos: ProductoParaVenta[];
  categorias: Opcion[];
  clientesIniciales: Opcion[];
  canalesIniciales: Opcion[];
  metodosIniciales: Opcion[];
  eventosIniciales: Opcion[];
}) {
  const router = useRouter();
  const [carrito, setCarrito] = useState<LineaCarrito[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [categoriaId, setCategoriaId] = useState("todas");
  const categoriaPorId = new Map(categorias.map((c) => [c.id, c.nombre]));

  const [clientes] = useState(clientesIniciales);
  const [clienteId, setClienteId] = useState<string>("sin_cliente");
  const [clienteNuevoNombre, setClienteNuevoNombre] = useState("");
  const [clienteNuevoTelefono, setClienteNuevoTelefono] = useState("");

  const [canales, setCanales] = useState(canalesIniciales);
  const [canalVentaId, setCanalVentaId] = useState(canales[0]?.id ?? "");
  const [canalDialogAbierto, setCanalDialogAbierto] = useState(false);
  const [canalNuevoNombre, setCanalNuevoNombre] = useState("");
  const [creandoCanal, setCreandoCanal] = useState(false);

  const [eventos] = useState(eventosIniciales);
  const [eventoId, setEventoId] = useState<string>("sin_evento");

  const [metodos, setMetodos] = useState(metodosIniciales);
  const [metodoPagoId, setMetodoPagoId] = useState<string>("sin_pago");
  const [montoPagoInicial, setMontoPagoInicial] = useState("");
  const [metodoDialogAbierto, setMetodoDialogAbierto] = useState(false);
  const [metodoNuevoNombre, setMetodoNuevoNombre] = useState("");
  const [creandoMetodo, setCreandoMetodo] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  const productosFiltrados = productos
    .filter((p) => categoriaId === "todas" || p.categoriaId === categoriaId)
    .filter((p) => p.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()));

  function agregarProducto(producto: ProductoParaVenta) {
    setCarrito((prev) => {
      const existente = prev.find((l) => l.productoId === producto.id);
      if (existente) {
        return prev.map((l) =>
          l.productoId === producto.id ? { ...l, cantidad: l.cantidad + 1 } : l
        );
      }
      return [
        ...prev,
        {
          productoId: producto.id,
          nombre: producto.nombre,
          precioVenta: Number(producto.precioVenta),
          cantidad: 1,
        },
      ];
    });
  }

  function cambiarCantidad(productoId: string, cantidad: number) {
    setCarrito((prev) =>
      cantidad <= 0
        ? prev.filter((l) => l.productoId !== productoId)
        : prev.map((l) => (l.productoId === productoId ? { ...l, cantidad } : l))
    );
  }

  function quitarLinea(productoId: string) {
    setCarrito((prev) => prev.filter((l) => l.productoId !== productoId));
  }

  async function crearCanalRapido() {
    setCreandoCanal(true);
    const resultado = await crearCanalVentaAction({ nombre: canalNuevoNombre });
    setCreandoCanal(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    const nuevo = { id: resultado.data.canalVentaId, nombre: resultado.data.nombre };
    setCanales((prev) => [...prev, nuevo]);
    setCanalVentaId(nuevo.id);
    setCanalDialogAbierto(false);
    setCanalNuevoNombre("");
  }

  async function crearMetodoRapido() {
    setCreandoMetodo(true);
    const resultado = await crearMetodoPagoAction({ nombre: metodoNuevoNombre });
    setCreandoMetodo(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    const nuevo = { id: resultado.data.metodoPagoId, nombre: resultado.data.nombre };
    setMetodos((prev) => [...prev, nuevo]);
    setMetodoPagoId(nuevo.id);
    setMetodoDialogAbierto(false);
    setMetodoNuevoNombre("");
  }

  async function confirmarVenta() {
    setError(null);
    if (carrito.length === 0) {
      setError("Agregá al menos un producto al carrito.");
      return;
    }
    if (!canalVentaId) {
      setError("Elegí un canal de venta.");
      return;
    }
    if (clienteId === "nuevo" && !clienteNuevoNombre.trim()) {
      setError("Ponele un nombre al cliente nuevo.");
      return;
    }

    setConfirmando(true);
    const resultado = await registrarVentaAction(sucursalId, {
      clienteId: clienteId !== "sin_cliente" && clienteId !== "nuevo" ? clienteId : undefined,
      clienteNuevo:
        clienteId === "nuevo"
          ? { nombre: clienteNuevoNombre, telefono: clienteNuevoTelefono || undefined }
          : undefined,
      canalVentaId,
      eventoId: eventoId !== "sin_evento" ? eventoId : undefined,
      lineas: carrito.map((l) => ({ productoId: l.productoId, cantidad: l.cantidad })),
      pagoInicial:
        metodoPagoId !== "sin_pago" && montoPagoInicial
          ? { metodoPagoId, monto: Number(montoPagoInicial) }
          : undefined,
    });
    setConfirmando(false);

    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    router.push(`/app/ventas/${resultado.data.ventaId}`);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {categorias.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCategoriaId("todas")}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                  categoriaId === "todas"
                    ? "bg-primary text-white"
                    : "bg-pastel-blue-bg text-text-body hover:bg-pastel-blue-bg/70"
                )}
              >
                Todos los productos
              </button>
              {categorias.map((categoria) => (
                <button
                  key={categoria.id}
                  type="button"
                  onClick={() => setCategoriaId(categoria.id)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                    categoriaId === categoria.id
                      ? "bg-primary text-white"
                      : "bg-pastel-blue-bg text-text-body hover:bg-pastel-blue-bg/70"
                  )}
                >
                  {categoria.nombre}
                </button>
              ))}
            </div>
          )}
          <div className="relative sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-muted" />
            <Input
              placeholder="Buscar por nombre o categoría..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        {productosFiltrados.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-muted">
            Ningún producto coincide con esta búsqueda.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {productosFiltrados.map((producto) => (
              <ProductPickerCard
                key={producto.id}
                producto={producto}
                categoriaNombre={
                  producto.categoriaId ? categoriaPorId.get(producto.categoriaId) : undefined
                }
                onAgregar={() => agregarProducto(producto)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle>Tu venta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CartPanel
              lineas={carrito}
              onCambiarCantidad={cambiarCantidad}
              onQuitar={quitarLinea}
            />

            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <Select
                items={{
                  sin_cliente: "Consumidor final",
                  nuevo: "+ Cliente nuevo",
                  ...Object.fromEntries(clientes.map((c) => [c.id, c.nombre])),
                }}
                value={clienteId}
                onValueChange={(v) => v && setClienteId(v)}
              >
                <SelectTrigger className="w-full">
                  <User className="size-4 text-text-muted" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sin_cliente">Consumidor final</SelectItem>
                  <SelectItem value="nuevo">+ Cliente nuevo</SelectItem>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {clienteId === "nuevo" && (
                <div className="space-y-1.5 pt-1.5">
                  <Input
                    placeholder="Nombre del cliente"
                    value={clienteNuevoNombre}
                    onChange={(e) => setClienteNuevoNombre(e.target.value)}
                  />
                  <Input
                    placeholder="Teléfono (opcional)"
                    value={clienteNuevoTelefono}
                    onChange={(e) => setClienteNuevoTelefono(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* H-01: el canal es obligatorio para vender y un negocio nuevo
                no tiene ninguno, así que este es el estado con el que se
                encuentra todo el mundo la primera vez. El "+ Nuevo canal"
                siempre existió, pero colgaba debajo del hueco que dejaba la
                grilla de canales al no renderizarse. Se pasa al patrón que ya
                usa GastoForm para "+ Crear nueva" categoría: el enlace vive
                en la misma fila que el label, y debajo siempre hay algo. */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label>Canal de venta</Label>
                <button
                  type="button"
                  onClick={() => setCanalDialogAbierto(true)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  + Nuevo canal
                </button>
              </div>
              {canales.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {canales.map((canal) => (
                    <button
                      key={canal.id}
                      type="button"
                      onClick={() => setCanalVentaId(canal.id)}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                        canalVentaId === canal.id
                          ? "border-primary bg-pastel-blue-bg text-primary"
                          : "border-gray-border text-text-body hover:border-primary/50"
                      )}
                    >
                      {canal.nombre}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-gray-border px-3 py-2 text-xs text-text-muted">
                  Todavía no tenés canales de venta. Creá uno acá arriba para poder registrar
                  la venta — por ejemplo &quot;Local&quot;, &quot;WhatsApp&quot; o
                  &quot;Feria&quot;.
                </p>
              )}
            </div>

            {eventos.length > 0 && (
              <div className="space-y-1.5">
                <Label>Evento (opcional)</Label>
                <Select
                  items={{
                    sin_evento: "Ninguno",
                    ...Object.fromEntries(eventos.map((e) => [e.id, e.nombre])),
                  }}
                  value={eventoId}
                  onValueChange={(v) => v && setEventoId(v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sin_evento">Ninguno</SelectItem>
                    {eventos.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Pago inicial (opcional)</Label>
              {metodos.length > 0 && (
                <div className="grid grid-cols-3 gap-1.5">
                  {metodos.map((metodo) => (
                    <button
                      key={metodo.id}
                      type="button"
                      onClick={() =>
                        setMetodoPagoId((prev) => (prev === metodo.id ? "sin_pago" : metodo.id))
                      }
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-colors",
                        metodoPagoId === metodo.id
                          ? "border-primary bg-pastel-blue-bg"
                          : "border-gray-border hover:border-primary/50"
                      )}
                    >
                      <MetodoPagoIcon
                        nombre={metodo.nombre}
                        className={cn(
                          "size-4",
                          metodoPagoId === metodo.id ? "text-primary" : "text-text-muted"
                        )}
                      />
                      <span className="line-clamp-1 text-[11px] font-medium text-navy">
                        {metodo.nombre}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Monto del pago"
                value={montoPagoInicial}
                onChange={(e) => setMontoPagoInicial(e.target.value)}
                disabled={metodoPagoId === "sin_pago"}
              />
              <button
                type="button"
                onClick={() => setMetodoDialogAbierto(true)}
                className="text-xs font-medium text-primary hover:underline"
              >
                + Nuevo método de pago
              </button>
            </div>

            {error && (
              <p role="alert" className="text-xs text-error-text">
                {error}
              </p>
            )}

            <Button
              onClick={confirmarVenta}
              disabled={confirmando || carrito.length === 0}
              className="w-full justify-center"
            >
              {confirmando ? "Registrando..." : "Confirmar venta"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={canalDialogAbierto} onOpenChange={setCanalDialogAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo canal de venta</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Ej. Feria, WhatsApp, Local físico"
            value={canalNuevoNombre}
            onChange={(e) => setCanalNuevoNombre(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCanalDialogAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={crearCanalRapido} disabled={creandoCanal || !canalNuevoNombre.trim()}>
              {creandoCanal ? "Creando..." : "Crear canal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={metodoDialogAbierto} onOpenChange={setMetodoDialogAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo método de pago</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Ej. Efectivo, QR, Transferencia"
            value={metodoNuevoNombre}
            onChange={(e) => setMetodoNuevoNombre(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setMetodoDialogAbierto(false)}>
              Cancelar
            </Button>
            <Button
              onClick={crearMetodoRapido}
              disabled={creandoMetodo || !metodoNuevoNombre.trim()}
            >
              {creandoMetodo ? "Creando..." : "Crear método"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
