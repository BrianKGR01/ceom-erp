# Transversales: seguridad, verificación, UI e higiene documental (2026-07-29)

> Parte de la [auditoría de prelanzamiento, 2ª edición](README.md).

---

## 1. Seguridad — ~72%

### 1.1 Lo que resiste (verificado)

- **Manifiesto de acceso vivo y creciendo:** 165 funciones clasificadas (eran 152) sobre 22
  archivos `"use server"`, verificación 100% estática por AST, cero entradas "manual". Las 13
  funciones nuevas post-auditoría (portal, canje, sucursales) están clasificadas
  (`src/lib/security/access-manifest.ts` + test).
- **Rate limit del canje** (única escritura pre-auth): 10 intentos/15 min por huella
  SHA-256(secreto:IP), en tabla (correcto para serverless), registra incluso bloqueado. Cierra lo
  que la auditoría anterior exigía "antes de cualquier despliegue" en ese frente.
- **Secretos correctos:** service role solo server-side (2 usos, ambos en server actions), `.env*`
  fuera del repo, `.env.example` solo placeholders, la capa edge (`proxy.ts`) usa solo la
  publishable key. El barrido "nada de claves de servicio en el cliente" se puede dar por hecho.
- **Deny-all deliberado:** `intentos_canje` y `logs_acceso_admin_ceom` tienen RLS sin policies a
  propósito (documentado en el schema) — los 2 INFO de advisors son esperados.
- **Los 4 WARN de SECURITY DEFINER son riesgo aceptado documentado** (el `EXECUTE` de
  `authenticated` ES el mecanismo del backstop; revocarlo rompería el aislamiento — corrección del
  2026-07-27, commit `5b597c3`). La única resolución real (mover las funciones de schema) sigue
  anotada como tarea futura. **No revocar.**
- **Test dorado SQL↔TS de vigencia** (`vigencia-dorado.test.ts`): la promesa de D-5 se cumplió.
- El layout de `/admin` gatea `ceom_admin` en dos capas (el doc de autorización aún dice lo
  contrario — drift en la dirección buena).

### 1.2 Lo que sigue abierto

| Ítem | Estado | Detalle |
|---|---|---|
| Leaked password protection | 🔴 **incumplido** | La condición "antes de cualquier despliegue" ya se violó: hay producción viva y el WARN sigue. Es un toggle del dashboard |
| Backstop RLS en runtime | 🔴 sin cambios | Solo Patrimonio y Proveedores migrados a `comoUsuario()`; los otros 7 módulos corren como rol dueño (bypass total) — sus `crudPolicy()` son invisibles al tráfico real. `FORCE` solo en Proveedores |
| G-12 — Gateway sin piso de RLS | 🔴 alta | 3 de 4 pestañas del portal institucional (Ventas, Gastos/Financiero, Nicho 1) leen con bypass total, apoyadas solo en `tieneConsentimiento()` de TS. El plan lo declaró "el próximo incremento, no opcional" |
| M1-M6 de la auditoría de autorización | 🔴/🟡 | M1, M2, M3, M5, M6 abiertos tal como se documentó. **M4 se cerró ⅔ de rebote con H-02** (sucursales validadas; `proveedorId` no) — ningún doc lo registra, quien retome M1-M6 re-verificará trabajo hecho. Esta auditoría amplió M1/M2: `clienteId` produce **escritura** cross-tenant (`ultima_compra_en`), e `importarVentaHistorica` no valida ni sucursal congelada |
| Rate limits de Auth (login/recovery/magic link) | ⚪ no verificable | Delegados a Supabase; el snapshot que los capturaría (`pnpm auth:config`) nunca se corrió |
| RLS de `instituciones` (G-13/D-2) | 🔴 alta | `USING(true)` sin REVOKE de columna: toda sesión autenticada lee correos y `auth_user_id` de todas las instituciones vía PostgREST, incluidas las borradas. Decidida, sin ejecutar |
| 🆕 RLS de `logs_acceso_institucion` | 🆕 media | `crudPolicy` estándar da al tenant `modify`/`delete` sobre su propio log de auditoría; D-1 pedía solo lectura |
| 🆕 **Credencial de `ceom_admin` commiteada en repo público** | 🔴 **crítica** | `src/modules/consentimiento/ANCLA.md:288` publica `ceomadmin-qa@ceom-erp.test / QaAdmin123!`, válida contra la base que la URL pública de producción sirve (ver [03-operacion-y-comercial.md](03-operacion-y-comercial.md) §1). Rotar la clave y borrar la credencial del doc es la acción №1 del roadmap |

