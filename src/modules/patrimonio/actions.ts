import { comoUsuario } from "@/db/contexto";
import { generarGastoCuotaPasivo } from "@/modules/gastos/actions";
import { tienePermiso } from "@/modules/identidad/actions";
import type { UsuarioConRol } from "@/modules/identidad/actions";
import * as repo from "./repository";
import type {
  estadoPasivoEnum,
  frecuenciaCuotaEnum,
  origenPagoPasivoEnum,
  tipoActivoEnum,
} from "./schema";

export type Resultado<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type TipoActivo = (typeof tipoActivoEnum.enumValues)[number];
type EstadoPasivo = (typeof estadoPasivoEnum.enumValues)[number];
type FrecuenciaCuota = (typeof frecuenciaCuotaEnum.enumValues)[number];
type OrigenPagoPasivo = (typeof origenPagoPasivoEnum.enumValues)[number];

// --- Calculo puro (Modulo_05 seccion 1.3) ---------------------------------------------------------

/**
 * Depreciacion lineal simple, bajo demanda — nunca se guarda como
 * snapshot. Satura en 0 (nunca negativo). Sin vida_util_meses, el activo
 * no deprecia (ej. un terreno) y devuelve valor_compra tal cual.
 */
export function calcularValorActual(
  activo: {
    valorCompra: string | number;
    fechaAdquisicion: string;
    vidaUtilMeses: string | number | null;
  },
  ahora: Date = new Date()
): number {
  const valorCompra = Number(activo.valorCompra);
  if (activo.vidaUtilMeses === null) return valorCompra;

  const vidaUtilMeses = Number(activo.vidaUtilMeses);
  const adquisicion = new Date(activo.fechaAdquisicion);
  // Metodos UTC, no locales: fechaAdquisicion es un "date" de Postgres
  // (sin hora) que JS parsea como medianoche UTC. Con metodos locales, en
  // cualquier huso horario negativo (ej. Bolivia, UTC-4) esa medianoche cae
  // en el dia/mes anterior, corriendo mal el calculo un mes entero.
  const mesesTranscurridos =
    (ahora.getUTCFullYear() - adquisicion.getUTCFullYear()) * 12 +
    (ahora.getUTCMonth() - adquisicion.getUTCMonth());

  const fraccionRestante = 1 - mesesTranscurridos / vidaUtilMeses;
  return Math.max(0, valorCompra * fraccionRestante);
}

// --- Lecturas (gate "ver") ---------------------------------------------------------

export async function consultarCapacidad(
  solicitante: UsuarioConRol,
  activoId: string
): Promise<Resultado<{
  capacidadProduccionCantidad: string | null;
  capacidadProduccionUnidad: string | null;
  capacidadAlmacenamientoCantidad: string | null;
  capacidadAlmacenamientoUnidad: string | null;
  disponibilidadHorariaSemanal: string | null;
  tiempoEstimadoPorCicloMinutos: string | null;
}>> {
  return comoUsuario(solicitante.id, async (tx) => {
    const activo = await repo.obtenerActivoPorId(tx, activoId);
    if (!activo) return { ok: false, error: "Activo no encontrado." };
    if (!(await tienePermiso(solicitante, activo.tenantId, "patrimonio", "ver"))) {
      return { ok: false, error: "No tenés permiso para ver este activo." };
    }

    return {
      ok: true,
      data: {
        capacidadProduccionCantidad: activo.capacidadProduccionCantidad,
        capacidadProduccionUnidad: activo.capacidadProduccionUnidad,
        capacidadAlmacenamientoCantidad: activo.capacidadAlmacenamientoCantidad,
        capacidadAlmacenamientoUnidad: activo.capacidadAlmacenamientoUnidad,
        disponibilidadHorariaSemanal: activo.disponibilidadHorariaSemanal,
        tiempoEstimadoPorCicloMinutos: activo.tiempoEstimadoPorCicloMinutos,
      },
    };
  });
}

export async function consultarValorActual(
  solicitante: UsuarioConRol,
  activoId: string
): Promise<Resultado<{ valorActual: number }>> {
  return comoUsuario(solicitante.id, async (tx) => {
    const activo = await repo.obtenerActivoPorId(tx, activoId);
    if (!activo) return { ok: false, error: "Activo no encontrado." };
    if (!(await tienePermiso(solicitante, activo.tenantId, "patrimonio", "ver"))) {
      return { ok: false, error: "No tenés permiso para ver este activo." };
    }

    return { ok: true, data: { valorActual: calcularValorActual(activo) } };
  });
}

