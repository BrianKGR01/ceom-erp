# Camino al lanzamiento — brechas priorizadas y plan por etapas

> Parte de la [auditoría de prelanzamiento](README.md) del 2026-07-27. Este es el documento de
> acción: qué falta exactamente, en qué orden conviene cerrarlo, y qué significa "listo para
> lanzar". Los porcentajes y la evidencia están en los otros tres documentos; acá solo el plan.

---

## 1. La decisión previa que ordena todo lo demás: ¿qué es "lanzar"?

El roadmap original apunta a producción en VPS propio con Supabase self-hosted (Fases 4-6). Esta
auditoría recomienda **separar el lanzamiento del self-hosting**:

- **Lanzamiento piloto (recomendado):** 3-10 negocios reales invitados por CEOM, corriendo en
  **Vercel + Supabase Cloud** — el stack que el proyecto ya usa en desarrollo, con backups y TLS
  gestionados. El alta asistida por `ceom_admin` (única vía hoy) deja de ser una limitación y pasa a
  ser el modelo de go-to-market.
- **Self-hosting (después):** ejecutar las Fases 4-6 con el runbook ya escrito
  (`docs/production/produccion.md`), **con datos reales del piloto como motivación y con la
  migración ensayada** — no como prerrequisito de tener usuarios.

Razón: el 100% del riesgo de infraestructura del roadmap (backups, TLS, actualización de 13
contenedores, cutover con invalidación de sesiones) hoy está delante de conseguir el primer usuario.
Invertir el orden acorta el tiempo a valor en semanas y hace el self-hosting más seguro (se migra un
sistema ya validado).

## 2. P0 — Bloqueantes del piloto (sin esto no se lanza)

### 2.1 Decisiones de producto (bloquean trabajo; solo el dueño puede tomarlas)

| # | Decisión | Bloquea |
|---|---|---|
| D1 | **Precio del plan Básico** (hoy el cliente ve Bs 0) | El lanzamiento comercial entero |
| D2 | **Sucursales**: ¿ABM ahora o esconder lo que las promete? (H-02) | La corrección de H-02, DA-06, DA-13 |
| D3 | **Roles por defecto**: sí/no a la propuesta escrita (H-35) | La experiencia de invitar equipo |
| D4 | **Política de costeo de reventa**: ¿último precio o promedio? (H-25) | Documentarla o cambiarla |
| D5 | **¿El piloto incluye instituciones?** | Si sí: H-42 y H-43 suben a P0. Si no: bajan a P1 |
| D6 | **Semántica de "pausada"** (H-46) y **downgrade vs. consentimientos** (H-47) | Cambios chicos de reglas |

### 2.2 Correcciones funcionales (los números tienen que decir la verdad)

| # | Qué | Referencia | Tamaño estimado |
|---|---|---|---|
| ~~C1~~ | ~~Conectar la comisión de venta al gasto real~~ | H-24 / DA-03 — ✅ **hecho**: trigger en `registrarVenta`, categoría "Comisiones de venta" autoprovisionada, y la comisión visible en la ficha de la venta | — |
| ~~C2~~ | ~~Darle efecto observable a la Compra de Ajuste~~ | H-31 — ✅ **hecho**: monto efectivo + estado de pago, lectura expuesta y visible en el listado, reversión de stock parcial con aviso, y llegada al estado de resultados solo en la dirección de costo | — |
| C3 | Recuperación de negocio por `ceom_admin` (designar Owner con registro de auditoría) | H-33 | Medio |
| C4 | Leer `entradaStock` al recibir una compra y avisar si falló | DA-24 (Proveedores) | Chico |
| C5 | Mostrar el efecto de ajustes en ficha/historial de venta y en el estado de cobro | H-26 | Medio |

### 2.3 Verificación (que el camino dorado no se pueda romper en silencio)

| # | Qué | Referencia |
|---|---|---|
| V1 | Arreglar `e2e/home.spec.ts` (hoy espera el placeholder de Next.js — falla contra la landing real) | §4.2 de [02-arquitectura-y-calidad.md](02-arquitectura-y-calidad.md) |
| V2 | Los 4 flujos e2e de la Fase 2 en Playwright, corriendo en CI: Modo Básico, Nicho 1, Nicho 4, consentimiento | Roadmap Fase 2 (0/6 hoy) |
| V3 | Seed de referencia para demos ya existe (`pnpm seed:demo`) — incorporarlo al setup de e2e | Roadmap Fase 2 último ítem |

### 2.4 Despliegue y operación mínima

| # | Qué | Nota |
|---|---|---|
| O1 | Conectar el repo a Vercel (deploy de preview por PR + producción desde `main`) | Hoy: cero proyectos. Es el ítem pendiente más viejo de la Fase 0 |
| O2 | Endurecimiento mínimo de Auth: leaked password protection, rate limits de Supabase, `REVOKE EXECUTE` de las 4 funciones SECURITY DEFINER, rate limit propio en el canje de código | [03-seguridad.md](03-seguridad.md) §5.1 |
| O3 | Captura de errores (Sentry o equivalente) + revisar los logs de Supabase como rutina | Sin esto, los errores del piloto son invisibles |
| O4 | Confirmar backups del plan de Supabase Cloud + una restauración de prueba | Barato, y convierte "hay backups" en un hecho |
| O5 | Documentar la rutina manual del ciclo de suscripción (quién marca vencidas, cuándo, con qué preaviso al cliente) | H-45 es sostenible a mano en piloto solo si es una rutina, no una memoria |

