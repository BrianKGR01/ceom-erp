# Auditoría de prelanzamiento — CEOM-ERP (2ª edición)

> **📌 Esto es evidencia, no el plan.** La **única fuente de verdad** del estado del proyecto es
> [`docs/roadmap/roadmap.md`](../roadmap/roadmap.md) (v3, 2026-08-06). Los documentos de esta
> carpeta son la evidencia fechada que lo sostiene: **son fotos del 2026-07-29 y no se actualizan**,
> salvo por notas de corrección explícitas donde una afirmación resultó falsa.
>
> **Cambios de nomenclatura que aplican a todo lo de acá** (fijados en la R-2.2 — tabla completa en
> el [Anexo A del roadmap](../roadmap/roadmap.md#anexo-a--nomenclatura)):
> `D1`…`D8` ⇒ `DP-01`…`DP-08` · `D-1`…`D-10` ⇒ `DD-01`…`DD-10` · `tanda 3.x` ⇒ `TI-3.x` ·
> `M1`…`M6` ⇒ `M-01`…`M-06` · las etapas `A`–`G` de [04-roadmap-lanzamiento.md](04-roadmap-lanzamiento.md)
> quedan retiradas en favor de los ítems `R-N.M` del roadmap.
>
> **Qué es esta carpeta.** El resultado de la segunda auditoría integral del proyecto, hecha el
> **2026-07-29** sobre la rama `dev`. La primera auditoría (2026-07-27) y sus 5 diagnósticos
> profundos viven en [`antiguo/`](antiguo/README.md) — siguen siendo referencia válida de diseño
> (varios ANCLA y comentarios de código apuntan ahí), pero sus números y su plan quedaron
> superados por esta edición.
>
> **La pregunta que responde:** ¿qué cambió en los dos días desde la auditoría anterior, en qué
> estado real está el producto hoy, y qué falta exactamente —y en qué orden— para llevarlo a
> producción de verdad?

## Documentos

| Documento | Qué responde |
|---|---|
| Este README | Resumen ejecutivo: veredicto, qué cambió, números verificados, avance por dimensión, hallazgos críticos |
| [01-estado-por-modulo.md](01-estado-por-modulo.md) | Los 14 módulos comparados contra sus docs y ANCLA: qué coincide, qué sigue abierto, qué defectos nuevos aparecieron |
| [02-transversales.md](02-transversales.md) | Seguridad (RLS, autorización, secretos), red de verificación (tests/CI/e2e), UI, e higiene documental (los registros corren detrás del código) |
| [03-operacion-y-comercial.md](03-operacion-y-comercial.md) | La dimensión más débil: producción sirviendo la base de desarrollo, plantillas de Auth desconocidas, sin captura de errores, ciclo comercial congelado |
| [04-roadmap-lanzamiento.md](04-roadmap-lanzamiento.md) | **El plan de acción**: estado ítem por ítem del plan anterior (37 ítems), y el roadmap nuevo por etapas hasta producción |
| [`antiguo/`](antiguo/README.md) | La auditoría del 2026-07-27 completa, con sus 5 diagnósticos profundos (día local, costo ausente, sucursales, instituciones, arranque desde cero) |

---

## Veredicto en tres frases

1. **Los dos días entre auditorías fueron de los más productivos del proyecto, y todo lo declarado
   cerrado es real.** Se re-verificó en código, hallazgo por hallazgo: H-02 (sucursales múltiples
   completas), H-42 + tandas 3.1–3.3b (instituciones), H-15/H-24/H-27/H-31 (la familia del número
   financiero), H-49 (día local), el candado de suite, y **el repo ya está conectado a Vercel con
   deploys de producción automáticos desde `main`** — la suite creció de 263 a 384 tests y **no se
   encontró ni una sola regresión**.
2. **El riesgo ya no es de construcción: es operativo y está vivo hoy.** Existe una URL de
   "producción" pública que sirve **la base de datos de desarrollo** (la misma que la suite de
   tests puebla y limpia), el repo de GitHub es **público con una credencial de `ceom_admin` de QA
   commiteada en un ANCLA**, las plantillas de correo de Auth están en estado "mixto y
   desconocido" (el alta de un negocio real puede congelarse en silencio), y un push directo a
   `main` llega a producción **sin que corra un solo test**. Ninguno de estos cuatro requiere
   construir nada grande — son horas, no semanas — pero son lo primero.
3. **El camino al piloto sigue siendo ~3-5 semanas de trabajo enfocado**, y ahora está mejor
   definido que hace dos días: 4 decisiones de producto siguen sin tomar (precio, roles, costeo,
   "pausada"), el único hallazgo 🔴 real que queda es H-33 (negocio irrecuperable sin el dueño),
   los 4 flujos e2e siguen en cero, y apareció una familia nueva de defectos — **avisos que el
   backend calcula y la UI descarta** (stock del POS, entrada de stock de compras, acreditación de
   producción) — que hace que fallos reales sean invisibles para el usuario.

## Qué cambió desde la auditoría del 2026-07-27 (verificado en código, no en commits)

| Cierre declarado | Veredicto de esta auditoría |
|---|---|
| H-02 — Sucursales múltiples (ABM, tope por plan, freeze en downgrade) | ✅ Real y completo; freeze verificado en los 6 módulos que escriben con `sucursal_id`, con tests |
| H-42 + tandas 3.1, 3.2, 3.3a, 3.3b — Instituciones | ✅ Reales: canje autenticado + TTL + límite de intentos, tercer estado "no aplica", proyección tipada, marcador H-15 al portal, registro de acceso D-1 visible para el negocio |
| H-15 — Producto sin costo ya no cuenta como ganancia pura | ✅ Real de punta a punta (columna, agregados, ranking, POS, portal institucional) — con un residuo: la tarjeta del Dashboard pinta `null` como "0%" |
| H-24 / H-27 — Comisión y cuota de pasivo generan Gasto real | ✅ Reales, con tests de valor exacto y guard anti-código-muerto (`auto-generacion-conectada.test.ts`) |
| H-31 — Compra de Ajuste con efecto observable | ✅ Real de punta a punta (monto efectivo, reversión parcial, estado de resultados) |
| H-49 — Día local | ✅ Real (intervalo semiabierto, `rangoInstantes`, TZ=UTC en CI a propósito) — con 2 fugas nuevas de la misma familia (fecha del gasto de comisión y vencimiento de insumo usan día UTC) |
| V1 — Spec e2e roto | ✅ Arreglado contra la landing real |
| O1 — Vercel | ✅ Conectado: producción desde `main`, previews por PR — pero ver el hallazgo crítico №1 abajo |
| Runbook de arranque + `pnpm auth:config` + `storage:setup` | ✅ Escritos y cableados — pero **nunca ejecutados** (el snapshot de Auth no existe, el ensayo de arranque no se corrió) |

**Regresiones encontradas: 0.** El único retroceso es de consistencia de UI: el patrón
`SubnavMiNegocio` que la auditoría de UI dio por "causa raíz cerrada" ganó una sexta copia con H-02.

## Los números verificados hoy (2026-07-29, en vivo)

| # | Dato | Valor |
|---|---|---|
| 1 | `pnpm typecheck` | ✅ pasa limpio |
| 2 | `pnpm lint` | ✅ 0 errores (19 warnings) |
| 3 | `pnpm test` (suite completa, DB real) | ✅ **46 archivos, 384/384 tests** en 9,1 min (hace 2 días: 39/263) |
| 4 | Tests e2e de los 4 flujos de negocio | **0 de 4** (solo el smoke de la landing, ya arreglado) |
| 5 | Vercel | ✅ Proyecto `ceom-erp`: producción desde `main` (último deploy 2026-07-28, PR #40) + previews por PR |
| 6 | CI (GitHub Actions) | ✅ Verde en los últimos 8 PRs (~2 min) — pero solo corre en `pull_request`, nunca en `push`, y ~15 suites de integración se saltean por falta de secrets |
| 7 | Advisors de seguridad de Supabase | 5 WARN (4 = riesgo aceptado documentado de las funciones RLS; 1 real: leaked password protection) + 2 INFO esperados (deny-all deliberado) |
| 8 | Advisors de performance | 81 FKs sin índice, 57 policies permisivas múltiples (sin cambios, no urge) |
| 9 | Hallazgos del manual: estado real contra código | **10 corregidos, 4 parciales, 31 abiertos (1 🔴: H-33)** — el doc declaraba 7/38 y corría detrás del código. *(✅ `hallazgos.md` actualizado el 2026-08-06 en la R-2.2; este número se confirmó exacto.)* |
| 10 | Precio real del producto | **Sigue sin definir** (Bs 0 en la base viva, verificado por SQL; "Precio a convenir" en Mi Plan es maquillaje) |

## Los 5 hallazgos críticos de esta edición

Detalle y evidencia en [03-operacion-y-comercial.md](03-operacion-y-comercial.md) y
[02-transversales.md](02-transversales.md). Los cinco fueron verificados adversarialmente
(un segundo agente intentó refutar cada uno leyendo el código y el entorno vivo, y no pudo).

1. **La "producción" de Vercel sirve la base de desarrollo, es pública, y el repo público tiene
   una credencial de `ceom_admin` commiteada.** `https://ceom-erp.vercel.app` responde 200 sin
   protección; sus 6 variables apuntan al único proyecto Supabase existente (el de dev, el mismo
   que la suite puebla y limpia); y `src/modules/consentimiento/ANCLA.md:288` publicaba una
   credencial de `ceom_admin` de QA válida contra esa base — cualquiera podía iniciar sesión como
   admin de la plataforma. **Era la acción №1 del roadmap.** *(✅ Neutralizado el 2026-07-30 —
   Fase 0: base vaciada, credencial rotada y retirada de los docs; la Deployment Protection queda
   para la Fase 1.)*
2. **Las plantillas de correo de Auth siguen en estado "mixto y desconocido" con producción viva.**
   El script `pnpm auth:config` que cierra la pregunta existe y nunca se corrió (el snapshot no
   está en ninguna rama). Si la plantilla de invitación sigue de fábrica, el Owner de un negocio
   recién dado de alta **no puede fijar contraseña nunca** y el negocio queda congelado sin error
   visible — la base viva ya muestra 4 invitados que jamás confirmaron.
3. **Un push directo a `main` despliega a producción sin correr un solo test.** `ci.yml` solo se
   dispara en `pull_request`; el build de Vercel solo typechequea. La rama `dev` tampoco tiene CI
   en push. Esta brecha nació al conectar Vercel y ningún doc la registra.
4. **El Panel Admin CEOM re-proyecta a mano y descarta los marcadores de completitud** — la clase
   exacta de defecto que la tanda 3.3a corrigió en el portal institucional, viva en la otra
   superficie de terceros, en violación directa de las reglas #9/#10 de `CLAUDE.md`. El equipo
   CEOM ve estados de resultados presentados como completos sin serlo.
5. **H-33 sigue abierto y es el único 🔴 real: un negocio cuyo dueño no está es irrecuperable**
   salvo escribiendo la base a mano. El diseño para cerrarlo ya está aprobado
   (`docs/decisiones/recuperacion-de-acceso.md` §5-B) y no se implementó. Peor: en un tenant
   vencido, ni siquiera el Owner presente puede transferir la titularidad
   (`transferirOwner` exige escritura habilitada).

## Porcentaje de avance, por dimensión

| Dimensión | 27-jul | **Hoy** | Qué lo mueve |
|---|---|---|---|
| Backend funcional (14 módulos) | ~95% | **~93%** | Sin regresiones, pero esta auditoría profundizó más: H-26 intacto, avisos descartados (C4, POS, producción), validaciones de tenant faltantes (M1/M2, `clienteId` con escritura cross-tenant), sin scheduler |
| Subsistema institucional | — | **~70%** | Tandas 3.1–3.3b cerradas y verificadas; 3.4 (revocación), 3.5 (RLS de `instituciones`, doble identidad) y 3.6 abiertas; `/admin` sin marcadores |
| Cobertura de UI (pantallas construidas) | ~95% | **~95%** | Completa y creciendo (Sucursales, Accesos D-1, landing) — el tracker corre detrás |
| Consistencia y pulido de UI | ~75% | **~72%** | Fases A/B cerradas; la migración masiva (Fase C) sin arrancar; `formatMoneda` con 10 copias + 21 usos crudos; una regresión (6ª copia de subnav) |
| Verificación end-to-end (Fase 2) | ~5% | **~10%** | V1 cerrado; 0/4 flujos; CI sin e2e; decisión de aislamiento de datos pendiente **antes** de escribir los specs |
| Seguridad | ~70% | **~72%** | Rate limit del canje ✅, manifiesto 165 funciones ✅, secretos ✅; backstop RLS sigue 2/9 módulos, G-12 abierto, M1-M6 abiertos (M4 ⅔ cerrado de rebote), leaked password pendiente |
| Infraestructura y operación | ~5% | **~35%** | Vercel conectado + runbook de arranque de 17 pasos + `auth:config` + `storage:setup` escritos — pero nada ensayado, sin Sentry, sin backups probados, y el crítico №1 |
| Ciclo comercial de la suscripción | ~25% | **~25%** | Sin cambios: precio en 0, vencimiento manual, sin avisos, rutina sin documentar |
| Documentación | ~95% | **~85%** | Sigue sobresaliente en volumen, pero el drift creció: los 2 registros de deuda, 4 ANCLA, 3 docs de módulo y el tracker de pantallas corren detrás del código (detalle en [02-transversales.md](02-transversales.md) §4) |

**Lectura honesta:** para un **piloto asistido** (3-10 negocios reales en Vercel + Supabase Cloud),
el proyecto está a **~3-5 semanas de trabajo enfocado** — un poco menos que hace dos días, y con
mucho mejor mapa. La etapa A del roadmap (seguridad inmediata: credencial, base de producción,
plantillas, CI en push) es de **horas**, y conviene hacerla antes que cualquier otra cosa.

## Metodología y alcance

- **Ejecutado en vivo hoy:** `pnpm typecheck`, `pnpm lint`, `pnpm test` (suite completa contra la
  base real, 9,1 min); advisors de seguridad y performance de Supabase (proyecto
  `riertvgnjaujstwyqoom`, el único existente); proyectos y deployments de Vercel; corridas de CI;
  consultas SQL a la base viva (precio del plan, usuarios invitados sin confirmar).
- **Análisis:** 12 agentes en paralelo compararon docs (`docs/modules/`, ANCLA, arquitectura,
  registros de deuda, planes de seguridad, tracker de UI, runbooks) contra `src/` completo, con
  evidencia `archivo:línea` obligatoria por hallazgo.
- **Verificación adversarial:** los 10 hallazgos críticos/altos más graves pasaron por un segundo
  agente instruido para **refutarlos**; 10/10 se confirmaron (uno con corrección de alcance: H-37
  no está "agravado", sigue tal como su registro lo describe).
- **Lo que esta auditoría NO hizo:** no ejecutó la app en navegador ni Playwright (prohibido por
  el candado de la suite en curso), y no re-verificó los ~21 ítems de deuda clasificados "dejar
  dormir" por el barrido del 2026-07-22.

*Auditoría generada el 2026-07-29 sobre `dev` (HEAD `e5f69ea`). Los porcentajes son juicio del
auditor sobre la evidencia citada, no una métrica automática.*
