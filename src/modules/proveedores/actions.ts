import { comoUsuario, ContextoRlsNoResueltoError } from "@/db/contexto";
// Excepcion deliberada y acotada -- SOLO para el fallback de
// consultarPagosCompraEnPeriodo cuando comoUsuario() no puede resolver
// contexto. Desde la Etapa 4.a (docs/security/PLAN-RLS-BACKSTOP.md
// §13/§15.3) el solicitante del Gateway ya tiene fila real, asi que este
// fallback ya no dispara en la practica para ese camino -- queda como
// defensa en profundidad para cualquier OTRO solicitante que no resuelva
// contexto, ver el comentario junto a esa funcion y contexto.test.ts
// (ALLOWLIST_IMPORTA_DB_CRUDO). Ningun otro uso de "db" es valido en este
// archivo -- todo lo demas pasa por comoUsuario().
import { db } from "@/db/client";
import { registrarEntradaCompraInsumo } from "@/modules/operativo/nichos/nicho-1/actions";
import { tienePermiso } from "@/modules/identidad/actions";
import type { UsuarioConRol } from "@/modules/identidad/actions";
import { registrarEntradaCompraReventa } from "@/modules/productos/actions";
import * as repo from "./repository";
import type {
  estadoCompraEnum,
  estadoPagoCompraEnum,
  tipoAjusteCompraEnum,
  tipoCompraEnum,
} from "./schema";

export type Resultado<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type TipoCompra = (typeof tipoCompraEnum.enumValues)[number];
type EstadoCompra = (typeof estadoCompraEnum.enumValues)[number];
type EstadoPagoCompra = (typeof estadoPagoCompraEnum.enumValues)[number];
type TipoAjusteCompra = (typeof tipoAjusteCompraEnum.enumValues)[number];

/** costo_unitario = (monto_total + costo_adicional_traslado) / cantidad
 * (Modulo_08 seccion 1.2, adenda Landed Cost simple — Modulo_08 seccion 6 /
 * roadmap item #12) — se calcula una sola vez al registrar la Compra, nunca
 * se edita despues (correcciones van por Compra de Ajuste). Sin costo
 * adicional, es exactamente la formula original. */
export function calcularCostoUnitario(
  montoTotal: string | number,
  cantidad: string | number,
  costoAdicionalTraslado: string | number | null = null
): number {
  const adicional = costoAdicionalTraslado ? Number(costoAdicionalTraslado) : 0;
  return (Number(montoTotal) + adicional) / Number(cantidad);
}

// --- Proveedores ---------------------------------------------------------

export interface DatosProveedor {
  nombre: string;
  contacto?: string;
  notas?: string;
}

export async function crearProveedor(
  solicitante: UsuarioConRol,
  tenantId: string,
  input: DatosProveedor
): Promise<Resultado<{ proveedorId: string }>> {
  if (!(await tienePermiso(solicitante, tenantId, "proveedores", "crear"))) {
    return { ok: false, error: "No tenés permiso para crear proveedores." };
  }

  return comoUsuario(solicitante.id, async (tx) => {
    const proveedor = await repo.crearProveedor(tx, {
      tenantId,
      nombre: input.nombre,
      contacto: input.contacto,
      notas: input.notas,
      creadoPor: solicitante.id,
    });

    return { ok: true, data: { proveedorId: proveedor.id } };
  });
}

export async function actualizarProveedor(
  solicitante: UsuarioConRol,
  proveedorId: string,
  input: Partial<DatosProveedor>
): Promise<Resultado<true>> {
  return comoUsuario(solicitante.id, async (tx) => {
    const proveedor = await repo.obtenerProveedorPorId(tx, proveedorId);
    if (!proveedor) return { ok: false, error: "Proveedor no encontrado." };
    if (
      !(await tienePermiso(solicitante, proveedor.tenantId, "proveedores", "editar"))
    ) {
      return { ok: false, error: "No tenés permiso para editar este proveedor." };
    }

    await repo.actualizarProveedor(tx, proveedorId, input);
    return { ok: true, data: true };
  });
}

export async function eliminarProveedor(
  solicitante: UsuarioConRol,
  proveedorId: string
): Promise<Resultado<true>> {
  return comoUsuario(solicitante.id, async (tx) => {
    const proveedor = await repo.obtenerProveedorPorId(tx, proveedorId);
    if (!proveedor) return { ok: false, error: "Proveedor no encontrado." };
    if (
      !(await tienePermiso(
        solicitante,
        proveedor.tenantId,
        "proveedores",
        "anular_ajustar"
      ))
    ) {
      return { ok: false, error: "No tenés permiso para eliminar este proveedor." };
    }

    await repo.eliminarProveedorSoft(tx, proveedorId);
    return { ok: true, data: true };
  });
}

