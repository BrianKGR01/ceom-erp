# Seguridad — qué resiste, qué está a medias, qué falta

> Parte de la [auditoría de prelanzamiento](README.md) del 2026-07-27. Este documento no repite las
> ~3.700 líneas de `docs/security/` — las resume para la decisión de lanzamiento y agrega lo que se
> verificó en vivo hoy (advisors de Supabase, estado real de configuración de Auth).

---

## 1. La postura en una frase

**La primera línea de defensa (autorización a nivel de aplicación) fue auditada de forma seria y
está en buen estado; la segunda línea (RLS como backstop en la base) está construida a medias y
pausada a conciencia; y la tercera capa (protecciones operativas: rate limiting, avisos, logging)
no existe todavía.** Para un piloto asistido, el estado es aceptable con 3-4 ajustes puntuales; para
abrir el registro al público, no.

## 2. Lo que ya se hizo — y se hizo bien

### 2.1 Auditoría de autorización server-side (2026-07-21, `docs/security/AUDITORIA-AUTORIZACION.md`)

- Barrido de los 16 módulos/capas con verificación adversarial + verificación personal.
- **27 funciones con escritura/lectura cross-tenant explotable, todas corregidas** (la clase: recibir
  un id de recurso del cliente y mutarlo sin atarlo al tenant del solicitante). Incluye la variante
  más grave (`construirDashboard` recibía el objeto `usuario` por parámetro — bypass total de
  `tienePermiso()` por POST directo), detectada por verificación empírica contra el build real.
- **Mecanismo preventivo real, no promesa:** `access-manifest.ts` clasifica las 152 funciones
  `"use server"` y su test por AST rompe la suite si aparece un endpoint sin clasificar, si el nivel
  declarado no tiene evidencia de guard, o si una función vuelve a recibir identidad por parámetro.
- Boundaries que resistieron el barrido sin hallazgos: `/admin` (todas las actions exigen
  `ceom_admin`), `/portal` y el Gateway de Consentimiento completo.
- **Residuo abierto:** M1-M6 (medios/bajos — FKs anidadas sin validar contra el tenant, p.ej.
  `activoId` en `crearPasivo`). Documentados a propósito; recomendado cerrarlos al migrar cada
  módulo a RLS.

### 2.2 RLS backstop (`docs/security/PLAN-RLS-BACKSTOP.md`)

Estado por etapa (resumen del propio plan, vigente):

| Pieza | Estado |
|---|---|
| Mecanismo base `comoUsuario()`/`comoCeomAdmin()`/`comoGatewaySistema()` (`src/db/contexto.ts`) | ✅ |
| Patrimonio migrado | ✅ (sin `FORCE`) |
| Proveedores migrado | ✅ (con `FORCE`, bypass `ceom_admin` y Gateway) |
| Los otros ~8 módulos (Identidad, Productos, Ventas, Gastos, etc.) | ❌ Sin migrar — el rol `postgres` sigue bypasseando RLS en ellos |
| Test de aislamiento cross-tenant en CI | ✅ Solo Patrimonio |
| Eliminar el export crudo `db` | ❌ Pendiente |

El trabajo está **pausado a propósito desde el 2026-07-22** ("no es abandono"), con checklist
autónomo para retomar módulo por módulo (`docs/security/CHECKLIST-MIGRACION-RLS.md`). La lectura del
auditor: **la pausa es razonable para el piloto** — las guardas de aplicación auditadas son la
defensa principal y están probadas — pero conviene retomar la migración al ritmo de un módulo por
semana, empezando por Identidad y Ventas (los de mayor valor de dato).

### 2.3 Identidad y superficies

- Gates server-side en layout/middleware por superficie, redirect por rol, verificado en navegador.
- Sesión de Institución deliberadamente separada de la de Usuario, con aislamiento verificado en
  ambas direcciones (`CEOM_Arquitectura.md` §8.3).