## 2. Red de verificación (tests, CI, e2e) — la dimensión que más maduró

### 2.1 Lo nuevo desde el 27/07 (verificado)

- **Suite: 46 archivos / 384 tests, todos en verde** (hace dos días: 39/263). Corrida completa hoy
  contra la base real: 9,1 min.
- **Candado de suite** por advisory lock sobre `DIRECT_URL` (una corrida a la vez o falla al
  instante), con test que protege la elección de `DIRECT_URL` sobre el pooler (bug real ya mordido).
- **`expect.hasAssertions()` global**: un test sin afirmaciones es rojo — cierra la clase del
  idiom `if (...) return` sobre los 384 tests.
- **Convención §6.1(b)** ("el valor esperado tiene que ser distinguible del valor de la falla")
  documentada con los 2 errores reales de la tanda 3.3a como ejemplo.
- **Guardas del journal de migraciones** (7 tests) — cubren la trampa real del timestamp futuro
  que `drizzle-kit` saltea en silencio.
- **TZ=UTC fijado en CI a propósito** (H-49): un cálculo de fecha apoyado en el reloj del proceso
  se cae en CI en vez de en el reporte de un cliente.
- Tests de RLS en vivo en 2 módulos (Patrimonio 4, Proveedores 9 — incluye Gateway con/sin
  consentimiento), corriendo también en CI contra postgres:16 con migraciones reales.

### 2.2 Las brechas (las tres primeras nacieron al conectar Vercel; ningún doc las registra)

| Ítem | Estado | Detalle |
|---|---|---|
| 🆕 **CI solo corre en `pull_request`** | 🔴 alta | Un push directo a `main` llega a producción sin lint ni un test (el build de Vercel solo typechequea). `dev` tampoco tiene CI en push: los ~35 commits recientes corrieron sin red hasta el PR. Fix: trigger `push` a `main` (y idealmente `dev`), o proteger `main` a solo-PR |
| 🆕 El verde de CI es un **subconjunto** del verde local | 🟡 media | Sin `SUPABASE_SECRET_KEY` como secret, ~15 suites de integración se saltean en CI (Ventas, Identidad, Consentimiento, Financiero…). Una regresión de integración solo se detecta si alguien corre la suite local |
| Fase 2 del roadmap: 0/4 flujos e2e | 🔴 alta | Ni Modo Básico, ni Nicho 1, ni Nicho 4, ni consentimiento tienen spec; CI no tiene paso de Playwright ni browsers. V1 (spec de home) sí quedó cerrado |
| V3 — seed no integrado a e2e | 🔴 media | `playwright.config.ts` solo levanta `pnpm dev`; sin globalSetup, sin storageState |
| 🆕 El e2e futuro correría contra la base compartida **sin candado** | 🆕 media | El advisory lock es exclusivo de vitest. Decidir el aislamiento (extender el lock, base dedicada o proyecto efímero) **antes** de escribir los 4 specs — si no, se recrea el incidente de conteos falsos del 27/07 |
| Cobertura esquelética en módulos de cierre | 🟡 baja | nicho-4 (2 tests), reportes (4 para 8 vistas), panel-admin-ceom (4, y sus 2 consultas operativas con **cero** tests — prerequisito del checklist RLS), suscripción (4) |

## 3. UI — construcción ~95%, consistencia ~72%

### 3.1 Verificado

- Las pantallas institucionales de las tandas 3.3a/3.3b existen completas en `/portal` (tercer
  estado, error por pestaña, cobertura por sucursal, marcador H-15 tipado) y la pantalla D-1
  "Quién miró" está navegable con ANCLA al día.
- Fases A y B de `AUDITORIA-UI-UX.md` cerradas de verdad: los 9 componentes nuevos existen, la
  tabla de `max-w` está en `design-system.md` §7. UI-044 (gate de Mi Plan) y UI-038 cerrados en
  código sin tachar en el doc.
- `docs/ui/observaciones-de-uso.md` es el doc de UI más fiel al código: sus estados coinciden.

### 3.2 Abierto

