// Presets de período para el Dashboard de Inicio — funciones puras, sin
// directiva "use client"/"use server" a proposito (se usan de los dos
// lados: server en page.tsx, cliente en dashboard-resumen.tsx). No existe
// ningun helper de backend que traduzca un preset a fechas (confirmado
// contra financiero/reportes/gastos/operativo) — el shape {desde, hasta}
// en formato YYYY-MM-DD coincide estructuralmente con PeriodoFinanciero/
// PeriodoConsulta de esos modulos.

export type PeriodoPresetId = "hoy" | "7dias" | "mes" | "anio";

export const PERIODOS_PRESET: { id: PeriodoPresetId; label: string }[] = [
  { id: "hoy", label: "Hoy" },
  { id: "7dias", label: "Últimos 7 días" },
  { id: "mes", label: "Este mes" },
  { id: "anio", label: "Este año" },
];

function formatearFecha(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

export function calcularRangoPreset(id: PeriodoPresetId, hoy: Date = new Date()): {
  desde: string;
  hasta: string;
} {
  const hasta = formatearFecha(hoy);
  switch (id) {
    case "hoy":
      return { desde: hasta, hasta };
    case "7dias": {
      const desde = new Date(hoy);
      desde.setDate(desde.getDate() - 6);
      return { desde: formatearFecha(desde), hasta };
    }
    case "mes": {
      const desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      return { desde: formatearFecha(desde), hasta };
    }
    case "anio": {
      const desde = new Date(hoy.getFullYear(), 0, 1);
      return { desde: formatearFecha(desde), hasta };
    }
  }
}

/** Mismo largo en días, inmediatamente anterior a `desde` — para el delta "vs período anterior". */
export function calcularPeriodoAnterior(periodo: { desde: string; hasta: string }): {
  desde: string;
  hasta: string;
} {
  const desde = new Date(periodo.desde);
  const hasta = new Date(periodo.hasta);
  const largoDias = Math.max(
    1,
    Math.round((hasta.getTime() - desde.getTime()) / (24 * 60 * 60 * 1000)) + 1
  );
  const nuevaHasta = new Date(desde);
  nuevaHasta.setDate(nuevaHasta.getDate() - 1);
  const nuevaDesde = new Date(nuevaHasta);
  nuevaDesde.setDate(nuevaDesde.getDate() - (largoDias - 1));
  return { desde: formatearFecha(nuevaDesde), hasta: formatearFecha(nuevaHasta) };
}
