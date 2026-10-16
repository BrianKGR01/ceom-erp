# Roadmap Cafiatto (paralelo al roadmap principal)

> Documento APARTE. `docs/roadmap/roadmap.md` no se toca. Estado: **PROPUESTA, sin aprobar**.
> Fuente funcional: `cafiato/CEOM_Flujo_Operativo_Cafiatto.pdf` (26 secciones) y
> `cafiato/CEOM · Cafiatto — Interfaz (1).html` (8 pantallas mock).
> Fecha: 2026-10-16.

## 0. Decisiones pendientes (bloquean el inicio)

| # | Pregunta | Recomendación |
|---|----------|---------------|
| 1 | Consumo del personal: ¿baja (PDF) o bonificación (mock)? | Bonificación |
| 2 | ¿Anular una venta devuelve insumos? | No por defecto, con opción explícita |
| 3 | Insumo sin stock: ¿bloquear o permitir negativo? | Bloquear salvo `vender_sin_stock` |
| 4 | PIN y descuentos por rol: ¿ahora o después? | Después; usar capacidades por rol |
| 5 | ¿Solo Cafiatto o capacidad general de Nicho 1? | General |
| 6 | Conversión de unidades en compras: ¿este ciclo? | Fase 7 (después) |

## 1. Principios

- Toda la lógica vive en `src/modules/operativo/nichos/nicho-1/` (regla 1). Ventas solo llama
  a una fachada neutral `src/modules/operativo/actions.ts` (regla 2); hay que añadir esa flecha
  Ventas→Operativo a la matriz de `CEOM_Arquitectura.md` §7.
- Ledger append-only, snapshot de costo en la venta, soft delete, RLS en la misma migración.
- Base única compartida con producción (2 negocios reales): ninguna migración sin mostrar el SQL
  antes, ensayo en postgres efímero (worktree + Docker) y verificación del objeto real después.
- Migraciones nuevas con `when` > 1785246768682 en `_journal.json`.
- Funcionalidad detrás de configuración, apagada por defecto.

## 2. Fases

### Fase 0 — Prerrequisitos (sin funcionalidad nueva) — ✅ HECHA en rama `feat/cafiatto` (2026-10-16)
- Entorno de pruebas aislado (worktree + postgres:16 en Docker, arranque manual).
- Revisar deriva de `0021_simulaciones` (tabla existe, no registrada en migraciones aplicadas).
- Tanda B de H-51: idempotencia de ventas en servidor (+ H-26). Migración: mostrar SQL antes.
- DA-45: bloqueo del caché de stock ante movimientos concurrentes.
- Salida: suite verde en entorno aislado.

### Fase 1 — Consumo por receta al vender (cierra H-53) — ✅ código y tests hechos en `feat/cafiatto`; falta migrar la base real
- (Real: 0050 = idempotencia de ventas, Fase 0; 0051 = `salida_venta`; 0052 = `modo_consumo` + precisión 4 decimales de insumos.) Migración: `modo_consumo` (`al_producir` | `al_vender`) en `vinculaciones_producto_receta`.
- Migración 0051/0052: columnas de snapshot de costo de receta en detalle de venta y movimientos
  de insumo con origen venta.
- Fachada `operativo/actions.ts`: `consumirRecetaPorVenta` (después del commit, regla 11).
- `registrarVenta` (`ventas/actions.ts` ~424-623): calcular costo desde receta, congelarlo y
  descontar insumos según `modo_consumo`.
- Reusa las 21 recetas actuales de Cafiatto (rendimiento 1 UND).
- Tests: unitarios del cálculo, integración venta→movimientos, concurrencia, RLS, guardas
  (`contexto.test.ts`, `sin-db-crudo-en-transaccion.test.ts`, `access-manifest.ts`).

### Fase 2 — Bajas de insumos y producto
- Tabla `bajas` + motivos (merma, vencido, accidente, otro), movimiento append-only.
- UI de registro y listado; permisos por capacidad.

### Fase 3 — Variantes y modificadores
- Variante con receta y precio propios (Modulo_03 §4.2: cada variante es un Producto).
- Modificadores: agrega, reemplaza, indicación. Snapshot por línea.
- Cambios en carrito del POS (`pos-cliente.tsx`, hoy por `productoId`).

### Fase 4 — Caja y turnos (módulo configurable, apagado por defecto)
- Turnos: apertura con fondo, cierre; esperado = fondo + efectivo + entradas − salidas.
- Entradas/salidas manuales, diferencia al cierre, historial.

### Fase 5 — Bonificación (según decisión 1 y 4)
- Bonificación hasta 100 % con motivo; PIN/descuento por rol según decisión 4.
- Consumo del personal modelado como se decida.

### Fase 6 — Dashboard, navegación y cierre
- Dashboard operativo: ventas por hora y por vendedor, rentabilidad.
- Navegación del sidebar por nicho (hoy hardcoded en `app-shell.tsx`).
- Ocultar en Vender productos sin receta completa; seeds de demo; e2e Playwright.

### Fase 7 — Conversión de unidades en compras (opcional, tras decisión 6)

## 3. Riesgos principales

| Riesgo | Mitigación |
|--------|-----------|
| Base única con negocios reales | Ensayo en efímero, SQL previo, flag apagado, verificación posterior |
| Descuento de stock fuera de la transacción de venta (atomicidad cruzada) | Fase 0 + reconciliación; documentar |
| Ventas duplicadas sin idempotencia | Tanda B antes de Fase 1 |
| Caché de stock pierde concurrencia (DA-45) | Lock en Fase 0 |
| Orden de migraciones por `when` | Verificar journal y `journal-migraciones.test.ts` |
| Conflicto PDF vs mock (personal) | Decisión 1 |
| Violar regla 1 (lógica de nicho en Core) | Fachada neutral + revisión de matriz §7 |
| Regla 11 (conexiones en transacción) | Llamadas entre módulos después del commit |

## 4. Conexiones y accesos necesarios

| Recurso | Estado | Para qué |
|---------|--------|----------|
| Supabase MCP (solo lectura) | Disponible, lo usé | Esquema, migraciones, advisors |
| Supabase escritura / migraciones en producción | Se pedirá aprobación en cada una | Aplicar 0050+ |
| Vercel MCP | 403 sobre `ceom-erp` (el equipo visible solo tiene `drinks-on-chain-*`) | Estado de despliegues |
| Docker Desktop | Arranque manual | Postgres efímero para tests |
| `SEED_DEMO_PASSWORD` en `.env.local` | Por confirmar | Seeds |
| GitHub (`gh`) | Por confirmar | PR y CI |

## 5. Definición de terminado por fase
`pnpm test`, `pnpm typecheck`, `pnpm lint` en verde; `ANCLA.md` actualizado; matriz §7 revisada;
commit por fase (memoria: commit por módulo).
