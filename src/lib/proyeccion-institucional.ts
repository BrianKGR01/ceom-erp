/**
 * Proyección institucional: cómo un módulo de consumo decide qué campos de una
 * función del Core llegan a un tercero (institución, Panel Admin CEOM).
 *
 * **El defecto que esto cierra (X-03).** `detalleFinanciero()` recibía siete
 * campos de `estadoResultados()` y reenviaba **tres elegidos a mano**. Entre
 * los descartados estaba `ingresosSinCostoConocido` —el marcador de H-15, que
 * sí llega a cuatro pantallas del dueño—, así que la institución veía el mismo
 * número **presentado como completo** (X-01). Y el mecanismo seguía en pie:
 * cada campo nuevo del origen nacía invisible para el tercero, en silencio, sin
 * que nada fallara. No era un bug, era una fábrica de bugs.
 *
 * **Qué garantiza el compilador, y qué no.** Escrito sin adornar, porque la
 * diferencia importa:
 *
 * | | ¿Lo garantiza el tipo? |
 * |---|---|
 * | Un campo nuevo del origen **no puede ignorarse** | ✅ Sí — el mapa deja de ser exhaustivo y `pnpm typecheck` falla |
 * | Un campo declarado marcador **no puede omitirse** | ✅ Sí — su única clasificación posible es `"marcador"` |
 * | Que un campo nuevo **entre** a la lista de marcadores | ❌ No — es una decisión humana |
 *
 * Lo tercero es la asimetría honesta de este diseño. Se mitiga de dos formas,
 * ninguna de las cuales es una garantía dura:
 *
 * 1. **La lista de marcadores la exporta el módulo de ORIGEN, no el consumidor.**
 *    Quien escribe `ingresosSinCostoConocido` está editando `financiero/actions.ts`
 *    en ese mismo momento, y agrega una línea al lado del campo que acaba de
 *    crear — en vez de tener que acordarse de ir a editar un mapa en otro
 *    módulo. Es la decisión tomada en el lugar de máximo contexto.
 * 2. **Omitir exige `esMarcador: false` explícito.** No se puede descartar un
 *    campo sin *afirmar* que no es un marcador de completitud. El compilador no
 *    sabe semántica y no puede verificar esa afirmación — pero convierte un
 *    **olvido silencioso** en una **afirmación escrita y equivocada**, que es
 *    revisable en un diff.
 *
 * Justificación completa: `docs/architecture/CEOM_Arquitectura.md` §3 principio
 * 7 y §3.1, y `docs/auditoria-prelanzamiento/antiguo/08-instituciones-punta-a-punta.md`
 * §4.8 (X-03) y D-10.
 */

/** Por qué se omite un campo, y la afirmación de que no es un marcador. */
export interface Omitido {
  /** Por qué este campo NO viaja al tercero. Se lee en el diff. */
  omitido: string;
  /**
   * Afirmación explícita de que este campo no cambia cómo se lee un número.
   * No admite `true`: un marcador no se omite, se expone — para eso está la
   * lista `MARCADORES_*` del módulo de origen.
   */
  esMarcador: false;
}

/**
 * Clasificación EXHAUSTIVA de los campos de `TOrigen`. Los que figuren en
 * `TMarcador` solo admiten `"marcador"`; el resto, `"expuesto"` o `Omitido`.
 *
 * Se usa siempre con `as const satisfies` — `satisfies` conserva los tipos
 * literales (que es lo que permite derivar el tipo de salida) mientras verifica
 * la restricción. Con una anotación `:` normal, TypeScript ensancharía los
 * valores a la unión y el tipo proyectado se perdería.
 */
export type Clasificacion<TOrigen, TMarcador extends keyof TOrigen> = {
  [K in keyof TOrigen]-?: K extends TMarcador ? "marcador" : "expuesto" | Omitido;
};

/** Las claves cuya clasificación es un string (`"expuesto"` o `"marcador"`). */
type ClavesQueViajan<TClasif> = {
  [K in keyof TClasif]: TClasif[K] extends string ? K : never;
}[keyof TClasif];

/** El objeto que efectivamente llega al tercero, derivado del mapa. */
export type Proyectado<TOrigen, TClasif> = Pick<
  TOrigen,
  Extract<ClavesQueViajan<TClasif>, keyof TOrigen>
>;

/**
 * Aplica la clasificación: copia los campos `"expuesto"`/`"marcador"` y deja
 * afuera los `Omitido`.
 *
 * Recorre las claves del MAPA y no las del objeto de origen, a propósito: si el
 * origen devolviera en runtime un campo que el mapa no conoce (respuesta de una
 * versión distinta, un `...spread` inesperado), no se filtra al tercero. El
 * tipo ya lo impide en compilación; esto lo impide también en ejecución.
 */
export function proyectar<TOrigen extends object, TClasif extends Record<keyof TOrigen, unknown>>(
  origen: TOrigen,
  clasificacion: TClasif
): Proyectado<TOrigen, TClasif> {
  const salida: Record<string, unknown> = {};
  for (const clave of Object.keys(clasificacion) as Array<keyof TOrigen & string>) {
    if (typeof clasificacion[clave] === "string") salida[clave] = origen[clave];
  }
  return salida as Proyectado<TOrigen, TClasif>;
}
