import {
  listarSucursalesPorTenant,
  recursoPerteneceAlTenant,
  tieneCapacidadEspecial,
  tienePermiso,
} from "@/modules/identidad/actions";
import type { UsuarioConRol } from "@/modules/identidad/actions";
import {
  consultarCostoOperativo,
  consultarPrecioVenta,
  descontarStockVenta,
  registrarAjusteManualStock,
} from "@/modules/productos/actions";
import * as repo from "./repository";
import type { estadoPagoVentaEnum, origenRegistroEnum, tipoAjusteVentaEnum } from "./schema";
import { errorSignoAjuste } from "./validation";

export type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

type OrigenRegistro = (typeof origenRegistroEnum.enumValues)[number];
type EstadoPagoVenta = (typeof estadoPagoVentaEnum.enumValues)[number];
type TipoAjusteVenta = (typeof tipoAjusteVentaEnum.enumValues)[number];

/**
 * Si `valor` es solo fecha (`YYYY-MM-DD`, ej. de un `<input type="date">`),
 * ancla a mediodía UTC en vez de medianoche — `new Date("YYYY-MM-DD")` sola
 * ancla a medianoche UTC, que al mostrarse con `toLocaleDateString` en un
 * huso horario detrás de UTC (Bolivia, UTC-4 — el mercado real del
 * producto) corre un día hacia atrás. Mediodía UTC deja margen para
 * cualquier huso real (UTC-12 a UTC+13) sin cambiar de día calendario. Si
 * `valor` ya trae hora/timezone, se respeta tal cual — no es una fecha
 * "solo día".
 */
function parsearFechaVentaSoloFecha(valor: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(valor) ? new Date(`${valor}T12:00:00Z`) : new Date(valor);
}

// --- Calculos puros ---------------------------------------------------------

export function calcularSubtotal(cantidad: number, precioVentaSnapshot: number): number {
  return cantidad * precioVentaSnapshot;
}

/** Regla 5 / 4.3: comision automatica por canal o evento — null si no hay
 * porcentaje aplicable (ninguno de los dos lo define). */
export function calcularComision(
  totalVenta: number,
  porcentajeComision: number | null
): number | null {
  if (porcentajeComision === null) return null;
  return totalVenta * (porcentajeComision / 100);
}

// --- Clientes ---------------------------------------------------------

export interface DatosCliente {
  nombre: string;
  telefono?: string;
  email?: string;
}

export async function crearCliente(
  solicitante: UsuarioConRol,
  tenantId: string,
  input: DatosCliente
): Promise<Resultado<{ clienteId: string }>> {
  if (!(await tienePermiso(solicitante, tenantId, "ventas", "crear"))) {
    return { ok: false, error: "No tenés permiso para crear clientes." };
  }
  const cliente = await repo.crearCliente({ tenantId, ...input });
  return { ok: true, data: { clienteId: cliente.id } };
}

export async function actualizarCliente(
  solicitante: UsuarioConRol,
  clienteId: string,
  input: Partial<DatosCliente>
): Promise<Resultado<true>> {
  const cliente = await repo.obtenerClientePorId(clienteId);
  if (!cliente) return { ok: false, error: "Cliente no encontrado." };
  if (!(await tienePermiso(solicitante, cliente.tenantId, "ventas", "editar"))) {
    return { ok: false, error: "No tenés permiso para editar este cliente." };
  }
  await repo.actualizarCliente(clienteId, input);
  return { ok: true, data: true };
}

export async function eliminarCliente(
  solicitante: UsuarioConRol,
  clienteId: string
): Promise<Resultado<true>> {
  const cliente = await repo.obtenerClientePorId(clienteId);
  if (!cliente) return { ok: false, error: "Cliente no encontrado." };
  if (!(await tienePermiso(solicitante, cliente.tenantId, "ventas", "anular_ajustar"))) {
    return { ok: false, error: "No tenés permiso para eliminar este cliente." };
  }
  await repo.eliminarClienteSoft(clienteId);
  return { ok: true, data: true };
}

