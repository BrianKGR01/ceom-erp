# Auditoría de prelanzamiento — CEOM-ERP

> **Qué es esta carpeta.** El resultado de una auditoría integral del proyecto hecha el
> **2026-07-27** sobre la rama `dev`: documentación completa de `docs/`, código de los 14 módulos,
> verificaciones ejecutadas en vivo (`pnpm typecheck` / `lint` / `test`), estado real de la base de
> datos en Supabase (advisors, migraciones) y estado real de despliegue (Vercel, CI). **No se
> modificó ningún código** — el único entregable es este diagnóstico.
>
> **La pregunta que responde:** ¿en qué porcentaje está el producto, qué falta para lanzarlo, y qué
> falta para que sea valioso para sus usuarios?

## Documentos

| Documento | Qué responde |
|---|---|
| Este README | Resumen ejecutivo: veredicto, porcentajes, los 10 números que importan |
| [01-estado-funcional.md](01-estado-funcional.md) | Qué hace el producto hoy, por actor; qué hallazgos críticos siguen abiertos (re-verificados contra el código hoy) |
| [02-arquitectura-y-calidad.md](02-arquitectura-y-calidad.md) | Si el código cumple la arquitectura prometida; calidad, tests, CI, deuda técnica |
| [03-seguridad.md](03-seguridad.md) | Postura de seguridad real: qué resiste, qué está a medias, qué falta |
| [04-camino-al-lanzamiento.md](04-camino-al-lanzamiento.md) | Las brechas priorizadas (P0/P1/P2) y un plan por etapas hasta el lanzamiento |
| [05-dia-local-y-reportes.md](05-dia-local-y-reportes.md) | Por qué el día en curso no aparece en ningún reporte: inventario completo, enfoque recomendado, plan de migración y de tests (H-49) |

---

## Veredicto en tres frases

1. **La construcción del producto está esencialmente terminada** (~90%): los 14 módulos del backend
   cerrados con tests, las 119 pantallas del inventario construidas y verificadas en navegador, el
   manual de usuario completo y una landing pública. Es un logro real: todo esto se construyó en
   **dos semanas** (primer commit 2026-07-13, 216 commits).
2. **La preparación para el lanzamiento está aproximadamente al 60%**, y el 40% restante no es más
   construcción: es **desplegar** (hoy no existe ningún entorno fuera de la máquina local — Vercel
   tiene cero proyectos), **verificar los flujos completos** (la Fase 2 del roadmap está 0/6, el
   único test e2e está roto), **cerrar 5 defectos críticos conocidos** y **decidir ~6 cuestiones de
   producto** que solo el dueño puede decidir (precio, sucursales, roles por defecto, entre otras).
3. **El riesgo más caro no es un bug: es la promesa central del producto.** "Todo dato operativo
   termina en un número financiero" es el principio rector #2 de la arquitectura — y hoy la comisión
   de venta se calculaba, se guardaba **y nunca llegaba al Estado de Resultados** (H-24), y una compra
   de ajuste **no tenía ningún efecto observable** (H-31). **Los dos están corregidos** (ver
   [01-estado-funcional.md](01-estado-funcional.md) §2). Un negocio que confiara en esos números los veía
   mejores de lo que son. Cerrar eso vale más que cualquier pantalla nueva.

## Porcentaje de avance, por dimensión

| Dimensión | Avance | Evidencia principal |
|---|---|---|
| Backend funcional (14 módulos, Fase 1) | **~95%** | 14/14 cerrados con tests; residuos: comisión sin conectar, compra de ajuste sin lectura, M1-M6 |
| Cobertura de UI (inventario de pantallas) | **~95%** | 119/119 construidas y verificadas; residuos: capacidad de producción inservible (H-34), stock mínimo sin carga (H-28) |
| Consistencia y pulido de UI | **~75%** | 8 problemas transversales de `docs/ui/AUDITORIA-UI-UX.md` (moneda ausente en montos, componentes duplicados, anchos sin regla) |
| Verificación end-to-end (Fase 2) | **~5%** | 0/6 ítems del roadmap; un solo spec de Playwright, y está roto (busca texto del placeholder de Next.js que ya no existe) |
| Seguridad (Fase 3, parcial) | **~70%** | Auditoría de autorización cerrada (27 críticos corregidos + manifiesto con test por AST sobre 152 funciones); RLS backstop solo 2/10 módulos; sin rate limiting; 4 WARN de advisors abiertos |
| Infraestructura y operación (Fases 4-6) | **~5%** | Runbook de producción escrito y bueno; nada ejecutado; **cero despliegues en Vercel**; sin backups propios, monitoreo ni logging estructurado |
| Ciclo comercial de la suscripción | **~25%** | Catálogo de planes funciona; precio del plan Básico en Bs 0, sin cobro, sin vencimiento automático, sin avisos (H-45/DA-18) |
| Documentación | **~95%** | Arquitectura, 11 módulos, manual de usuario (20 capítulos, 3 actores), runbook, 4 auditorías internas previas — sobresaliente |

