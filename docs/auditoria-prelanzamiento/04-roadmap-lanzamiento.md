# Roadmap al lanzamiento — 2ª edición (2026-07-29)

> **📌 Nota (2026-07-30):** el tracker vivo del proyecto es ahora
> [`docs/roadmap/roadmap.md`](../roadmap/roadmap.md), que reorganiza estas etapas en fases
> consecutivas con casillas. Este documento queda como el detalle/evidencia de la auditoría que
> lo originó — las casillas se marcan allá, no acá.
>
> Parte de la [auditoría de prelanzamiento, 2ª edición](README.md). Reemplaza a
> [`antiguo/04-camino-al-lanzamiento.md`](antiguo/04-camino-al-lanzamiento.md). Documento de
> acción: primero el cierre contable del plan anterior (qué se hizo de verdad), después el plan
> nuevo por etapas. La evidencia de cada afirmación está en los documentos 01–03.
>
> Convención: `[ ]` pendiente · `[~]` parcial · `[x]` hecho y verificado en esta auditoría.

---

## 0. Cierre del plan anterior — los 37 ítems, ítem por ítem

**Balance: 6 hechos, 8 parciales, el resto pendiente.** Lo que se cerró se cerró bien (con tests);
lo pendiente está intacto — no hubo cierres a medias sin registrar, hubo foco en otra cosa
(instituciones + arranque, que el plan anterior subestimaba).

| Ítem | Estado | Nota corta |
|---|---|---|
| D1 Precio del Básico | `[ ]` | Bs 0 en la base viva; "Precio a convenir" es maquillaje |
| D2 Sucursales (H-02) | `[x]` | Completo con tests; DA-06 quedó fuera de alcance y sigue abierto |
| D3 Roles por defecto (H-35) | `[ ]` | Ni decisión ni código |
| D4 Costeo de reventa (H-25) | `[ ]` | Se sigue pisando con última compra, sin declarar |
| D5 ¿Piloto con instituciones? | `[~]` | Decidido **sí de facto** (3 tandas invertidas) — sin anotar; ⇒ H-43 sube a P0 |
| D6 "Pausada" (H-46) / downgrade vs consentimientos (H-47) | `[ ]` | Sin decidir; pausada = bloqueado por seguridad (testeado) |
| C1 Comisión → gasto (H-24) | `[x]` | Con test de valor exacto |
| C2 Compra de Ajuste (H-31) | `[x]` | De punta a punta |
| C3 Recuperación de negocio (H-33) | `[~]` | Solo la Opción C (recovery de contraseña); **designar Owner sigue sin existir** |
| C4 Leer `entradaStock` (DA-24) | `[~]` | El módulo lo expone y testea; **la ruta lo descarta** — el aviso nunca llega al usuario |
| C5 Ajustes → total/estado de cobro (H-26) | `[ ]` | Intacto; venta anulada queda "pendiente" para siempre |
| V1 Spec e2e de home | `[x]` | Contra la landing real |
| V2 4 flujos e2e en CI | `[ ]` | 0/4; CI sin Playwright |
| V3 Seed en setup de e2e | `[ ]` | Sin globalSetup ni storageState |
| O1 Vercel conectado | `[x]` | Producción desde `main` + previews — pero ver crítico №1 (base de dev) |
| O2 Endurecimiento Auth | `[~]` | Rate limit del canje ✅; REVOKE reclasificado correctamente como riesgo aceptado; **leaked password pendiente**; rate limits no verificables sin el snapshot |
| O3 Captura de errores | `[ ]` | En cero |
| O4 Backups confirmados + restauración | `[ ]` | Sin evidencia |
| O5 Rutina de suscripción escrita | `[ ]` | No existe en `docs/production/` |
| P1 (8 ítems) | `[ ]`×7 `[~]`×1 | Solo H-42 hecho (de P1-2); H-43, moneda, POS, M1-M6/RLS, exportación, cron, menores: intactos |
| Checklist §6 (10 casillas) | 2 parciales, resto pendiente | CHK-5 tenía criterio inválido (los 4 WARN son aceptados); reescrito abajo en §5 |

