import { listarSucursalesPorTenant, tienePermiso } from "@/modules/identidad/actions";
import type { UsuarioConRol } from "@/modules/identidad/actions";
import { ROL_CEOM_ADMIN_ID } from "@/modules/identidad/constants";
import * as repo from "./repository";
import type {
  estadoPagoGastoEnum,
  origenGastoEnum,
  tipoGastoEnum,
} from "./schema";

export type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

type TipoGasto = (typeof tipoGastoEnum.enumValues)[number];
type OrigenGasto = (typeof origenGastoEnum.enumValues)[number];
type EstadoPagoGasto = (typeof estadoPagoGastoEnum.enumValues)[number];

// Solo se necesita el rol del solicitante para gatear el catalogo global de
// categorias sugeridas — mismo criterio que Suscripcion/Modulo 2.
// `rol.esRolSistema` obligatorio (no solo rolId): chequeo doble unificado en
// la Etapa 3 del backstop de RLS (docs/security/PLAN-RLS-BACKSTOP.md
// §10.2/§10.11 decision 5), igual que identidad/tienePermiso().
interface SolicitanteCeomAdmin {
  rolId: string;
  rol: { esRolSistema: boolean };
}

function requiereCeomAdmin(
  solicitante: SolicitanteCeomAdmin
): { ok: false; error: string } | null {
  if (!(solicitante.rol.esRolSistema && solicitante.rolId === ROL_CEOM_ADMIN_ID)) {
    return {
      ok: false,
      error: "Solo el equipo CEOM puede gestionar el catálogo de categorías de gasto sugeridas.",
    };
  }
  return null;
}

/** Set default global (Modulo_04 seccion 1.2) — se precarga al crear el
 * tenant en el diseño, pero como el onboarding no existe todavia, queda
 * como funcion invocable a mano (mismo criterio que CanalVenta en Ventas). */
export const CATEGORIAS_GASTO_DEFAULT = [
  "Insumos",
  "Mano de obra",
  "Transporte",
  "Marketing",
  "Servicios",
] as const;

// --- Categorias de Gasto ---------------------------------------------------------

export interface DatosCategoriaGasto {
  nombre: string;
  categoriaGastoSugeridaId?: string;
}

export async function crearCategoriaGasto(
  solicitante: UsuarioConRol,
  tenantId: string,
  input: DatosCategoriaGasto
): Promise<Resultado<{ categoriaId: string }>> {
  if (!(await tienePermiso(solicitante, tenantId, "costos_gastos", "crear"))) {
    return { ok: false, error: "No tenés permiso para crear categorías de gasto." };
  }
  const categoria = await repo.crearCategoriaGasto({
    tenantId,
    nombre: input.nombre,
    categoriaGastoSugeridaId: input.categoriaGastoSugeridaId,
  });
  return { ok: true, data: { categoriaId: categoria.id } };
}

/** Carga el set default global (sin dedupe — se asume una sola invocacion,
 * justo despues de crear el tenant). */
export async function sembrarCategoriasGastoDefault(
  solicitante: UsuarioConRol,
  tenantId: string
): Promise<Resultado<{ categoriaIds: string[] }>> {
  if (!(await tienePermiso(solicitante, tenantId, "costos_gastos", "crear"))) {
    return { ok: false, error: "No tenés permiso para crear categorías de gasto." };
  }
  // Set fijo de 5 categorias (no crece con datos del tenant) — insercion en
  // paralelo, cada una independiente y el orden no importa.
  const categorias = await Promise.all(
    CATEGORIAS_GASTO_DEFAULT.map((nombre) => repo.crearCategoriaGasto({ tenantId, nombre }))
  );
  return { ok: true, data: { categoriaIds: categorias.map((c) => c.id) } };
}

export async function actualizarCategoriaGasto(
  solicitante: UsuarioConRol,
  categoriaId: string,
  input: Partial<DatosCategoriaGasto>
): Promise<Resultado<true>> {
  const categoria = await repo.obtenerCategoriaGastoPorId(categoriaId);
  if (!categoria) return { ok: false, error: "Categoría de gasto no encontrada." };
  if (!(await tienePermiso(solicitante, categoria.tenantId, "costos_gastos", "editar"))) {
    return { ok: false, error: "No tenés permiso para editar esta categoría de gasto." };
  }
  await repo.actualizarCategoriaGasto(categoriaId, input);
  return { ok: true, data: true };
}