## 3. P1 — Antes de crecer más allá del piloto

- **Roles por defecto** implementados (tras D3) y **alta de `ceom_admin` desde `/admin`** (H-14).
- **H-42/H-43** (institución: segundo canje + correo obligatorio) — P0 si D5 = sí.
- **Símbolo de moneda en todos los montos** (auditoría UI/UX #6) + unificar las utilidades
  duplicadas (`formatMoneda` y compañía) para poder hacerlo una sola vez.
- **POS: stock visible y aviso de sobreventa** (H-37); **stock mínimo cargable** (H-28/DA-07);
  **filtro de sucursal honesto** en el Dashboard (DA-06) — o global mientras no haya multi-sucursal.
- **M1-M6** de la auditoría de autorización + **migración RLS de Identidad y Ventas** (checklist ya
  escrito).
- **Exportación de reportes** (DA-05/H-20) — único compromiso documental del MVP sin cumplir; según
  demanda real del piloto.
- **Avisos por correo del ciclo de suscripción** (H-45) — el reemplazo del scheduler manual (DA-04)
  puede ser un cron simple (Vercel Cron / pg_cron) que llame las funciones ya construidas.
- Los "quitar logo/imagen" (DA-08/09), DA-17, DA-10 (índice único parcial), H-29 (categoría en uso),
  H-34 (capacidad de producción: agregar los campos al form o quitar la pantalla).

## 4. P2 — Deuda que puede esperar (con dueño y disparador anotados)

- Consistencia visual transversal (anchos, tabs, EmptyState, formularios RHF vs useState) — el
  backlog priorizado ya existe en `docs/ui/AUDITORIA-UI-UX.md` §6.
- Paginación de `listarTenants` (DA-37) — al pasar de ~50 tenants.
- FKs de `planes.nicho_id`/`categorias_sugeridas.nicho_id` (DA-12), límite de sucursales por plan
  (DA-13 — tras D2), atributos de plan sin efecto (H-36).
- Completar RLS en el resto de módulos + `FORCE` + eliminar el export crudo `db` (etapas 5-6 del
  plan).
- Registro de auditoría completo de lecturas `ceom_admin` (DA-38) — reputacional, antes de firmar
  con la primera institución grande.
- 79 FKs sin índice + 56 policies permisivas múltiples (advisors de performance) — al crecer datos.
- Fases 4-6 del roadmap (VPS self-hosted) — tras validar el piloto.

## 5. Plan sugerido por etapas (secuencia, no fechas)

| Etapa | Contenido | Salida |
|---|---|---|
| **A. Decidir** | Las 6 decisiones de §2.1 en una sesión de trabajo | Backlog P0 sin ambigüedad |
| **B. Números honestos** | C1-C5 + V1 | Los reportes financieros dicen la verdad; e2e deja de estar roto |
| **C. Red de verificación** | V2-V3 (4 flujos e2e en CI) | El camino dorado protegido contra regresiones |
| **D. Desplegar** | O1-O5 | El producto existe fuera de una máquina local, con errores visibles y backups confirmados |
| **E. Piloto** | 3-10 negocios asistidos (el caso validado SanttiCampo primero); rutina semanal de revisión de errores/feedback; los P1 se ordenan por lo que el piloto grite | Producto validado con uso real |
| **F. Self-host** | Fases 4-6 con el runbook existente, migración ensayada con los datos del piloto | La visión de infraestructura completa del roadmap |

**Estimación honesta:** las etapas A-D son ~4-6 semanas de trabajo enfocado al ritmo que el
historial del repo demuestra. Lo que no se puede estimar desde acá es la duración de E — esa la
definen los usuarios.

## 6. Definición de "listo para lanzar" (checklist verificable)

- [ ] Las 6 decisiones de §2.1 tomadas y anotadas (en este archivo o donde corresponda).
- [ ] C1-C5 cerradas, con test cada una.
- [ ] `pnpm test:e2e` en verde en CI, cubriendo los 4 flujos de la Fase 2.
- [ ] App desplegada en Vercel, con dominio, accesible por un usuario real externo.
- [ ] Endurecimiento O2 aplicado (verificable: advisors de Supabase sin esos 4 WARN).
- [ ] Captura de errores activa y probada (un error forzado llega al canal del equipo).
- [ ] Restauración de backup probada una vez.
- [ ] Rutina del ciclo de suscripción escrita en `docs/production/` (aunque sea manual).
- [ ] Precio real cargado en el plan Básico (el cliente no ve más "Bs 0").
- [ ] Un tenant piloto real (no `owner@ceom.local`) completó el camino dorado sin asistencia
      posterior al alta.