## 1. La decisión marco se mantiene (y ya está medio ejecutada)

**Lanzamiento piloto en Vercel + Supabase Cloud; self-hosting (Fases 4-6) después del piloto,
con el runbook ya escrito.** Sin cambios respecto del plan anterior — con una precisión: la etapa
"Desplegar" ya arrancó sola y por el paso más riesgoso (hay producción pública sirviendo la base
de desarrollo). El plan nuevo ordena primero contener eso.

## 2. El plan nuevo, por etapas

### Etapa A — Contención de seguridad (horas, no días — antes que todo lo demás)

- [ ] **A1.** Rotar la contraseña del `ceom_admin` de QA y **borrar la credencial de
      `src/modules/consentimiento/ANCLA.md:288`** (el repo es público). Barrer otros secretos en
      docs/ANCLA.
- [ ] **A2.** Decidir y ejecutar una de dos, hoy: **(a)** Deployment Protection en Vercel mientras
      no exista el Supabase de producción, o **(b)** crear el proyecto de producción y reapuntar
      las 6 variables (runbook paso 16). La (b) es además el ensayo de arranque de A5.
- [ ] **A3.** Activar leaked password protection (toggle; único WARN real de advisors).
- [ ] **A4.** `SUPABASE_ACCESS_TOKEN=... pnpm auth:config` + commitear el snapshot → cierra el
      estado "mixto y desconocido" de las plantillas. Corregir las 2 plantillas custom si el
      veredicto da ❌ (sin tocar las 2 PKCE — el script lo verifica).
- [ ] **A5.** CI: agregar trigger `push` a `main` (y idealmente `dev`), y `SUPABASE_SECRET_KEY`
      como secret para que las ~15 suites de integración dejen de saltearse en CI.

### Etapa B — Decidir y ordenar los papeles (una sesión de trabajo del dueño + media jornada)

- [ ] **B1.** Las 4 decisiones pendientes, en una sesión: **D1** precio real, **D3** roles por
      defecto (sí/no a la propuesta escrita), **D4** política de costeo (documentarla u optar por
      promedio), **D6** semántica de "pausada" + downgrade vs consentimientos (H-47). Anotar
      además D5 = sí (ya decidida de facto). Decisiones nuevas de esta auditoría: **D7** config de
      plan letra muerta (¿aplicarla o quitarla del formulario?), **D8** regenerar o no los 5 pagos
      históricos de pasivo (Bs 10.700) y las 2 ventas a las 00:00Z.
- [ ] **B2.** Pasada de higiene documental (media jornada, ordena todo lo demás): hallazgos.md
      (H-30/H-06/H-18 corregidos; H-01/H-05/H-12/H-32 parciales; H-33 único 🔴),
      deuda-aplazada.md (DA-01/DA-03 cerrados, DA-04 parcial), tabla de tandas del doc 08,
      ANCLA de monitoreo-institucional/panel-admin-ceom/identidad/suscripcion,
      `Modulo_01/04/07/08/11`, tracker de pantallas (+Sucursales, +Accesos D-1, +landing),
      `AUDITORIA-AUTORIZACION.md` (M4 ⅔ cerrado, layout `/admin`), UI-044/UI-038, y los 3 docs
      que aún dicen "Vercel: cero".

### Etapa C — Números y avisos que digan la verdad (el grueso del trabajo funcional P0)

*Criterio: cerrar la familia "el aviso se calcula y se descarta" completa con un solo patrón
(propagar y mostrar, como ya hace `registrarCompraDeAjusteAction`), y los huecos que hacen mentir
a un número.*

- [ ] **C1.** H-33: designar/reasignar Owner por `ceom_admin` con registro de auditoría — el
      diseño ya está aprobado (`docs/decisiones/recuperacion-de-acceso.md` §5-B, 3 condiciones).
      Función nueva con `tenantId` explícito (no un bypass sobre `transferirOwner`, que es
      caller-implícita).