- Anti-enumeración en recuperación de contraseña y magic link (misma respuesta exista o no el correo).
- La fila del usuario Gateway quedó blindada en tres capas tras OBS-10 (PR #24).

## 3. Verificado en vivo hoy — advisors de Supabase (proyecto `riertvgnjaujstwyqoom`)

### 3.1 Seguridad — 4 WARN + 1 INFO, ninguno crítico

| Advisor | Nivel | Lectura |
|---|---|---|
| `current_tenant_id()`, `es_ceom_admin()`, `es_gateway_sistema()`, `tenant_tiene_consentimiento_vigente()` ejecutables por `authenticated` vía `/rest/v1/rpc/` | WARN ×4 | Las 4 funciones `SECURITY DEFINER` del mecanismo RLS quedaron invocables por la API REST de Supabase para cualquier usuario logueado. Son solo lecturas de contexto (devuelven boolean/uuid del propio JWT), **no filtran datos de otro tenant** — pero no hay razón para dejarlas expuestas: `REVOKE EXECUTE ... FROM authenticated, anon` es un fix de una línea por función. [Referencia](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) |
| Leaked password protection deshabilitada | WARN | El chequeo contra HaveIBeenPwned está apagado. Activarlo es un toggle en el dashboard de Auth. [Referencia](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) |
| `logs_acceso_admin_ceom` con RLS habilitada y cero policies | INFO | Conocido y diferido a propósito (plan RLS, etapa 3.d) — la tabla es inaccesible para `authenticated`, que es el estado seguro |

**Corrección post-verificación (2026-07-27, tanda de higiene):** la recomendación de este documento
("`REVOKE EXECUTE ... FROM authenticated, anon` es un fix de una línea por función") es incorrecta
para el rol `authenticated`. Verificado en vivo (advisors + `pg_proc`) y contra el código:

- `es_ceom_admin()`, `es_gateway_sistema()` y `tenant_tiene_consentimiento_vigente()` ya nacieron en
  sus propias migraciones de creación (`0031`, `0035`, `0038`) con `revoke all ... from public, anon;
  grant execute ... to authenticated;` — el mismo criterio que `current_tenant_id()` adoptó
  retroactivamente en `0028`. No queda ningún `EXECUTE` de `public`/`anon` pendiente de revocar en
  ninguna de las 4 funciones.
- El `EXECUTE` de `authenticated` que el advisor sigue marcando **no es un descuido, es el mecanismo
  activo del backstop de RLS**: `src/db/contexto.ts` (`fijarContextoYExigirTenant`) hace
  `set local role authenticated` y llama a estas funciones para que las policies de `crudPolicy()`/
  `ceomAdminBypassPolicy()`/`gatewayVigenciaBypassPolicy()` (`src/db/rls.ts`) puedan evaluarse — es el
  camino real que usan hoy los módulos Patrimonio y Proveedores. Revocarle `EXECUTE` a `authenticated`
  rompería el aislamiento de tenant en producción, no lo cierra.
- Por eso `current_tenant_id()` sigue apareciendo en el advisor en vivo pese a que `0028` ya se aplicó
  hace tiempo: ese WARN específico (ejecutable por `authenticated` vía RPC) es un riesgo aceptado a
  conciencia, no algo resoluble con un `REVOKE` sin romper RLS.
- La única forma de cerrarlo de verdad sería sacar las 4 funciones del schema `public` (el que
  PostgREST expone como `/rest/v1/rpc/`) a un schema no expuesto, conservando el `EXECUTE` de
  `authenticated` ahí. Es un cambio estructural — schema nuevo, re-apuntar las ~92 policies que las
  llaman, `src/db/rls.ts`, verificación completa — **diferido a propósito, no parte de esta tanda de
  higiene.**

### 3.2 Performance — no bloquea, conviene saberlo

- **79 foreign keys sin índice** (INFO) — irrelevante con volumen de piloto; entra en juego con
  datos reales acumulados.
- **56 casos de policies permisivas múltiples** (WARN) — costo por query en tablas con varias
  policies; se racionaliza al completar la migración RLS.

## 4. Lo que no existe todavía (Fase 3 del roadmap, sin empezar en su mayoría)

| Falta | Riesgo si se lanza sin esto | Costo estimado |
|---|---|---|
| **Rate limiting** en login, recuperación, magic link y canje de código (verificado hoy: cero ocurrencias en `src/`) | Fuerza bruta / abuso del cupo de emails de Auth. El canje de código de `/portal` es público y adivinable por fuerza bruta si el espacio de códigos es chico | Bajo — Supabase Auth trae límites configurables; el canje necesita uno propio |
| **Logging estructurado + captura de errores** (Sentry o similar) | Los errores de producción solo se verían si alguien mira la consola del servidor | Bajo-medio |
| **Avisos por correo del ciclo de suscripción** (H-45) | Clientes bloqueados sin preaviso → reclamos | Medio |
| **Registro de auditoría completo de lecturas `ceom_admin`** (DA-38: solo las 3 lecturas del panel auditan; otras vías no dejan rastro) | Compromiso reputacional con la promesa de privacidad ("CEOM no tiene acceso privilegiado") | Medio — el propio proyecto lo tiene anotado como el ítem de mayor peso reputacional |
| **Backups propios / restauración probada** | En Supabase Cloud (piloto): mitigado por los backups del plan — confirmar retención y hacer una restauración de prueba. En self-hosted: bloqueante absoluto, ya documentado en el runbook | Bajo (Cloud) / medio (VPS) |
| Revisión de secretos formal (Fase 3) | `.env.local` fuera del repo (verificado); falta el barrido formal de "nada de claves de servicio en el cliente" | Bajo |

## 5. Recomendaciones concretas, en orden

1. **Antes de cualquier despliegue**: activar leaked password protection; configurar los rate limits
   de Supabase Auth; agregar un rate limit propio al canje de código del portal. ~~`REVOKE EXECUTE`
   de las 4 funciones SECURITY DEFINER para `authenticated`/`anon`~~ — corregido en la nota de la
   §3.1: la parte de `anon`/`public` ya estaba resuelta desde la creación de cada función, y la de
   `authenticated` no se puede revocar sin romper el backstop de RLS activo (Patrimonio/Proveedores).
2. **Antes del piloto**: cerrar M1-M6 (mecánicos, el guard ya existe); captura de errores (Sentry o
   equivalente); confirmar backups del plan de Supabase Cloud con una restauración de prueba.
3. **Durante el piloto**: retomar la migración RLS módulo por módulo (Identidad primero), con su
   test de aislamiento por módulo — el checklist ya existe y no requiere releer el plan.
4. **Antes de abrir el registro al público** (si algún día hay signup autoservicio): revisión
   completa de la Fase 3 + pentest externo del boundary `/portal` y del canje de código.