**Lectura honesta del número global:** si "lanzar" significa un **piloto asistido** (3-10 negocios
reales invitados por CEOM, corriendo en Vercel + Supabase Cloud), el proyecto está a **~4-6 semanas
de trabajo enfocado**. Si "lanzar" significa la visión completa del roadmap (VPS propio, Supabase
self-hosted, cobro funcionando), hay que sumarle las Fases 4-6 completas.

## Los 10 números que importan (verificados hoy)

| # | Dato | Valor |
|---|---|---|
| 1 | `pnpm typecheck` | ✅ pasa limpio |
| 2 | `pnpm lint` | ✅ 0 errores (13 warnings `react-hooks/incompatible-library`) |
| 3 | `pnpm test` (suite completa, DB real) | ✅ 39 archivos, 263/263 tests pasando |
| 4 | Tests e2e reales de los 4 flujos de negocio | **0** (el único spec existente falla: quedó del template inicial) |
| 5 | Proyectos desplegados en Vercel | **0** |
| 6 | Hallazgos 🔴 del manual aún abiertos | **3 de 6** (H-02, H-33, H-42 — H-24, H-30 y H-31 ya corregidos) |
| 7 | Módulos con RLS de backstop activa | 2 de ~10 (Patrimonio, Proveedores) — plan pausado a propósito |
| 8 | Advisors de seguridad de Supabase | 4 WARN + 1 INFO (ninguno crítico; detalle en [03-seguridad.md](03-seguridad.md)) |
| 9 | Decisiones de producto pendientes que bloquean trabajo | ~6 (ver [04-camino-al-lanzamiento.md](04-camino-al-lanzamiento.md) §2) |
| 10 | Precio real del producto | **sin definir** (plan Básico en Bs 0, visible para el cliente en "Mi Plan") |

## Qué hace falta para que sea valioso para los usuarios — en una tabla

El detalle por actor está en [01-estado-funcional.md](01-estado-funcional.md); esto es el resumen:

| Actor | Lo que ya recibe | Lo que le falta para confiar/operar |
|---|---|---|
| **Negocio (Owner)** | El camino dorado completo: catálogo → venta → dashboard con datos reales; producción por recetas (Nicho 1); compras con landed cost (Nicho 4); patrimonio, gastos, simulaciones, reportes; comisión de canal y ajuste de compra ya descontados del resultado (H-24, H-31) | Que el resto de los costos también llegue al resultado (H-27 cuotas de pasivo, H-15 productos sin costo, H-26, DA-06); sucursales reales o que dejen de prometerse (H-02); roles predefinidos para invitar a su equipo sin armar una matriz de 40 casillas (H-35) |
| **Colaborador** | Login, permisos por rol funcionando de verdad (server-side), POS | Un menú que se adapte a sus permisos (H-08); que el Owner pueda armarle un rol sin fricción (H-35) |
| **Institución** | Canje de código, magic link de reingreso, cartera, ficha de negocio con solo lo aprobado | Poder canjear un **segundo** código sin romperse (H-42 — es su caso más probable); correo obligatorio al alta (H-43) |
| **Equipo CEOM** | Panel completo: tenants, planes, instituciones, logs, manual integrado | Recuperar un negocio cuyo dueño no está (H-33 — hoy la única salida es tocar la base a mano); dar de alta a otro admin (H-14); que la suscripción venza/avise sola (H-45) |

## Metodología y alcance

- **Fuentes:** los ~9.400 renglones de documentación de estado en `docs/` (roadmap, tracker de
  pantallas, barrido de deuda aplazada, 4 auditorías internas previas, 48 hallazgos del manual,
  observaciones de uso), contrastados **contra el código actual** — cada hallazgo crítico citado acá
  se re-verificó hoy con búsquedas sobre `src/` (varios ya estaban corregidos y así se registra).
- **Verificaciones ejecutadas:** `pnpm typecheck`, `pnpm lint`, `pnpm test`; advisors de seguridad y
  performance de Supabase (proyecto `riertvgnjaujstwyqoom`); listado de proyectos/deployments de
  Vercel; historial de PRs y corridas de CI en GitHub.
- **Lo que esta auditoría NO hizo:** no ejecutó la app en navegador (las tandas de UI ya fueron
  verificadas así por el equipo y está documentado), no corrió Playwright contra un entorno vivo, y
  no re-auditó línea por línea los 53.000 renglones de TypeScript — se apoya en las auditorías
  internas previas y las contrasta por muestreo.

*Auditoría generada el 2026-07-27 sobre `dev`. Los porcentajes son juicio del auditor sobre la
evidencia citada, no una métrica automática.*
