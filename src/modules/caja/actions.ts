import { listarSucursalesPorTenant, tienePermiso } from "@/modules/identidad/actions";
import type { UsuarioConRol } from "@/modules/identidad/actions";
import { rangoInstantes, zonaHorariaTenant } from "@/lib/periodo";
import { consultarCobrosDeTurno, listarVentasDeTurno } from "@/modules/ventas/actions";
import * as repo from "./repository";

/**
 * Caja y turnos (Roadmap Cafiatto, Fase 4). Ver `ANCLA.md`.
 *
 * Permisos (sin modulo propio: el enum de permisos se reutiliza en muchos sitios):
 * - `ventas:crear`   — abrir/cerrar turno, registrar movimientos, ver el turno abierto.
 * - `ventas:anular_ajustar` — activar/configurar la caja, ver el historial de turnos
 *   y las diferencias. (El Owner pasa por la matriz como siempre.)
 */

export type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

const redondear2 = (n: number) => Math.round(n * 100) / 100;
const TOLERANCIA = 0.005;

/** Fondo inicial + efectivo cobrado + entradas - salidas. Es la unica formula del cajon. */
export function calcularEfectivoEsperado(
  fondoInicial: number,
  efectivoCobrado: number,
  entradas: number,
  salidas: number
): number {
  return redondear2(fondoInicial + efectivoCobrado + entradas - salidas);
}

export interface ResumenTurno {
  turnoId: string;
  numero: number;
  cajaId: string;
  cajaNombre: string;
  estado: "abierto" | "cerrado";
  abiertoPor: string;
  abiertoEn: Date;
  cerradoPor: string | null;
  cerradoEn: Date | null;
  fondoInicial: number;
  ventasCantidad: number;
  ventasTotal: number;
  porMedio: Array<{ metodoPagoId: string; nombre: string; esEfectivo: boolean; monto: number; cantidad: number }>;
  efectivoCobrado: number;
  entradas: number;
  salidas: number;
  efectivoEsperado: number;
  /** Solo en un turno cerrado. */
  efectivoContado: number | null;
  diferencia: number | null;
  observaciones: string | null;
}

async function construirResumen(
  solicitante: UsuarioConRol,
  tenantId: string,
  turno: repo.TurnoCaja,
  cajaNombre: string
): Promise<Resultado<ResumenTurno>> {
  const base = {
    turnoId: turno.id,
    numero: turno.numero,
    cajaId: turno.cajaId,
    cajaNombre,
    estado: turno.estado,
    abiertoPor: turno.abiertoPor,
    abiertoEn: turno.abiertoEn,
    cerradoPor: turno.cerradoPor,
    cerradoEn: turno.cerradoEn,
    fondoInicial: Number(turno.fondoInicial),
    efectivoContado: turno.efectivoContado === null ? null : Number(turno.efectivoContado),
    diferencia: turno.diferencia === null ? null : Number(turno.diferencia),
    observaciones: turno.observaciones,
  };
  const movimientos = await repo.sumarMovimientos(turno.id);

  // Un turno cerrado se lee de su foto: lo que paso DESPUES (un cobro tardio, un ajuste)
  // no cambia lo que se conto y se firmo al cerrar.
  if (turno.estado === "cerrado") {
    return {
      ok: true,
      data: {
        ...base,
        ventasCantidad: turno.ventasCantidad ?? 0,
        ventasTotal: Number(turno.ventasTotal ?? 0),
        porMedio: (turno.totalesPorMedio as ResumenTurno["porMedio"] | null) ?? [],
        efectivoCobrado: ((turno.totalesPorMedio as ResumenTurno["porMedio"] | null) ?? [])
          .filter((m) => m.esEfectivo)
          .reduce((s, m) => s + m.monto, 0),
        entradas: movimientos.entradas,
        salidas: movimientos.salidas,
        efectivoEsperado: Number(turno.efectivoEsperado ?? 0),
      },
    };
  }

  const cobros = await consultarCobrosDeTurno(solicitante, tenantId, turno.id);
  if (!cobros.ok) return cobros;
  return {
    ok: true,
    data: {
      ...base,
      ventasCantidad: cobros.data.ventasCantidad,
      ventasTotal: cobros.data.ventasTotal,
      porMedio: cobros.data.porMetodo,
      efectivoCobrado: cobros.data.efectivoCobrado,
      entradas: movimientos.entradas,
      salidas: movimientos.salidas,
      efectivoEsperado: calcularEfectivoEsperado(
        Number(turno.fondoInicial),
        cobros.data.efectivoCobrado,
        movimientos.entradas,
        movimientos.salidas
      ),
    },
  };
}

// --- Configuracion -----------------------------------------------------------

