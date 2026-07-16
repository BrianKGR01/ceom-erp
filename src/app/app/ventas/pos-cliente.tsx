"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { CartPanel, type LineaCarrito } from "@/modules/ventas/components/cart-panel";
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
  clientesIniciales,
  canalesIniciales,
  metodosIniciales,
}: {
  sucursalId: string;
  productos: ProductoParaVenta[];
  clientesIniciales: Opcion[];
  canalesIniciales: Opcion[];
  metodosIniciales: Opcion[];
}) {
  const router = useRouter();
  const [carrito, setCarrito] = useState<LineaCarrito[]>([]);

  const [clientes] = useState(clientesIniciales);
  const [clienteId, setClienteId] = useState<string>("sin_cliente");
  const [clienteNuevoNombre, setClienteNuevoNombre] = useState("");
  const [clienteNuevoTelefono, setClienteNuevoTelefono] = useState("");

  const [canales, setCanales] = useState(canalesIniciales);
  const [canalVentaId, setCanalVentaId] = useState(canales[0]?.id ?? "");
  const [canalDialogAbierto, setCanalDialogAbierto] = useState(false);
  const [canalNuevoNombre, setCanalNuevoNombre] = useState("");
  const [creandoCanal, setCreandoCanal] = useState(false);

  const [metodos, setMetodos] = useState(metodosIniciales);
  const [metodoPagoId, setMetodoPagoId] = useState<string>("sin_pago");
  const [montoPagoInicial, setMontoPagoInicial] = useState("");
  const [metodoDialogAbierto, setMetodoDialogAbierto] = useState(false);
  const [metodoNuevoNombre, setMetodoNuevoNombre] = useState("");
  const [creandoMetodo, setCreandoMetodo] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

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
      <div className="lg:col-span-2">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {productos.map((producto) => (
            <ProductPickerCard
              key={producto.id}
              producto={producto}
              onAgregar={() => agregarProducto(producto)}
            />
          ))}
        </div>
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
                  sin_cliente: "Sin cliente",
                  nuevo: "+ Cliente nuevo",
                  ...Object.fromEntries(clientes.map((c) => [c.id, c.nombre])),
                }}
                value={clienteId}
                onValueChange={(v) => v && setClienteId(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sin_cliente">Sin cliente</SelectItem>
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

            <div className="space-y-1.5">
              <Label>Canal de venta</Label>
              <Select
                items={Object.fromEntries(canales.map((c) => [c.id, c.nombre]))}
                value={canalVentaId}
                onValueChange={(v) => v && setCanalVentaId(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Elegí un canal" />
                </SelectTrigger>
                <SelectContent>
                  {canales.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                onClick={() => setCanalDialogAbierto(true)}
                className="text-xs font-medium text-primary hover:underline"
              >
                + Nuevo canal
              </button>
            </div>

            <div className="space-y-1.5">
              <Label>Pago inicial (opcional)</Label>
              <div className="flex gap-2">
                <Select
                  items={{
                    sin_pago: "Sin pago todavía",
                    ...Object.fromEntries(metodos.map((m) => [m.id, m.nombre])),
                  }}
                  value={metodoPagoId}
                  onValueChange={(v) => v && setMetodoPagoId(v)}
                >
                  <SelectTrigger className="w-1/2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sin_pago">Sin pago todavía</SelectItem>
                    {metodos.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Monto"
                  className="w-1/2"
                  value={montoPagoInicial}
                  onChange={(e) => setMontoPagoInicial(e.target.value)}
                  disabled={metodoPagoId === "sin_pago"}
                />
              </div>
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