/** Caso borde 2: eliminar una categoria en uso no rompe los gastos ya
 * registrados con ella — solo deja de estar disponible para gastos nuevos. */
export async function eliminarCategoriaGasto(
  solicitante: UsuarioConRol,
  categoriaId: string
): Promise<Resultado<true>> {
  const categoria = await repo.obtenerCategoriaGastoPorId(categoriaId);
  if (!categoria) return { ok: false, error: "Categoría de gasto no encontrada." };
  if (!(await tienePermiso(solicitante, categoria.tenantId, "costos_gastos", "anular_ajustar"))) {
    return { ok: false, error: "No tenés permiso para eliminar esta categoría de gasto." };
  }
  await repo.eliminarCategoriaGastoSoft(categoriaId);
  return { ok: true, data: true };
}

export async function listarCategoriasGasto(
  solicitante: UsuarioConRol,
  tenantId: string
): Promise<Resultado<Awaited<ReturnType<typeof repo.listarCategoriasGastoPorTenant>>>> {
  if (!(await tienePermiso(solicitante, tenantId, "costos_gastos", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver categorías de gasto." };
  }
  return { ok: true, data: await repo.listarCategoriasGastoPorTenant(tenantId) };
}

// --- Categorias de Gasto Sugeridas (catalogo global, Panel Admin CEOM) --------------------

export async function listarCategoriasGastoSugeridas(
  opts: { nichoId?: string; soloActivas?: boolean } = {}
) {
  return repo.listarCategoriasGastoSugeridas(opts);
}

export async function crearCategoriaGastoSugerida(
  solicitante: SolicitanteCeomAdmin,
  input: { nichoId?: string; nombre: string }
): Promise<Resultado<{ categoriaGastoSugeridaId: string }>> {
  const bloqueo = requiereCeomAdmin(solicitante);
  if (bloqueo) return bloqueo;
  const categoria = await repo.crearCategoriaGastoSugerida({
    nichoId: input.nichoId,
    nombre: input.nombre,
  });
  return { ok: true, data: { categoriaGastoSugeridaId: categoria.id } };
}

export async function desactivarCategoriaGastoSugerida(
  solicitante: SolicitanteCeomAdmin,
  categoriaGastoSugeridaId: string
): Promise<Resultado<true>> {
  const bloqueo = requiereCeomAdmin(solicitante);
  if (bloqueo) return bloqueo;
  await repo.actualizarActivaCategoriaGastoSugerida(categoriaGastoSugeridaId, false);
  return { ok: true, data: true };
}

/**
 * Hermano de requireSucursalOperable en Productos/Ventas/Patrimonio (H-02,
 * completando el freeze en los 6 módulos que escriben con sucursal_id — ver
 * docs/auditoria-prelanzamiento/antiguo/07-sucursales-multiples.md sección 6.3
 * hueco 6). `gastos.sucursalId`/`gastos_recurrentes.sucursalId` son
 * nullable — null/undefined salta el chequeo, nunca lo rechaza.
 */
async function requireSucursalOperable(
  solicitante: UsuarioConRol,
  tenantId: string,
  sucursalId: string | undefined | null
): Promise<{ ok: false; error: string } | null> {
  if (!sucursalId) return null;
  const res = await listarSucursalesPorTenant(solicitante, tenantId);
  if (!res.ok) return { ok: false, error: res.error };
  const sucursal = res.data.find((s) => s.id === sucursalId);
  if (!sucursal) {
    return { ok: false, error: "La sucursal indicada no existe en este negocio." };
  }
  if (sucursal.congeladaEn) {
    return {
      ok: false,
      error: "Esta sucursal está congelada por el plan del negocio — no se puede operar en ella.",
    };
  }
  return null;
}

// --- Gastos ---------------------------------------------------------

export interface DatosGasto {
  sucursalId?: string;
  tipo: TipoGasto;
  categoriaId: string;
  monto: string | number;
  fechaGasto: string;
  proveedorId?: string;
  descripcion?: string;
}

export async function crearGastoManual(
  solicitante: UsuarioConRol,
  tenantId: string,
  input: DatosGasto
): Promise<Resultado<{ gastoId: string }>> {
  if (!(await tienePermiso(solicitante, tenantId, "costos_gastos", "crear"))) {
    return { ok: false, error: "No tenés permiso para crear gastos." };
  }
  const sucursalOperable = await requireSucursalOperable(solicitante, tenantId, input.sucursalId);
  if (sucursalOperable) return sucursalOperable;
  const gasto = await repo.crearGasto({
    tenantId,
    sucursalId: input.sucursalId,
    tipo: input.tipo,
    categoriaId: input.categoriaId,
    monto: String(input.monto),
    fechaGasto: input.fechaGasto,
    proveedorId: input.proveedorId,
    origen: "manual",
    descripcion: input.descripcion,
    creadoPor: solicitante.id,
  });
  return { ok: true, data: { gastoId: gasto.id } };
}

function esGastoManual(gasto: { origen: OrigenGasto }): boolean {
  return gasto.origen === "manual";
}

/** Regla 2 / caso borde 1: un gasto de origen automatico nunca se edita
 * directo — se corrige en su modulo de origen (Patrimonio o AjusteVenta).
 * Caso borde 6: no se permite bajar el monto por debajo de lo ya pagado. */
export async function actualizarGastoManual(
  solicitante: UsuarioConRol,
  gastoId: string,
  input: Partial<Omit<DatosGasto, "tipo">>
): Promise<Resultado<true>> {
  const gasto = await repo.obtenerGastoPorId(gastoId);
  if (!gasto) return { ok: false, error: "Gasto no encontrado." };
  if (!(await tienePermiso(solicitante, gasto.tenantId, "costos_gastos", "editar"))) {
    return { ok: false, error: "No tenés permiso para editar este gasto." };
  }
  if (!esGastoManual(gasto)) {
    return {
      ok: false,
      error:
        "Este gasto es de origen automático — se corrige en su módulo de origen (Patrimonio o Ajuste de Venta), no acá.",
    };
  }
  if (input.monto !== undefined) {
    const totalPagado = await repo.obtenerTotalPagado(gastoId);
    if (Number(input.monto) < totalPagado) {
      return {
        ok: false,
        error: `No se puede bajar el monto por debajo de lo ya pagado (${totalPagado}).`,
      };
    }
  }
  if (input.sucursalId !== undefined) {
    const sucursalOperable = await requireSucursalOperable(solicitante, gasto.tenantId, input.sucursalId);
    if (sucursalOperable) return sucursalOperable;
  }

  await repo.actualizarGasto(gastoId, {
    sucursalId: input.sucursalId,
    categoriaId: input.categoriaId,
    monto: input.monto !== undefined ? String(input.monto) : undefined,
    fechaGasto: input.fechaGasto,
    proveedorId: input.proveedorId,
    descripcion: input.descripcion,
    modificadoPor: solicitante.id,
    modificadoEn: new Date(),
  });
  return { ok: true, data: true };
}

export async function eliminarGastoManual(
  solicitante: UsuarioConRol,
  gastoId: string
): Promise<Resultado<true>> {
  const gasto = await repo.obtenerGastoPorId(gastoId);
  if (!gasto) return { ok: false, error: "Gasto no encontrado." };
  if (!(await tienePermiso(solicitante, gasto.tenantId, "costos_gastos", "anular_ajustar"))) {
    return { ok: false, error: "No tenés permiso para eliminar este gasto." };
  }
  if (!esGastoManual(gasto)) {
    return {
      ok: false,
      error:
        "Este gasto es de origen automático — se corrige en su módulo de origen, no se elimina acá.",
    };
  }
  await repo.eliminarGastoSoft(gastoId);
  return { ok: true, data: true };
}

export async function listarGastos(
  solicitante: UsuarioConRol,
  tenantId: string
): Promise<Resultado<Awaited<ReturnType<typeof repo.listarGastosPorTenant>>>> {
  if (!(await tienePermiso(solicitante, tenantId, "costos_gastos", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver gastos." };
  }
  return { ok: true, data: await repo.listarGastosPorTenant(tenantId) };
}

export async function fichaGasto(
  solicitante: UsuarioConRol,
  gastoId: string
): Promise<
  Resultado<{
    gasto: Awaited<ReturnType<typeof repo.obtenerGastoPorId>>;
    pagos: Awaited<ReturnType<typeof repo.listarPagosPorGasto>>;
  }>
> {
  const gasto = await repo.obtenerGastoPorId(gastoId);
  if (!gasto) return { ok: false, error: "Gasto no encontrado." };
  if (!(await tienePermiso(solicitante, gasto.tenantId, "costos_gastos", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver este gasto." };
  }
  const pagos = await repo.listarPagosPorGasto(gastoId);
  return { ok: true, data: { gasto, pagos } };
}

/** Los gastos de origen automatico ya nacen pagados (regla 6) — no admiten
 * pagos manuales adicionales via esta funcion. */
export async function registrarPagoGasto(
  solicitante: UsuarioConRol,
  gastoId: string,
  input: { monto: string | number; fechaPago: string }
): Promise<Resultado<{ estadoPago: EstadoPagoGasto; totalPagado: number }>> {
  const gasto = await repo.obtenerGastoPorId(gastoId);
  if (!gasto) return { ok: false, error: "Gasto no encontrado." };
  if (!(await tienePermiso(solicitante, gasto.tenantId, "costos_gastos", "crear"))) {
    return { ok: false, error: "No tenés permiso para registrar pagos en este gasto." };
  }
  if (!esGastoManual(gasto)) {
    return {
      ok: false,
      error: "Este gasto ya nació pagado — no admite pagos manuales adicionales.",
    };
  }

  const { estadoPago, totalPagado } = await repo.registrarPagoGastoTx({
    gastoId,
    monto: String(input.monto),
    fechaPago: input.fechaPago,
    creadoPor: solicitante.id,
  });
  return { ok: true, data: { estadoPago, totalPagado } };
}

// --- Auto-generacion (Modulo_04 seccion 2 y 3.6) ---------------------------------------------------------

/** Categoria bajo la que se archiva la comision de canal/evento. No esta en
 * CATEGORIAS_GASTO_DEFAULT a proposito: ese set lo elige el usuario al
 * arrancar y puede no sembrarse nunca, y la comision no puede depender de
 * eso (H-32 — sin categoria no se puede cargar un gasto). Se provisiona
 * sola, la primera vez que hace falta. */
export const CATEGORIA_COMISION_VENTA = "Comisiones de venta";

/** La gemela de CATEGORIA_COMISION_VENTA para la cuota de un Pasivo (H-27),
 * por el mismo motivo: el disparo es automatico desde Patrimonio y no puede
 * depender de que el Owner haya creado una categoria antes. */
export const CATEGORIA_CUOTA_PASIVO = "Cuotas de deuda";

/**
 * Devuelve la categoria de gasto del tenant con ese nombre, creandola si
 * todavia no existe. Si el Owner ya creo una homonima a mano, la reutiliza
 * en vez de duplicarla.
 *
 * Sin lock: dos operaciones simultaneas del mismo tenant, ambas la primera,
 * podrian crear dos filas homonimas. El costo de esa carrera es una
 * categoria repetida en un desplegable — no un gasto perdido ni un numero
 * mal calculado —, y `categorias_gasto` no tiene (ni deberia tener) un
 * unique por nombre: el usuario puede querer dos categorias parecidas.
 */
async function obtenerOCrearCategoriaGastoPorNombre(
  tenantId: string,
  nombre: string
): Promise<string> {
  const existente = await repo.obtenerCategoriaGastoPorNombre(tenantId, nombre);
  if (existente) return existente.id;
  const creada = await repo.crearCategoriaGasto({ tenantId, nombre });
  return creada.id;
}

/**
 * Convierte el pago de una cuota de Pasivo en el Gasto que le corresponde
 * (`fijo`, `origen = cuota_pasivo_automatica`, referenciando el Pasivo), ya
 * pagado (regla 6). Desde ahi la cuota viaja por el mismo camino que
 * cualquier otro gasto: resta en el estado de resultados, sale en el flujo
 * de caja y aparece en la distribucion por categoria.
 *
 * **La llama `registrarPagoPasivo()` de Patrimonio** (Modulo_05 seccion 2,
 * "hacia Costos & Gastos"), despues de confirmar el pago — antes no la
 * llamaba nadie fuera de los tests, y esa era exactamente la causa de H-27.
 *
 * **Ya NO llama a `registrarPagoPasivo()`.** Antes esta funcion hacia las
 * dos mitades (crear el gasto y decrementar el saldo del Pasivo), lo que
 * ataba Gastos -> Patrimonio; como el disparo correcto es al reves (el pago
 * genera su gasto), esa llamada cerraba un ciclo entre los dos modulos. La
 * flecha quedo en un solo sentido: Patrimonio -> Gastos. Misma inversion
 * que se hizo con Ventas al cerrar H-24.
 *
 * **Gatea por `patrimonio:crear`, no por `costos_gastos:crear`.** La cuota
 * no es una carga manual de gasto: es la consecuencia automatica de un pago
 * de deuda ya autorizado. Pedir `costos_gastos:crear` haria que un
 * colaborador sin ese permiso registre el pago y pierda el gasto en
 * silencio — el mismo defecto silencioso y optimista que esta funcion
 * existe para cerrar (leccion literal de H-24).
 *
 * `categoriaId` es opcional: sin el, se usa (o se crea) la categoria
 * "Cuotas de deuda" del tenant.
 */
export async function generarGastoCuotaPasivo(
  solicitante: UsuarioConRol,
  tenantId: string,
  input: {
    pasivoId: string;
    categoriaId?: string;
    sucursalId?: string;
    monto: string | number;
    fechaGasto: string;
  }
): Promise<Resultado<{ gastoId: string; categoriaId: string; monto: number }>> {
  if (!(await tienePermiso(solicitante, tenantId, "patrimonio", "crear"))) {
    return { ok: false, error: "No tenés permiso para registrar pagos de deuda." };
  }

  const monto = Number(input.monto);
  // Una cuota es un egreso: solo puede restar. Un monto negativo o cero no
  // es una cuota, es un dato roto — mejor rechazarlo que archivar un
  // "gasto" que le sume al resultado (misma leccion que H-30).
  if (!Number.isFinite(monto) || monto <= 0) {
    return { ok: false, error: "El monto de la cuota tiene que ser mayor a 0." };
  }
  const sucursalOperable = await requireSucursalOperable(solicitante, tenantId, input.sucursalId);
  if (sucursalOperable) return sucursalOperable;

  const categoriaId =
    input.categoriaId ??
    (await obtenerOCrearCategoriaGastoPorNombre(tenantId, CATEGORIA_CUOTA_PASIVO));

  const { gasto } = await repo.crearGastoConPagoTx({
    gasto: {
      tenantId,
      // `pasivos` no tiene sucursal_id (Modulo_05 seccion 1.2): una deuda es
      // del negocio, no de un local. El gasto nace sin sucursal y por eso NO
      // aparece en un estado de resultados filtrado por sucursal —
      // `sumarTotalGastosPeriodo` compara con `eq()`, que excluye los null.
      // Decision consciente, fijada con un test.
      sucursalId: input.sucursalId,
      tipo: "fijo",
      categoriaId,
      monto: String(monto),
      fechaGasto: input.fechaGasto,
      origen: "cuota_pasivo_automatica",
      referenciaId: input.pasivoId,
      creadoPor: solicitante.id,
    },
    pago: { monto: String(monto), fechaPago: input.fechaGasto, creadoPor: solicitante.id },
  });

  return { ok: true, data: { gastoId: gasto.id, categoriaId, monto } };
}

/**
 * Convierte la comision ya calculada en una Venta en el Gasto que le
 * corresponde (`variable_no_productivo`, `origen = comision_venta_automatica`,
 * referenciando la venta), ya pagado (regla 6). Desde ahi la comision viaja
 * por el mismo camino que cualquier otro gasto: resta en el estado de
 * resultados, sale en el flujo de caja y aparece en la distribucion por
 * categoria. La llama `registrarVenta` al confirmar la venta (Modulo_03
 * regla 5 / seccion 4.3) — antes no la llamaba nadie fuera de los tests, y
 * esa era exactamente la causa de H-24.
 *
 * **Recibe los datos de la venta en vez de ir a buscarlos.** Antes leia la
 * Venta con `fichaVenta()`, lo que ataba Gastos -> Ventas; como el disparo
 * correcto es al reves (la venta genera su comision, Modulo_03 seccion 5
 * "salidas hacia Costos & Gastos"), esa lectura creaba un ciclo entre los
 * dos modulos. La flecha quedo en un solo sentido: Ventas -> Gastos.
 *
 * **Gatea por `ventas:crear`, no por `costos_gastos:crear`.** La comision no
 * es una carga manual de gasto: es la consecuencia automatica de una venta
 * ya autorizada. Pedir `costos_gastos:crear` haria que un vendedor sin ese
 * permiso registre la venta y pierda la comision en silencio — el mismo
 * defecto silencioso y optimista que esta funcion existe para cerrar.
 *
 * `categoriaId` es opcional: sin el, se usa (o se crea) la categoria
 * "Comisiones de venta" del tenant.
 */
export async function generarGastoComisionVenta(
  solicitante: UsuarioConRol,
  tenantId: string,
  input: {
    ventaId: string;
    sucursalId: string;
    montoComision: string | number;
    fechaVenta: Date | string;
    categoriaId?: string;
  }
): Promise<Resultado<{ gastoId: string; categoriaId: string; monto: number }>> {
  if (!(await tienePermiso(solicitante, tenantId, "ventas", "crear"))) {
    return { ok: false, error: "No tenés permiso para registrar ventas." };
  }

  const monto = Number(input.montoComision);
  // Una comision es un costo: solo puede restar. Un monto negativo o cero no
  // es una comision, es un dato roto — mejor rechazarlo que archivar un
  // "gasto" que le sume al resultado (misma leccion que H-30).
  if (!Number.isFinite(monto) || monto <= 0) {
    return { ok: false, error: "El monto de la comisión tiene que ser mayor a 0." };
  }
  const sucursalOperable = await requireSucursalOperable(solicitante, tenantId, input.sucursalId);
  if (sucursalOperable) return sucursalOperable;

  const fechaGasto =
    input.fechaVenta instanceof Date
      ? input.fechaVenta.toISOString().slice(0, 10)
      : input.fechaVenta.slice(0, 10);

  const categoriaId =
    input.categoriaId ??
    (await obtenerOCrearCategoriaGastoPorNombre(tenantId, CATEGORIA_COMISION_VENTA));

  const { gasto } = await repo.crearGastoConPagoTx({
    gasto: {
      tenantId,
      sucursalId: input.sucursalId,
      tipo: "variable_no_productivo",
      categoriaId,
      monto: String(monto),
      fechaGasto,
      origen: "comision_venta_automatica",
      referenciaId: input.ventaId,
      creadoPor: solicitante.id,
    },
    pago: {
      monto: String(monto),
      fechaPago: fechaGasto,
      creadoPor: solicitante.id,
    },
  });

  return { ok: true, data: { gastoId: gasto.id, categoriaId, monto } };
}

// --- Gastos Recurrentes ---------------------------------------------------------

export interface DatosGastoRecurrente {
  sucursalId?: string;
  categoriaId: string;
  monto: string | number;
  frecuencia: "mensual" | "semanal" | "quincenal" | "anual";
  fechaInicio: string;
  fechaFin?: string;
}

export async function crearGastoRecurrente(
  solicitante: UsuarioConRol,
  tenantId: string,
  input: DatosGastoRecurrente
): Promise<Resultado<{ gastoRecurrenteId: string }>> {
  if (!(await tienePermiso(solicitante, tenantId, "costos_gastos", "crear"))) {
    return { ok: false, error: "No tenés permiso para crear gastos recurrentes." };
  }
  const sucursalOperable = await requireSucursalOperable(solicitante, tenantId, input.sucursalId);
  if (sucursalOperable) return sucursalOperable;
  const gastoRecurrente = await repo.crearGastoRecurrente({
    tenantId,
    sucursalId: input.sucursalId,
    categoriaId: input.categoriaId,
    monto: String(input.monto),
    frecuencia: input.frecuencia,
    fechaInicio: input.fechaInicio,
    fechaFin: input.fechaFin,
    creadoPor: solicitante.id,
  });
  return { ok: true, data: { gastoRecurrenteId: gastoRecurrente.id } };
}

export async function actualizarGastoRecurrente(
  solicitante: UsuarioConRol,
  gastoRecurrenteId: string,
  input: Partial<DatosGastoRecurrente>
): Promise<Resultado<true>> {
  const gastoRecurrente = await repo.obtenerGastoRecurrentePorId(gastoRecurrenteId);
  if (!gastoRecurrente) return { ok: false, error: "Gasto recurrente no encontrado." };
  if (
    !(await tienePermiso(solicitante, gastoRecurrente.tenantId, "costos_gastos", "editar"))
  ) {
    return { ok: false, error: "No tenés permiso para editar este gasto recurrente." };
  }
  if (input.sucursalId !== undefined) {
    const sucursalOperable = await requireSucursalOperable(
      solicitante,
      gastoRecurrente.tenantId,
      input.sucursalId
    );
    if (sucursalOperable) return sucursalOperable;
  }
  await repo.actualizarGastoRecurrente(gastoRecurrenteId, {
    sucursalId: input.sucursalId,
    categoriaId: input.categoriaId,
    monto: input.monto !== undefined ? String(input.monto) : undefined,
    frecuencia: input.frecuencia,
    fechaInicio: input.fechaInicio,
    fechaFin: input.fechaFin,
  });
  return { ok: true, data: true };
}

/** Caso borde 3: detiene la generacion futura sin borrar el historico ya
 * generado. */
export async function desactivarGastoRecurrente(
  solicitante: UsuarioConRol,
  gastoRecurrenteId: string
): Promise<Resultado<true>> {
  const gastoRecurrente = await repo.obtenerGastoRecurrentePorId(gastoRecurrenteId);
  if (!gastoRecurrente) return { ok: false, error: "Gasto recurrente no encontrado." };
  if (
    !(await tienePermiso(
      solicitante,
      gastoRecurrente.tenantId,
      "costos_gastos",
      "anular_ajustar"
    ))
  ) {
    return { ok: false, error: "No tenés permiso para desactivar este gasto recurrente." };
  }
  await repo.actualizarGastoRecurrente(gastoRecurrenteId, { activo: false });
  return { ok: true, data: true };
}

export async function listarGastosRecurrentes(
  solicitante: UsuarioConRol,
  tenantId: string
): Promise<Resultado<Awaited<ReturnType<typeof repo.listarGastosRecurrentesPorTenant>>>> {
  if (!(await tienePermiso(solicitante, tenantId, "costos_gastos", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver gastos recurrentes." };
  }
  return { ok: true, data: await repo.listarGastosRecurrentesPorTenant(tenantId) };
}

/**
 * Genera el Gasto de un periodo desde la plantilla. origen="manual"
 * (decision del plan): a diferencia de la cuota de pasivo o la comision de
 * venta, un gasto recurrente (ej. alquiler) no representa una transaccion
 * con una contraparte que ya quedo registrada en otro modulo — el Owner
 * puede necesitar corregir el monto de un mes puntual sin tocar la
 * plantilla, asi que se comporta como cualquier gasto manual editable
 * (regla 3). Sin pago automatico: sigue el ciclo normal de Pago de Gasto.
 */
export async function generarGastoDesdeRecurrente(
  solicitante: UsuarioConRol,
  gastoRecurrenteId: string,
  input: { fechaGasto: string }
): Promise<Resultado<{ gastoId: string }>> {
  const gastoRecurrente = await repo.obtenerGastoRecurrentePorId(gastoRecurrenteId);
  if (!gastoRecurrente) return { ok: false, error: "Gasto recurrente no encontrado." };
  if (
    !(await tienePermiso(solicitante, gastoRecurrente.tenantId, "costos_gastos", "crear"))
  ) {
    return { ok: false, error: "No tenés permiso para generar gastos." };
  }
  if (!gastoRecurrente.activo) {
    return { ok: false, error: "Este gasto recurrente está desactivado." };
  }
  const sucursalOperable = await requireSucursalOperable(
    solicitante,
    gastoRecurrente.tenantId,
    gastoRecurrente.sucursalId
  );
  if (sucursalOperable) return sucursalOperable;

  const gasto = await repo.crearGasto({
    tenantId: gastoRecurrente.tenantId,
    sucursalId: gastoRecurrente.sucursalId,
    tipo: "fijo",
    categoriaId: gastoRecurrente.categoriaId,
    monto: gastoRecurrente.monto,
    fechaGasto: input.fechaGasto,
    origen: "manual",
    referenciaId: gastoRecurrenteId,
    creadoPor: solicitante.id,
  });

  return { ok: true, data: { gastoId: gasto.id } };
}

// --- Agregados (Modulo_04 seccion 2) ---------------------------------------------------------

export async function consultarTotalCostosFijos(
  solicitante: UsuarioConRol,
  tenantId: string,
  periodo: { desde: string; hasta: string }
): Promise<Resultado<{ totalCostosFijos: number }>> {
  if (!(await tienePermiso(solicitante, tenantId, "costos_gastos", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver gastos." };
  }
  const totalCostosFijos = await repo.sumarGastosPorTipoEnPeriodo(
    tenantId,
    "fijo",
    periodo.desde,
    periodo.hasta
  );
  return { ok: true, data: { totalCostosFijos } };
}

export async function consultarDistribucionPorCategoria(
  solicitante: UsuarioConRol,
  tenantId: string,
  periodo: { desde: string; hasta: string }
): Promise<Resultado<Array<{ categoriaId: string; total: number }>>> {
  if (!(await tienePermiso(solicitante, tenantId, "costos_gastos", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver gastos." };
  }
  const filas = await repo.sumarGastosPorCategoriaEnPeriodo(
    tenantId,
    periodo.desde,
    periodo.hasta
  );
  return { ok: true, data: filas.map((f) => ({ categoriaId: f.categoriaId, total: Number(f.total) })) };
}

// --- Agregados por periodo para Financiero (Modulo_07, seccion 2) ---------------------------------------------------------

export async function consultarPagosGastoEnPeriodo(
  solicitante: UsuarioConRol,
  tenantId: string,
  periodo: { desde: string; hasta: string },
  opts: { sucursalId?: string } = {}
): Promise<Resultado<{ totalPagado: number }>> {
  if (!(await tienePermiso(solicitante, tenantId, "costos_gastos", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver gastos." };
  }
  const totalPagado = await repo.sumarPagosGastoPeriodo(
    tenantId,
    periodo.desde,
    periodo.hasta,
    opts
  );
  return { ok: true, data: { totalPagado } };
}

/** A diferencia de consultarTotalCostosFijos (solo tipo=fijo), suma TODOS
 * los Gasto del periodo — insumo de estado_resultados en Financiero. */
export async function consultarTotalGastosEnPeriodo(
  solicitante: UsuarioConRol,
  tenantId: string,
  periodo: { desde: string; hasta: string },
  opts: { sucursalId?: string } = {}
): Promise<Resultado<{ totalGastos: number }>> {
  if (!(await tienePermiso(solicitante, tenantId, "costos_gastos", "ver"))) {
    return { ok: false, error: "No tenés permiso para ver gastos." };
  }
  const totalGastos = await repo.sumarTotalGastosPeriodo(
    tenantId,
    periodo.desde,
    periodo.hasta,
    opts
  );
  return { ok: true, data: { totalGastos } };
}
