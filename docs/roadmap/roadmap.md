# CEOM-ERP — Roadmap general (v2, 2026-07-30)

> **Qué es este documento:** el plan vigente de principio a fin, con casillas para ir marcando.
> Reemplaza al [roadmap de construcción original](antiguo/roadmap.md) (cuya Fase 1 —los 14
> módulos, 14/14— sigue siendo el registro histórico válido). La evidencia de cada ítem vive en
> la [auditoría de prelanzamiento v2](../auditoria-prelanzamiento/README.md); acá solo el plan.
>
> Convención: `[ ]` pendiente · `[~]` parcial/en curso · `[x]` cerrado y verificado (con fecha).
>
> **La regla que ordena este roadmap: las fases son consecutivas por diseño.** Cada fase deja
> algo que las siguientes usan, y ninguna fase obliga a volver a tocar lo que una anterior cerró:
> el entorno y CI se endurecen **antes** de escribir más código (todo lo posterior corre
> protegido); las decisiones de producto se toman **antes** de las correcciones (para codificar
> una sola vez); lo funcional se cierra **antes** de la pasada de UI (para no re-pulir pantallas
> dos veces); la UI se cierra **antes** de los e2e (para no reescribir selectores); los e2e
> existen **antes** del despliegue real (para desplegar protegido); y el piloto ocurre **antes**
> de endurecer lo que solo el uso real prioriza.

---

## Fase 0 — Base limpia y acceso de prueba

*Por qué primero: los datos de prueba actuales se crearon a mitad de la construcción y no pasaron
por los flujos completos — ensucian cada verificación. Además, vaciar Auth invalida la credencial
de QA que quedó commiteada en un repo público (crítico №1 de la auditoría).*

- [ ] **0.1** Vaciar todos los datos de negocio, Auth y Storage de la base de desarrollo,
      **preservando las filas de sistema que las migraciones sembraron** (tenant CEOM Ops, roles
      de sistema Owner/CEOM Admin/Gateway, plan Básico, usuario Gateway bloqueado — migraciones
      `0005`/`0007`/`0034`). El journal de migraciones no se toca.
- [ ] **0.2** Crear el `ceom_admin` de QA nuevo por Admin API con contraseña directa (sin depender
      de plantillas de correo). La credencial se comparte por canal directo — **nunca más
      commiteada en un doc**.
- [ ] **0.3** Quitar la credencial vieja de `src/modules/consentimiento/ANCLA.md` (queda inerte
      por el vaciado, pero no debe seguir escrita) y barrer otros secretos en docs.
- [ ] **0.4** Verificar el arranque sobre base limpia: `pnpm storage:setup` (idempotente) y la
      suite completa en verde contra la base vacía.

**Criterio de salida:** suite 384+ en verde sobre base limpia; ningún secreto vigente commiteado.

## Fase 1 — Contención del entorno y red mínima de CI

*Por qué acá: son horas de trabajo que protegen todo lo que viene después. Nada de las fases
siguientes las invalida.*

- [ ] **1.1** Activar **Deployment Protection** en Vercel: la URL pública deja de servir la base
      de desarrollo hasta que exista producción real (se quita en la Fase 6).
- [ ] **1.2** Activar **leaked password protection** en Supabase Auth (toggle; único WARN real).
- [ ] **1.3** Correr `pnpm auth:config` con `SUPABASE_ACCESS_TOKEN` y commitear el snapshot;
      corregir las 2 plantillas custom si el veredicto da ❌ (sin tocar las 2 PKCE — el script lo
      verifica). ⚠️ Requiere un token de Management API que solo el dueño puede generar.
- [ ] **1.4** CI: agregar trigger `push` a `main` (y a `dev`), y `SUPABASE_SECRET_KEY` como
      secret para que las ~15 suites de integración dejen de saltearse en CI.
- [ ] **1.5** Verificar un alta de Owner de punta a punta con correo real (invitación → clic →
      contraseña → `/app`) — es la prueba viva de 1.3.