export async function obtenerConfiguracionCaja(
  solicitante: UsuarioConRol,
  tenantId: string
): Promise<Resultado<{ habilitada: boolean; exigirTurno: boolean }>> {
  if (!(await tienePermiso(solicitante, tenantId, "ventas", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver la caja." };
  }
  const c = await repo.obtenerConfiguracion(tenantId);
  return { ok: true, data: { habilitada: c?.habilitada ?? false, exigirTurno: c?.exigirTurno ?? true } };
}

/**
 * Activa o apaga la caja del negocio. Al activarla se crea una "Caja" por cada
 * sucursal que no tenga una. Apagarla NO cierra turnos abiertos ni borra historial:
 * solo deja de exigirse en Vender.
 */
export async function configurarCaja(
  solicitante: UsuarioConRol,
  tenantId: string,
  input: { habilitada: boolean; exigirTurno?: boolean }
): Promise<Resultado<{ habilitada: boolean; exigirTurno: boolean }>> {
  if (!(await tienePermiso(solicitante, tenantId, "ventas", "anular_ajustar"))) {
    return { ok: false, error: "No tenés permiso para configurar la caja." };
  }
  const actual = await repo.obtenerConfiguracion(tenantId);
  const exigirTurno = input.exigirTurno ?? actual?.exigirTurno ?? true;

  if (input.habilitada) {
    const sucursales = await listarSucursalesPorTenant(solicitante, tenantId);
    if (!sucursales.ok) return sucursales;
    const operables = sucursales.data.filter((s) => !s.congeladaEn);
    const existentes = await repo.listarCajas(tenantId);
    for (const s of operables) {
      if (!existentes.some((c) => c.sucursalId === s.id)) {
        await repo.crearCaja({
          tenantId,
          sucursalId: s.id,
          nombre: operables.length > 1 ? `Caja ${s.nombre}` : "Caja Principal",
        });
      }
    }
  }

  const guardada = await repo.guardarConfiguracion(tenantId, {
    habilitada: input.habilitada,
    exigirTurno,
    modificadoPor: solicitante.id,
  });
  return { ok: true, data: { habilitada: guardada.habilitada, exigirTurno: guardada.exigirTurno } };
}

// --- Turnos ----------------------------------------------------------------

/**
 * Para la capa de acciones de Ventas: en que turno se registra esta venta/cobro.
 * - Caja apagada -> `turnoId: null`, no se exige nada.
 * - Caja activa con turno abierto en la sucursal -> ese turno.
 * - Caja activa sin turno y `exigir_turno` -> error (no se vende sin turno).
 */
export async function turnoParaOperar(
  solicitante: UsuarioConRol,
  tenantId: string,
  sucursalId: string
): Promise<Resultado<{ turnoId: string | null }>> {
  if (!(await tienePermiso(solicitante, tenantId, "ventas", "crear"))) {
    return { ok: false, error: "No tenés permiso para registrar ventas." };
  }
  const config = await repo.obtenerConfiguracion(tenantId);
  if (!config?.habilitada) return { ok: true, data: { turnoId: null } };

  const turno = await repo.obtenerTurnoAbiertoDeSucursal(tenantId, sucursalId);
  if (turno) return { ok: true, data: { turnoId: turno.id } };
  if (config.exigirTurno) {
    return { ok: false, error: "Para vender o cobrar, primero abrí el turno de la caja." };
  }
  return { ok: true, data: { turnoId: null } };
}

export async function abrirTurno(
  solicitante: UsuarioConRol,
  tenantId: string,
  input: { cajaId: string; fondoInicial: number }
): Promise<Resultado<{ turnoId: string; numero: number }>> {
  if (!(await tienePermiso(solicitante, tenantId, "ventas", "crear"))) {
    return { ok: false, error: "No tenés permiso para abrir un turno." };
  }
  const config = await repo.obtenerConfiguracion(tenantId);
  if (!config?.habilitada) return { ok: false, error: "La caja no está activada en este negocio." };
  if (!(input.fondoInicial >= 0)) return { ok: false, error: "El fondo inicial no puede ser negativo." };

  const caja = await repo.obtenerCajaPorId(input.cajaId);
  if (!caja || caja.tenantId !== tenantId) return { ok: false, error: "Caja no encontrada." };
  const sucursales = await listarSucursalesPorTenant(solicitante, tenantId);
  if (!sucursales.ok) return sucursales;
  const sucursal = sucursales.data.find((s) => s.id === caja.sucursalId);
  if (!sucursal || sucursal.congeladaEn) {
    return { ok: false, error: "Esta sucursal está congelada por el plan del negocio — no se puede operar en ella." };
  }

  if (await repo.obtenerTurnoAbiertoDeCaja(caja.id)) {
    return { ok: false, error: `${caja.nombre} ya tiene un turno abierto.` };
  }
  try {
    const turno = await repo.abrirTurnoTx({
      tenantId,
      cajaId: caja.id,
      abiertoPor: solicitante.id,
      fondoInicial: String(redondear2(input.fondoInicial)),
    });
    return { ok: true, data: { turnoId: turno.id, numero: turno.numero } };
  } catch (e) {
    // Dos aperturas simultaneas de la misma caja: el indice unico frena a la segunda.
    const codigo = (x: unknown) => (x as { code?: string } | null)?.code;
    if (codigo(e) === "23505" || codigo((e as { cause?: unknown } | null)?.cause) === "23505") {
      return { ok: false, error: `${caja.nombre} ya tiene un turno abierto.` };
    }
    throw e;
  }
}

/** Las cajas del negocio con su turno abierto (y el estado en vivo de ese turno), para la pantalla. */
export async function estadoDeCajas(
  solicitante: UsuarioConRol,
  tenantId: string
): Promise<
  Resultado<{
    habilitada: boolean;
    exigirTurno: boolean;
    cajas: Array<{ cajaId: string; nombre: string; sucursalId: string; turno: ResumenTurno | null }>;
  }>
> {
  if (!(await tienePermiso(solicitante, tenantId, "ventas", "crear"))) {
    return { ok: false, error: "No tenés permiso para ver la caja." };
  }
  const config = await repo.obtenerConfiguracion(tenantId);
  if (!config?.habilitada) {
    return { ok: true, data: { habilitada: false, exigirTurno: config?.exigirTurno ?? true, cajas: [] } };
  }
  const cajas = await repo.listarCajas(tenantId);
  const filas = await Promise.all(
    cajas.map(async (caja) => {
      const turno = await repo.obtenerTurnoAbiertoDeCaja(caja.id);
      if (!turno) return { cajaId: caja.id, nombre: caja.nombre, sucursalId: caja.sucursalId, turno: null };
      const resumen = await construirResumen(solicitante, tenantId, turno, caja.nombre);
      return {
        cajaId: caja.id,
        nombre: caja.nombre,
        sucursalId: caja.sucursalId,
        turno: resumen.ok ? resumen.data : null,
      };
    })
  );
  return { ok: true, data: { habilitada: true, exigirTurno: config.exigirTurno, cajas: filas } };
}

export async function registrarMovimientoCaja(
  solicitante: UsuarioConRol,
  tenantId: string,
  input: { turnoId: string; tipo: "entrada" | "salida"; monto: number; motivo: string }
): Promise<Resultado<{ movimientoId: string; efectivoEsperado: number }>> {
  if (!(await tienePermiso(solicitante, tenantId, "ventas", "crear"))) {
    return { ok: false, error: "No tenés permiso para registrar movimientos de caja." };
  }
  if (!(input.monto > 0)) return { ok: false, error: "El monto tiene que ser mayor a cero." };
  if (!input.motivo.trim()) return { ok: false, error: "El motivo del movimiento es obligatorio." };

  const turno = await repo.obtenerTurnoPorId(input.turnoId);
  if (!turno || turno.tenantId !== tenantId) return { ok: false, error: "Turno no encontrado." };
  if (turno.estado !== "abierto") return { ok: false, error: "Este turno ya está cerrado." };
  const caja = await repo.obtenerCajaPorId(turno.cajaId);

  const resumen = await construirResumen(solicitante, tenantId, turno, caja?.nombre ?? "Caja");
  if (!resumen.ok) return resumen;
  // Sacar mas efectivo del que deberia haber es casi siempre un error de tipeo.
  if (input.tipo === "salida" && input.monto > resumen.data.efectivoEsperado + TOLERANCIA) {
    return {
      ok: false,
      error: `La salida (${input.monto.toFixed(2)}) supera el efectivo esperado en caja (${resumen.data.efectivoEsperado.toFixed(2)}).`,
    };
  }

  const mov = await repo.crearMovimiento({
    tenantId,
    turnoId: turno.id,
    tipo: input.tipo,
    monto: String(redondear2(input.monto)),
    motivo: input.motivo.trim(),
    creadoPor: solicitante.id,
  });
  return {
    ok: true,
    data: {
      movimientoId: mov.id,
      efectivoEsperado: calcularEfectivoEsperado(
        resumen.data.fondoInicial,
        resumen.data.efectivoCobrado,
        resumen.data.entradas + (input.tipo === "entrada" ? input.monto : 0),
        resumen.data.salidas + (input.tipo === "salida" ? input.monto : 0)
      ),
    },
  };
}

/**
 * Cierra el turno: compara lo esperado con lo contado y guarda la foto. Una
 * diferencia NO modifica las ventas — queda registrada para revision, y exige una
 * observacion que la explique.
 */
export async function cerrarTurno(
  solicitante: UsuarioConRol,
  tenantId: string,
  input: { turnoId: string; efectivoContado: number; observaciones?: string }
): Promise<Resultado<ResumenTurno>> {
  if (!(await tienePermiso(solicitante, tenantId, "ventas", "crear"))) {
    return { ok: false, error: "No tenés permiso para cerrar el turno." };
  }
  if (!(input.efectivoContado >= 0)) return { ok: false, error: "El efectivo contado no puede ser negativo." };

  const turno = await repo.obtenerTurnoPorId(input.turnoId);
  if (!turno || turno.tenantId !== tenantId) return { ok: false, error: "Turno no encontrado." };
  if (turno.estado !== "abierto") return { ok: false, error: "Este turno ya está cerrado." };
  const caja = await repo.obtenerCajaPorId(turno.cajaId);

  const vivo = await construirResumen(solicitante, tenantId, turno, caja?.nombre ?? "Caja");
  if (!vivo.ok) return vivo;
  const contado = redondear2(input.efectivoContado);
  const diferencia = redondear2(contado - vivo.data.efectivoEsperado);
  const observaciones = input.observaciones?.trim() || null;
  if (Math.abs(diferencia) > TOLERANCIA && !observaciones) {
    return {
      ok: false,
      error: `Hay una diferencia de ${diferencia.toFixed(2)} entre lo esperado y lo contado: explicala en las observaciones para cerrar.`,
    };
  }

  const cerrado = await repo.cerrarTurno(turno.id, {
    cerradoPor: solicitante.id,
    ventasCantidad: vivo.data.ventasCantidad,
    ventasTotal: String(redondear2(vivo.data.ventasTotal)),
    totalesPorMedio: vivo.data.porMedio,
    efectivoEsperado: String(vivo.data.efectivoEsperado),
    efectivoContado: String(contado),
    diferencia: String(diferencia),
    observaciones,
  });
  // Cierre simultaneo: otro llego primero.
  if (!cerrado) return { ok: false, error: "Este turno ya está cerrado." };

  return construirResumen(solicitante, tenantId, cerrado, caja?.nombre ?? "Caja");
}

// --- Historial -------------------------------------------------------------

export async function listarTurnos(
  solicitante: UsuarioConRol,
  tenantId: string,
  filtros: {
    periodo?: { desde: string; hasta: string };
    cajaId?: string;
    estado?: "abierto" | "cerrado";
    conDiferencia?: boolean;
  } = {}
): Promise<Resultado<Awaited<ReturnType<typeof repo.listarTurnos>>>> {
  if (!(await tienePermiso(solicitante, tenantId, "ventas", "anular_ajustar"))) {
    return { ok: false, error: "No tenés permiso para ver el historial de turnos." };
  }
  const rango = filtros.periodo ? rangoInstantes(filtros.periodo, await zonaHorariaTenant(tenantId)) : null;
  return {
    ok: true,
    data: await repo.listarTurnos(tenantId, {
      inicio: rango?.inicio,
      fin: rango?.fin,
      cajaId: filtros.cajaId,
      estado: filtros.estado,
      conDiferencia: filtros.conDiferencia,
    }),
  };
}

/** Detalle de un turno: lo ve quien lo abrio o un supervisor (`ventas:anular_ajustar`). */
export async function fichaTurno(
  solicitante: UsuarioConRol,
  tenantId: string,
  turnoId: string
): Promise<
  Resultado<{
    resumen: ResumenTurno;
    movimientos: Awaited<ReturnType<typeof repo.listarMovimientos>>;
    ventas: Awaited<ReturnType<typeof listarVentasDeTurno>> extends infer R
      ? R extends { ok: true; data: infer D }
        ? D
        : never
      : never;
  }>
> {
  const turno = await repo.obtenerTurnoPorId(turnoId);
  if (!turno || turno.tenantId !== tenantId) return { ok: false, error: "Turno no encontrado." };
  const esSuyo = turno.abiertoPor === solicitante.id && (await tienePermiso(solicitante, tenantId, "ventas", "crear"));
  if (!esSuyo && !(await tienePermiso(solicitante, tenantId, "ventas", "anular_ajustar"))) {
    return { ok: false, error: "No tenés permiso para ver este turno." };
  }
  const caja = await repo.obtenerCajaPorId(turno.cajaId);
  const resumen = await construirResumen(solicitante, tenantId, turno, caja?.nombre ?? "Caja");
  if (!resumen.ok) return resumen;
  const ventas = await listarVentasDeTurno(solicitante, tenantId, turnoId);
  if (!ventas.ok) return ventas;
  return {
    ok: true,
    data: { resumen: resumen.data, movimientos: await repo.listarMovimientos(turnoId), ventas: ventas.data },
  };
}

