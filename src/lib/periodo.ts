// Unica definicion de "un dia" en todo el sistema (H-49).
//
// El problema que este modulo resuelve: los reportes reciben el periodo como
// dos fechas de solo-dia ("2026-07-01", "2026-07-27") y las convertian con
// `new Date(...)`, que las ancla a MEDIANOCHE UTC. Bolivia es UTC-4, asi que
// ese borde cortaba a las 20:00 del dia anterior y el dia en curso nunca
// entraba en ningun reporte. El diagnostico completo, con el inventario de
// los 11 lugares afectados y la demostracion del modo de falla, esta en
// docs/auditoria-prelanzamiento/antiguo/05-dia-local-y-reportes.md.
//
// Las dos reglas que este modulo hace cumplir:
//
//   1. Un rango de dias LOCALES se traduce a un intervalo SEMIABIERTO de
//      instantes `[inicio, fin)`. Nunca `<= fin`: sobre un timestamp, el `<=`
//      siempre deja afuera parte del ultimo dia — es literalmente el bug.
//   2. La zona horaria es una propiedad del NEGOCIO, no del servidor (Vercel
//      corre en UTC) ni del navegador (viaja con el usuario). Entra por
//      parametro explicito; ninguna funcion de aca lee el huso del entorno.

/**
 * Zona horaria de referencia del negocio. Hoy es una constante: todos los
 * tenants operan en Bolivia, que ademas no tiene horario de verano (offset
 * fijo UTC-4 desde 1932).
 *
 * No se usa directamente desde el resto de la app — se llega a ella por
 * `zonaHorariaTenant()`, ver el porque ahi.
 */
export const ZONA_HORARIA_NEGOCIO = "America/La_Paz";

/**
 * Zona horaria del tenant.
 *
 * **Recibe `tenantId` y es asincrona a proposito, aunque hoy devuelva una
 * constante.** La decision de producto (2026-07-27) fue fijar una zona unica
 * ahora y dejar la puerta abierta a que sea configurable por negocio. Lo caro
 * de retrofitear no es la columna: es la costura — que es exactamente la
 * situacion que produjo H-49, donde el borde del periodo estaba cableado en 14
 * archivos. Con esta firma, migrar a `tenants.zona_horaria` es cambiar el
 * cuerpo de esta funcion; sin ella seria volver a barrer los mismos archivos.
 *
 * Los 10 llamadores (la capa de acciones de Ventas, Nicho 1, Proveedores y
 * Consentimiento) ya tienen el `tenantId` a mano y ya son asincronos, asi que
 * la firma no le cuesta nada a nadie hoy.
 */
export async function zonaHorariaTenant(tenantId: string): Promise<string> {
  void tenantId;
  return ZONA_HORARIA_NEGOCIO;
}

/** Un dia calendario en formato `YYYY-MM-DD` — lo que manda un `<input type="date">`. */
export type DiaISO = string;

export interface Periodo {
  desde: DiaISO;
  hasta: DiaISO;
}

/** Intervalo semiabierto de instantes: `inicio <= t < fin`. */
export interface RangoInstantes {
  inicio: Date;
  fin: Date;
}

const FORMATO_DIA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Offset de `zona` respecto de UTC, en minutos, EN ESE INSTANTE.
 *
 * Se calcula formateando el instante en la zona y re-leyendo esas partes como
 * si fueran UTC: la diferencia con el instante original es el offset. Usa la
 * base de datos de husos IANA que ya trae `Intl` — por eso este modulo no
 * necesita ninguna dependencia nueva, y por eso funciona con horario de verano
 * sin conocer las reglas de cada pais.
 */
function offsetEnMinutos(instante: Date, zona: string): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: zona,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instante);

  const v: Record<string, string> = {};
  for (const p of partes) v[p.type] = p.value;

  const comoUtc = Date.UTC(
    Number(v.year),
    Number(v.month) - 1,
    Number(v.day),
    // `hour12:false` devuelve "24" en vez de "00" en algunos motores.
    Number(v.hour) % 24,
    Number(v.minute),
    Number(v.second)
  );
  return (comoUtc - instante.getTime()) / 60_000;
}

