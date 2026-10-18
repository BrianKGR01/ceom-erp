"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Search, User } from "lucide-react";
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
import {
  BonificarDialog,
  ETIQUETA_MOTIVO_BONIFICACION,
  type BonificacionVenta,
} from "@/modules/ventas/components/bonificar-dialog";
import {
  ConfigurarProductoDialog,
  type GrupoModificadores,
  type LineaConfigurada,
} from "@/modules/ventas/components/configurar-producto-dialog";
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
  stockPorProducto,
  productos,
  modificadoresPorProducto,
  caja = null,
  puedeBonificar = { consumoPersonal: false, cortesia: false },
  categorias,
  clientesIniciales,
  canalesIniciales,
  metodosIniciales,
  eventosIniciales,
}: {
  sucursalId: string;
  /** H-37. `null` = sin permiso para ver inventario. */
  stockPorProducto: Record<string, number> | null;
  productos: ProductoParaVenta[];
  /** Fase 3: grupos de modificadores que ofrece cada producto. */
  modificadoresPorProducto: Record<string, GrupoModificadores[]>;
  /** Fase 4: null = el negocio no usa caja. */
  caja?: { exigirTurno: boolean; turnoNumero: number | null; cajaNombre: string } | null;
  /** Fase 5: que motivos de bonificacion puede usar quien vende (capacidades por rol). */
  puedeBonificar?: { consumoPersonal: boolean; cortesia: boolean };
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
  // Venta ya guardada y navegación a su ficha en curso. Mientras esto no sea
  // null el punto de venta NO se puede volver a confirmar: ver confirmarVenta.
  const [ventaRegistradaId, setVentaRegistradaId] = useState<string | null>(null);
  // R-3.2 / H-37: lo que pasó con el stock de la venta ya registrada.
  const [ventaConAvisos, setVentaConAvisos] = useState<{
    ventaId: string;
    avisos: Array<{ nombre: string; mensaje: string }>;
  } | null>(null);

  // Fase 3: las variantes del mismo producto (mismo `grupoVariantes`) se muestran
  // en UNA tarjeta; tocarla abre la hoja para elegir variante y modificadores.
  interface Tarjeta {
    clave: string;
    /** Nombre del grupo; null si es un producto suelto. */
    grupo: string | null;
    variantes: ProductoParaVenta[];
  }
  const tarjetas: Tarjeta[] = [];
  for (const p of productos) {
    const grupo = p.grupoVariantes?.trim() || null;
    const existente = grupo
      ? tarjetas.find((t) => t.grupo?.toLowerCase() === grupo.toLowerCase())
      : undefined;
    if (existente) existente.variantes.push(p);
    else tarjetas.push({ clave: grupo ? `g:${grupo.toLowerCase()}` : `p:${p.id}`, grupo, variantes: [p] });
  }
  const tarjetasFiltradas = tarjetas
    .map((t) => ({
      ...t,
      variantes: t.variantes.filter((p) => categoriaId === "todas" || p.categoriaId === categoriaId),
    }))
    .filter((t) => t.variantes.length > 0)
    .filter((t) => {
      const q = busqueda.trim().toLowerCase();
      return (
        q === "" ||
        (t.grupo ?? "").toLowerCase().includes(q) ||
        t.variantes.some((p) => p.nombre.toLowerCase().includes(q))
      );
    });

  const [configurando, setConfigurando] = useState<Tarjeta | null>(null);

  // Fase 5: bonificacion. El descuento real lo calcula el servidor; esto es solo para mostrar.
  const [bonificacion, setBonificacion] = useState<BonificacionVenta | null>(null);
  const [bonificarAbierto, setBonificarAbierto] = useState(false);
  const puedeAlgunaBonificacion = puedeBonificar.consumoPersonal || puedeBonificar.cortesia;
  const totalCarrito = carrito.reduce((acc, l) => acc + l.precioVenta * l.cantidad, 0);
  const totalNeto = bonificacion
    ? totalCarrito - Math.round(totalCarrito * bonificacion.porcentaje) / 100
    : totalCarrito;
  // Fase 4: con la caja activa y exigida, sin turno abierto no se confirma (el servidor lo vuelve a exigir).
  const sinTurno = Boolean(caja?.exigirTurno && caja.turnoNumero === null);

  function tocarTarjeta(tarjeta: Tarjeta) {
    const sinOpciones =
      tarjeta.variantes.length === 1 && (modificadoresPorProducto[tarjeta.variantes[0].id] ?? []).length === 0;
    if (sinOpciones) {
      const p = tarjeta.variantes[0];
      agregarLinea({
        producto: p,
        cantidad: 1,
        modificadorIds: [],
        modificadoresTexto: [],
        precioUnitario: Number(p.precioVenta),
        observacion: "",
      });
      return;
    }
    setConfigurando(tarjeta);
  }

  function agregarLinea(linea: LineaConfigurada) {
    const clave = [linea.producto.id, [...linea.modificadorIds].sort().join(","), linea.observacion].join("|");
    setCarrito((prev) => {
      const existente = prev.find((l) => l.clave === clave);
      if (existente) {
        return prev.map((l) => (l.clave === clave ? { ...l, cantidad: l.cantidad + linea.cantidad } : l));
      }
      return [
        ...prev,
        {
          clave,
          productoId: linea.producto.id,
          nombre: linea.producto.nombre,
          precioVenta: linea.precioUnitario,
          cantidad: linea.cantidad,
          modificadorIds: linea.modificadorIds,
          modificadoresTexto: linea.modificadoresTexto,
          observacion: linea.observacion,
        },
      ];
    });
    setConfigurando(null);
  }

  // H-37: líneas que piden más de lo que hay. Avisa, no bloquea — vender sin
  // stock puede estar permitido, y si no lo está el servidor lo dice igual.
  const excedenStock =
    stockPorProducto === null
      ? []
      : carrito
          .filter((l) => !productos.find((p) => p.id === l.productoId)?.alVender)
          .map((l) => ({ ...l, disponible: stockPorProducto[l.productoId] ?? 0 }))
          .filter((l) => l.cantidad > l.disponible);

  // Las líneas del carrito cuyo producto no tiene costo cargado (H-15).
  const sinCostoEnCarrito = carrito.filter((linea) =>
    productos.some((p) => p.id === linea.productoId && p.costoOperativoVigente === null && !p.alVender)
  );

  function cambiarCantidad(clave: string, cantidad: number) {
    setCarrito((prev) =>
      cantidad <= 0
        ? prev.filter((l) => l.clave !== clave)
        : prev.map((l) => (l.clave === clave ? { ...l, cantidad } : l))
    );
  }

  function quitarLinea(clave: string) {
    setCarrito((prev) => prev.filter((l) => l.clave !== clave));
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

  // H-51 Tanda B: una clave por intento de venta. Si el servidor recibe dos
  // veces la misma, devuelve la venta ya creada en vez de registrar otra.
  const claveIdempotenciaRef = useRef(crypto.randomUUID());

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

    if (confirmando || ventaRegistradaId) return;
    if (sinTurno) {
      setError("Para vender, primero abrí el turno de la caja.");
      return;
    }
    setConfirmando(true);
    const resultado = await registrarVentaAction(sucursalId, {
      claveIdempotencia: claveIdempotenciaRef.current,
      clienteId: clienteId !== "sin_cliente" && clienteId !== "nuevo" ? clienteId : undefined,
      clienteNuevo:
        clienteId === "nuevo"
          ? { nombre: clienteNuevoNombre, telefono: clienteNuevoTelefono || undefined }
          : undefined,
      canalVentaId,
      eventoId: eventoId !== "sin_evento" ? eventoId : undefined,
      lineas: carrito.map((l) => ({
        productoId: l.productoId,
        cantidad: l.cantidad,
        modificadorIds: l.modificadorIds.length > 0 ? l.modificadorIds : undefined,
        observacion: l.observacion || undefined,
      })),
      bonificacion: bonificacion ?? undefined,
      pagoInicial:
        metodoPagoId !== "sin_pago" && montoPagoInicial
          ? { metodoPagoId, monto: Number(montoPagoInicial) }
          : undefined,
    });
    if (!resultado.ok) {
      setConfirmando(false);
      setError(resultado.error);
      return;
    }

    // Ventas duplicadas en producción (informe del 2026-09-23): acá antes se
    // hacía setConfirmando(false) y recién después router.push, sin esperar la
    // navegación ni vaciar el carrito. Durante los 2-4 s que tarda en cargar la
    // ficha, el punto de venta quedaba igual que antes de confirmar y con el
    // botón activo, y la cajera volvía a tocar: 13 ventas duplicadas en 3 días.
    // ⛔ No volver a habilitar el botón en el camino exitoso. La venta ya está
    // guardada: lo único que queda es irse de esta pantalla.
    setCarrito([]);
    claveIdempotenciaRef.current = crypto.randomUUID();
    // La venta ya quedó. Si el stock no se movió como se esperaba, se muestra
    // antes de salir de la pantalla (antes este aviso se descartaba).
    if (resultado.data.avisosStock.length > 0) {
      const nombrePorId = new Map(carrito.map((l) => [l.productoId, l.nombre]));
      setConfirmando(false);
      setVentaConAvisos({
        ventaId: resultado.data.ventaId,
        avisos: resultado.data.avisosStock.map((a) => ({
          nombre: nombrePorId.get(a.productoId) ?? "Producto",
          mensaje: a.mensaje,
        })),
      });
      return;
    }
    setVentaRegistradaId(resultado.data.ventaId);
    router.push(`/app/ventas/${resultado.data.ventaId}`);
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {caja && (
        <div className="md:col-span-2 lg:col-span-3">
          {sinTurno ? (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-warning-bg p-4 text-sm">
              <p className="text-warning-text">
                <span className="font-medium">No hay un turno abierto en {caja.cajaNombre}.</span> Para vender, primero se
                abre el turno: así cada venta queda asociada a la caja.
              </p>
              <Link href="/app/caja" className="font-medium text-warning-text underline">
                Abrir turno
              </Link>
            </div>
          ) : caja.turnoNumero !== null ? (
            <p className="text-xs text-text-muted">
              {caja.cajaNombre} · Turno #{caja.turnoNumero} abierto
            </p>
          ) : null}
        </div>
      )}
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

        {tarjetasFiltradas.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-muted">
            Ningún producto coincide con esta búsqueda.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {tarjetasFiltradas.map((tarjeta) => {
              const primero = tarjeta.variantes[0];
              const precios = tarjeta.variantes.map((v) => Number(v.precioVenta));
              const variasVariantes = tarjeta.variantes.length > 1;
              const hayPrecios = Math.min(...precios) !== Math.max(...precios);
              return (
                <ProductPickerCard
                  key={tarjeta.clave}
                  producto={
                    variasVariantes
                      ? { ...primero, precioVenta: String(Math.min(...precios)) }
                      : primero
                  }
                  nombre={variasVariantes ? (tarjeta.grupo ?? primero.nombre) : undefined}
                  etiquetaPrecio={variasVariantes && hayPrecios ? "desde" : undefined}
                  categoriaNombre={
                    primero.categoriaId ? categoriaPorId.get(primero.categoriaId) : undefined
                  }
                  stock={
                    variasVariantes || stockPorProducto === null
                      ? null
                      : (stockPorProducto[primero.id] ?? 0)
                  }
                  onAgregar={() => tocarTarjeta(tarjeta)}
                />
              );
            })}
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
              bonificacionPct={bonificacion?.porcentaje}
            />

            {/* Fase 5: Cafiatto asume el precio. Solo se ofrece a quien tiene la capacidad. */}
            {puedeAlgunaBonificacion && carrito.length > 0 && !ventaRegistradaId && (
              bonificacion ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-warning-bg p-3 text-xs">
                  <p className="text-warning-text">
                    <span className="font-medium">Venta bonificada</span> ·{" "}
                    {ETIQUETA_MOTIVO_BONIFICACION[bonificacion.motivo].toLowerCase()}
                    {bonificacion.beneficiario ? ` (${bonificacion.beneficiario})` : ""} · {bonificacion.porcentaje}%
                  </p>
                  <button
                    type="button"
                    onClick={() => setBonificacion(null)}
                    className="font-medium text-warning-text underline"
                  >
                    Quitar
                  </button>
                </div>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={() => setBonificarAbierto(true)}>
                  Bonificar
                </Button>
              )
            )}

            {/* H-15 — avisa, NO bloquea. La venta siempre se tiene que poder
                registrar: el dueño cobrando con el cliente enfrente no puede
                quedar trabado por un dato contable. Pero este es el último
                momento en que el costo todavía se puede capturar: al
                confirmar, la línea congela su costo y no se recalcula nunca
                (regla 4), así que cargarlo mañana no repara esta venta. */}
            {sinCostoEnCarrito.length > 0 && (
              <div className="flex items-start gap-2 rounded-xl bg-warning-bg p-4">
                <AlertTriangle className="mt-1 size-4 shrink-0 text-warning-text" />
                <div className="text-xs text-text-body">
                  <p className="font-medium text-warning-text">
                    {sinCostoEnCarrito.length === 1
                      ? `"${sinCostoEnCarrito[0].nombre}" no tiene costo cargado.`
                      : `${sinCostoEnCarrito.length} productos de esta venta no tienen costo cargado.`}
                  </p>
                  <p className="mt-1">
                    Se va a contar como ganancia pura y el margen va a quedar sin calcular.
                    Podés registrar la venta igual — pero el costo de esta venta ya no se
                    puede corregir después.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                    {sinCostoEnCarrito.map((l) => (
                      <Link
                        key={l.productoId}
                        href={`/app/productos/${l.productoId}/editar`}
                        className="font-medium text-warning-text underline"
                      >
                        Cargar costo de {l.nombre}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
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
                <div className="space-y-2 pt-1.5">
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
            <div className="space-y-2">
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
              <div className="space-y-2">
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

            <div className="space-y-2">
              <Label>Pago inicial (opcional)</Label>
              {metodos.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                disabled={metodoPagoId === "sin_pago" || totalNeto <= 0}
              />
              <button
                type="button"
                onClick={() => setMetodoDialogAbierto(true)}
                className="text-xs font-medium text-primary hover:underline"
              >
                + Nuevo método de pago
              </button>
            </div>

            {excedenStock.length > 0 && !ventaConAvisos && (
              <div className="flex items-start gap-2 rounded-xl bg-warning-bg p-4">
                <AlertTriangle className="mt-1 size-4 shrink-0 text-warning-text" />
                <div className="space-y-1 text-xs text-text-body">
                  {excedenStock.map((l) => (
                    <p key={l.productoId}>
                      <span className="font-medium text-warning-text">{l.nombre}:</span> pedís {l.cantidad} y
                      hay {l.disponible}.
                    </p>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <p role="alert" className="text-xs text-error-text">
                {error}
              </p>
            )}

            {ventaRegistradaId ? (
              <div role="status" className="space-y-2 rounded-xl bg-success-bg p-4 text-center">
                <p className="text-sm font-medium text-success-text">Venta registrada. Abriendo el detalle…</p>
                <Link
                  href={`/app/ventas/${ventaRegistradaId}`}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Si no se abre, tocá acá
                </Link>
              </div>
            ) : ventaConAvisos ? (
              <div role="alert" className="space-y-3 rounded-xl bg-warning-bg p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-1 size-4 shrink-0 text-warning-text" />
                  <div className="space-y-1 text-xs text-text-body">
                    <p className="font-medium text-warning-text">La venta quedó registrada, con avisos de stock:</p>
                    {ventaConAvisos.avisos.map((a, i) => (
                      <p key={i}>
                        <span className="font-medium">{a.nombre}:</span> {a.mensaje}
                      </p>
                    ))}
                  </div>
                </div>
                <Button
                  onClick={() => router.push(`/app/ventas/${ventaConAvisos.ventaId}`)}
                  className="w-full justify-center"
                >
                  Entendido, ver la venta
                </Button>
              </div>
            ) : (
              <Button
                onClick={confirmarVenta}
                disabled={confirmando || carrito.length === 0}
                className="w-full justify-center"
              >
                {confirmando ? "Registrando..." : bonificacion ? "Confirmar venta bonificada" : "Confirmar venta"}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {bonificarAbierto && (
        <BonificarDialog
          puede={puedeBonificar}
          inicial={bonificacion}
          total={totalCarrito}
          onCerrar={() => setBonificarAbierto(false)}
          onAplicar={(b) => {
            setBonificacion(b);
            // Si no queda nada por cobrar, no hay pago inicial que cargar.
            if (b.porcentaje >= 100) {
              setMetodoPagoId("sin_pago");
              setMontoPagoInicial("");
            }
            setBonificarAbierto(false);
          }}
        />
      )}

      {configurando && (
        <ConfigurarProductoDialog
          titulo={configurando.grupo ?? configurando.variantes[0].nombre}
          variantes={configurando.variantes}
          modificadoresPorProducto={modificadoresPorProducto}
          onCerrar={() => setConfigurando(null)}
          onAgregar={agregarLinea}
        />
      )}

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