**Criterio de salida:** URL pública protegida; un push a `main` no puede desplegar sin tests; el
flujo de invitación probado con un correo real.

## Fase 2 — Decisiones de producto e higiene de los registros

*Por qué acá: varias correcciones de la Fase 3 dependen de estas decisiones (codificar una vez,
no dos), y la pasada de higiene evita re-trabajar cosas ya cerradas.*

- [ ] **2.1** Sesión de decisiones del dueño (una sola, con acta en este archivo):
      **D1** precio real del plan Básico · **D3** roles por defecto (sí/no a la propuesta) ·
      **D4** política de costeo de reventa · **D6** semántica de "pausada" + downgrade vs.
      consentimientos (H-47) · **D7** config de plan letra muerta (¿aplicarla o quitarla?) ·
      **D8** regenerar o no los 5 pagos históricos (Bs 10.700) y las 2 ventas a las 00:00Z ·
      anotar **D5 = sí** (piloto con instituciones, decidida de facto).
- [ ] **2.2** Pasada de higiene documental (media jornada): `hallazgos.md` y `deuda-aplazada.md`
      al estado real (10 corregidos/31 abiertos, DA-01/03 cerrados, DA-04 parcial), los 4 ANCLA
      desactualizados, `Modulo_01/04/07/08/11`, tracker de pantallas, tabla de tandas del doc 08,
      y los 3 docs que aún dicen "Vercel: cero". Detalle completo:
      [02-transversales.md §4](../auditoria-prelanzamiento/02-transversales.md).

**Criterio de salida:** cero decisiones bloqueantes; los registros de deuda son confiables para
planificar.

## Fase 3 — Correcciones funcionales: los números y avisos dicen la verdad

*Por qué acá: es el grueso del P0 funcional. Se hace después de decidir (Fase 2) y antes de la
pasada de UI (Fase 4), porque varios de estos cambios agregan piezas de interfaz que la Fase 4
pulirá una sola vez. Evidencia por ítem:
[01-estado-por-modulo.md](../auditoria-prelanzamiento/01-estado-por-modulo.md).*

- [ ] **3.1** H-33 — designar/reasignar Owner por `ceom_admin` con auditoría (diseño ya aprobado
      en `docs/decisiones/recuperacion-de-acceso.md` §5-B; función nueva con `tenantId` explícito,
      no un bypass de `transferirOwner`). El único 🔴 del sistema.
- [ ] **3.2** Familia "el aviso se calcula y se descarta" (un solo patrón, cuatro lugares):
      `entradaStock` al registrar/recibir compra (DA-24/C4), `acreditacionOk` de producción,
      `avisosStock` del POS (H-37, incluyendo stock visible por producto), `ajusteStock` del
      ajuste de venta. Test por cada uno con el caso de permisos cruzados.
- [ ] **3.3** H-26 — los ajustes de venta afectan el total derivado y recalculan `estado_pago`
      (espejo del patrón ya resuelto en Proveedores con H-31).
- [ ] **3.4** Validaciones de pertenencia al tenant: evento abierto y propio, canal propio y
      `clienteId` propio en `registrarVenta` (hoy hay escritura cross-tenant de
      `ultima_compra_en`); lo mismo en `importarVentaHistorica` (M2, incl. sucursal congelada);
      sucursal destino en `consolidarStockDeSucursal`. Cierra M1/M2.
- [ ] **3.5** Familia H-49 residual + consistencia de derivados: fecha del gasto de comisión por
      día local del tenant; vencimiento de insumo desde `fecha_compra` (día local); formato del
      historial de simulaciones con TZ fija; `flujoCaja` sin pagos de gastos soft-eliminados;
      validaciones de `registrarPagoPasivo` a nivel módulo; validación server-side de
      simulaciones (los zod hoy muertos).
- [ ] **3.6** DA-06 — el filtro de sucursal dice la verdad: propagar `sucursalId` a
      `rankingProductos`/`historicoVentas`/`margenPorCanalYProducto`/`distribucionGastos`/
      `controlMerma`, o avisar en el Dashboard qué tarjetas no lo respetan.
