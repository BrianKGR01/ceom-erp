# ANCLA — Módulo: Reportes y Dashboard

## Contrato (no romper sin actualizar este archivo)
- Responsabilidad: capa de presentación que compone, en una sola vista, las
  métricas que cada módulo ya expone por su cuenta. **Cero tablas propias,
  cero lógica de negocio propia** — principio rector explícito de
  `Modulo_10_reportes.md`, llevado al extremo respecto a Financiero/
  Simulaciones (que al menos tienen alguna fórmula pura propia).
- NO hace: no almacena ni recalcula nada — si un dato está mal en el
  Dashboard, el error está en el módulo dueño de ese dato, nunca acá. No
  implementa exportación PDF/Excel (sección 6 del doc) — es una capa de
  presentación/plantilla visual, fuera de alcance mientras no exista UI en
  el proyecto. No implementa el Dashboard institucional gateado — ese ya
  es `src/modules/monitoreo-institucional/` (roadmap ítem #11), un módulo
  aparte con su propio gate de `tieneConsentimiento()`; este módulo
  (`reportes`) es la vista **interna** del Owner/equipo del tenant.
- Entradas que consume: `estadoResultados`/`flujoCaja`/
  `calcularMargenPorcentaje` (Financiero, la última pura y reutilizada),
  `consultarDistribucionPorCategoria` (Gastos, ya existía),
  `rankingProductos`/`historicoVentas`/`margenPorCanalYProducto` (Ventas,
  **nuevas en esta tarea**), `consultarMermaPeriodo` (Operativo Nicho 1, ya
  existía — se construyó en Módulo 6 anticipando exactamente esta adenda).
  Todo caja negra vía `actions.ts`.
- Salidas que expone (`actions.ts`): `resumenPeriodo`, `rankingProductos`,
  `distribucionGastos`, `historicoVentas`, `estadoResultados` (re-exportada
  de Financiero), `flujoCaja` (re-exportada de Financiero),
  `margenPorCanalYProducto`, `controlMerma`.

## Estado actual
- [x] `actions.ts` con las 8 vistas del doc, sin `schema.ts` ni
      `repository.ts` — no hay estado que migrar.
- [x] `rankingProductos`/`margenPorCanalYProducto` calculan `margenPct` acá
      (no en Ventas) reutilizando `calcularMargenPorcentaje()` de
      Financiero — ver "Decisiones" abajo, motivo: ciclo de imports.
- [x] `controlMerma` delega directo a `consultarMermaPeriodo` (Nicho 1) sin
      lógica de nicho propia — para un tenant Nicho 4/Modo Básico (sin
      Producciones) da 0 de forma natural, cumple caso borde 1 del doc sin
      código especial.
- [x] Tests: `reportes.test.ts` (integración contra Supabase Cloud real) —
      caso de uso 1 (resumen con datos reales), caso borde 1 aplicado dos
      veces (`distribucionGastos` y `controlMerma` en un tenant sin datos
      → vacío/cero, nunca error). Sigue la regla 4 del doc explícita
      ("nunca testea reglas de negocio, porque no las tiene") — no se
      duplicó el fixture pesado de producción de
      `operativo-nicho1.test.ts` solo para volver a probar la fórmula de
      merma, que ya está probada en su módulo de origen.
- [ ] Exportación PDF/Excel (sección 6 del doc) — explícitamente fuera de
      alcance, documentado, no silencioso. Queda para cuando se aborde la
      fase de UI (co-branding negocio + marca discreta de CEOM, mismo
      layout que pantalla, ya investigado y confirmado en el doc).
- [x] **Primera UI real** (`src/app/app/(shell)/dashboard-resumen.tsx` +
      `inicio-actions.ts`, pantalla de Inicio): Sección A completa del
      Dashboard (Resumen del período, Flujo de Caja, Productos más
      vendidos, Gastos por categoría, Merma) — cierra el "camino dorado"
      del MVP (`docs/ui/pantallas.md`).
- [x] **Sección B — Reportes Detallados** (`src/app/app/(shell)/reportes/`,
      route actions.ts propio en `reportes/actions.ts` a nivel de ruta,
      wrapper de las funciones del módulo — no confundir con este archivo):
      4 pantallas — Resumen Financiero (`/app/reportes`, con mockup, Estado
      de Resultados formal + Flujo de Caja reusado + **Valor Patrimonial
      Total** embebido, cierra el pendiente de Patrimonio), Margen por
      Canal y Producto (`/app/reportes/margen-canal-producto`, con mockup,
      pivot table producto × canal), Histórico de Ventas
      (`/app/reportes/historico-ventas`, sin mockup — reusa literalmente el
      gráfico de barras y la paleta del Dashboard) e Ranking de Productos —
      vista completa (`/app/reportes/ranking-productos`, sin mockup — reusa
      literalmente el widget de ranking del Dashboard, sin límite de N, con
      filtro de canal agregado). Botón "Ver reportes detallados" del
      Dashboard conectado. Módulo 14 queda 9/9 pantallas. Sin cambio de
      contrato de `actions.ts` del módulo — todo consumido tal cual ya
      existía.
- ⚠️ **Limitación real de filtro conocida**: el selector de sucursal del
  Dashboard solo filtra `resumenPeriodo`/`flujoCaja` (que sí aceptan
  `sucursalId` opcional) — `rankingProductos`, `distribucionGastos` y
  `controlMerma` no reciben `sucursalId` en su firma, así que esas 3
  tarjetas siempre muestran el consolidado del tenant sin importar la
  sucursal elegida. No es un bug de la UI, es la firma real de estas 3
  funciones — si se quiere resolver, es un cambio de contrato acá (y en
  Ventas/Gastos/Nicho 1), no en la pantalla.

## Cambio de contrato en Ventas
- **Ventas** (`src/modules/ventas/actions.ts`): `rankingProductos`,
  `historicoVentas`, `margenPorCanalYProducto` — nuevas, agregados de solo
  lectura por período (mismo patrón que las de Financiero). Devuelven
  ingresos/costos crudos, **no** `margenPct` calculado — ver "Decisiones"
  abajo. Ver `ventas/ANCLA.md`.

## Dónde está cada cosa
- Server actions (todo el módulo — no hay `schema.ts` ni `repository.ts`):
  `src/modules/reportes/actions.ts`
- Tests: `src/modules/reportes/reportes.test.ts`
- Sin migración — este módulo no agrega tablas.

## Decisiones tomadas que un agente no debe revertir
- **`rankingProductos`/`margenPorCanalYProducto` de VENTAS no calculan
  `margenPct`** — solo devuelven `ingresos`/`costos` crudos. Motivo:
  Financiero ya importa Ventas (`consultarIngresosPeriodo`, etc.); si
  Ventas importara `calcularMargenPorcentaje()` de Financiero para calcular
  el margen ahí mismo, se cerraría un ciclo de imports. Reportes, que ya
  importa ambos módulos sin problema, es quien calcula `margenPct` final
  para mostrar. `rankingProductos` de Ventas sí **ordena** internamente por
  un ratio de margen cuando `criterio="margen"` — es un ratio de
  ordenamiento interno (`(ingresos-costos)/ingresos`), no la fórmula de
  negocio reutilizable con nombre propio. No "arreglar" esto moviendo el
  cálculo de vuelta a Ventas.
- **`consultarMermaPeriodo` se reutiliza directo desde Operativo Nicho 1,
  sin dispatch de nicho** — Reportes no tiene (ni necesita) lógica para
  distinguir "este tenant es Nicho 1 vs Nicho 4 vs Modo Básico" antes de
  llamar la función; simplemente la llama siempre, y el resultado natural
  (0 si no hay Producciones) ya es correcto para los otros dos casos.
- Los tests de integración corren contra el Supabase Cloud de desarrollo
  real (rol `postgres`, bypassea RLS), mismo criterio que los demás
  módulos.

## Última actualización: 2026-07-16 — primera UI real (Dashboard, Sección A) — cierra el camino dorado del MVP; sin cambio de contrato de `actions.ts`

## Última actualización: 2026-07-17 — Sección B (Reportes Detallados) completa, módulo 14 al 9/9; widget Valor Patrimonial Total de Patrimonio embebido en Resumen Financiero; sin cambio de contrato de `actions.ts`