- [ ] **C2.** H-26: los ajustes afectan el total derivado y recalculan `estado_pago`
      (espejo de lo que Proveedores ya hace con H-31: `derivarEstadoPago` contra monto efectivo).
- [ ] **C3.** Familia avisos descartados: `entradaStock` (registrar/recibir compra),
      `acreditacionOk` (producción), `avisosStock` (POS — H-37, mostrar además stock disponible),
      `ajusteStock` (ajuste de venta). Test por cada uno con el caso de permisos cruzados.
- [ ] **C4.** Validaciones de tenant en Ventas: evento abierto y propio, canal propio,
      `clienteId` propio (hoy escribe `ultima_compra_en` cross-tenant), y las mismas en
      `importarVentaHistorica` (M1/M2). Sucursal destino en `consolidarStockDeSucursal`.
- [ ] **C5.** Familia H-49 residual: fecha del gasto de comisión por día local del tenant,
      vencimiento de insumo desde `fecha_compra` (día local), formato del historial de
      simulaciones con TZ fija. `flujoCaja` sin pagos de gastos soft-eliminados (o bloquear el
      borrado con pagos). Validaciones de `registrarPagoPasivo` a nivel módulo.
- [ ] **C6.** Panel Admin CEOM: reemplazar la re-proyección a mano por
      `lib/proyeccion-institucional.ts` (marcador H-15, estados error/no-aplica, cobertura por
      sucursal) — cierra la violación de reglas #9/#10.
- [ ] **C7.** H-43: correo de institución obligatorio al alta (con D5 = sí, es P0), con el aviso
      "sin correo no puede entrar al portal".
- [ ] **C8.** RLS de `logs_acceso_institucion` a solo-SELECT para el tenant, y D-4 parte 2
      (validar módulos veedor contra el nicho al generar código).
- [ ] **C9.** El cron único (Vercel Cron ya viable): transición `activa→vencida` desde
      `fecha_proximo_pago` (H-45), generación de recurrentes (H-10/DA-04) y cuota periódica,
      purga de `intentos_canje` y retención de logs D-1. Si se decide no automatizar aún:
      escribir la rutina manual O5 en `docs/production/` — una de las dos, no ninguna.

### Etapa D — Red de verificación (antes del piloto, no después)

- [ ] **D-1.** Decidir el aislamiento de datos para e2e (extender el advisory lock a Playwright,
      base dedicada, o proyecto Supabase efímero) — **antes** de escribir los specs.
- [ ] **D-2.** Los 4 flujos e2e de la Fase 2 (Modo Básico, Nicho 1, Nicho 4, consentimiento) con
      seed + storageState en el setup (V3), y el paso `test:e2e` en CI con browsers.
- [ ] **D-3.** Extender `tenant-aislamiento.test.ts` a Ventas, Gastos, Productos e Identidad
      (el patrón ya corre en CI; replicarlo es barato), y los 2 tests faltantes de
      panel-admin-ceom que el checklist RLS exige.

### Etapa E — Desplegar de verdad (si A2 fue la opción (a), acá va la (b))

- [ ] **E1.** Proyecto Supabase de producción creado ejecutando el runbook de 17 pasos tal cual
      está escrito — **el ensayo es el arranque**; cada desvío se anota como hallazgo del runbook.
- [ ] **E2.** Reapuntar las 6 variables de Vercel Production; `dev`/preview siguen contra la base
      de desarrollo.
- [ ] **E3.** Captura de errores (Sentry o equivalente) + probar que un error forzado llega al
      canal del equipo (O3).
- [ ] **E4.** Confirmar retención de backups del plan de Supabase Cloud + **una restauración de
      prueba** (O4). Un healthcheck/uptime mínimo sobre la URL de producción.
- [ ] **E5.** Precio real cargado (D1 ya decidida en B1) — el formulario de `/admin/planes` ya
      existe; es un dato.

### Etapa F — Piloto (3-10 negocios asistidos)

- El caso validado SanttiCampo primero; alta asistida por `ceom_admin` como modelo de
  go-to-market. Rutina semanal: revisar errores (E3), feedback, y el diálogo de suscripción
  (hasta que C9 lo automatice). Los P1 se ordenan por lo que el piloto grite.

