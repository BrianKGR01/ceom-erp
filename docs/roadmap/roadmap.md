# CEOM-ERP — Roadmap general (v3, 2026-08-06)

> **Qué es este documento.** La **única fuente de verdad** del estado del proyecto: qué está hecho,
> qué falta, en qué orden, y qué decisiones están tomadas con su motivo. Está escrito para que
> alguien que no leyó ningún chat lo abra y sepa exactamente dónde estamos.
>
> **Qué NO es.** No es la evidencia. Cada afirmación de acá se apoya en la
> [auditoría de prelanzamiento v2](../auditoria-prelanzamiento/README.md) (2026-07-29) y sus
> diagnósticos profundos en [`antiguo/`](../auditoria-prelanzamiento/antiguo/README.md); acá solo
> el plan y las decisiones.
>
> **Historial de versiones.** v1 = [roadmap de construcción original](antiguo/roadmap.md) (su Fase 1
> —los 14 módulos, 14/14— sigue siendo el registro histórico válido). v2 = 2026-07-30, reorganizó
> el plan en fases consecutivas. **v3 = ésta**: reconciliación documental (R-2.2), que resolvió las
> contradicciones entre planes, recuperó los ítems que se caían entre uno y otro, y fijó la
> nomenclatura del [Anexo A](#anexo-a--nomenclatura).
>
> **Convención de casillas:** `[ ]` pendiente · `[~]` parcial/en curso · `[x]` cerrado y verificado
> (con fecha) · `[–]` **diferido por decisión** (no es un olvido — el motivo y el disparador están
> en el [Anexo B](#anexo-b--decisiones-tomadas-con-su-disparador)).
>
> **Cómo se citan los ítems:** `R-3.9` = ítem 3.9 de este roadmap. Nunca "Fase 3.9" a secas, que
> colisiona con las tandas institucionales. Ver [Anexo A](#anexo-a--nomenclatura).

---

## La regla que ordena este roadmap

**Las fases son consecutivas por diseño.** Cada fase deja algo que las siguientes usan, y ninguna
fase obliga a volver a tocar lo que una anterior cerró: el entorno y CI se endurecen **antes** de
escribir más código; las decisiones de producto se toman **antes** de las correcciones (para
codificar una sola vez); lo funcional se cierra **antes** de la pasada de UI (para no re-pulir
pantallas dos veces); la UI se cierra **antes** de los e2e (para no reescribir selectores); los e2e
existen **antes** del despliegue real (para desplegar protegido); y el piloto ocurre **antes** de
endurecer lo que solo el uso real prioriza.

> **La v2 violaba su propia regla en un punto, y la R-2.2 lo corrigió.** La decisión de aislamiento
> de datos estaba en la Fase 5 ("antes de escribir los specs"), pero un ítem de la Fase 1 —dar
> `SUPABASE_SECRET_KEY` a CI— **no se puede ejecutar sin haberla tomado**. Ejecutar la Fase 1 como
> estaba escrita habría obligado a volver atrás. La decisión subió a **R-1.4** y la Fase 5 la
> hereda. El detalle verificado está en R-1.4.

---

## Estado del proyecto — verificado el 2026-08-06

| # | Dato | Valor |
|---|---|---|
| 1 | Suite completa (`pnpm test`, base real) | ✅ **46 archivos / 384 tests**, ~9 min |
| 2 | `pnpm typecheck` / `pnpm lint` | ✅ limpio / ✅ 0 errores (19 warnings) |
| 3 | Módulos backend | **14/14** cerrados (v1 Fase 1) |
| 4 | Tests e2e de los 4 flujos de negocio | **0 de 4** (solo el smoke de la landing) |
| 5 | Hallazgos del manual | **10 corregidos · 4 parciales · 31 abiertos · 4 anotados** — 1 solo 🔴: **H-33** |
| 6 | Deuda aplazada | **3 cerrados · 1 parcial · 38 abiertos** de 44 |
| 7 | Supabase | **1 proyecto** (`riertvgnjaujstwyqoom`, dev), organización en **plan Free** |
| 8 | Advisors de seguridad | 4 WARN de riesgo aceptado + **1 real: leaked password** + 2 INFO esperados |
| 9 | Vercel | Proyecto `ceom-erp`: producción desde `main` + previews por PR. **`https://ceom-erp.vercel.app/login` responde 200 público** |
| 10 | CI | Verde, pero solo en `pull_request` y con ~15 suites de integración salteándose |
| 11 | Precio real del producto | **Sin definir** (Bs 0 en la base) |

**Lectura honesta:** el riesgo ya no es de construcción — es operativo. Para un piloto asistido
(3-10 negocios reales) el proyecto está a **~3-5 semanas de trabajo enfocado**.

### Tres restricciones del plan Free que este roadmap ahora cuenta *(verificadas el 2026-08-06)*

La organización `DevBroSolutions` está en **plan `free`**. Eso no es un detalle de facturación:
condiciona tres ítems del plan que antes se daban por resueltos.

1. **2 proyectos como tope**, y **los pausados no cuentan**. Un segundo proyecto cuesta **$0**.
   → Hace que el ensayo del arranque sea gratis (**R-6.1**), y hace que un proyecto Supabase
   dedicado a CI compita por el mismo cupo que producción (**R-1.4**).
2. **Sin backups automáticos.** Supabase respalda a diario solo desde Pro; al plan Free le
   recomienda `supabase db dump` + copia off-site. → **R-6.4** no es ejecutable como estaba escrito.
3. **Pausa por inactividad** tras ~7 días de poca actividad de base. Un piloto de 3-10 negocios con
   uso esporádico es exactamente ese perfil. → **R-6.4** y **R-7.1**.

---

## Fase 0 — Base limpia y acceso de prueba ✅ CERRADA

*Por qué primero: los datos de prueba se crearon a mitad de la construcción y no pasaron por los
flujos completos — ensuciaban cada verificación. Además, vaciar Auth invalidaba la credencial de QA
commiteada en un repo público.*

- [x] **R-0.1** *(2026-07-30)* Vaciados todos los datos de negocio, Auth y Storage de la base de
      desarrollo, **preservando las filas de sistema que las migraciones sembraron** (tenant CEOM
      Ops, roles de sistema Owner/CEOM Admin/Gateway, plan Básico con `max_sucursales=1` según el
      backfill de la `0045`, usuario Gateway bloqueado — migraciones `0005`/`0007`/`0034`). El
      journal de migraciones no se tocó. Storage: 21 objetos eliminados vía API.
- [x] **R-0.2** *(2026-07-30)* `ceom_admin` de QA nuevo (`admin-qa@ceom-erp.test`) creado por Admin
      API con contraseña directa y `email_confirm`. La credencial se comparte por canal directo —
      **nunca commiteada**. Ver **DEC-02** del Anexo B.
- [x] **R-0.3** *(2026-07-30)* Credencial vieja retirada de `consentimiento/ANCLA.md` y de los 3
      docs que la citaban; la contraseña del seed de instituciones pasó a `SEED_DEMO_PASSWORD`
      obligatoria en `.env.local`. La credencial vieja sigue en el historial de git — inocua, el
      usuario ya no existe.
- [x] **R-0.4** *(2026-07-30)* Verificado el arranque sobre base limpia: `pnpm storage:setup`
      idempotente y suite **384/384** contra la base vacía.

**Criterio de salida:** ✅ cumplido el 2026-07-30 — suite en verde sobre base limpia; ningún secreto
vigente commiteado.

## Fase 1 — Contención del entorno y red mínima de CI

*Por qué acá: son horas de trabajo que protegen todo lo que viene después. Nada de las fases
siguientes las invalida.*

- [–] **R-1.1** ~~Activar Deployment Protection en Vercel.~~ **DIFERIDO POR DECISIÓN** — ver
      **DEC-03** del Anexo B. No es un pendiente olvidado.
      > ⚠️ **Si algún día se retoma, no alcanza con "activarlo".** Verificado el 2026-08-06: el
      > proyecto **ya tiene** `ssoProtection.enabled: true` con `deploymentType:
      > "all_except_custom_domains"` (**Standard Protection**), y aun así
      > `https://ceom-erp.vercel.app/login` **responde HTTP 200 sin autenticación** — bajo ese
      > modo el dominio de producción queda fuera. Quien mire el dashboard va a ver el toggle en
      > verde y va a marcar esta casilla siendo falso. El valor que hace falta es **All
      > Deployments**, y la verificación no es el toggle sino el `curl`.
- [ ] **R-1.2** Activar **leaked password protection** en Supabase Auth. Toggle del dashboard; es
      el único WARN real de los advisors (los otros 4 son riesgo aceptado documentado — **no
      revocarlos**, ver `02-transversales.md` §1.1). Verificado todavía abierto el 2026-08-06.
- [ ] **R-1.3** Correr `pnpm auth:config` con `SUPABASE_ACCESS_TOKEN` y commitear el snapshot;
      corregir las 2 plantillas custom si el veredicto da ❌ (**sin tocar las 2 PKCE** — el script
      lo verifica). ⚠️ Requiere un token de Management API que solo el dueño puede generar.
      *Por qué importa: si la plantilla "Invite user" sigue de fábrica, el enlace llega con un
      formato que `app/auth/callback/route.ts` rechaza y el Owner de un negocio nuevo **nunca puede
      fijar contraseña** — el negocio queda congelado desde el alta, sin error visible.*
- [ ] **R-1.4** 🔀 **Decidir contra qué base corren los tests automatizados** — CI y, más adelante,
      Playwright. **Sube desde la Fase 5 (era la "D-1" del plan anterior); R-5.1 la hereda.**

      <details open>
      <summary><b>Por qué subió: el plan de CI, como estaba escrito, rompía CI</b> (verificado el 2026-08-06)</summary>

      La v2 decía: *"agregar `SUPABASE_SECRET_KEY` como secret para que las ~15 suites de
      integración dejen de saltearse en CI"*. **Eso no las des-saltea: las pone en rojo.**

      1. Las suites gatean en `DATABASE_URL && SUPABASE_SECRET_KEY`. Hoy CI tiene la primera
         (apunta al contenedor `postgres:16` efímero del workflow) y no la segunda, así que se
         saltean.
      2. Con las dos presentes, cada suite hace dos cosas contra **bases distintas**:
         `crearClienteAdmin()` crea el usuario en el **Supabase real** (el único que existe, el de
         dev), y `crearTenantConOwner()` inserta `public.usuarios` en el **contenedor de CI**.
      3. En el medio está la FK `usuarios_id_users_id_fk → auth.users(id)`
         (`drizzle/migrations/0002…:95`). El `auth.users` del contenedor es un stub vacío. Es un
         **`23503` garantizado** en el `beforeAll` de las 15 suites.
      4. Además `crearClienteAdmin()` necesita `NEXT_PUBLIC_SUPABASE_URL`, que CI tampoco tiene.

      **Y si en cambio se apunta `DATABASE_URL`/`DIRECT_URL` de CI al Supabase de dev** —la única
      forma de que Auth y datos compartan identidad—, entra a jugar el **candado de suite**
      (`vitest.global-setup.ts`): un advisory lock de sesión, exclusivo, tomado durante los ~9
      minutos que dura la corrida. Dos PRs en paralelo ⇒ el segundo muere al instante; una corrida
      de CI ⇒ mata la corrida local de quien esté trabajando, y viceversa. El candado **hace bien
      su trabajo** (falla rápido en vez de producir los conteos falsos del incidente del 27/07),
      pero convierte CI en una cola de un solo carril compartida con las máquinas del equipo.
      Además, CI escribiría en la base que la URL pública de Vercel sirve.

      **Esto ya estaba registrado y nadie lo cruzó con el plan:** DA-16 dice desde el 2026-07-22
      que el entorno de CI *"no puede proveer"* Auth real.
      </details>

      **Las tres salidas, con su costo real:**

      | Opción | Qué implica | Costo |
      |---|---|---|
      | **(a)** Proyecto Supabase dedicado a CI | Auth y datos coherentes, sin colisión con nadie | **$0 hoy** (cupo 2 del plan Free), pero **consume el cupo que necesita producción**. Al llegar a R-6.1 hay que elegir: pausar el de CI, o pasar a Pro (~$25/mes) |
      | **(b)** CI contra el Supabase de dev, con el candado | Cero infraestructura nueva | CI y las máquinas del equipo se bloquean mutuamente; CI escribe en la base que Vercel sirve en público |
      | **(c)** Stub de Auth para tests | No necesita ningún Supabase | El más trabajo, y baja la fidelidad justo donde vive el riesgo (GoTrue) |

      - [ ] Decidir entre (a), (b) y (c), y **anotar la decisión como DEC-06 en el Anexo B**.
      - [ ] Recién entonces: agregar el trigger `push` a `main` (y a `dev`) en `ci.yml`, y los
            secrets que la opción elegida requiera.

      > **El trigger `push` no depende de esta decisión y se puede hacer ya.** Hoy un push directo
      > a `main` llega a producción sin correr un solo test (el build de Vercel solo typechequea).
      > Separarlo de la parte de secrets es la forma de cerrar el agujero sin esperar la decisión.
- [ ] **R-1.5** Verificar un alta de Owner de punta a punta con correo real (invitación → clic →
      contraseña → `/app`) — es la prueba viva de R-1.3.

**Criterio de salida:** un push a `main` no puede desplegar sin tests; el flujo de invitación
probado con un correo real; la decisión de R-1.4 anotada. *(La URL pública queda deliberadamente
sin proteger — DEC-03.)*

## Fase 2 — Decisiones de producto e higiene de los registros

*Por qué acá: varias correcciones de la Fase 3 dependen de estas decisiones (codificar una vez, no
dos), y la pasada de higiene evita re-trabajar cosas ya cerradas.*

- [ ] **R-2.1** Sesión de decisiones del dueño (una sola, con acta en el [Anexo B](#anexo-b--decisiones-tomadas-con-su-disparador)):
      **DP-01** precio real del plan Básico · **DP-03** roles por defecto (sí/no a la propuesta de
      `docs/manual/propuesta-roles-por-defecto.md`) · **DP-04** política de costeo de reventa ·
      **DP-06** semántica de "pausada" (H-46) + downgrade vs. consentimientos (H-47) · **DP-07**
      config de plan letra muerta (¿aplicarla o quitarla del formulario?) · **DP-08** regenerar o
      no los 5 pagos históricos de pasivo (Bs 10.700) y las 2 ventas a las 00:00Z.
      **DP-05 ya está anotada** (piloto con instituciones = sí, ver Anexo B).
- [x] **R-2.2** *(2026-08-06)* **Reconciliación documental.** Ésta es la tanda que produjo la v3
      de este roadmap. Qué se hizo:
      - **Nomenclatura:** barrido de `docs/` completo, esquema de prefijos por familia y tabla de
        equivalencia — [Anexo A](#anexo-a--nomenclatura).
      - **Contradicciones resueltas** (ensayo vs. arranque; aislamiento de datos vs. CI; "el layout
        de `/admin` no gatea"; "M4 abierto"; "Vercel: cero" en 4 lugares, no 3).
      - **Ítems recuperados** entre planes: G-13 movido a R-3.8, tandas institucionales
        desglosadas con nombre propio, G-17 confirmado cerrado, G-12 con su consecuencia comercial
        escrita.
      - **Registros al día:** `hallazgos.md` (7→10 corregidos, H-30 con 🔴 falso), `deuda-aplazada.md`
        (1→3 cerrados, DA-03 encabezando la lista de prioridades estando resuelto), 4 ANCLA, 5 docs
        de módulo, el tracker de pantallas, `AUDITORIA-AUTORIZACION.md`, `AUDITORIA-UI-UX.md` y la
        tabla de tandas del doc 08.
      - **Decisiones del dueño** registradas con su disparador — [Anexo B](#anexo-b--decisiones-tomadas-con-su-disparador).

**Criterio de salida:** cero decisiones bloqueantes; los registros de deuda son confiables para
planificar. *(La segunda mitad ya está cumplida.)*

## Fase 3 — Correcciones funcionales: los números y avisos dicen la verdad

*Por qué acá: es el grueso del P0 funcional. Después de decidir (Fase 2) y antes de la pasada de UI
(Fase 4), porque varios de estos cambios agregan piezas de interfaz que la Fase 4 pulirá una sola
vez. Evidencia por ítem: [01-estado-por-modulo.md](../auditoria-prelanzamiento/01-estado-por-modulo.md).*

- [ ] **R-3.1** **H-33** — designar/reasignar Owner por `ceom_admin` con auditoría. Diseño ya
      aprobado en `docs/decisiones/recuperacion-de-acceso.md` §5-B; función nueva con `tenantId`
      explícito, **no** un bypass de `transferirOwner` (que es caller-implícita). **El único 🔴 del
      sistema.** Agravante verificado: en un tenant vencido ni el Owner presente puede transferir.
- [ ] **R-3.2** Familia **"el aviso se calcula y se descarta"** — un solo patrón, cuatro lugares:
      `entradaStock` al registrar/recibir compra (**DA-24**), `acreditacionOk` de producción,
      `avisosStock` del POS (**H-37**, incluyendo stock visible por producto), `ajusteStock` del
      ajuste de venta. El criterio de fix ya existe en el repo: `registrarCompraDeAjusteAction`
      propaga y muestra. Test por cada uno con el caso de permisos cruzados.
      > *Disparador realista verificado para DA-24: un usuario con permisos solo-proveedores lo
      > produce en **cada** compra, porque la entrada de stock exige `operativo:crear` o
      > `inventario:crear`. La compra queda "recibido" con el stock sin entrar y sin ninguna señal.*
- [ ] **R-3.3** **H-26** — los ajustes de venta afectan el total derivado y recalculan
      `estado_pago`. Es el espejo del patrón ya resuelto en Proveedores con H-31 (`derivarEstadoPago`
      contra monto efectivo). Hoy una venta anulada queda "pendiente de cobro" para siempre.
- [ ] **R-3.4** Validaciones de pertenencia al tenant: evento **abierto y propio**, canal propio y
      `clienteId` propio en `registrarVenta` (hoy hay **escritura** cross-tenant de
      `ultima_compra_en`); lo mismo en `importarVentaHistorica` (incl. sucursal congelada);
      sucursal destino en `consolidarStockDeSucursal`. Cierra **M-01/M-02**.
      *Usar `recursoPerteneceAlTenant()` de Identidad, no reimplementar la guarda a mano — así
      nacieron estos huecos.*
- [ ] **R-3.5** Familia **H-49 residual** + consistencia de derivados: fecha del gasto de comisión
      por día local del tenant; vencimiento de insumo desde `fecha_compra` (día local); formato del
      historial de simulaciones con TZ fija; `flujoCaja` sin pagos de gastos soft-eliminados;
      validaciones de `registrarPagoPasivo` a nivel módulo; validación server-side de simulaciones
      (los zod hoy muertos, con `margenDeseadoPct=100` dividiendo por cero vía POST directo).
- [ ] **R-3.6** **DA-06** — el filtro de sucursal dice la verdad: propagar `sucursalId` a
      `rankingProductos` / `historicoVentas` / `margenPorCanalYProducto` / `distribucionGastos` /
      `controlMerma`, o avisar en el Dashboard qué tarjetas no lo respetan.
- [ ] **R-3.7** `/admin` con la **proyección institucional tipada**: marcador H-15, estados
      error/no-aplica y cobertura por sucursal en la Ficha de Tenant. Cierra la violación de las
      reglas **#9/#10** de `CLAUDE.md` y reutiliza `lib/proyeccion-institucional.ts` —
      **no se diseña nada nuevo**, es el mismo arreglo que el portal institucional ya tiene.
      *Detalle del defecto: `panel-admin-ceom/ANCLA.md`, sección "Defecto abierto conocido".*
- [ ] **R-3.8** **Institucional P0** — lo que el piloto con instituciones (DP-05 = sí) vuelve
      bloqueante:
      - **H-43** correo de institución obligatorio al alta, con el aviso "sin correo no puede
        entrar al portal".
      - **G-13 / DD-02** — 🔀 **movido desde la Fase 8 en la R-2.2.** `instituciones` tiene RLS
        `USING(true)` sin `REVOKE` de columna: **toda sesión autenticada lee la tabla entera —
        correos y `auth_user_id`, incluidas las borradas— vía PostgREST** (verificado en vivo con
        JWT sintético). La decisión (DD-02: `REVOKE` de columna + filtrar `eliminado_en`, sin
        policy nueva) está tomada desde la tanda TI-3.1 y nunca se ejecutó.
        **Por qué sube:** estaba después del piloto, y el piloto **incluye instituciones** — o sea
        que quedaba abierto justo en el momento en que la tabla pasa a tener correos reales de
        terceros. Es el único ítem de esta lista cuyo daño *crece* con el piloto en vez de
        esperarlo.
      - RLS de `logs_acceso_institucion` a **solo-SELECT** para el tenant. Hoy el `crudPolicy`
        estándar le da `modify`/`delete` sobre su propio log de auditoría; DD-01 pedía solo lectura.
      - **DD-04 parte 2** — validar los módulos veedor contra el nicho al generar el código.
- [ ] **R-3.9** **El cron único** (Vercel Cron ya viable): transición `activa→vencida` (**H-45**),
      generación de recurrentes y cuota periódica (**H-10/DA-04**), purga de `intentos_canje` y
      retención de logs de DD-01. Es **una sola pieza** para lo que hoy figura como cuatro deudas
      en cuatro lugares.
      **Si se decide diferirlo: escribir la rutina manual del ciclo de suscripción en
      `docs/production/` — una de las dos, no ninguna.**
- [ ] **R-3.10** Implementar lo decidido en R-2.1: roles por defecto (**DP-03**) + filtrado por
      sucursal (`usuarios.sucursalId`, hoy deliberadamente inactivo) + menú según permisos/rubro
      (**H-08**) + alta de `ceom_admin` desde `/admin` (**H-14**); política de costeo aplicada o
      documentada (**DP-04**); config de plan aplicada o retirada (**DP-07**); regeneración de
      históricos si **DP-08** = sí.

**Criterio de salida:** suite en verde con tests nuevos por ítem; `hallazgos.md` y
`deuda-aplazada.md` actualizados **al cierre de cada ítem, no al final** (ésa es la lección que
produjo la R-2.2).

## Fase 4 — Consistencia de UI: una sola pasada, con todo lo funcional ya adentro

*Por qué acá: las primitivas ya existen (Fases A/B de la auditoría de UI); ésta es la migración
mecánica que quedó pendiente, hecha una vez y sobre pantallas ya funcionalmente completas. Detalle:
[02-transversales.md §3](../auditoria-prelanzamiento/02-transversales.md) y `docs/ui/AUDITORIA-UI-UX.md` §6.*

- [ ] **R-4.1** ⚠️ **Va primero, y no es negociable:** integrar `/app/mi-negocio/sucursales` al
      submenú del sidebar **antes** de borrar los subnav duplicados. Hoy esas copias son su
      **única** navegación — ejecutar R-4.3 como está escrita deja la pantalla inalcanzable.
- [ ] **R-4.2** Un solo `formatMoneda` (el de `lib/format.ts`) con símbolo de moneda en **todos**
      los montos: eliminar las 10 copias locales y los 21 `toLocaleString` crudos.
- [ ] **R-4.3** Anchos según la tabla de `max-w` de `design-system.md` §7; subnav de Mi Negocio
      centralizado (borrar las 6 copias — **después de R-4.1**); migrar consumidores a
      Tabs/ToggleGroup/EmptyState.
- [ ] **R-4.4** Lote responsive móvil (UI-011 compras, UI-041/UI-043 del shell).
- [ ] **R-4.5** Restos de H-15 en UI: la tarjeta del Dashboard deja de pintar `null` como "0%"
      (`dashboard-resumen.tsx:292,308` — es la primera pantalla que ve el usuario); **H-34** según
      lo decidido (campos de capacidad en el form de Activo, o quitar la pantalla).
- [ ] **R-4.6** Actualizar `docs/ui/pantallas.md` y `AUDITORIA-UI-UX.md` al cierre: **re-inventariar
      las pantallas nuevas** (Sucursales, Accesos institucionales, landing, Recuperar contraseña,
      canje autenticado) y tachar lo hecho. El tracker perdió su "100% completo" en la R-2.2
      precisamente porque nadie hizo esto.

**Criterio de salida:** verificación en navegador de una muestra de pantallas por módulo; ningún
monto sin símbolo de moneda; cero copias de subnav; Sucursales alcanzable desde el sidebar.

## Fase 5 — Verificación end-to-end

*Por qué acá: los specs se escriben sobre una UI ya estable (Fase 4) y protegen el despliegue
(Fase 6). Detalle: [02-transversales.md §2](../auditoria-prelanzamiento/02-transversales.md).*

- [ ] **R-5.1** Aplicar a Playwright la decisión de aislamiento tomada en **R-1.4**. *(Este ítem
      ya no decide nada: hereda.)* El advisory lock es exclusivo de vitest, así que sin esto los
      e2e correrían contra la base compartida **sin candado** y se recrearía el incidente de
      conteos falsos del 27/07.
- [ ] **R-5.2** Los 4 flujos e2e: Modo Básico, Nicho 1, Nicho 4, consentimiento institucional —
      con seed + `storageState` de login en el setup.
- [ ] **R-5.3** `test:e2e` corriendo en CI (browsers incluidos).
- [ ] **R-5.4** Extender `tenant-aislamiento.test.ts` a Ventas, Gastos, Productos e Identidad, y
      los 2 tests faltantes de `panel-admin-ceom` (prerequisito del checklist de migración RLS).

**Criterio de salida:** los 4 flujos corren en CI sin intervención manual — el criterio literal de
la Fase 2 del roadmap original, por fin cumplido.

## Fase 6 — Despliegue real

*Por qué acá: desplegar protegido por los e2e, sobre una base de producción virgen. Detalle:
[03-operacion-y-comercial.md](../auditoria-prelanzamiento/03-operacion-y-comercial.md).*

- [ ] **R-6.1** **Ensayar el arranque contra un proyecto descartable, y recién después crear
      producción.** Son **dos actos, no uno**.
      > 🔀 **Contradicción resuelta en la R-2.2.** La v2 de este roadmap decía *"el ensayo del
      > arranque y la creación de producción son el mismo acto"*, y el requisito de cierre
      > registrado en
      > [`antiguo/09` §5](../auditoria-prelanzamiento/antiguo/09-arranque-desde-cero.md#5-el-ensayo--requisito-de-cierre-de-la-etapa-3)
      > decía exactamente lo contrario: *"el arranque real debe ser la repetición de algo que ya
      > salió bien, no un estreno"*. **Gana el requisito**, porque la única razón para fusionarlos
      > —que un segundo proyecto costara plata o cupo— resultó falsa: plan Free, **2 proyectos,
      > $0** el segundo. El ensayo es gratis y la contradicción desaparece.

      1. Crear un proyecto Supabase **descartable** y ejecutar el runbook de 17 pasos
         ([antiguo/09 §3.2](../auditoria-prelanzamiento/antiguo/09-arranque-desde-cero.md)) **tal
         cual está escrito**. Lo que el ensayo prueba no es que el sistema arranque: es que **el
         runbook alcanza**. Si hace falta tocar algo que no está en la lista, eso es el hallazgo.
      2. El paso 12 (`pnpm seed:admin` con correo real) es el que de verdad lo prueba: ejercita
         SMTP + Site URL + plantilla de invitación de una sola vez, en el único momento en que
         todavía no hay un negocio real esperando.
      3. Corregir el runbook con lo encontrado. *(Ya se sabe de un desvío: dice "49 migraciones" y
         son 50.)*
      4. **Pausar o borrar el proyecto de ensayo** — el cupo del plan Free es 2 y los pausados no
         cuentan. Pausarlo conserva la evidencia.
      5. Crear **producción** ejecutando el runbook ya corregido.
- [ ] **R-6.2** Reapuntar las 6 variables de Vercel Production al proyecto nuevo. Dev/preview
      siguen contra la base de desarrollo. **Acá deja de ser cierto DEC-03**: desde este momento la
      URL pública sirve datos reales, y el repo tiene que pasar a privado (**DEC-01**) y la
      credencial de QA rotarse (**DEC-02**).
- [ ] **R-6.3** Captura de errores (Sentry o equivalente) + probar que un error forzado llega al
      canal del equipo. Hoy está en cero: sin `instrumentation.ts`, sin logger.
- [ ] **R-6.4** **Backups y disponibilidad — decisión de plata, no de trabajo.**
      > ⚠️ **Reescrito en la R-2.2.** Decía *"confirmar retención de backups del plan de Supabase
      > Cloud + una restauración de prueba"*. **En plan Free eso no es ejecutable**: Supabase hace
      > backups automáticos diarios solo desde Pro; al plan Free le recomienda `supabase db dump` +
      > copia off-site. No hay retención que confirmar ni backup que restaurar. Y hay un segundo
      > problema del mismo origen: los proyectos Free **se pausan tras ~7 días de poca actividad**,
      > que es el perfil de uso de un piloto de 3-10 negocios.

      Elegir una, y anotarla como decisión en el Anexo B:
      - **(a)** Subir la organización a **Pro** antes del piloto (~$25/mes): backups diarios con 7
        días de retención, y sin pausa por inactividad. Resuelve las dos cosas de una.
      - **(b)** Quedarse en Free y **construir el reemplazo**: `pg_dump` programado con destino
        off-site, restauración probada una vez, y un healthcheck que además genere actividad para
        evitar la pausa. Es gratis en plata y no en trabajo.
      - [ ] En cualquiera de los dos casos: **una restauración de prueba, hecha una vez.**
      - [ ] Healthcheck / uptime mínimo sobre la URL de producción.
- [ ] **R-6.5** Precio real cargado en el plan Básico (**DP-01**, decidido en R-2.1; el formulario
      de `/admin/planes` ya existe — es un dato, no código).

**Criterio de salida:** el checklist "listo para lanzar" de
[04-roadmap-lanzamiento.md §5](../auditoria-prelanzamiento/04-roadmap-lanzamiento.md) completo,
**con R-6.4 resuelto por una de las dos vías** y no dado por hecho.

## Fase 7 — Piloto (3-10 negocios asistidos)

- [ ] **R-7.1** Primer tenant real: el caso validado SanttiCampo, alta asistida por `ceom_admin`.
      *Si R-6.4 se resolvió por la vía (b), vigilar la pausa por inactividad desde el primer día.*
- [ ] **R-7.2** Rutina semanal escrita y en uso: errores (R-6.3), feedback, ciclo de suscripción
      (hasta que R-3.9 lo automatice del todo).
- [ ] **R-7.3** Un tenant piloto completa el camino dorado sin asistencia posterior al alta.
- [ ] **R-7.4** Backlog del piloto: lo que los usuarios griten ordena la Fase 8.

> ⚠️ **Lo que hay que decirle al piloto, si incluye instituciones.** Ver **G-12** en la Fase 8: al
> arrancar el piloto, 3 de las 4 pestañas del portal institucional leen con **bypass total de
> RLS**. **No se le promete a una institución aislamiento a nivel de base de datos**; lo que hay es
> un chequeo de aplicación correcto y testeado, sin piso independiente por debajo.

## Fase 8 — Endurecimiento post-piloto

*Lo que sigue abierto del subsistema institucional, con nombre propio — hasta la R-2.2 esto era
"tandas 3.4–3.6", una bolsa sin ítems.*

- [ ] **R-8.1** **Coherencia de la revocación** (ex tanda TI-3.4):
      - **G-05 / DD-03** — revocar no saca al negocio de la cartera: la institución lo sigue
        viendo. Decisión tomada (opción (c): marcado "acceso revocado", se ocultan plan y estado),
        sin implementar.
      - **G-06** — `fecha_fin` del vínculo es decorativa: no se aplica en `estaEnCartera()` /
        `listarCartera()` ni se muestra. Aplicarla, o quitarla del manual.
      - **G-07 / DD-06** — borrar una institución queda a medio morir: no revoca aprobaciones y
        deja su correo bloqueado para siempre. Decisión tomada (se libera el correo), sin
        implementar.
      - ~~**G-17**~~ ✅ **CERRADO** — *verificado en la R-2.2, y ningún plan lo registraba.* El
        canje autenticado de la tanda TI-3.2 lo resolvió: el Owner genera un código nuevo y la
        institución, ya con sesión, lo canjea; el índice único parcial
        `aprobaciones_tenant_vigente_unica` (`0037`) evita que la cartera se duplique. Tiene test
        propio: `consentimiento.test.ts:640`. **Lo único que queda es decirlo en la pantalla**, y
        eso es copy — va con R-4.x, no acá.
- [ ] **R-8.2** **Superficie de datos y trazabilidad** (ex tanda TI-3.5, sin lo que ya salió):
      - **G-16** — la misma identidad de Auth puede ser Usuario de un tenant e Institución a la
        vez (ya pasó en los datos). Rechazar el vínculo perezoso si el `authUserId` ya es Usuario.
      - ~~**G-13 / DD-02**~~ → **movido a R-3.8** (antes del piloto, no después).
      - ~~**G-04**~~ ✅ cerrado en la tanda TI-3.2 (rate limit del canje), no en ésta como decía la
        tabla de tandas. ~~**DD-01**~~ ✅ cerrado en TI-3.3b.
- [ ] **R-8.3** **Escala del piloto** (ex tanda TI-3.6, opcional — solo si el piloto lo pide):
      - **G-09** — acoplar cartera y solicitud a nivel de acción, no solo en la UI.
      - **G-10** — nada es masivo: 15 negocios = 15 códigos, 15 canjes, 30 diálogos de `/admin`.
- [ ] **R-8.4** **G-12 — backstop de RLS del Gateway** en Ventas, Gastos/Financiero y Nicho 1.
      Hoy 3 de las 4 pestañas del portal institucional leen con **bypass total de RLS**, apoyadas
      únicamente en el chequeo de `tieneConsentimiento()` de TypeScript.
      **Se queda en la Fase 8 a propósito: no es trivial** (implica migrar tres módulos a
      `comoUsuario()` y escribir sus policies de Gateway). **La consecuencia comercial está escrita
      en la Fase 7 y no se borra hasta que este ítem cierre.**
- [ ] **R-8.5** Migración RLS módulo por módulo (checklist ya escrito: `CHECKLIST-MIGRACION-RLS.md`)
      + `FORCE` en Patrimonio; al completar, eliminar el export crudo `db`.
      *Hoy: solo Patrimonio y Proveedores migrados; los otros 7 corren como rol dueño, o sea que
      sus `crudPolicy()` son invisibles al tráfico real.*
- [ ] **R-8.6** **M-03 / M-05 / M-06** residuales de la auditoría de autorización, y el
      `proveedorId` que le falta a **M-04** (los otros ⅔ se cerraron de rebote con H-02).
      Costo promedio multi-sucursal (decidir alcance); **DA-10** (índice único de vinculaciones);
      **DA-12**.
- [ ] **R-8.7** Exportación de reportes PDF/Excel (**DA-05/H-20**) — según demanda real del piloto.
      Es el único compromiso documental del MVP sin una línea de código.
- [ ] **R-8.8** Resto del P2 histórico: paginación de `listarTenants`, 81 FKs sin índice, 57
      policies permisivas múltiples, **DA-38** (registro de auditoría completo de lecturas
      `ceom_admin`), y los ~21 ítems "dejar dormir" de `deuda-aplazada.md` §4.
- [ ] **R-8.9** Mover de schema las 4 funciones `SECURITY DEFINER` con `EXECUTE` de `authenticated`.
      **No revocar el `EXECUTE`: ese permiso ES el mecanismo del backstop, y revocarlo rompe el
      aislamiento** (corrección del 2026-07-27, commit `5b597c3`). Mover de schema es la única
      resolución real de esos 4 WARN, y es tarea de acá, no de la Fase 1.

## Fase 9 — Self-hosting (la visión de infraestructura completa)

- [ ] **R-9.1** Fases 4–6 del [roadmap original](antiguo/roadmap.md) con el runbook existente
      (`docs/production/produccion.md`), migración ensayada con los datos reales del piloto.
      > **Anotado para que nadie lo cuente dos veces (R-2.2):** el destino declarado es
      > **self-hosted en VPS**, así que **toda la configuración del dashboard de Supabase Cloud se
      > va a migrar igual** — plantillas de correo, SMTP, Site URL, rate limits, toggles de
      > seguridad. Eso **no** significa que R-1.3 se pueda saltear: el snapshot de `auth:config` es
      > precisamente **la lista de qué configurar el día del VPS**, y sin correrlo esa lista no
      > existe. Lo que sí significa es que R-1.3 y R-6.1 son configuración **de una etapa
      > intermedia**, no definitiva. Ver **DEC-04**.

---

## Cómo se actualiza este documento

- Marcar casillas **al cerrar cada ítem, con fecha** — no al final de la fase.
- Si un ítem cambia de fase o aparece uno nuevo, anotarlo acá con una línea de motivo (nunca borrar
  en silencio) — igual que hizo la R-2.2 con G-13 y con la decisión de aislamiento.
- Al cerrar cada ítem funcional, actualizar **en el mismo cambio** su rastro en
  `docs/manual/hallazgos.md` / `docs/deuda-aplazada.md` / el `ANCLA.md` del módulo. **Ésta es la
  lección cara de la R-2.2:** los registros que corren detrás del código hacen re-trabajar lo
  cerrado y sobreestimar lo abierto.
- Un ítem que se decide **no hacer** se marca `[–]` con su entrada en el Anexo B. **Una casilla
  vacía se lee como olvido.**

---

## Anexo A — Nomenclatura

### Por qué existe

Tres cosas distintas se llamaron **"D-1"** al mismo tiempo: el precio del plan Básico, el registro
de acceso institucional, y la decisión de aislamiento de datos para e2e. Ya había pasado con la
palabra **"etapa"**, que llegó a significar cuatro cosas y costó tiempo real. El barrido de la R-2.2
sobre `docs/` completo encontró que no eran casos aislados.

### Las colisiones encontradas

| Sigla | Significados que convivían |
|---|---|
| **D-1 / D1** | (a) precio del plan Básico · (b) registro de acceso institucional · (c) decidir el aislamiento de datos para e2e |
| **D-2 / D2** | (a) sucursales múltiples (H-02) · (b) angostar la RLS de `instituciones` · (c) los 4 flujos e2e |
| **D-3 / D3** | (a) roles por defecto · (b) cartera al revocar · (c) extender `tenant-aislamiento.test.ts` |
| **D-4 / D4** | (a) política de costeo de reventa · (b) módulos veedor fuera del nicho |
| **D-5 / D5** | (a) ¿el piloto incluye instituciones? · (b) backstop fino por institución |
| **C1** | (a) comisión → gasto (H-24) · (b) designar Owner (H-33) |
| **C4** | (a) leer `entradaStock` (DA-24) · (b) validaciones de pertenencia al tenant |
| **3.4 / 3.5 / 3.6** | (a) tandas institucionales · (b) ítems del roadmap vigente |
| **Etapa** | (a) numeración del proyecto (Etapa 3 = instituciones) · (b) etapas A–F del 1er plan · (c) etapas A–G del 2º plan · (d) etapas 1–6 del backstop de RLS (`4.a`, `4.b.0`, `4.b.1`) · (e) "Etapa 5" de H-02 |
| **Etapa A / C / D** | significan **cosas distintas** en los dos planes de lanzamiento (ver `04-roadmap-lanzamiento.md`) |
| **M1…M6 vs M04/M07/M10** | huecos de la auditoría de autorización vs. abreviatura de "Módulo NN" |

### El esquema

**Un prefijo por familia. Los números no cambian** — así `grep "3.3b"`, `grep "D-7"` o `grep "M4"`
siguen encontrando el rastro que hay en ANCLA, tests y comentarios de código.

| Familia | Prefijo | Ejemplo | Dónde se define |
|---|---|---|---|
| Ítem de este roadmap | **`R-`** | `R-3.9` | este archivo |
| **Decisión de producto** (del dueño) | **`DP-`** | `DP-01` | [Anexo B](#anexo-b--decisiones-tomadas-con-su-disparador) |
| **Decisión de diagnóstico** (institucional) | **`DD-`** | `DD-07` | `antiguo/08` §9 |
| **Decisión de proceso/entorno** | **`DEC-`** | `DEC-03` | [Anexo B](#anexo-b--decisiones-tomadas-con-su-disparador) |
| **Tanda institucional** | **`TI-`** | `TI-3.3b` | `antiguo/08` §7 |
| Hallazgo del manual | `H-` | `H-33` | `docs/manual/hallazgos.md` |
| Deuda aplazada | `DA-` | `DA-06` | `docs/deuda-aplazada.md` |
| Hueco del diagnóstico institucional | `G-` | `G-13` | `antiguo/08` |
| Defecto de proyección institucional | `X-` | `X-01` | `antiguo/08` §4.6-4.8 |
| Hueco de la auditoría de autorización | **`M-`** | `M-04` | `docs/security/AUDITORIA-AUTORIZACION.md` |
| Hallazgo de UI | `UI-` | `UI-011` | `docs/ui/AUDITORIA-UI-UX.md` |
| Observación de uso | `OBS-` | `OBS-09` | `docs/ui/observaciones-de-uso.md` |

**Reglas de escritura:**

1. **"Etapa" y "Fase" nunca se usan solas.** O llevan el prefijo (`R-3.9`, `TI-3.4`), o van
   calificadas ("la Etapa 4.b.1 **del backstop de RLS**").
2. **Los módulos se escriben `Modulo_04` o "Módulo 4"**, nunca `M04` — esa forma choca con `M-04`.
3. **Los identificadores de los dos planes de lanzamiento superados están retirados.** No se cita
   más `A1`…`E5` ni `C1`…`C9`: se citan los `R-N.M` de acá.

### Tabla de equivalencia con los nombres viejos

> Se conserva para que ningún rastro se rompa. Los **anclas HTML** de los documentos históricos
> **no se tocaron**: `#d-7--vencen-los-códigos` sigue resolviendo.

**Decisiones de producto** *(estaban en `04-camino-al-lanzamiento.md` §2.1 y `04-roadmap-lanzamiento.md` §0)*

| Nuevo | Era | Qué decide |
|---|---|---|
| `DP-01` | `D1` | Precio real del plan Básico |
| `DP-02` | `D2` | Sucursales múltiples (H-02) — ✅ resuelta 2026-07-27 |
| `DP-03` | `D3` | Roles por defecto (H-35) |
| `DP-04` | `D4` | Política de costeo de reventa (H-25) |
| `DP-05` | `D5` | ¿El piloto incluye instituciones? — ✅ **sí**, ver Anexo B |
| `DP-06` | `D6` | Semántica de "pausada" (H-46) + downgrade vs. consentimientos (H-47) |
| `DP-07` | `D7` | Config de plan letra muerta: ¿aplicarla o quitarla? |
| `DP-08` | `D8` | ¿Regenerar los 5 pagos históricos (Bs 10.700) y las 2 ventas a las 00:00Z? |

**Decisiones de diagnóstico institucional** *(`antiguo/08` §9)* — equivalencia directa `D-N` ⇒ `DD-0N`:
`D-1`⇒`DD-01` … `D-10`⇒`DD-10`. La tabla con el estado de cada una está en ese documento.

**Tandas institucionales** — equivalencia directa `tanda 3.x` ⇒ `TI-3.x`, incluidas `TI-3.3a` y
`TI-3.3b`.

**Huecos de autorización** — `M1`…`M6` ⇒ `M-01`…`M-06`.

**Ítems de los planes de lanzamiento superados** *(retirados — se citan los `R-N.M`)*

| Era | Dónde | Hoy es |
|---|---|---|
| `A1` · `A2` · `A3` · `A4` · `A5` | 2º plan, Etapa A | R-0.2/R-0.3 · R-1.1(DEC-03)/R-6.1 · R-1.2 · R-1.3 · R-1.4 |
| `B1` · `B2` | 2º plan, Etapa B | R-2.1 · R-2.2 |
| `C1`…`C9` | 2º plan, Etapa C | R-3.1 · R-3.3 · R-3.2 · R-3.4 · R-3.5 · R-3.7 · R-3.8 · R-3.8 · R-3.9 |
| `D-1` · `D-2` · `D-3` | 2º plan, Etapa D | **R-1.4** (subió) · R-5.2/R-5.3 · R-5.4 |
| `E1`…`E5` | 2º plan, Etapa E | R-6.1 · R-6.2 · R-6.3 · R-6.4 · R-6.5 |
| `C1`…`C5` | 1er plan, §2.2 | H-24 ✅ · H-31 ✅ · R-3.1 · R-3.2 · R-3.3 |
| `V1` · `V2` · `V3` | 1er plan, §2.3 | ✅ cerrado · R-5.2/R-5.3 · R-5.2 |
| `O1`…`O5` | 1er plan, §2.4 | ✅ cerrado · R-1.2/R-1.3 · R-6.3 · R-6.4 · R-3.9 |

---

## Anexo B — Decisiones tomadas, con su disparador

> **Por qué este anexo.** Una decisión sin su motivo se relee como un descuido, y una casilla vacía
> se lee como un olvido. Cada entrada dice **qué se decidió**, **por qué**, y **qué tiene que pasar
> para revisarla**. Las que todavía no se tomaron están en R-2.1.

### DEC-01 — El repositorio de GitHub sigue **público**, a propósito

**Decisión:** no se pasa a privado por ahora.
**Por qué:** el proyecto no está en el radar de nadie y todo lo que hay detrás es un entorno de
prueba. Después de la Fase 0 no queda ningún secreto vigente commiteado — la credencial que había
está en el historial pero apunta a un usuario que ya no existe.
**Disparador para revisarla:** **antes de que exista producción con datos reales** — o sea, antes de
**R-6.2**. Desde ese momento el código público describe una superficie viva con datos de terceros.

### DEC-02 — La credencial de `admin-qa@ceom-erp.test` es deliberadamente de QA

**Decisión:** existe un `ceom_admin` operativo cuya contraseña se comparte por canal directo, para
poder crear negocios y ejercitar flujos completos durante el desarrollo.
**Por qué:** sin un admin real no se puede probar el alta de un negocio, que es el camino más
crítico y el menos cubierto por tests.
**Regla dura:** **no vuelve a ningún documento del repo, nunca** — ni en un ANCLA, ni en un doc de
auditoría, ni en un comentario. Eso fue el crítico №1 de la auditoría del 29/07.
**Disparador:** **se rota al crear producción** (**R-6.2**).

### DEC-03 — La Deployment Protection de Vercel queda **diferida**, no pendiente

**Decisión:** `R-1.1` se marca `[–]`. La URL pública sigue sirviendo la base de desarrollo, sin
protección.
**Por qué:** con la base vaciada en la Fase 0 y la credencial rotada, lo que la URL expone es un
entorno de prueba vacío. El costo de protegerla (romper el acceso rápido para verificar cambios
desplegados) no se paga con lo que evita hoy.
**Lo que esta decisión NO cubre:** el momento en que la base tenga datos reales.
**Disparador:** **R-6.2**. Al reapuntar Vercel a producción, esta decisión caduca automáticamente —
y con ella caducan también DEC-01 y DEC-02.
**Ojo al retomarla:** el toggle del dashboard ya figura activado (Standard Protection) y la URL
igual responde 200. Ver la nota de R-1.1.

### DEC-04 — El destino declarado es **self-hosted en VPS**

**Decisión:** el piloto corre en Vercel + Supabase Cloud; el self-hosting (Fase 9) va después, con
el runbook ya escrito y la migración ensayada con datos reales del piloto.
**Por qué:** el 100% del riesgo de infraestructura (backups, TLS, 13 contenedores, cutover con
invalidación de sesiones) estaba delante de conseguir el primer usuario. Invertir el orden acorta
semanas el tiempo a valor y hace el self-hosting más seguro: se migra un sistema ya validado.
**Consecuencia que hay que contar y no contar dos veces:** toda la configuración del dashboard de
Supabase Cloud (plantillas, SMTP, Site URL, rate limits, toggles) **se va a volver a hacer en el
VPS**. Eso **no** vuelve opcional a R-1.3: el snapshot de `auth:config` es la lista de qué
configurar ese día, y sin correrlo esa lista no existe. Lo que sí hace es que R-1.3 y R-6.1 son
trabajo de **una etapa intermedia**, no definitivo.
**Disparador:** al cerrar la Fase 7 (piloto validado).

### DEC-05 — El piloto **incluye instituciones** *(era `D5`, decidida de facto)*

**Decisión:** sí. Se invirtieron tres tandas completas en el subsistema institucional
(TI-3.1, TI-3.2, TI-3.3a/b), lo cual la decide en los hechos; acá queda anotada.
**Consecuencias directas:** **H-43** (correo de institución obligatorio) sube a P0 → R-3.8. **G-13**
sube de la Fase 8 a R-3.8, porque la tabla `instituciones` pasa a tener correos reales de terceros.
Y hay que decirle al piloto lo de **G-12** (ver Fase 7).

### DEC-06 — *(pendiente)* Contra qué base corren los tests automatizados

**Se decide en R-1.4.** Las tres opciones y su costo están ahí. **Anotar acá el resultado**, porque
R-5.1 la hereda y porque condiciona el cupo de proyectos del plan Free.

### Riesgo aceptado (no es una decisión pendiente): los 4 WARN de `SECURITY DEFINER`

`current_tenant_id()`, `es_ceom_admin()`, `es_gateway_sistema()` y
`tenant_tiene_consentimiento_vigente()` son ejecutables por `authenticated` y los advisors las
marcan. **Es deliberado: ese `EXECUTE` ES el mecanismo del backstop de RLS, y revocarlo rompe el
aislamiento** (verificado el 2026-07-27, commit `5b597c3`). **No revocar.** La única resolución real
es moverlas de schema, y es **R-8.9**.