/** El dia calendario (`YYYY-MM-DD`) en que cae `instante` visto desde `zona`. */
export function diaLocalDe(instante: Date, zona: string): DiaISO {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instante);
  // en-CA ya formatea como YYYY-MM-DD.
  return partes;
}

/**
 * Aritmetica de dias calendario, pura: `YYYY-MM-DD` -> `YYYY-MM-DD`. No
 * interviene ningun huso, porque un dia calendario no tiene huso — se opera en
 * UTC solo para reutilizar el manejo de meses y anios bisiestos de `Date`.
 */
export function sumarDias(dia: DiaISO, dias: number): DiaISO {
  const [a, m, d] = dia.split("-").map(Number);
  const siguiente = new Date(Date.UTC(a, m - 1, d));
  siguiente.setUTCDate(siguiente.getUTCDate() + dias);
  return siguiente.toISOString().slice(0, 10);
}

/** Dias calendario entre dos dias, inclusive de los dos extremos. */
function largoEnDias(desde: DiaISO, hasta: DiaISO): number {
  const ms =
    new Date(`${hasta}T00:00:00Z`).getTime() - new Date(`${desde}T00:00:00Z`).getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

/**
 * El instante en que empieza el dia `dia` en `zona`.
 *
 * Algoritmo de dos pasadas, que es lo que hace falta para no equivocarse en
 * los cambios de horario de verano:
 *
 *  1. Se asume medianoche UTC y se corrige por el offset vigente en ese
 *     instante; eso da un candidato.
 *  2. El offset en el candidato puede ser otro (si el cambio de hora cae
 *     dentro del dia), asi que se calcula un segundo candidato.
 *  3. Gana el candidato mas temprano cuyo dia local SEA `dia`. Si ninguno lo
 *     es —caso de la medianoche que no existe, cuando el reloj salta de 23:59
 *     a 01:00— se toma el mas tardio, que es el instante de la transicion y
 *     por lo tanto el primer momento real de ese dia.
 *
 * Bolivia no tiene horario de verano, asi que en produccion siempre gana la
 * primera pasada; las otras ramas existen para que el helper sea correcto si
 * algun dia hay un tenant en una zona que si lo tiene (ver `zonaHorariaTenant`).
 */
export function instanteDeDiaLocal(dia: DiaISO, zona: string): Date {
  if (!FORMATO_DIA.test(dia)) {
    throw new Error(`Fecha invalida "${dia}": se esperaba YYYY-MM-DD.`);
  }
  const [a, m, d] = dia.split("-").map(Number);
  const medianocheUtc = Date.UTC(a, m - 1, d, 0, 0, 0, 0);

  const offset1 = offsetEnMinutos(new Date(medianocheUtc), zona);
  const candidato1 = medianocheUtc - offset1 * 60_000;

  const offset2 = offsetEnMinutos(new Date(candidato1), zona);
  const candidato2 = medianocheUtc - offset2 * 60_000;

  const candidatos = candidato1 === candidato2 ? [candidato1] : [candidato1, candidato2];
  const validos = candidatos.filter((c) => diaLocalDe(new Date(c), zona) === dia);

  return new Date(validos.length > 0 ? Math.min(...validos) : Math.max(...candidatos));
}

/**
 * Traduce un rango de dias locales al intervalo de instantes `[inicio, fin)`
 * que hay que usar contra una columna `timestamptz`.
 *
 * `fin` es el comienzo del dia local SIGUIENTE a `hasta` — por eso el filtro
 * correspondiente es `lt(columna, fin)` y nunca `lte`. Cubrir el dia `hasta`
 * completo es justamente lo que H-49 no hacia.
 *
 * Para columnas `date` (gastos, compras, patrimonio) esto NO se usa: ahi los
 * dias se comparan como texto y no hay instante ni huso en juego. Ver el mapa
 * completo de que columna es de cada tipo en el documento de diagnostico.
 */
export function rangoInstantes(periodo: Periodo, zona: string): RangoInstantes {
  return {
    inicio: instanteDeDiaLocal(periodo.desde, zona),
    fin: instanteDeDiaLocal(sumarDias(periodo.hasta, 1), zona),
  };
}

/**
 * El dia de hoy segun el negocio, listo para un `<input type="date">`.
 *
 * Los formularios usaban `new Date().toISOString().slice(0, 10)`, que da el dia
 * **UTC**: pasadas las 20:00 de Bolivia proponian MANANA como fecha por defecto.
 * Mientras los reportes tampoco contaban el dia en curso el error pasaba
 * inadvertido; ahora que cuentan, un pago cargado a la noche con el default sin
 * corregir cae en el reporte del dia siguiente.
 */
export function hoyLocal(zona: string): DiaISO {
  return diaLocalDe(new Date(), zona);
}

// --- Presets de periodo ---------------------------------------------------------
// Viven aca y no en `app/(shell)/periodo-presets.ts`, que es de donde salieron:
// los consumian tambien /admin y /portal importando cruzado desde la carpeta de
// /app, y sobre todo tenian su propia nocion de "hoy", distinta de la de
// `instanteDeDiaLocal`. Tener dos definiciones de dia es exactamente lo que
// produjo H-49.

export type PeriodoPresetId = "hoy" | "7dias" | "mes" | "anio";

export const PERIODOS_PRESET: { id: PeriodoPresetId; label: string }[] = [
  { id: "hoy", label: "Hoy" },
  { id: "7dias", label: "Últimos 7 días" },
  { id: "mes", label: "Este mes" },
  { id: "anio", label: "Este año" },
];

/**
 * Traduce un preset al rango de dias locales del negocio.
 *
 * **`zona` es un parametro obligatorio, no un default del entorno.** La version
 * anterior derivaba "hoy" del reloj del proceso donde corriera: en el servidor
 * el huso de Vercel (UTC), en el navegador el del usuario. Como ademas mezclaba
 * las dos bases —`hasta` salia de `toISOString()` (UTC) y `desde` de los
 * getters locales—, el render del servidor y el primer clic del usuario podian
 * dar rangos distintos. En el cruce de anio daban directamente anios distintos.
 * Hoy no se nota porque la maquina de desarrollo esta en America/La_Paz; en
 * produccion aparecia al desplegar.
 *
 * `ahora` se inyecta para poder probar la funcion sin depender del reloj.
 */
export function calcularRangoPreset(
  id: PeriodoPresetId,
  zona: string,
  ahora: Date = new Date()
): Periodo {
  const hoy = diaLocalDe(ahora, zona);
  switch (id) {
    case "hoy":
      return { desde: hoy, hasta: hoy };
    case "7dias":
      return { desde: sumarDias(hoy, -6), hasta: hoy };
    case "mes":
      return { desde: `${hoy.slice(0, 7)}-01`, hasta: hoy };
    case "anio":
      return { desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy };
  }
}

/**
 * Mismo largo en dias, inmediatamente anterior a `desde` — para el delta "vs
 * periodo anterior" del Dashboard.
 *
 * Aritmetica de dias calendario pura: no toca husos ni instantes. La version
 * anterior parseaba a `Date` y mezclaba getters UTC con setters locales; daba
 * bien de casualidad porque los dos errores se cancelaban.
 */
export function calcularPeriodoAnterior(periodo: Periodo): Periodo {
  const largo = largoEnDias(periodo.desde, periodo.hasta);
  const hasta = sumarDias(periodo.desde, -1);
  return { desde: sumarDias(hasta, -(largo - 1)), hasta };
}