export async function listarClientes(
  solicitante: UsuarioConRol,
  tenantId: string
): Promise<Resultado<Awaited<ReturnType<typeof repo.listarClientesPorTenant>>>> {
  if (!(await tienePermiso(solicitante, tenantId, "ventas", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver clientes." };
  }
  return { ok: true, data: await repo.listarClientesPorTenant(tenantId) };
}

// --- Canal de Venta ---------------------------------------------------------

export interface DatosCanalVenta {
  nombre: string;
  porcentajeComisionDefault?: string | number;
  activo?: boolean;
}

export async function crearCanalVenta(
  solicitante: UsuarioConRol,
  tenantId: string,
  input: DatosCanalVenta
): Promise<Resultado<{ canalVentaId: string }>> {
  if (!(await tienePermiso(solicitante, tenantId, "ventas", "crear"))) {
    return { ok: false, error: "No tenés permiso para crear canales de venta." };
  }
  const canal = await repo.crearCanalVenta({
    tenantId,
    nombre: input.nombre,
    porcentajeComisionDefault:
      input.porcentajeComisionDefault !== undefined
        ? String(input.porcentajeComisionDefault)
        : undefined,
  });
  return { ok: true, data: { canalVentaId: canal.id } };
}

export async function actualizarCanalVenta(
  solicitante: UsuarioConRol,
  canalVentaId: string,
  input: Partial<DatosCanalVenta>
): Promise<Resultado<true>> {
  const canal = await repo.obtenerCanalVentaPorId(canalVentaId);
  if (!canal) return { ok: false, error: "Canal de venta no encontrado." };
  if (!(await tienePermiso(solicitante, canal.tenantId, "ventas", "editar"))) {
    return { ok: false, error: "No tenés permiso para editar este canal de venta." };
  }
  await repo.actualizarCanalVenta(canalVentaId, {
    nombre: input.nombre,
    porcentajeComisionDefault:
      input.porcentajeComisionDefault !== undefined
        ? String(input.porcentajeComisionDefault)
        : undefined,
    activo: input.activo,
  });
  return { ok: true, data: true };
}

export async function eliminarCanalVenta(
  solicitante: UsuarioConRol,
  canalVentaId: string
): Promise<Resultado<true>> {
  const canal = await repo.obtenerCanalVentaPorId(canalVentaId);
  if (!canal) return { ok: false, error: "Canal de venta no encontrado." };
  if (!(await tienePermiso(solicitante, canal.tenantId, "ventas", "anular_ajustar"))) {
    return { ok: false, error: "No tenés permiso para eliminar este canal de venta." };
  }
  await repo.eliminarCanalVentaSoft(canalVentaId);
  return { ok: true, data: true };
}

export async function listarCanalesVenta(
  solicitante: UsuarioConRol,
  tenantId: string
): Promise<Resultado<Awaited<ReturnType<typeof repo.listarCanalesVentaPorTenant>>>> {
  if (!(await tienePermiso(solicitante, tenantId, "ventas", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver canales de venta." };
  }
  return { ok: true, data: await repo.listarCanalesVentaPorTenant(tenantId) };
}

// --- Metodo de Pago ---------------------------------------------------------

export interface DatosMetodoPago {
  nombre: string;
}

export async function crearMetodoPago(
  solicitante: UsuarioConRol,
  tenantId: string,
  input: DatosMetodoPago
): Promise<Resultado<{ metodoPagoId: string }>> {
  if (!(await tienePermiso(solicitante, tenantId, "ventas", "crear"))) {
    return { ok: false, error: "No tenés permiso para crear métodos de pago." };
  }
  const metodo = await repo.crearMetodoPago({ tenantId, nombre: input.nombre });
  return { ok: true, data: { metodoPagoId: metodo.id } };
}

export async function actualizarMetodoPago(
  solicitante: UsuarioConRol,
  metodoPagoId: string,
  input: Partial<DatosMetodoPago>
): Promise<Resultado<true>> {
  const metodo = await repo.obtenerMetodoPagoPorId(metodoPagoId);
  if (!metodo) return { ok: false, error: "Método de pago no encontrado." };
  if (!(await tienePermiso(solicitante, metodo.tenantId, "ventas", "editar"))) {
    return { ok: false, error: "No tenés permiso para editar este método de pago." };
  }
  await repo.actualizarMetodoPago(metodoPagoId, { nombre: input.nombre });
  return { ok: true, data: true };
}

/** Sin eliminado_en (seccion 1.7) — la baja es el booleano activo. */
export async function desactivarMetodoPago(
  solicitante: UsuarioConRol,
  metodoPagoId: string
): Promise<Resultado<true>> {
  const metodo = await repo.obtenerMetodoPagoPorId(metodoPagoId);
  if (!metodo) return { ok: false, error: "Método de pago no encontrado." };
  if (!(await tienePermiso(solicitante, metodo.tenantId, "ventas", "anular_ajustar"))) {
    return { ok: false, error: "No tenés permiso para desactivar este método de pago." };
  }
  await repo.actualizarMetodoPago(metodoPagoId, { activo: false });
  return { ok: true, data: true };
}

/** Simétrico a desactivarMetodoPago — sin eliminado_en (seccion 1.7), la
 * reactivacion tambien es solo el booleano activo. */
export async function reactivarMetodoPago(
  solicitante: UsuarioConRol,
  metodoPagoId: string
): Promise<Resultado<true>> {
  const metodo = await repo.obtenerMetodoPagoPorId(metodoPagoId);
  if (!metodo) return { ok: false, error: "Método de pago no encontrado." };
  if (!(await tienePermiso(solicitante, metodo.tenantId, "ventas", "editar"))) {
    return { ok: false, error: "No tenés permiso para reactivar este método de pago." };
  }
  await repo.actualizarMetodoPago(metodoPagoId, { activo: true });
  return { ok: true, data: true };
}

export async function listarMetodosPago(
  solicitante: UsuarioConRol,
  tenantId: string
): Promise<Resultado<Awaited<ReturnType<typeof repo.listarMetodosPagoPorTenant>>>> {
  if (!(await tienePermiso(solicitante, tenantId, "ventas", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver métodos de pago." };
  }
  return { ok: true, data: await repo.listarMetodosPagoPorTenant(tenantId) };
}

// --- Eventos ---------------------------------------------------------
// Gateados por la capacidad especial "gestionar_eventos" (seccion 1.6), no
// por la matriz generica "ventas" — cualquiera con permiso crear en Ventas
// puede VENDER dentro de un evento abierto, pero abrir/editar comision/
// cerrar/reabrir exige especificamente esta capacidad.

export interface DatosEvento {
  sucursalId: string;
  canalVentaId: string;
  nombre: string;
  porcentajeComision?: string | number;
  fechaInicio: string;
  fechaFin: string;
}

async function requiereGestionarEventos(
  solicitante: UsuarioConRol
): Promise<{ ok: false; error: string } | null> {
  if (!(await tieneCapacidadEspecial(solicitante, "gestionar_eventos"))) {
    return { ok: false, error: "No tenés la capacidad para gestionar eventos." };
  }
  return null;
}

export async function abrirEvento(
  solicitante: UsuarioConRol,
  tenantId: string,
  input: DatosEvento
): Promise<Resultado<{ eventoId: string }>> {
  const bloqueo = await requiereGestionarEventos(solicitante);
  if (bloqueo) return bloqueo;
  // requiereGestionarEventos solo chequea la capacidad (tenant-ciega) — hay
  // que atar el tenantId elegido al del solicitante para que un Owner no cree
  // eventos en otro tenant (auditoría de autorización).
  if (!recursoPerteneceAlTenant(solicitante, tenantId)) {
    return { ok: false, error: "No tenés permiso para gestionar eventos." };
  }

  // Se precarga con el default del canal si no se especifica (seccion 1.6).
  let porcentajeComision = input.porcentajeComision;
  if (porcentajeComision === undefined) {
    const canal = await repo.obtenerCanalVentaPorId(input.canalVentaId);
    porcentajeComision = canal?.porcentajeComisionDefault ?? undefined;
  }

  const evento = await repo.crearEvento({
    tenantId,
    sucursalId: input.sucursalId,
    canalVentaId: input.canalVentaId,
    nombre: input.nombre,
    porcentajeComision:
      porcentajeComision !== undefined ? String(porcentajeComision) : undefined,
    fechaInicio: new Date(input.fechaInicio),
    fechaFin: new Date(input.fechaFin),
    estado: "abierto",
    creadoPor: solicitante.id,
  });
  return { ok: true, data: { eventoId: evento.id } };
}

export async function actualizarComisionEvento(
  solicitante: UsuarioConRol,
  eventoId: string,
  nuevoPorcentaje: string | number
): Promise<Resultado<true>> {
  const bloqueo = await requiereGestionarEventos(solicitante);
  if (bloqueo) return bloqueo;

  const evento = await repo.obtenerEventoPorId(eventoId);
  // El evento debe ser del tenant del solicitante — sin esto, cualquier Owner
  // (que pasa la capacidad gestionar_eventos) podía cerrar/reabrir/re-comisionar
  // eventos de otro tenant pasando un eventoId ajeno (auditoría de autorización).
  if (!evento || !recursoPerteneceAlTenant(solicitante, evento.tenantId)) {
    return { ok: false, error: "Evento no encontrado." };
  }

  await repo.actualizarEvento(eventoId, { porcentajeComision: String(nuevoPorcentaje) });
  return { ok: true, data: true };
}

export async function cerrarEvento(
  solicitante: UsuarioConRol,
  eventoId: string
): Promise<Resultado<true>> {
  const bloqueo = await requiereGestionarEventos(solicitante);
  if (bloqueo) return bloqueo;

  const evento = await repo.obtenerEventoPorId(eventoId);
  // El evento debe ser del tenant del solicitante — sin esto, cualquier Owner
  // (que pasa la capacidad gestionar_eventos) podía cerrar/reabrir/re-comisionar
  // eventos de otro tenant pasando un eventoId ajeno (auditoría de autorización).
  if (!evento || !recursoPerteneceAlTenant(solicitante, evento.tenantId)) {
    return { ok: false, error: "Evento no encontrado." };
  }

  await repo.actualizarEvento(eventoId, {
    estado: "cerrado",
    cerradoPor: solicitante.id,
    cerradoEn: new Date(),
  });
  return { ok: true, data: true };
}

/** Reabrir es una accion auditada (seccion 4.1) — no limpia cerrado_por/
 * cerrado_en del cierre anterior, queda como rastro de que ya se habia
 * cerrado una vez. */
export async function reabrirEvento(
  solicitante: UsuarioConRol,
  eventoId: string
): Promise<Resultado<true>> {
  const bloqueo = await requiereGestionarEventos(solicitante);
  if (bloqueo) return bloqueo;

  const evento = await repo.obtenerEventoPorId(eventoId);
  // El evento debe ser del tenant del solicitante — sin esto, cualquier Owner
  // (que pasa la capacidad gestionar_eventos) podía cerrar/reabrir/re-comisionar
  // eventos de otro tenant pasando un eventoId ajeno (auditoría de autorización).
  if (!evento || !recursoPerteneceAlTenant(solicitante, evento.tenantId)) {
    return { ok: false, error: "Evento no encontrado." };
  }

  await repo.actualizarEvento(eventoId, { estado: "abierto" });
  return { ok: true, data: true };
}

export async function listarEventos(
  solicitante: UsuarioConRol,
  tenantId: string
): Promise<Resultado<Awaited<ReturnType<typeof repo.listarEventosPorTenant>>>> {
  if (!(await tienePermiso(solicitante, tenantId, "ventas", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver eventos." };
  }
  return { ok: true, data: await repo.listarEventosPorTenant(tenantId) };
}

// --- Ventas ---------------------------------------------------------

export interface DatosLineaVenta {
  productoId: string;
  cantidad: string | number;
}

export interface DatosVenta {
  sucursalId: string;
  clienteId?: string;
  clienteNuevo?: DatosCliente;
  fechaVenta?: string;
  canalVentaId: string;
  eventoId?: string;
  lineas: DatosLineaVenta[];
  pagoInicial?: { metodoPagoId: string; monto: string | number };
  origenRegistro?: Extract<OrigenRegistro, "en_vivo" | "offline_sincronizado">;
}

/**
 * Registra la venta: snapshot doble por linea, descuenta stock real en
 * Productos e Inventario, calcula y persiste la comision (por evento o por
 * canal), y opcionalmente registra el primer pago. El descuento de stock
 * ocurre DESPUES de confirmar la Venta (necesita su id como referencia) —
 * mismo gap de atomicidad cruzada ya documentado y aceptado en Modulo 6.
 */
export async function registrarVenta(
  solicitante: UsuarioConRol,
  tenantId: string,
  input: DatosVenta
): Promise<
  Resultado<{
    ventaId: string;
    totalVenta: number;
    comisionMontoCalculado: number | null;
    descuentosStock: Array<Awaited<ReturnType<typeof descontarStockVenta>>>;
  }>
> {
  if (!(await tienePermiso(solicitante, tenantId, "ventas", "crear"))) {
    return { ok: false, error: "No tenés permiso para registrar ventas." };
  }
  if (input.lineas.length === 0) {
    return { ok: false, error: "La venta necesita al menos una línea de producto." };
  }

  // input.sucursalId no se revalidaba contra el tenant (auditoría de
  // autorización, docs/security/AUDITORIA-AUTORIZACION.md §8.3) — sin esto,
  // una Venta podía quedar registrada en el tenant propio pero apuntando a
  // una sucursal de OTRO tenant (contaminación de FK, mismo patrón ya
  // corregido en Patrimonio/Proveedores).
  const sucursalesRes = await listarSucursalesPorTenant(solicitante, tenantId);
  if (!sucursalesRes.ok || !sucursalesRes.data.some((s) => s.id === input.sucursalId)) {
    return { ok: false, error: "La sucursal indicada no existe en este negocio." };
  }

  // Regla 4: alta implicita de cliente.
  let clienteId = input.clienteId ?? null;
  if (!clienteId && input.clienteNuevo) {
    const cliente = await repo.crearCliente({ tenantId, ...input.clienteNuevo });
    clienteId = cliente.id;
  }

  const fechaVenta = input.fechaVenta ? parsearFechaVentaSoloFecha(input.fechaVenta) : new Date();

  type LineaSnapshot = {
    productoId: string;
    cantidad: string;
    precioVentaSnapshot: string;
    costoUnitarioSnapshot: string;
    subtotal: string;
  };

  // Snapshot doble (regla 1) — se congela ANTES de crear la Venta. Cada
  // línea consulta precio/costo de un producto propio, sin depender de las
  // demás (tope chico: líneas de UNA venta) — se resuelven en paralelo.
  const resultadosLineas = await Promise.all(
    input.lineas.map(async (linea): Promise<Resultado<LineaSnapshot>> => {
      const precio = await consultarPrecioVenta(solicitante, linea.productoId);
      if (!precio.ok) return precio;
      const costo = await consultarCostoOperativo(solicitante, linea.productoId);
      if (!costo.ok) return costo;

      const cantidad = Number(linea.cantidad);
      const subtotal = calcularSubtotal(cantidad, precio.data.precioVenta);
      return {
        ok: true,
        data: {
          productoId: linea.productoId,
          cantidad: String(cantidad),
          precioVentaSnapshot: String(precio.data.precioVenta),
          costoUnitarioSnapshot: String(costo.data.costoOperativoVigente ?? 0),
          subtotal: String(subtotal),
        },
      };
    })
  );
  // Preserva el comportamiento del for secuencial que reemplaza: el primer
  // error en el orden original de las líneas es el que se devuelve.
  const primerError = resultadosLineas.find((r) => !r.ok);
  if (primerError) return primerError;
  const lineas = resultadosLineas
    .filter((r): r is { ok: true; data: LineaSnapshot } => r.ok)
    .map((r) => r.data);
  const totalVenta = lineas.reduce((acc, l) => acc + Number(l.subtotal), 0);

  // Regla 5 / 4.3: comision por Evento si hay, si no por Canal.
  let porcentajeComision: number | null = null;
  if (input.eventoId) {
    const evento = await repo.obtenerEventoPorId(input.eventoId);
    porcentajeComision = evento?.porcentajeComision ? Number(evento.porcentajeComision) : null;
  } else {
    const canal = await repo.obtenerCanalVentaPorId(input.canalVentaId);
    porcentajeComision = canal?.porcentajeComisionDefault
      ? Number(canal.porcentajeComisionDefault)
      : null;
  }
  const comisionMontoCalculado = calcularComision(totalVenta, porcentajeComision);

  const { venta } = await repo.crearVentaConDetalleTx({
    venta: {
      tenantId,
      sucursalId: input.sucursalId,
      clienteId,
      fechaVenta,
      canalVentaId: input.canalVentaId,
      eventoId: input.eventoId,
      origenRegistro: input.origenRegistro ?? "en_vivo",
      comisionPorcentajeAplicado:
        porcentajeComision !== null ? String(porcentajeComision) : undefined,
      comisionMontoCalculado:
        comisionMontoCalculado !== null ? String(comisionMontoCalculado) : undefined,
      creadoPor: solicitante.id,
    },
    lineas,
  });

  const descuentosStock: Array<Awaited<ReturnType<typeof descontarStockVenta>>> = [];
  // Secuencial a propósito: descontarStockVenta lee el stock disponible y
  // recién después inserta el movimiento (no es atómico) — si dos líneas de
  // esta misma venta comparten producto+sucursal, paralelizarlo dejaría que
  // ambas lean el mismo disponible y sobregiren el stock.
  for (const linea of lineas) {
    const descuento = await descontarStockVenta(solicitante, tenantId, {
      productoId: linea.productoId,
      sucursalId: input.sucursalId,
      cantidad: linea.cantidad,
      referenciaId: venta.id,
    });
    descuentosStock.push(descuento);
  }

  if (input.pagoInicial) {
    await repo.registrarPagoVentaTx({
      ventaId: venta.id,
      monto: String(input.pagoInicial.monto),
      metodoPagoId: input.pagoInicial.metodoPagoId,
      fechaPago: fechaVenta,
      creadoPor: solicitante.id,
    });
  }

  return {
    ok: true,
    data: { ventaId: venta.id, totalVenta, comisionMontoCalculado, descuentosStock },
  };
}

export interface DatosAjusteVenta {
  tipo: TipoAjusteVenta;
  montoAjuste: string | number;
  productoId?: string;
  cantidadProductoAjustada?: string | number;
  motivo: string;
  // Regla 7: solo si la devolucion implica entrega real de efectivo — la
  // distincion la marca quien registra el ajuste.
  generaPagoNegativo?: boolean;
  metodoPagoId?: string;
}

/** Nunca edita la Venta original (regla 2). Si cantidadProductoAjustada
 * viene, dispara un entrada_ajuste_manual real en Productos e Inventario
 * (caso borde 2) — requiere productoId (adenda de este modulo, ver ANCLA). */
export async function registrarAjusteVenta(
  solicitante: UsuarioConRol,
  ventaId: string,
  input: DatosAjusteVenta
): Promise<
  Resultado<{
    ajusteId: string;
    ajusteStock: Awaited<ReturnType<typeof registrarAjusteManualStock>> | null;
  }>
> {
  const venta = await repo.obtenerVentaPorId(ventaId);
  if (!venta) return { ok: false, error: "Venta no encontrada." };
  if (!(await tienePermiso(solicitante, venta.tenantId, "ventas", "anular_ajustar"))) {
    return { ok: false, error: "No tenés permiso para ajustar esta venta." };
  }
  if (!input.motivo.trim()) {
    return { ok: false, error: "El motivo del ajuste es obligatorio." };
  }
  // El signo importa: el estado de resultados suma los ajustes, asi que un
  // ajuste reductor cargado en positivo infla el resultado en vez de
  // reducirlo. Se valida aca ademas de en el schema de la ruta porque esta
  // funcion es la superficie publica del modulo — la llaman tests, seeds y
  // cualquier otro modulo, no solo la Server Action.
  const errorSigno = errorSignoAjuste(input.tipo, Number(input.montoAjuste));
  if (errorSigno) return { ok: false, error: errorSigno };
  if (input.cantidadProductoAjustada !== undefined && !input.productoId) {
    return {
      ok: false,
      error: "Un ajuste que devuelve stock necesita indicar el producto afectado.",
    };
  }
  if (
    input.generaPagoNegativo &&
    (input.tipo !== "devolucion" || !input.metodoPagoId)
  ) {
    return {
      ok: false,
      error: "Un pago negativo solo aplica a devoluciones, e indicando el método de pago.",
    };
  }

  const { ajuste } = await repo.crearAjusteVentaTx({
    ajuste: {
      ventaId,
      tipo: input.tipo,
      montoAjuste: String(input.montoAjuste),
      productoId: input.productoId,
      cantidadProductoAjustada:
        input.cantidadProductoAjustada !== undefined
          ? String(input.cantidadProductoAjustada)
          : undefined,
      motivo: input.motivo,
      creadoPor: solicitante.id,
    },
    pagoNegativo:
      input.generaPagoNegativo && input.metodoPagoId
        ? {
            monto: String(-Math.abs(Number(input.montoAjuste))),
            metodoPagoId: input.metodoPagoId,
            fechaPago: new Date(),
            creadoPor: solicitante.id,
          }
        : undefined,
  });

  let ajusteStock: Awaited<ReturnType<typeof registrarAjusteManualStock>> | null = null;
  if (input.cantidadProductoAjustada !== undefined && input.productoId) {
    ajusteStock = await registrarAjusteManualStock(solicitante, venta.tenantId, {
      productoId: input.productoId,
      sucursalId: venta.sucursalId,
      tipo: "entrada_ajuste_manual",
      cantidad: input.cantidadProductoAjustada,
      motivo: `Ajuste de Venta ${ventaId}: ${input.motivo}`,
    });
  }

  return { ok: true, data: { ajusteId: ajuste.id, ajusteStock } };
}

export async function registrarPagoVenta(
  solicitante: UsuarioConRol,
  ventaId: string,
  input: { monto: string | number; metodoPagoId: string; fechaPago?: string }
): Promise<Resultado<{ estadoPago: EstadoPagoVenta; totalPagado: number }>> {
  const venta = await repo.obtenerVentaPorId(ventaId);
  if (!venta) return { ok: false, error: "Venta no encontrada." };
  if (!(await tienePermiso(solicitante, venta.tenantId, "ventas", "crear"))) {
    return { ok: false, error: "No tenés permiso para registrar pagos en esta venta." };
  }

  const { estadoPago, totalPagado } = await repo.registrarPagoVentaTx({
    ventaId,
    monto: String(input.monto),
    metodoPagoId: input.metodoPagoId,
    fechaPago: input.fechaPago ? new Date(input.fechaPago) : new Date(),
    creadoPor: solicitante.id,
  });

  return { ok: true, data: { estadoPago, totalPagado } };
}

export async function listarVentas(
  solicitante: UsuarioConRol,
  tenantId: string
): Promise<Resultado<Awaited<ReturnType<typeof repo.listarVentasPorTenant>>>> {
  if (!(await tienePermiso(solicitante, tenantId, "ventas", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver ventas." };
  }
  return { ok: true, data: await repo.listarVentasPorTenant(tenantId) };
}

/** listarVentas() no trae el total por fila (Venta no persiste un
 * monto_total propio) — este wrapper lo agrega llamando obtenerTotalVenta
 * por fila, mismo criterio que listarSucursalesPorTenant/
 * listarMovimientosStock agregados esta sesion. */
export async function listarVentasConTotal(
  solicitante: UsuarioConRol,
  tenantId: string
): Promise<Resultado<Array<Awaited<ReturnType<typeof repo.listarVentasPorTenant>>[number] & { total: number }>>> {
  if (!(await tienePermiso(solicitante, tenantId, "ventas", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver ventas." };
  }
  const ventas = await repo.listarVentasPorTenant(tenantId);
  const totales = await Promise.all(ventas.map((v) => repo.obtenerTotalVenta(v.id)));
  return {
    ok: true,
    data: ventas.map((venta, i) => ({ ...venta, total: totales[i] })),
  };
}

export async function fichaVenta(
  solicitante: UsuarioConRol,
  ventaId: string
): Promise<
  Resultado<{
    venta: Awaited<ReturnType<typeof repo.obtenerVentaPorId>>;
    detalles: Awaited<ReturnType<typeof repo.obtenerDetallesVenta>>;
    pagos: Awaited<ReturnType<typeof repo.listarPagosPorVenta>>;
    ajustes: Awaited<ReturnType<typeof repo.listarAjustesPorVenta>>;
    totalVenta: number;
  }>
> {
  const venta = await repo.obtenerVentaPorId(ventaId);
  if (!venta) return { ok: false, error: "Venta no encontrada." };
  if (!(await tienePermiso(solicitante, venta.tenantId, "ventas", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver esta venta." };
  }

  const [detalles, pagos, ajustes, totalVenta] = await Promise.all([
    repo.obtenerDetallesVenta(ventaId),
    repo.listarPagosPorVenta(ventaId),
    repo.listarAjustesPorVenta(ventaId),
    repo.obtenerTotalVenta(ventaId),
  ]);

  return { ok: true, data: { venta, detalles, pagos, ajustes, totalVenta } };
}

// --- Importacion de Historial (seccion 6.2) ---------------------------------------------------------

export interface DatosLineaVentaHistorica {
  productoId: string;
  cantidad: string | number;
  precioVentaSnapshot: string | number;
  costoUnitarioSnapshot: string | number;
}

export interface DatosVentaHistorica {
  sucursalId: string;
  clienteId?: string;
  fechaVenta: string;
  canalVentaId: string;
  lineas: DatosLineaVentaHistorica[];
}

/**
 * Carga masiva de historial viejo (caso borde 4) — restringida a Owner o
 * capacidad importar_historico. A diferencia de registrarVenta: NO consulta
 * ni descuenta stock en Productos e Inventario (el producto podría ya no
 * existir), NO calcula comision, y los snapshots vienen directo del input
 * en vez de consultarse en vivo — es carga de datos de referencia, no una
 * transaccion nueva.
 */
export async function importarVentaHistorica(
  solicitante: UsuarioConRol,
  tenantId: string,
  input: DatosVentaHistorica
): Promise<Resultado<{ ventaId: string; totalVenta: number }>> {
  if (
    !solicitante.esOwner &&
    !(await tieneCapacidadEspecial(solicitante, "importar_historico"))
  ) {
    return {
      ok: false,
      error: "No tenés permiso para importar historial de ventas.",
    };
  }
  if (input.lineas.length === 0) {
    return { ok: false, error: "La importación necesita al menos una línea de producto." };
  }

  const lineas = input.lineas.map((linea) => {
    const cantidad = Number(linea.cantidad);
    const precioVentaSnapshot = Number(linea.precioVentaSnapshot);
    return {
      productoId: linea.productoId,
      cantidad: String(cantidad),
      precioVentaSnapshot: String(precioVentaSnapshot),
      costoUnitarioSnapshot: String(linea.costoUnitarioSnapshot),
      subtotal: String(calcularSubtotal(cantidad, precioVentaSnapshot)),
    };
  });
  const totalVenta = lineas.reduce((acc, l) => acc + Number(l.subtotal), 0);

  const { venta } = await repo.crearVentaConDetalleTx({
    venta: {
      tenantId,
      sucursalId: input.sucursalId,
      clienteId: input.clienteId,
      fechaVenta: parsearFechaVentaSoloFecha(input.fechaVenta),
      canalVentaId: input.canalVentaId,
      origenRegistro: "importacion_historica",
      creadoPor: solicitante.id,
    },
    lineas,
  });

  return { ok: true, data: { ventaId: venta.id, totalVenta } };
}

// --- Agregados por periodo (Modulo_07 - Financiero, seccion 2) ---------------------------------------------------------
// Financiero no tiene tablas propias — consume Ventas exclusivamente via
// estas funciones (caja negra), nunca importando detalles_venta/ventas
// directo.

export interface PeriodoConsulta {
  desde: string;
  hasta: string;
}

export async function consultarIngresosPeriodo(
  solicitante: UsuarioConRol,
  tenantId: string,
  periodo: PeriodoConsulta,
  opts: { sucursalId?: string; productoId?: string } = {}
): Promise<Resultado<{ ingresos: number; costos: number }>> {
  if (!(await tienePermiso(solicitante, tenantId, "ventas", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver ventas." };
  }
  const { ingresos, costos } = await repo.sumarIngresosCostosPeriodo(
    tenantId,
    new Date(periodo.desde),
    new Date(periodo.hasta),
    opts
  );
  return { ok: true, data: { ingresos, costos } };
}

/** Rotación de un producto en un período — roadmap ítem #13 (Simulaciones,
 * sección 1.1: "rotación del último período"). */
export async function consultarUnidadesVendidasPeriodo(
  solicitante: UsuarioConRol,
  tenantId: string,
  productoId: string,
  periodo: PeriodoConsulta,
  opts: { sucursalId?: string } = {}
): Promise<Resultado<{ unidadesVendidas: number }>> {
  if (!(await tienePermiso(solicitante, tenantId, "ventas", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver ventas." };
  }
  const unidadesVendidas = await repo.sumarUnidadesVendidasPeriodo(
    tenantId,
    productoId,
    new Date(periodo.desde),
    new Date(periodo.hasta),
    opts
  );
  return { ok: true, data: { unidadesVendidas } };
}

// --- Reportes (Modulo_10, seccion 2.1) ---------------------------------------------------------
// Reportes no tiene tablas propias — estas tres funciones son la unica
// forma de que consuma "solo lectura" a Ventas sin importar sus tablas
// directo. Devuelven ingresos/costos crudos, NO margenPct calculado: Ventas
// no puede importar calcularMargenPorcentaje() de Financiero sin crear un
// ciclo (Financiero ya importa Ventas) — Reportes, que ya importa ambos
// sin ciclo, es quien calcula el margen% final para mostrar. El criterio
// "margen" de rankingProductos sí ordena por margen acá (ratio interno de
// ordenamiento, no la formula de negocio reutilizable).

export async function rankingProductos(
  solicitante: UsuarioConRol,
  tenantId: string,
  periodo: PeriodoConsulta,
  opts: { canalVentaId?: string; criterio: "rotacion" | "margen" }
): Promise<
  Resultado<Array<{ productoId: string; unidadesVendidas: number; ingresos: number; costos: number }>>
> {
  if (!(await tienePermiso(solicitante, tenantId, "ventas", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver ventas." };
  }
  const filas = await repo.listarRankingProductos(
    tenantId,
    new Date(periodo.desde),
    new Date(periodo.hasta),
    { canalVentaId: opts.canalVentaId }
  );

  const ordenadas = [...filas].sort((a, b) => {
    if (opts.criterio === "rotacion") return b.unidadesVendidas - a.unidadesVendidas;
    const margenA = a.ingresos !== 0 ? (a.ingresos - a.costos) / a.ingresos : -Infinity;
    const margenB = b.ingresos !== 0 ? (b.ingresos - b.costos) / b.ingresos : -Infinity;
    return margenB - margenA;
  });

  return { ok: true, data: ordenadas };
}

/** Separa ventas regulares de las de evento (regla ya fijada en este
 * módulo: no distorsionar el histórico regular con volumen de feria). */
export async function historicoVentas(
  solicitante: UsuarioConRol,
  tenantId: string,
  periodo: PeriodoConsulta,
  opts: { incluirEventos: boolean }
): Promise<Resultado<Awaited<ReturnType<typeof repo.listarHistoricoVentas>>>> {
  if (!(await tienePermiso(solicitante, tenantId, "ventas", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver ventas." };
  }
  const filas = await repo.listarHistoricoVentas(
    tenantId,
    new Date(periodo.desde),
    new Date(periodo.hasta),
    opts
  );
  return { ok: true, data: filas };
}

export async function margenPorCanalYProducto(
  solicitante: UsuarioConRol,
  tenantId: string,
  periodo: PeriodoConsulta
): Promise<Resultado<Awaited<ReturnType<typeof repo.listarMargenPorCanalYProducto>>>> {
  if (!(await tienePermiso(solicitante, tenantId, "ventas", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver ventas." };
  }
  const filas = await repo.listarMargenPorCanalYProducto(
    tenantId,
    new Date(periodo.desde),
    new Date(periodo.hasta)
  );
  return { ok: true, data: filas };
}

export async function consultarPagosVentaEnPeriodo(
  solicitante: UsuarioConRol,
  tenantId: string,
  periodo: PeriodoConsulta,
  opts: { sucursalId?: string } = {}
): Promise<Resultado<{ totalPagado: number }>> {
  if (!(await tienePermiso(solicitante, tenantId, "ventas", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver ventas." };
  }
  const totalPagado = await repo.sumarPagosVentaPeriodo(
    tenantId,
    new Date(periodo.desde),
    new Date(periodo.hasta),
    opts
  );
  return { ok: true, data: { totalPagado } };
}

export async function consultarAjustesVentaEnPeriodo(
  solicitante: UsuarioConRol,
  tenantId: string,
  periodo: PeriodoConsulta,
  opts: { sucursalId?: string; productoId?: string } = {}
): Promise<Resultado<{ totalAjustes: number }>> {
  if (!(await tienePermiso(solicitante, tenantId, "ventas", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver ventas." };
  }
  const totalAjustes = await repo.sumarAjustesVentaPeriodo(
    tenantId,
    new Date(periodo.desde),
    new Date(periodo.hasta),
    opts
  );
  return { ok: true, data: { totalAjustes } };
}
