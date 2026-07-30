# Operación, despliegue y ciclo comercial (2026-07-29)

> Parte de la [auditoría de prelanzamiento, 2ª edición](README.md). Esta es la dimensión más
> débil del proyecto (~35%) y donde viven los hallazgos críticos. Todos los de este documento
> fueron verificados adversarialmente contra el entorno vivo (Supabase, Vercel, la URL pública),
> no solo contra el repo.

---

## 1. 🔴 CRÍTICO — La "producción" de Vercel sirve la base de desarrollo, en público

**Los hechos, verificados en vivo hoy:**

1. Solo existe **un** proyecto de Supabase (`riertvgnjaujstwyqoom`, el de desarrollo, creado el
   2026-07-13). El proyecto de producción del runbook (paso 16) no existe.
2. Vercel despliega **producción** desde `main` automáticamente (último deploy 2026-07-28,
   PR #40), y sus 6 variables de Production apuntan a ese único Supabase — la misma base que
   **la suite de tests puebla y limpia** y contra la que corren los seeds.
3. `https://ceom-erp.vercel.app/login` responde **HTTP 200 público**, sin deployment protection.
4. El repo de GitHub es **público** (`githubRepoVisibility: "public"`), y
   `src/modules/consentimiento/ANCLA.md:288` tiene commiteada la credencial QA
   `ceomadmin-qa@ceom-erp.test / QaAdmin123!` — **válida contra esa base**. Cualquier persona
   puede iniciar sesión como `ceom_admin` de la plataforma en la URL pública.

**Consecuencia:** no es solo "datos de prueba visibles". Es una superficie admin real, pública,
con credencial publicada, sobre la base que todo el equipo usa para desarrollar. Una corrida de la
suite altera lo que "producción" muestra; un tercero con la credencial puede crear/tocar tenants.

**Acciones (todas chicas, en este orden):**
- Rotar la contraseña del `ceom_admin` de QA en la base y **borrar la credencial del ANCLA**
  (reemplazarla por "ver gestor de secretos del equipo"). Revisar si hay otras credenciales
  commiteadas (el barrido de esta auditoría encontró esa).
- Decidir de inmediato una de dos: **(a)** activar Deployment Protection de Vercel (la URL deja
  de ser pública) mientras no exista el Supabase de producción, o **(b)** crear ya el proyecto de
  producción y reapuntar las 6 variables (runbook §3.2 paso 16) — la opción (b) es además el
  ensayo del arranque que la Etapa 3 exige (§5 del doc de arranque).
- Activar **leaked password protection** (toggle, WARN vivo).

## 2. 🔴 CRÍTICO — Plantillas de Auth: "mixto y desconocido", con el alta real en juego

El estado documentado el 2026-07-28 sigue exacto: hay evidencia de que `/portal` funciona (PKCE
con plantillas de fábrica) y de que las 2 plantillas custom de `/app` estaban pendientes al 23/07.
De los 4 flujos de correo, **2 no tienen ninguna evidencia de funcionar: la invitación de
Owner/colaborador y el alta del primer `ceom_admin`** — exactamente los que dan de alta negocios
reales. Si "Invite user" sigue de fábrica, el enlace llega con formato que
`app/auth/callback/route.ts` rechaza (`exige token_hash+type`) y el Owner **nunca puede fijar
contraseña**: el negocio queda congelado desde el alta sin que nada falle visiblemente.

**Evidencia en vivo que lo corrobora:** `auth.audit_log_entries` está vacío (no se puede saber el
método de ningún login) y de 8 usuarios con `invited_at`, **4 nunca confirmaron** (2 son Owners de
negocio). El único invitado confirmado usó el atajo `generateLink()` de QA — lo que prueba que la
cadena server-side funciona y que el único eslabón desconocido es precisamente la plantilla.

**Acción (es un comando):** `SUPABASE_ACCESS_TOKEN=... pnpm auth:config` y commitear
`docs/production/auth-config.snapshot.json`. El script ya existe, extrae 23 campos sin secretos,
da veredicto ✅/❌ por plantilla y tiene modo `--check` para drift (que CI hoy no corre).
Sin el token de Management API en el entorno, nada de esto puede cerrarse.

## 3. Lo que sí avanzó (verificado)

| Pieza | Estado |
|---|---|
| Runbook ejecutable del arranque (17 pasos, con valor y verificación por paso) | ✅ Existe (`antiguo/09-arranque-desde-cero.md` §3.2) — pasos 12/14 dependen de bandeja de correo por diseño aceptado |
| `pnpm auth:config` (snapshot de config de Auth por Management API) | ✅ Bien construido — **nunca ejecutado** |
| `storage:setup` en el orden de bootstrap + chequeo ejecutable del bucket | ✅ Cerrado en los dos lugares prometidos, idempotente |
| Protección de las plantillas PKCE contra la "mejora por coherencia" | ✅ Blindada en doc + runbook + script (de lo mejor resuelto del área) |
| Runbook self-hosted Fases 4-6 (`docs/production/produccion.md`) | ✅ Escrito y bueno; posponerlo hasta después del piloto es decisión explícita y razonable |
| Seeds re-sembrables (`--reset`), seed de instituciones con casos degenerados, onboarding de demos completado | ✅ (commits `bd03636`, `b0e046e`, `e5f69ea`) |

## 4. Lo que sigue en cero (operación del piloto)

| Ítem del plan anterior | Estado | Detalle |
|---|---|---|
| O3 — Captura de errores | 🔴 en cero | Sin Sentry ni equivalente, sin `instrumentation.ts`, sin logger (grep vacío). Con producción viva, los errores son invisibles salvo mirar logs a mano |
| O4 — Backups | 🔴 sin confirmar | Ninguna evidencia de retención confirmada ni restauración probada; lo único escrito es para el self-hosting futuro |
| Monitoreo | 🔴 en cero | Ni healthcheck ni uptime check para el entorno YA desplegado; una caída se descubre si un usuario avisa |
| O5 — Rutina del ciclo de suscripción | 🔴 sin escribir | La mecánica del diálogo está documentada; la rutina (quién revisa, qué días, con qué preaviso) no existe en ningún doc |
| Ensayo del arranque contra proyecto nuevo | 🔴 no ejecutado | El runbook existe pero nunca se probó; hasta que corra, el arranque real es un estreno. (Detalle menor: dice "49 migraciones" y ya son 50) |
| Purga de `intentos_canje` + retención de logs D-1 | 🔴 pendiente autodeclarado | El "antes de producción" del propio schema ya se incumplió |

## 5. Ciclo comercial — sin cambios (~25%)

- **D1 — precio del plan Básico: sigue Bs 0 en la base viva** (verificado por SQL:
  `precio_mensual = 0.00`, plan activo). "Precio a convenir" en Mi Plan es maquillaje de UI
  (commit `514fafe`); `/admin` sigue mostrando `0.00 BOB / mes`. El formulario para cargarlo ya
  existe — el bloqueante es 100% de negocio, cero de código.
- **H-45 — nada vence, nada avisa, nada cobra.** El mecanismo existe (estados + gracia +
  `calcularEstadoAcceso`), el disparador no. Matiz verificado: `Modulo_01` documenta la transición
  `activa→vencida` como manual ("hoy la cambia el equipo CEOM"), así que no es contradicción
  doc-código sino brecha operativa reconocida — pero sin la rutina de O5 escrita, depende de la
  memoria de alguien.
- **🆕 Config de plan letra muerta** (gracia e invitación por plan editables sin efecto): ver
  [01-estado-por-modulo.md](01-estado-por-modulo.md) §1 — decidir dirección (aplicarla o quitarla
  del formulario y corregir el manual).
- Un solo cron (Vercel Cron ahora es viable) resuelve la transición de H-45 + recurrentes (H-10) +
  la mitad pendiente de DA-04 — hoy documentados en 4 lugares como si fueran 4 deudas.

## 6. Drift documental de esta dimensión

Tres documentos siguen afirmando "cero proyectos en Vercel" (`roadmap.md:21`, `antiguo/04:62`,
`antiguo/README:56`) — falso desde el 27/07 y engañoso en la peor dirección: la etapa "Desplegar"
no es que no arrancó; arrancó **por el paso más riesgoso** (deploy público sin reapuntar la base,
sin errores visibles y sin backups). Corregirlos es parte de la pasada de higiene del
[roadmap](04-roadmap-lanzamiento.md).