### Etapa G — Después del piloto

- Tandas 3.4–3.6 de instituciones (revocación coherente, RLS de `instituciones` D-2, G-16,
  G-09/G-10) y **G-12** (backstop de RLS del Gateway en Ventas/Gastos/Financiero/Nicho 1).
- Continuar la migración RLS módulo por módulo (checklist ya escrito) + `FORCE` en Patrimonio;
  a término, Etapa 6 (eliminar el export crudo `db`).
- Implementación de roles por defecto (tras D3) + filtrado por sucursal (Etapa 5 de H-02) + H-14
  (alta de admin desde `/admin`) + H-08 (menú por permisos/rubro).
- Fase C de UI (formatMoneda/moneda en todos los montos — integrar Sucursales al sidebar ANTES de
  borrar los subnav —, max-w, lote responsive), H-34 (campos de capacidad o quitar la pantalla),
  exportación de reportes (DA-05/H-20, según demanda del piloto).
- M3/M5/M6 residuales, costo ponderado multi-sucursal (decidir alcance), DA-06 (sucursal en
  Dashboard), DA-10 (índice único), y el resto de P2 del plan anterior (sin cambios).
- Fases 4-6 del roadmap (VPS self-hosted) con el runbook existente y la migración ensayada con
  datos del piloto.

## 3. Qué NO está en el plan (deliberadamente)

- Los ~21 ítems "dejar dormir" de deuda-aplazada.md (sin síntoma, con dueño y disparador anotados).
- Los advisors de performance (81 FKs sin índice, 57 policies) — al crecer datos.
- Multi-owner, captura offline, cierre agregado de evento — promesas de doc sin demanda todavía;
  quedan registradas en 01-estado-por-modulo.md.

## 4. Estimación honesta

| Etapa | Esfuerzo |
|---|---|
| A (contención) | **Horas** — nada requiere construir |
| B (decisiones + higiene) | 1 sesión del dueño + media jornada |
| C (funcional P0) | ~1,5–2,5 semanas (C1-C9 son ~15 cambios chicos/medianos, casi todos con patrón ya existente en el repo) |
| D (verificación) | ~1 semana (la decisión D-1 primero; los specs reutilizan seeds ya escritos) |
| E (despliegue real) | ~2-3 días (el runbook ya existe; E1 es ejecutarlo) |
| **Total a piloto (F)** | **~3-5 semanas de trabajo enfocado**, al ritmo demostrado por el historial |

## 5. Definición de "listo para lanzar" (checklist verificable, reemplaza al anterior)

- [ ] Credencial QA rotada y fuera del repo; URL de producción protegida **o** sirviendo el
      Supabase de producción (nunca más la base de dev en público).
- [ ] `docs/production/auth-config.snapshot.json` commiteado con ✅ en las 4 plantillas, y un
      alta de Owner real completada de punta a punta (correo → contraseña → `/app`).
- [ ] CI corre en push a `main` con la suite de integración completa (secret configurado).
- [ ] Las decisiones D1, D3, D4, D6 (+D7, D8) anotadas; precio real visible en `/admin/planes`.
- [ ] C1–C9 cerradas, cada una con test (o la rutina O5 escrita, si C9 se difirió).
- [ ] `pnpm test:e2e` en verde en CI cubriendo los 4 flujos.
- [ ] Advisors de Supabase sin WARN **no aceptados** (hoy queda 1: leaked password).
- [ ] Captura de errores activa y probada; restauración de backup probada una vez.
- [ ] Un tenant piloto real (no de seed) completó el camino dorado sin asistencia posterior al
      alta.
- [ ] Los registros de deuda (hallazgos.md / deuda-aplazada.md) reflejan el estado real
      (pasada B2 hecha) — para que el próximo plan no se haga sobre datos viejos.

---

*Generado el 2026-07-29 como parte de la 2ª auditoría de prelanzamiento. Cuando un ítem se cierre,
marcarlo acá mismo con fecha — este documento es vivo, igual que su antecesor.*
