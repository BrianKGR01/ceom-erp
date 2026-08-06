# Arquitectura y calidad — el código contra lo que promete

> Parte de la [auditoría de prelanzamiento](README.md) del 2026-07-27. Este documento responde:
> ¿el código cumple la arquitectura documentada? ¿Qué tan sano está? ¿Qué dice la evidencia
> ejecutada (typecheck, lint, tests, CI)?

---

## 1. Cumplimiento de las reglas de arquitectura no negociables

Contra las 8 reglas de `CLAUDE.md`/`AGENTS.md`, con la evidencia de las auditorías internas previas
contrastada por muestreo:

| Regla | Cumplimiento | Nota |
|---|---|---|
| 1. El Core nunca contiene lógica de nicho | ✅ | La lógica de recetas/lotes vive en `nichos/nicho-1/`; Nicho 4 quedó mínimo a propósito (decisión confirmada, no simetría a medias) |
| 2. Cada módulo es una caja negra | ✅ | Verificado explícitamente en la tanda de UI de Nicho 1 ("ninguna pantalla nueva importa `productos/schema.ts` ni su repository directo"); las integraciones cross-módulo pasan por `actions.ts` públicos |
| 3. Ledger append-only | ✅ con 1 excepción no declarada | Stock/insumos/ventas derivan saldos de movimientos. **Excepción:** el costo de reventa se **pisa** con la última compra (H-25) — válido como política, pero indocumentado |
| 4. Snapshot doble en Ventas | ✅ | `precio_venta_snapshot` + `costo_unitario_snapshot` por línea, probado |
| 5. Soft delete siempre | ✅ | `eliminado_en` en todo el esquema; entidades sin él (Venta, Producción, Simulación) son decisiones documentadas de inmutabilidad |
| 6. Multi-tenant por RLS + `tenant_id` | ⚠️ **A medias — y es el punto más importante** | Toda tabla lleva `tenant_id` y toda query lo filtra a nivel aplicación; las policies `crudPolicy()` están declaradas en las 44 tablas de negocio. Pero la conexión de negocio corre como rol `postgres`, que **bypassea RLS** — la migración al backstop real (`comoUsuario()`) cubre solo Patrimonio y Proveedores. Detalle en [03-seguridad.md](03-seguridad.md) |
| 7. El Gateway es el único punto de autorización de terceros | ✅ | La auditoría de autorización lo confirmó: "el boundary de `/portal` resiste"; revocación cortando acceso en base verificada dos veces |
| 8. Leer módulo y ANCLA antes de codear | ✅ | Los 15 `ANCLA.md` existen y están al día — es la práctica mejor sostenida del proyecto |

**Conclusión:** la arquitectura no es aspiracional — está implementada. El único desvío estructural
real es la regla 6 (RLS como backstop activo), que el propio proyecto ya diagnosticó, planificó y
pausó a conciencia (`docs/security/PLAN-RLS-BACKSTOP.md`).

## 2. Tamaño y forma del código

| Métrica | Valor |
|---|---|
| Líneas TypeScript/TSX en `src/` | ~53.200 |
| Módulos de negocio | 14 (+ 2 nichos bajo `operativo/`) |
| Funciones públicas de módulo (`actions.ts`) | ~223 |
| Endpoints `"use server"` reales | 152, todos clasificados en `src/lib/security/access-manifest.ts` |
| Migraciones SQL (Drizzle) | 41 (`drizzle/migrations/`), append-only respetado |
| Tablas en `public` | 49 (44 de negocio con `tenant_id` + RLS declarada) |
| Archivos de test | 39 |
| Commits | 216 desde el 2026-07-13 |

## 3. Verificaciones ejecutadas hoy (2026-07-27, rama `dev`)

| Verificación | Resultado |
|---|---|
| `pnpm typecheck` | ✅ Pasa limpio |
| `pnpm lint` | ✅ 0 errores; 13 warnings, todos `react-hooks/incompatible-library` (Base UI `SelectTrigger` dentro de forms — cosmético, no funcional) |
| `pnpm test` | Ver §4 |
| CI (GitHub Actions) | ✅ Las últimas 5 corridas en verde (~1m50s). Corre typecheck + lint + tests contra un Postgres 16 con las migraciones reales aplicadas |
| Build de Vercel | ~~— No existe: cero proyectos conectados~~ ⚠️ **Falso desde el 2026-07-27** (corregido acá el 2026-08-06, R-2.2): el proyecto `ceom-erp` existe, con producción desde `main` y previews por PR. **Este renglón es el que la propia 2ª auditoría no incluyó** en su lista de "3 docs que dicen Vercel: cero" — eran 4 lugares, no 3 |