export async function listarProveedores(
  solicitante: UsuarioConRol,
  tenantId: string
): Promise<Resultado<Awaited<ReturnType<typeof repo.listarProveedoresPorTenant>>>> {
  if (!(await tienePermiso(solicitante, tenantId, "proveedores", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver proveedores." };
  }
  return comoUsuario(solicitante.id, async (tx) => ({
    ok: true,
    data: await repo.listarProveedoresPorTenant(tx, tenantId),
  }));
}

/** ficha_proveedor(proveedor_id) — resumen de compras a ese proveedor
 * (Modulo_08 seccion 2). */
export async function fichaProveedor(
  solicitante: UsuarioConRol,
  proveedorId: string
): Promise<Resultado<{
  proveedor: Awaited<ReturnType<typeof repo.obtenerProveedorPorId>>;
  cantidadCompras: number;
  montoTotalComprado: number;
  compras: Awaited<ReturnType<typeof repo.listarComprasPorProveedor>>;
}>> {
  return comoUsuario(solicitante.id, async (tx) => {
    const proveedor = await repo.obtenerProveedorPorId(tx, proveedorId);
    if (!proveedor) return { ok: false, error: "Proveedor no encontrado." };
    if (!(await tienePermiso(solicitante, proveedor.tenantId, "proveedores", "ver"))) {
      return { ok: false, error: "No tenés permiso para ver este proveedor." };
    }

    const [resumen, comprasDelProveedor] = await Promise.all([
      repo.resumenComprasPorProveedor(tx, proveedorId),
      repo.listarComprasPorProveedor(tx, proveedorId),
    ]);

    return {
      ok: true,
      data: {
        proveedor,
        cantidadCompras: resumen.cantidadCompras,
        montoTotalComprado: Number(resumen.montoTotalComprado),
        compras: comprasDelProveedor,
      },
    };
  });
}

// --- Compras ---------------------------------------------------------

export interface DatosCompra {
  sucursalId: string;
  proveedorId?: string;
  tipo: TipoCompra;
  // Exactamente uno segun "tipo" — validado abajo, reforzado por el CHECK
  // de la base (roadmap item #12: cierra el pendiente de item_id sin FK).
  insumoId?: string;
  productoId?: string;
  cantidad: string | number;
  montoTotal: string | number;
  costoAdicionalTraslado?: string | number;
  fechaCompra: string;
  fechaVencimiento?: string;
  // "recibido" (default) preserva el comportamiento historico: la Compra
  // ya representa mercaderia que entro. "pedido" es el flujo de Orden de
  // Compra (Modulo_08 seccion 6) — recien entra a inventario al llamar
  // recibirCompra().
  estado?: EstadoCompra;
}

export interface DatosEntradaStock {
  ok: boolean;
  error?: string;
}

/**
 * Dispara la entrada de stock real segun tipo — Modulo 2 (reventa) o
 * Operativo Nicho 1 (insumo). Mismo criterio de "gap de atomicidad cruzada
 * aceptado a proposito" que Ventas/Producción (Módulos 3/6): si esta
 * llamada falla, la Compra ya quedó "recibido" igual — el caller detecta el
 * error en el resultado y reintenta a mano.
 *
 * Frontera con un módulo no migrado (docs/security/PLAN-RLS-BACKSTOP.md,
 * Etapa 2): Productos/Nicho-1 todavía usan `db` crudo internamente (no
 * reciben `tx`), así que esta llamada NO hereda el contexto de RLS ni la
 * transacción abierta por `comoUsuario()` — abre su propia conexión con rol
 * bypass (verificado empíricamente, no solo razonado, ver el plan). Esto no
 * es una regresión de seguridad (esos módulos ya corrían así antes de esta
 * migración), pero sí es la primera vez que una escritura de un módulo ya
 * migrado puede committear del otro lado ANTES de que la transacción
 * externa (`registrarCompra`/`recibirCompra`) haga su propio commit — hoy
 * el riesgo es despreciable porque nada después de esta llamada puede
 * fallar, pero el patrón para las once etapas restantes queda documentado
 * en el plan, no resuelto acá.
 */
async function dispararEntradaStock(
  solicitante: UsuarioConRol,
  tenantId: string,
  compra: NonNullable<Awaited<ReturnType<typeof repo.obtenerCompraPorId>>>
): Promise<DatosEntradaStock> {
  if (compra.tipo === "reventa") {
    const res = await registrarEntradaCompraReventa(solicitante, tenantId, {
      productoId: compra.productoId!,
      sucursalId: compra.sucursalId,
      cantidad: compra.cantidad,
      costoCompra: compra.costoUnitario,
      referenciaId: compra.id,
    });
    return res.ok ? { ok: true } : { ok: false, error: res.error };
  }

  const res = await registrarEntradaCompraInsumo(solicitante, tenantId, {
    insumoId: compra.insumoId!,
    sucursalId: compra.sucursalId,
    cantidad: compra.cantidad,
    costoCompra: compra.costoUnitario,
    fechaVencimiento: compra.fechaVencimiento ?? undefined,
    referenciaId: compra.id,
  });
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

export async function registrarCompra(
  solicitante: UsuarioConRol,
  tenantId: string,
  input: DatosCompra
): Promise<
  Resultado<{ compraId: string; costoUnitario: number; entradaStock?: DatosEntradaStock }>
> {
  if (!(await tienePermiso(solicitante, tenantId, "proveedores", "crear"))) {
    return { ok: false, error: "No tenés permiso para registrar compras." };
  }
  if (input.tipo === "insumo" && (!input.insumoId || input.productoId)) {
    return { ok: false, error: "Para una compra de insumo tenés que elegir un insumo, no un producto." };
  }
  if (input.tipo === "reventa" && (!input.productoId || input.insumoId)) {
    return { ok: false, error: "Para una compra de reventa tenés que elegir un producto, no un insumo." };
  }

  return comoUsuario(solicitante.id, async (tx) => {
    // Si se indica proveedor, debe ser del tenant — sin esto la compra
    // referenciaba un proveedor ajeno (auditoría de autorización). proveedorId
    // es opcional (compra sin proveedor registrado). El insumoId/productoId se
    // valida en la entrada de stock (registrarEntradaCompraInsumo/Reventa, ya
    // atadas a su tenant), que se dispara al recibir la compra.
    if (input.proveedorId) {
      const proveedor = await repo.obtenerProveedorPorId(tx, input.proveedorId);
      if (!proveedor || proveedor.tenantId !== tenantId) {
        return { ok: false, error: "Proveedor no encontrado." };
      }
    }

    const costoUnitario = calcularCostoUnitario(
      input.montoTotal,
      input.cantidad,
      input.costoAdicionalTraslado ?? null
    );
    const estado = input.estado ?? "recibido";

    const compra = await repo.crearCompra(tx, {
      tenantId,
      sucursalId: input.sucursalId,
      proveedorId: input.proveedorId,
      tipo: input.tipo,
      insumoId: input.insumoId,
      productoId: input.productoId,
      cantidad: String(input.cantidad),
      costoUnitario: String(costoUnitario),
      montoTotal: String(input.montoTotal),
      costoAdicionalTraslado:
        input.costoAdicionalTraslado !== undefined ? String(input.costoAdicionalTraslado) : undefined,
      fechaCompra: input.fechaCompra,
      fechaVencimiento: input.fechaVencimiento,
      estado,
      fechaRecepcion: estado === "recibido" ? input.fechaCompra : undefined,
      creadoPor: solicitante.id,
    });

    if (estado !== "recibido") {
      return { ok: true, data: { compraId: compra.id, costoUnitario } };
    }

    const entradaStock = await dispararEntradaStock(solicitante, tenantId, compra);
    return { ok: true, data: { compraId: compra.id, costoUnitario, entradaStock } };
  });
}

/** Transiciona una Compra "pedido" -> "recibido" y recien ahi dispara la
 * entrada de stock real (Modulo_08 seccion 6 / roadmap item #12: Orden de
 * Compra como estado, no entidad nueva). `fechaRecepcion` opcional (cambio
 * aditivo agregado al construir la UI — antes siempre usaba la fecha de
 * hoy; `repo.marcarCompraRecibida` ya aceptaba el parametro, solo faltaba
 * exponerlo) — default a hoy si no se especifica. */
export async function recibirCompra(
  solicitante: UsuarioConRol,
  compraId: string,
  fechaRecepcion?: string
): Promise<Resultado<{ entradaStock: DatosEntradaStock }>> {
  return comoUsuario(solicitante.id, async (tx) => {
    const compra = await repo.obtenerCompraPorId(tx, compraId);
    if (!compra) return { ok: false, error: "Compra no encontrada." };
    if (!(await tienePermiso(solicitante, compra.tenantId, "proveedores", "crear"))) {
      return { ok: false, error: "No tenés permiso para recibir compras." };
    }
    if (compra.estado === "recibido") {
      return { ok: false, error: "Esta compra ya está recibida." };
    }

    const fecha = fechaRecepcion ?? new Date().toISOString().slice(0, 10);
    const compraRecibida = await repo.marcarCompraRecibida(tx, compraId, fecha);
    const entradaStock = await dispararEntradaStock(
      solicitante,
      compra.tenantId,
      compraRecibida
    );

    return { ok: true, data: { entradaStock } };
  });
}

/** historial_precio(item) — Modulo_08 seccion 2. "item" es insumo o
 * producto segun tipo (roadmap item #12). */
export async function historialPrecio(
  solicitante: UsuarioConRol,
  tenantId: string,
  item: { insumoId: string } | { productoId: string }
): Promise<Resultado<Awaited<ReturnType<typeof repo.listarComprasPorItem>>>> {
  if (!(await tienePermiso(solicitante, tenantId, "proveedores", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver el historial." };
  }
  return comoUsuario(solicitante.id, async (tx) => ({
    ok: true,
    data: await repo.listarComprasPorItem(tx, tenantId, item),
  }));
}

/** Listado general de Compras del tenant — antes solo existian listados
 * indirectos (fichaProveedor -> compras[] por proveedor, historialPrecio
 * por item). Filtros opcionales por estadoPago y estado (pedido/recibido),
 * mas reciente primero. Agregada para la UI de "Listado de Compras"
 * (docs/ui/pantallas.md seccion 4). */
export async function listarCompras(
  solicitante: UsuarioConRol,
  tenantId: string,
  opts: { estadoPago?: EstadoPagoCompra; estado?: EstadoCompra } = {}
): Promise<Resultado<Awaited<ReturnType<typeof repo.listarComprasPorTenant>>>> {
  if (!(await tienePermiso(solicitante, tenantId, "proveedores", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver compras." };
  }
  return comoUsuario(solicitante.id, async (tx) => ({
    ok: true,
    data: await repo.listarComprasPorTenant(tx, tenantId, opts),
  }));
}

// --- Pagos de Compra ---------------------------------------------------------

/** Saldo pendiente de una Compra (montoTotal - total pagado) — agregada
 * para la UI de "Registrar pago de Compra" (resumen saldo antes/después en
 * vivo, mismo criterio que consultarPasivoDeActivo en Patrimonio). Antes
 * `obtenerTotalPagado` solo se usaba internamente dentro de
 * `registrarPagoCompraTx`, sin wrapper de lectura propio. */
export async function consultarSaldoCompra(
  solicitante: UsuarioConRol,
  compraId: string
): Promise<Resultado<{ saldoPendiente: number }>> {
  return comoUsuario(solicitante.id, async (tx) => {
    const compra = await repo.obtenerCompraPorId(tx, compraId);
    if (!compra) return { ok: false, error: "Compra no encontrada." };
    if (!(await tienePermiso(solicitante, compra.tenantId, "proveedores", "ver"))) {
      return { ok: false, error: "No tenés permiso para ver esta compra." };
    }

    const totalPagado = await repo.obtenerTotalPagado(tx, compraId);
    return { ok: true, data: { saldoPendiente: Number(compra.montoTotal) - totalPagado } };
  });
}

export async function registrarPagoCompra(
  solicitante: UsuarioConRol,
  compraId: string,
  input: { monto: string | number; fechaPago: string }
): Promise<Resultado<{ estadoPago: EstadoPagoCompra; totalPagado: number }>> {
  return comoUsuario(solicitante.id, async (tx) => {
    const compra = await repo.obtenerCompraPorId(tx, compraId);
    if (!compra) return { ok: false, error: "Compra no encontrada." };
    if (!(await tienePermiso(solicitante, compra.tenantId, "proveedores", "crear"))) {
      return { ok: false, error: "No tenés permiso para registrar pagos en esta compra." };
    }

    const { estadoPago, totalPagado } = await repo.registrarPagoCompraTx(tx, {
      compraId,
      monto: String(input.monto),
      fechaPago: input.fechaPago,
      creadoPor: solicitante.id,
    });

    return { ok: true, data: { estadoPago, totalPagado } };
  });
}

// --- Compra de Ajuste ---------------------------------------------------------

export interface DatosCompraAjuste {
  tipo: TipoAjusteCompra;
  montoAjuste: string | number;
  motivo: string;
}

/** Nunca se edita una Compra directamente (regla 3.3) — se corrige con una
 * Compra de Ajuste que referencia a la original, con motivo obligatorio. */
export async function registrarCompraDeAjuste(
  solicitante: UsuarioConRol,
  compraId: string,
  input: DatosCompraAjuste
): Promise<Resultado<{ ajusteId: string }>> {
  return comoUsuario(solicitante.id, async (tx) => {
    const compra = await repo.obtenerCompraPorId(tx, compraId);
    if (!compra) return { ok: false, error: "Compra no encontrada." };
    if (
      !(await tienePermiso(solicitante, compra.tenantId, "proveedores", "anular_ajustar"))
    ) {
      return { ok: false, error: "No tenés permiso para ajustar esta compra." };
    }
    if (!input.motivo.trim()) {
      return { ok: false, error: "El motivo del ajuste es obligatorio." };
    }

    const ajuste = await repo.crearCompraAjuste(tx, {
      compraId,
      tipo: input.tipo,
      montoAjuste: String(input.montoAjuste),
      motivo: input.motivo,
      creadoPor: solicitante.id,
    });

    return { ok: true, data: { ajusteId: ajuste.id } };
  });
}

// --- Agregados por periodo para Financiero (Modulo_07, seccion 2) ---------------------------------------------------------

/**
 * Es la única función de Proveedores alcanzada por el camino Gateway/Panel
 * Admin CEOM, vía financiero.flujoCaja() (docs/security/
 * PLAN-RLS-BACKSTOP.md §9.6/§10.4/§10.7). Etapa 3 (`es_ceom_admin()` +
 * policy de bypass en las 4 tablas de Proveedores) resolvió la mitad del
 * problema: un `ceom_admin` real (Panel Admin CEOM) pasa por
 * `comoUsuario()` como cualquier otra función del módulo — `RLS` lo deja
 * ver el `tenantId` que quiere inspeccionar gracias al bypass, sin
 * excepción de código.
 *
 * **La otra mitad se cerró en la Etapa 4.a** (docs/security/
 * PLAN-RLS-BACKSTOP.md §13/§15.3, Opción A′): `solicitanteGateway()` ya no
 * es un objeto sintético — es una fila real sembrada
 * (`0034_gateway_sistema_seed.sql`), y `compras`/`pagos_compra` tienen
 * `gatewayVigenciaBypassPolicy()` (Etapa 4.b.0, §16.9.1 — solo lectura,
 * filtra por id puntual + vigencia de consentimiento del tenant, no por rol
 * — nunca `es_ceom_admin()`, ver §13.3 sobre por qué reusar ese bypass
 * hubiera sido una regresión). El camino Gateway ahora también
 * entra por el `try` (`comoUsuario()`) y sale con el dato real — ya no
 * dispara `ContextoRlsNoResueltoError`.
 *
 * **El fallback de abajo queda de todas formas, como defensa en
 * profundidad, no como el camino esperado de nadie conocido hoy.** Un
 * `ContextoRlsNoResueltoError` para cualquier solicitante sin fila real en
 * `usuarios`/`auth.users` (hoy, ninguno identificado) seguiría cayendo acá
 * en vez de propagar — riesgo aceptado y documentado, no nuevo. No quitar
 * este fallback solo porque "ya no lo dispara nadie" sin antes confirmar
 * que ningún otro caller pueda llegar con un id no resuelto; no expandir
 * este patrón a otras funciones sin la misma revisión.
 */
export async function consultarPagosCompraEnPeriodo(
  solicitante: UsuarioConRol,
  tenantId: string,
  periodo: { desde: string; hasta: string },
  opts: { sucursalId?: string } = {}
): Promise<Resultado<{ totalPagado: number }>> {
  if (!(await tienePermiso(solicitante, tenantId, "proveedores", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver compras." };
  }
  try {
    return await comoUsuario(solicitante.id, async (tx) => {
      const totalPagado = await repo.sumarPagosCompraPeriodo(
        tx,
        tenantId,
        periodo.desde,
        periodo.hasta,
        opts
      );
      return { ok: true, data: { totalPagado } };
    });
  } catch (error) {
    if (!(error instanceof ContextoRlsNoResueltoError)) throw error;
    const totalPagado = await repo.sumarPagosCompraPeriodo(
      db,
      tenantId,
      periodo.desde,
      periodo.hasta,
      opts
    );
    return { ok: true, data: { totalPagado } };
  }
}