- [ ] **3.7** `/admin` con la proyección institucional tipada: marcador H-15, estados
      error/no-aplica y cobertura por sucursal en la Ficha de Tenant (cierra la violación de las
      reglas #9/#10; reutiliza `lib/proyeccion-institucional.ts`).
- [ ] **3.8** Institucional P0: H-43 correo de institución obligatorio (con aviso), RLS de
      `logs_acceso_institucion` a solo-SELECT, D-4 parte 2 (validar módulos veedor contra el
      nicho al generar código).
- [ ] **3.9** El cron único (Vercel Cron ya viable): transición `activa→vencida` (H-45),
      generación de recurrentes y cuota periódica (H-10/DA-04), purga de `intentos_canje` y
      retención de logs D-1. Si se decide diferirlo: escribir la rutina manual (O5) en
      `docs/production/` — una de las dos, no ninguna.
- [ ] **3.10** Implementar lo decidido en 2.1: roles por defecto + filtrado por sucursal
      (`usuarios.sucursalId`, Etapa 5 de H-02) + menú según permisos/rubro (H-08) + alta de
      `ceom_admin` desde `/admin` (H-14); política de costeo aplicada o documentada (D4);
      config de plan aplicada o retirada (D7); regeneración de históricos si D8 = sí.

**Criterio de salida:** suite en verde con tests nuevos por ítem; `hallazgos.md` actualizado al
cierre de cada uno (no al final).

## Fase 4 — Consistencia de UI: una sola pasada, con todo lo funcional ya adentro

*Por qué acá: las primitivas ya existen (Fases A/B de la auditoría de UI); esta es la migración
mecánica que quedó pendiente, hecha una vez y sobre pantallas ya funcionalmente completas.
Detalle: [02-transversales.md §3](../auditoria-prelanzamiento/02-transversales.md) y
`docs/ui/AUDITORIA-UI-UX.md` §6.*

- [ ] **4.1** Integrar `/app/mi-negocio/sucursales` al submenú del sidebar **antes** de borrar
      los subnav duplicados (hoy son su única navegación).
- [ ] **4.2** Un solo `formatMoneda` (el de `lib/format.ts`) con símbolo de moneda en **todos**
      los montos: eliminar las 10 copias locales y los 21 `toLocaleString` crudos.
- [ ] **4.3** Anchos según la tabla de `max-w` de `design-system.md` §7; subnav de Mi Negocio
      centralizado (borrar las 6 copias); migrar consumidores a Tabs/ToggleGroup/EmptyState.
- [ ] **4.4** Lote responsive móvil (UI-011 compras, UI-041/UI-043 del shell).
- [ ] **4.5** Restos de H-15 en UI: la tarjeta del Dashboard deja de pintar `null` como "0%";
      H-34 según lo decidido (campos de capacidad en el form de Activo, o quitar la pantalla).
- [ ] **4.6** Actualizar `docs/ui/pantallas.md` y `AUDITORIA-UI-UX.md` al cierre (tachar lo
      hecho, registrar pantallas nuevas).

**Criterio de salida:** verificación en navegador de una muestra de pantallas por módulo; ningún
monto sin símbolo de moneda; cero copias de subnav.

## Fase 5 — Verificación end-to-end

*Por qué acá: los specs se escriben sobre una UI ya estable (Fase 4) y protegen el despliegue
(Fase 6). Detalle: [02-transversales.md §2](../auditoria-prelanzamiento/02-transversales.md).*

- [ ] **5.1** Decidir el aislamiento de datos para e2e (extender el advisory lock a Playwright,
      base dedicada, o proyecto efímero) — **antes** de escribir los specs.
- [ ] **5.2** Los 4 flujos e2e: Modo Básico, Nicho 1, Nicho 4, consentimiento institucional —
      con seed + `storageState` de login en el setup.
- [ ] **5.3** `test:e2e` corriendo en CI (browsers incluidos).
- [ ] **5.4** Extender `tenant-aislamiento.test.ts` a Ventas, Gastos, Productos e Identidad, y
      los 2 tests faltantes de panel-admin-ceom (prerequisito del checklist RLS).

**Criterio de salida:** los 4 flujos corren en CI sin intervención manual (criterio literal de la
Fase 2 del roadmap original, por fin cumplido).

## Fase 6 — Despliegue real

*Por qué acá: desplegar protegido por los e2e, sobre una base de producción virgen. El ensayo del
arranque y la creación de producción son el mismo acto. Detalle:
[03-operacion-y-comercial.md](../auditoria-prelanzamiento/03-operacion-y-comercial.md).*

- [ ] **6.1** Crear el proyecto Supabase de **producción** ejecutando el runbook de 17 pasos tal
      cual está escrito ([antiguo/09 §3.2](../auditoria-prelanzamiento/antiguo/09-arranque-desde-cero.md));
      cada desvío se anota como hallazgo del runbook.
- [ ] **6.2** Reapuntar las 6 variables de Vercel Production al proyecto nuevo; quitar la
      Deployment Protection de 1.1. Dev/preview siguen contra la base de desarrollo.
- [ ] **6.3** Captura de errores (Sentry o equivalente) + probar que un error forzado llega al
      canal del equipo.
- [ ] **6.4** Confirmar retención de backups del plan de Supabase Cloud + **una restauración de
      prueba**; healthcheck/uptime mínimo sobre la URL de producción.
- [ ] **6.5** Precio real cargado en el plan Básico (decidido en 2.1; el formulario ya existe).

**Criterio de salida:** el checklist "listo para lanzar" de
[04-roadmap-lanzamiento.md §5](../auditoria-prelanzamiento/04-roadmap-lanzamiento.md) completo.

## Fase 7 — Piloto (3-10 negocios asistidos)

- [ ] **7.1** Primer tenant real: el caso validado SanttiCampo, alta asistida por `ceom_admin`.
- [ ] **7.2** Rutina semanal escrita y en uso: errores (6.3), feedback, ciclo de suscripción
      (hasta que 3.9 lo automatice del todo).
- [ ] **7.3** Un tenant piloto completa el camino dorado sin asistencia posterior al alta.
- [ ] **7.4** Backlog del piloto: lo que los usuarios griten ordena la Fase 8.

## Fase 8 — Endurecimiento post-piloto

- [ ] Tandas institucionales 3.4–3.6 (revocación coherente, RLS de `instituciones` D-2, G-16,
      G-09/G-10) y **G-12** (backstop de RLS del Gateway en Ventas/Gastos/Financiero/Nicho 1).
- [ ] Migración RLS módulo por módulo (checklist ya escrito) + `FORCE` en Patrimonio; al
      completar, eliminar el export crudo `db` (Etapa 6 del plan de backstop).
- [ ] M3/M5/M6 residuales de la auditoría de autorización; costo promedio multi-sucursal
      (decidir alcance); DA-10 (índice único de vinculaciones); DA-12.
- [ ] Exportación de reportes PDF/Excel (DA-05/H-20) — según demanda real del piloto.
- [ ] Resto del P2 histórico (paginación, FKs de performance, DA-38, etc.).

## Fase 9 — Self-hosting (la visión de infraestructura completa)

- [ ] Fases 4–6 del [roadmap original](antiguo/roadmap.md) con el runbook existente
      (`docs/production/produccion.md`), migración ensayada con los datos reales del piloto.

---

## Cómo se actualiza este documento

- Marcar casillas **al cerrar cada ítem, con fecha** — no al final de la fase.
- Si un ítem cambia de fase o aparece uno nuevo, anotarlo acá con una línea de motivo (nunca
  borrar en silencio) — igual que el roadmap original.
- Al cerrar cada ítem funcional, actualizar en el mismo cambio su rastro en
  `docs/manual/hallazgos.md` / `docs/deuda-aplazada.md` (lección de la auditoría v2: los
  registros que corren detrás del código hacen re-trabajar lo cerrado).