## 4. Estado de los tests — la brecha real es de *nivel*, no de cantidad

**Resultado de hoy: `pnpm test` → 39 archivos, 263 tests, 263 pasando, 0 fallos** (334s, corriendo
contra la base real de desarrollo — así está diseñada la suite). La Fase 1 se sostiene con evidencia
ejecutable, no solo con documentación.

**Lo que los tests cubren bien:** cada módulo tiene su suite de integración contra base real
(prueba de caja negra del contrato), el guard `recursoPerteneceAlTenant` tiene test de regresión, el
manifiesto de acceso tiene un test por AST que **falla si se agrega un endpoint sin clasificar** (la
mejor pieza de ingeniería de calidad del proyecto), y Patrimonio tiene el primer test de aislamiento
cross-tenant real corriendo en CI.

**Lo que no cubre nadie:**

1. **Los 4 flujos completos de la Fase 2 del roadmap** (Nicho 1 de punta a punta, Nicho 4, Modo
   Básico, consentimiento) — 0/6 ítems. La verificación end-to-end que existe fue **manual en
   navegador**, tanda por tanda; nada la re-ejecuta automáticamente, así que cada cambio nuevo puede
   romper el camino dorado sin que CI se entere.
2. **El único spec de Playwright está roto y delata que nadie corre e2e:** `e2e/home.spec.ts` espera
   el texto del placeholder de Next.js ("to get started, edit the page.tsx file") que ya no existe —
   la landing lo reemplazó. `pnpm test:e2e` fallaría hoy. CI ni siquiera lo ejecuta.
3. **Tests cross-tenant por módulo:** solo Patrimonio. La auditoría de autorización recomendó
   extenderlos (§8.2) — con 27 críticos de esa clase ya encontrados una vez, es la regresión más
   valiosa de escribir.

## 5. Deuda técnica — mapa ya hecho, lectura del auditor

El proyecto ya tiene su propio barrido de deuda (`docs/deuda-aplazada.md`, 44 ítems del 2026-07-22)
y es de buena calidad. Lo que esta auditoría agrega:

- **Desde el barrido, el equipo sí retomó los prioritarios:** DA-01 (siembra de categorías al crear
  tenant — verificado hoy: `sembrarCategoriasGastoDefault` se llama desde el alta en `/admin`),
  H-01 (señalización del canal), H-30 (signo del ajuste). El mecanismo "lo que tiene ítem visible se
  cierra, lo que vive solo en un ANCLA duerme" sigue vigente — esta carpeta existe en parte para
  darles ítem visible a los que quedan.
- **DA-03 (=H-24, comisión) ya está cerrado.** Los que siguen abiertos con mejor relación costo/impacto: DA-24
  Proveedores (`entradaStock` sin lector), DA-08/09 (quitar logo/imagen), DA-17 (comisión de evento,
  falta solo el `.tsx`), DA-10 (índice único parcial en vinculaciones producto-receta — riesgo
  latente de corrupción de costos, el patrón ya está resuelto en Consentimiento).
- **Duplicación de UI:** ~6 utilidades (`formatMoneda`, `formatFecha`, `KpiCard`, etc.) copiadas en
  3-6 archivos cada una (auditoría UI/UX §1.7) — ya produjo una divergencia visible al usuario. No
  bloquea el lanzamiento; encarece cada cambio transversal (el ejemplo perfecto: agregar el símbolo
  de moneda a todos los montos hoy exige tocar decenas de archivos).

## 6. Fortalezas que conviene no perder

1. **La disciplina de `ANCLA.md` + verificación en navegador por tanda.** Es la razón por la que
   este proyecto de 2 semanas tiene menos incógnitas que muchos de 2 años.
2. **El manifiesto de acceso con test por AST** — convierte "olvidarse un gate" de error silencioso
   en build roto. Extenderlo, no dejarlo envejecer.
3. **La honestidad documental**: los documentos registran lo que está mal, con severidad y evidencia
   (`hallazgos.md`, `deuda-aplazada.md`). Esta auditoría fue posible en un día por eso.
4. **CI con migraciones reales** contra Postgres de contenedor — la base para los tests de Fase 2.