export async function consultarPasivoDeActivo(
  solicitante: UsuarioConRol,
  activoId: string
): Promise<Resultado<Array<{ pasivoId: string; saldoPendiente: number }>>> {
  return comoUsuario(solicitante.id, async (tx) => {
    const activo = await repo.obtenerActivoPorId(tx, activoId);
    if (!activo) return { ok: false, error: "Activo no encontrado." };
    if (!(await tienePermiso(solicitante, activo.tenantId, "patrimonio", "ver"))) {
      return { ok: false, error: "No tenés permiso para ver este activo." };
    }

    const pasivosDelActivo = await repo.obtenerPasivoDeActivo(tx, activoId);
    const data = await Promise.all(
      pasivosDelActivo.map(async (pasivo) => ({
        pasivoId: pasivo.id,
        saldoPendiente: await repo.obtenerSaldoPendiente(tx, pasivo.id),
      }))
    );
    return { ok: true, data };
  });
}

export async function listarActivos(
  solicitante: UsuarioConRol,
  tenantId: string,
  opts: { excluirDadosDeBaja?: boolean } = {}
): Promise<Resultado<Awaited<ReturnType<typeof repo.listarActivosPorTenant>>>> {
  if (!(await tienePermiso(solicitante, tenantId, "patrimonio", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver activos." };
  }
  return comoUsuario(solicitante.id, async (tx) => ({
    ok: true,
    data: await repo.listarActivosPorTenant(tx, tenantId, opts),
  }));
}

export async function obtenerActivoPorId(
  solicitante: UsuarioConRol,
  activoId: string
): Promise<Resultado<NonNullable<Awaited<ReturnType<typeof repo.obtenerActivoPorId>>>>> {
  return comoUsuario(solicitante.id, async (tx) => {
    const activo = await repo.obtenerActivoPorId(tx, activoId);
    if (!activo) return { ok: false, error: "Activo no encontrado." };
    if (!(await tienePermiso(solicitante, activo.tenantId, "patrimonio", "ver"))) {
      return { ok: false, error: "No tenés permiso para ver este activo." };
    }
    return { ok: true, data: activo };
  });
}

export async function listarPasivos(
  solicitante: UsuarioConRol,
  tenantId: string,
  opts: { soloActivos?: boolean } = {}
): Promise<Resultado<Awaited<ReturnType<typeof repo.listarPasivosPorTenant>>>> {
  if (!(await tienePermiso(solicitante, tenantId, "patrimonio", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver pasivos." };
  }
  return comoUsuario(solicitante.id, async (tx) => ({
    ok: true,
    data: await repo.listarPasivosPorTenant(tx, tenantId, opts),
  }));
}

export async function obtenerPasivoPorId(
  solicitante: UsuarioConRol,
  pasivoId: string
): Promise<Resultado<NonNullable<Awaited<ReturnType<typeof repo.obtenerPasivoPorId>>>>> {
  return comoUsuario(solicitante.id, async (tx) => {
    const pasivo = await repo.obtenerPasivoPorId(tx, pasivoId);
    if (!pasivo) return { ok: false, error: "Pasivo no encontrado." };
    if (!(await tienePermiso(solicitante, pasivo.tenantId, "patrimonio", "ver"))) {
      return { ok: false, error: "No tenés permiso para ver este pasivo." };
    }
    return { ok: true, data: pasivo };
  });
}

/** Ficha de Pasivo (pantallas.md sección 3): el pasivo + su saldo derivado
 * + el historial completo de pagos — antes solo existía el saldo agregado
 * (consultarPasivoDeActivo), sin la lista de pagos individuales. */
export async function fichaPasivo(
  solicitante: UsuarioConRol,
  pasivoId: string
): Promise<
  Resultado<{
    pasivo: NonNullable<Awaited<ReturnType<typeof repo.obtenerPasivoPorId>>>;
    saldoPendiente: number;
    pagos: Awaited<ReturnType<typeof repo.listarPagosPorPasivo>>;
  }>
> {
  return comoUsuario(solicitante.id, async (tx) => {
    const pasivo = await repo.obtenerPasivoPorId(tx, pasivoId);
    if (!pasivo) return { ok: false, error: "Pasivo no encontrado." };
    if (!(await tienePermiso(solicitante, pasivo.tenantId, "patrimonio", "ver"))) {
      return { ok: false, error: "No tenés permiso para ver este pasivo." };
    }

    const [saldoPendiente, pagos] = await Promise.all([
      repo.obtenerSaldoPendiente(tx, pasivoId),
      repo.listarPagosPorPasivo(tx, pasivoId),
    ]);

    return { ok: true, data: { pasivo, saldoPendiente, pagos } };
  });
}

/** Caso de uso 6: suma de valor_actual de activos no dados de baja, menos
 * saldo_pendiente de pasivos activos. */
export async function consultarValorPatrimonialTotal(
  solicitante: UsuarioConRol,
  tenantId: string
): Promise<Resultado<{ valorPatrimonialTotal: number }>> {
  if (!(await tienePermiso(solicitante, tenantId, "patrimonio", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver el patrimonio." };
  }

  return comoUsuario(solicitante.id, async (tx) => {
    const activosDelTenant = await repo.listarActivosPorTenant(tx, tenantId, {
      excluirDadosDeBaja: true,
    });
    const totalActivos = activosDelTenant.reduce(
      (acc, activo) => acc + calcularValorActual(activo),
      0
    );

    const pasivosActivos = await repo.listarPasivosPorTenant(tx, tenantId, {
      soloActivos: true,
    });
    const saldos = await Promise.all(
      pasivosActivos.map((pasivo) => repo.obtenerSaldoPendiente(tx, pasivo.id))
    );
    const totalPasivos = saldos.reduce((acc, saldo) => acc + saldo, 0);

    return { ok: true, data: { valorPatrimonialTotal: totalActivos - totalPasivos } };
  });
}

// --- Activos (escritura) ---------------------------------------------------------

export interface DatosActivo {
  nombre: string;
  tipo: TipoActivo;
  sucursalId?: string;
  capacidadProduccionCantidad?: string;
  capacidadProduccionUnidad?: string;
  capacidadAlmacenamientoCantidad?: string;
  capacidadAlmacenamientoUnidad?: string;
  disponibilidadHorariaSemanal?: string;
  requiereDescansoEntreCiclos?: boolean;
  tiempoDescansoMinutos?: string;
  tiempoEstimadoPorCicloMinutos?: string;
  valorCompra: string | number;
  fechaAdquisicion: string;
  vidaUtilMeses?: string;
  proveedorId?: string;
  numeroSerie?: string;
  vencimientoGarantia?: string;
}

export async function crearActivo(
  solicitante: UsuarioConRol,
  tenantId: string,
  input: DatosActivo
): Promise<Resultado<{ activoId: string }>> {
  if (!(await tienePermiso(solicitante, tenantId, "patrimonio", "crear"))) {
    return { ok: false, error: "No tenés permiso para crear activos." };
  }

  return comoUsuario(solicitante.id, async (tx) => {
    const activo = await repo.crearActivo(tx, {
      tenantId,
      nombre: input.nombre,
      tipo: input.tipo,
      sucursalId: input.sucursalId,
      capacidadProduccionCantidad: input.capacidadProduccionCantidad,
      capacidadProduccionUnidad: input.capacidadProduccionUnidad,
      capacidadAlmacenamientoCantidad: input.capacidadAlmacenamientoCantidad,
      capacidadAlmacenamientoUnidad: input.capacidadAlmacenamientoUnidad,
      disponibilidadHorariaSemanal: input.disponibilidadHorariaSemanal,
      requiereDescansoEntreCiclos: input.requiereDescansoEntreCiclos ?? false,
      tiempoDescansoMinutos: input.tiempoDescansoMinutos,
      tiempoEstimadoPorCicloMinutos: input.tiempoEstimadoPorCicloMinutos,
      valorCompra: String(input.valorCompra),
      fechaAdquisicion: input.fechaAdquisicion,
      vidaUtilMeses: input.vidaUtilMeses,
      proveedorId: input.proveedorId,
      numeroSerie: input.numeroSerie,
      vencimientoGarantia: input.vencimientoGarantia,
      creadoPor: solicitante.id,
    });

    return { ok: true, data: { activoId: activo.id } };
  });
}

export async function actualizarActivo(
  solicitante: UsuarioConRol,
  activoId: string,
  input: Partial<DatosActivo>
): Promise<Resultado<true>> {
  return comoUsuario(solicitante.id, async (tx) => {
    const activo = await repo.obtenerActivoPorId(tx, activoId);
    if (!activo) return { ok: false, error: "Activo no encontrado." };
    if (!(await tienePermiso(solicitante, activo.tenantId, "patrimonio", "editar"))) {
      return { ok: false, error: "No tenés permiso para editar este activo." };
    }

    await repo.actualizarActivo(tx, activoId, {
      ...input,
      valorCompra: input.valorCompra !== undefined ? String(input.valorCompra) : undefined,
      modificadoPor: solicitante.id,
      modificadoEn: new Date(),
    });
    return { ok: true, data: true };
  });
}

/** "Dado de baja" es un estado de negocio, nunca una eliminacion (seccion
 * 3, regla 2) — no cancela el pasivo asociado (regla 3). `motivo`
 * obligatorio: adenda no explicita del doc, agregada al construir la UI
 * (ver ANCLA) — mismo criterio que el motivo obligatorio de
 * registrarAjusteVenta/registrarAjusteManualStock, auditoria de una accion
 * irreversible. */
export async function darDeBajaActivo(
  solicitante: UsuarioConRol,
  activoId: string,
  motivo: string
): Promise<Resultado<true>> {
  return comoUsuario(solicitante.id, async (tx) => {
    const activo = await repo.obtenerActivoPorId(tx, activoId);
    if (!activo) return { ok: false, error: "Activo no encontrado." };
    if (
      !(await tienePermiso(solicitante, activo.tenantId, "patrimonio", "anular_ajustar"))
    ) {
      return { ok: false, error: "No tenés permiso para dar de baja este activo." };
    }
    if (!motivo.trim()) {
      return { ok: false, error: "El motivo de la baja es obligatorio." };
    }

    await repo.actualizarEstadoActivo(tx, activoId, "dado_de_baja", solicitante.id, motivo);
    return { ok: true, data: true };
  });
}

/** Caso borde 4: reubicar un activo entre sucursales — solo auditoria, sin
 * ledger de movimientos (a diferencia del stock). */
export async function transferirActivo(
  solicitante: UsuarioConRol,
  activoId: string,
  nuevaSucursalId: string
): Promise<Resultado<true>> {
  return comoUsuario(solicitante.id, async (tx) => {
    const activo = await repo.obtenerActivoPorId(tx, activoId);
    if (!activo) return { ok: false, error: "Activo no encontrado." };
    if (!(await tienePermiso(solicitante, activo.tenantId, "patrimonio", "editar"))) {
      return { ok: false, error: "No tenés permiso para transferir este activo." };
    }

    await repo.actualizarSucursalActivo(tx, activoId, nuevaSucursalId, solicitante.id);
    return { ok: true, data: true };
  });
}

// --- Pasivos (escritura) ---------------------------------------------------------

export interface DatosPasivo {
  activoId?: string;
  montoTotal: string | number;
  cuotaPeriodica: string | number;
  frecuenciaCuota: FrecuenciaCuota;
  plazoCuotas: number;
  fechaInicio: string;
}

export async function crearPasivo(
  solicitante: UsuarioConRol,
  tenantId: string,
  input: DatosPasivo
): Promise<Resultado<{ pasivoId: string }>> {
  if (!(await tienePermiso(solicitante, tenantId, "patrimonio", "crear"))) {
    return { ok: false, error: "No tenés permiso para crear pasivos." };
  }

  return comoUsuario(solicitante.id, async (tx) => {
    const pasivo = await repo.crearPasivo(tx, {
      tenantId,
      activoId: input.activoId,
      montoTotal: String(input.montoTotal),
      cuotaPeriodica: String(input.cuotaPeriodica),
      frecuenciaCuota: input.frecuenciaCuota,
      plazoCuotas: input.plazoCuotas,
      fechaInicio: input.fechaInicio,
      creadoPor: solicitante.id,
    });

    return { ok: true, data: { pasivoId: pasivo.id } };
  });
}

/** Nunca se edita un Pasivo para reflejar una renegociacion (regla 4): se
 * crea uno nuevo vinculado y el anterior pasa a "refinanciado". */
export async function refinanciarPasivo(
  solicitante: UsuarioConRol,
  pasivoAnteriorId: string,
  nuevosTerminos: DatosPasivo
): Promise<Resultado<{ pasivoId: string }>> {
  return comoUsuario(solicitante.id, async (tx) => {
    const anterior = await repo.obtenerPasivoPorId(tx, pasivoAnteriorId);
    if (!anterior) return { ok: false, error: "Pasivo no encontrado." };
    if (!(await tienePermiso(solicitante, anterior.tenantId, "patrimonio", "editar"))) {
      return { ok: false, error: "No tenés permiso para refinanciar este pasivo." };
    }

    const nuevo = await repo.refinanciarPasivoTx(tx, pasivoAnteriorId, {
      tenantId: anterior.tenantId,
      activoId: nuevosTerminos.activoId ?? anterior.activoId,
      montoTotal: String(nuevosTerminos.montoTotal),
      cuotaPeriodica: String(nuevosTerminos.cuotaPeriodica),
      frecuenciaCuota: nuevosTerminos.frecuenciaCuota,
      plazoCuotas: nuevosTerminos.plazoCuotas,
      fechaInicio: nuevosTerminos.fechaInicio,
      creadoPor: solicitante.id,
    });

    return { ok: true, data: { pasivoId: nuevo.id } };
  });
}

/**
 * Registra el pago **y genera el Gasto de la cuota** en Costos y Gastos
 * (Modulo_05 seccion 2, "hacia Costos & Gastos"). Hasta H-27 solo hacia lo
 * primero: la plata salia del negocio, el saldo de la deuda bajaba, y el
 * egreso no llegaba ni al estado de resultados ni al flujo de caja — el
 * negocio se veia mas rentable de lo real, en silencio. El Gasto es el
 * unico vehiculo por el que un egreso llega al resultado.
 *
 * **El gasto se genera FUERA de la transaccion de RLS, despues del commit**,
 * a proposito y por dos razones:
 *
 * 1. Gastos todavia no esta migrado a `comoUsuario()` — su repository usa
 *    `db` crudo, o sea otra conexion. Llamarlo desde adentro de esta
 *    transaccion abierta escribiria por un canal distinto al del `tx`, sin
 *    ganar atomicidad y arriesgando quedarse sin conexiones del pool.
 * 2. Si el gasto falla, el pago **no se pierde**: se devuelve como aviso en
 *    `gastoCuota` para que la pantalla lo muestre. Mismo criterio ya
 *    aceptado en `registrarVenta()` para la comision y el descuento de
 *    stock (H-24) — el registro que el usuario pidio nunca se anula por su
 *    consecuencia.
 *
 * El gap de atomicidad cruzada que queda es el mismo que Ventas: un gasto
 * que no se creo se puede cargar a mano; un pago perdido, no.
 */
export async function registrarPagoPasivo(
  solicitante: UsuarioConRol,
  pasivoId: string,
  input: { monto: string | number; fechaPago: string; origen?: OrigenPagoPasivo }
): Promise<
  Resultado<{
    saldoPendiente: number;
    estadoPasivo: EstadoPasivo;
    gastoCuota: Awaited<ReturnType<typeof generarGastoCuotaPasivo>>;
  }>
> {
  const pago = await comoUsuario(solicitante.id, async (tx) => {
    const pasivo = await repo.obtenerPasivoPorId(tx, pasivoId);
    if (!pasivo) return { ok: false as const, error: "Pasivo no encontrado." };
    if (!(await tienePermiso(solicitante, pasivo.tenantId, "patrimonio", "crear"))) {
      return { ok: false as const, error: "No tenés permiso para registrar pagos en este pasivo." };
    }

    const { saldoPendiente } = await repo.registrarPagoPasivoTx(tx, {
      pasivoId,
      monto: String(input.monto),
      fechaPago: input.fechaPago,
      origen: input.origen ?? "manual",
      creadoPor: solicitante.id,
    });

    return {
      ok: true as const,
      data: {
        tenantId: pasivo.tenantId,
        saldoPendiente,
        estadoPasivo: (saldoPendiente <= 0 ? "pagado" : "activo") as EstadoPasivo,
      },
    };
  });
  if (!pago.ok) return pago;

  const gastoCuota = await generarGastoCuotaPasivo(solicitante, pago.data.tenantId, {
    pasivoId,
    monto: input.monto,
    fechaGasto: input.fechaPago,
  });

  return {
    ok: true,
    data: {
      saldoPendiente: pago.data.saldoPendiente,
      estadoPasivo: pago.data.estadoPasivo,
      gastoCuota,
    },
  };
}