| Ítem | Estado | Detalle |
|---|---|---|
| 🆕 `/admin` sin marcadores institucionales | 🔴 alta | Ver [01-estado-por-modulo.md](01-estado-por-modulo.md) §5 — re-proyección a mano + skeleton eterno + sin "no aplica" |
| Fase C (migración masiva) sin arrancar | 🔴 media | `formatMoneda`: 2 consumidores reales de `lib/format.ts` vs **10 copias locales + 21 `toLocaleString` crudos** — casi ningún monto muestra símbolo de moneda; Tabs con 1 consumidor; lote responsive (UI-011/041/043) sin arrancar |
| 🆕 Sucursales (H-02) huérfana del sidebar | 🆕 media | La única navegación a `/app/mi-negocio/sucursales` vive en las copias de `SubnavMiNegocio` que la Fase C planea **borrar** — ejecutarla como está escrita dejaría la pantalla inalcanzable |
| 🆕 Regresión UI-005 | 🔺 media | El patrón deprecado ganó una **sexta copia** (sucursales) y la copia del onboarding divergió más (4 vs 6 ítems, glosario a medias) |
| H-08 — menú sin adaptar a permisos/rubro | 🔴 media | `app-shell.tsx:180-255`: array fijo; la única condición es `esOwner` para "Mi negocio". El bloqueo server-side funciona (no es agujero), pero el colaborador ve ítems que rebotan |
| H-34 — capacidad de producción | 🔴 media | Sin campos en ningún formulario (decisión pendiente: agregarlos o quitar la pantalla) |
| Tracker de pantallas desactualizado | 🟡 media | `pantallas.md` declara 119/119 al 2026-07-25; faltan al menos 3 pantallas nuevas (landing `/`, Sucursales, Accesos D-1) y 2 modales. El conteo real de rutas es 75 `page.tsx` |

## 4. Higiene documental — el riesgo nuevo más barato de cerrar

**No se encontró ninguna regresión** (nada marcado "corregido" que el código contradiga). El
problema es el inverso: **los registros corren detrás del código**, y quien planifique desde ellos
va a re-trabajar cosas cerradas y subestimar lo abierto.

| Registro | Declara | Real contra código |
|---|---|---|
| `docs/manual/hallazgos.md` | 7 corregidos, 38 abiertos (2🔴) | **10 corregidos** (sumar H-30, H-06, H-18), 4 parciales (H-01, H-05, H-12, H-32), **31 abiertos (1🔴: H-33)**. H-30 —"el peor abierto"— está cerrado con tests y el índice aún muestra un 🔴 falso |
| `docs/deuda-aplazada.md` | 1 cerrado de 44 (DA-13) | **3 cerrados** (DA-01, DA-03, DA-13) + DA-04 parcial. DA-03 sigue listado como "#1 de los cinco a elegir" estando resuelto |
| `antiguo/08-instituciones` tabla de tandas | 3.3 "Pendiente" | 3.3a + 3.3b mergeadas (commits `1f68bea`/`1f8a8fd`/`12ec263`/`77e77ab`); D-1 adelantada desde 3.5 |
| 3 docs sobre Vercel | "cero proyectos/despliegues" | Falso desde el 27/07: `roadmap.md:21`, `antiguo/04:62`, `antiguo/README:56` |
| ANCLA desactualizados | — | `monitoreo-institucional` (contrato cambió: motivo, cobertura, falla-cerrado), `panel-admin-ceom` (**contradice** al código: dice que no audita y audita), `identidad` (`obtenerTenantParaVeedor`, `recursoPerteneceAlTenant`), `suscripcion` ("nadie consume `modulosVeedorPermitidos`" — falso) |
| Docs de módulo | — | `Modulo_01`/`Modulo_11` describen `incluye_sucursales` (no existe); `Modulo_04`/`Modulo_07` sin los contratos de H-31/H-15; `Modulo_08` declara "fuera de alcance" el landed cost implementado hace semanas |
| `AUDITORIA-AUTORIZACION.md` | M4 abierto; layout `/admin` sin gate | M4 ⅔ cerrado por H-02; el layout sí gatea. También UI-044/UI-038 sin tachar en `AUDITORIA-UI-UX.md` |

**Recomendación:** una sola pasada de higiene (media jornada) que actualice los 2 registros, los 4
ANCLA, los 3 docs de módulo, el tracker de pantallas y la tabla de tandas — está en la Etapa B del
[roadmap](04-roadmap-lanzamiento.md) porque ordena todas las priorizaciones siguientes.
