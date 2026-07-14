# Módulo 11 — Suscripción y Panel Administrativo CEOM

## 0. Propósito del módulo y alcance

Este es el último módulo del roadmap, y por diseño el último que se construye — así lo planteaste desde el principio ("esto va a ir aparte... va a ser lo último que vamos a crear"). Cubre tres piezas que ya veníamos anticipando en módulos anteriores, y que acá se terminan de cerrar:

1. **Gestión de Suscripción** — la mayor parte del modelo de datos ya existe (Tenant, Plan — Módulo 1); acá se cierra el flujo operativo completo.
2. **Panel Administrativo CEOM** — donde opera el rol `ceom_admin` (ya definido en el Módulo 1, sección 6.5).
3. **Panel Institucional y Gateway de Consentimiento** — formaliza con entidades concretas lo que la arquitectura v3 dejó definido como patrón (Policy Enforcement Point).

**Explícitamente fuera de alcance de este módulo** (son líneas de negocio reales del Lean Canvas, pero sin diseño funcional todavía — se documentan aparte cuando se prioricen):
- **CEOM Edu** (microlearning, cursos, simulador de inversión educativo).
- **Marketplace de Asesores humanos** (consultoría paga).
- Pasarela de pago automática (ya señalado como fuera de alcance en el Módulo 1).

---

## 1. Suscripción — cerrando el flujo operativo

El modelo de datos (`Tenant.plan_id`, `estado_suscripcion`, `estado_acceso`, `Plan` con sus campos de configuración) ya quedó definido en el Módulo 1. Lo que faltaba era el flujo completo de quién opera qué:

| Acción | Quién la ejecuta | Ya definido en |
|---|---|---|
| Alta de un tenant nuevo | `ceom_admin`, manual (sales-led) | Módulo 1, sección 3 |
| Cambio de plan (upgrade/downgrade) | `ceom_admin` manual, o autogestionado si el plan lo permite | Módulo 1, sección 11 |
| Transición de etapas por vencimiento (`solo_lectura` → `bloqueado`) | Automático, según configuración del plan | Módulo 1, sección 9.5 |
| **Crear o editar el catálogo de Planes** (precio por nicho, funciones incluidas) | `ceom_admin`, desde el Panel Administrativo CEOM | **Se cierra acá** (sección 2) |

---

## 2. Panel Administrativo CEOM

Reutiliza el mismo motor de Autorización de todo el sistema (Módulo 1) — el rol `ceom_admin` es de alcance cross-tenant, no una aplicación aparte con su propia lógica de permisos.

### 2.1 Funciones del Panel

- **Gestión de Tenants:** alta manual, cambio de plan, cambio de `estado_suscripcion`, consulta de cualquier tenant (sujeto a los mismos principios de auditoría que el resto del sistema — cada acción queda con `creado_por`/`modificado_por`).
- **Gestión del catálogo de Planes:** crear/editar planes, precio por Nicho, funciones incluidas (`incluye_sucursales`, `permite_multiples_owners`, `permite_downgrade_autogestionado`, duraciones de gracia).
- **Gestión de categorías sugeridas por Nicho:** `CategoriaSugerida` (Módulo 2) y `CategoriaGastoSugerida` (Módulo 4) — el equipo CEOM las administra desde acá.
- **Gestión de Instituciones y sus alianzas** (sección 3).
- **Salud agregada de la plataforma** (sección 2.2).

### 2.2 Salud agregada — métricas del Lean Canvas, calculables directamente

El Panel debe poder mostrar, sin cálculo manual, las métricas que el propio Lean Canvas de CEOM ya declara como objetivo:

- Cantidad de emprendimientos activos.
- % que completa la configuración inicial (onboarding, Módulo 1).
- % de retención a distintos plazos.
- Distribución de tenants por plan y por Nicho.

Todas estas son consultas agregadas sobre datos que ya existen en otros módulos (Tenant, onboarding) — el Panel no almacena ni recalcula nada por su cuenta, mismo principio ya aplicado en Reportes (Módulo 10).

---

## 3. Panel Institucional y Gateway de Consentimiento (formalización de la arquitectura v3)

### 3.1 Entidades

**Institución**

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `nombre` | text | Ej. "Incubadora UPSA" |
| `tipo` | enum | `universidad`, `incubadora`, `organizacion` |
| `contacto` | text, nullable | |
| `creado_por` | uuid | `ceom_admin` que la dio de alta |
| `creado_en` | timestamp | |
| `eliminado_en` | timestamp, nullable | |

**Cartera Institucional** (qué tenants sigue una institución, y en qué cohorte)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `institucion_id` | uuid | FK |
| `tenant_id` | uuid | FK |
| `cohorte` | text, nullable | Ej. "Cohorte 2026-1" |
| `fecha_inicio` / `fecha_fin` | date / date, nullable | |
| `eliminado_en` | timestamp, nullable | |

**Solicitud de Seguimiento** (la institución pide ver un tenant)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `institucion_id` | uuid | FK |
| `tenant_id` | uuid | FK |
| `modulos_solicitados` | enum[] | `financiero`, `operativo`, `inventario_operativo` |
| `estado` | enum | `pendiente` / `aprobada` / `rechazada` |
| `creado_en` | timestamp | |

**Aprobación de Tenant** (el consentimiento vigente — lo que consulta el Gateway)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `tenant_id` | uuid | FK |
| `institucion_id` | uuid | FK |
| `modulos_aprobados` | enum[] | Puede ser un subconjunto de lo solicitado |
| `aprobado_por` | uuid | Usuario del tenant (Owner) que aprobó |
| `fecha_aprobacion` | timestamp | |
| `revocado_en` | timestamp, nullable | La revocación es inmediata — la próxima consulta del Gateway ya deniega (regla ya fijada en el Módulo 1, sección 7.2) |

### 3.2 Gateway de Consentimiento — ya definido conceptualmente, ahora con datos concretos

El motor `tiene_permiso(solicitante, tenant, módulo)` del Módulo 1 ahora tiene, para el caso de instituciones, una fuente de datos concreta: consulta `Aprobación de Tenant` (¿existe una fila activa, con `revocado_en = null`, que incluya este módulo?). Ningún módulo de datos (Financiero, Operativo, Inventario Operativo) es consultado directamente por una institución — siempre pasa primero por acá.

### 3.3 Panel Institucional (vista — sin tablas propias, mismo criterio que Reportes)

Compone, para la cartera de una institución:
- Lista de tenants en su cartera, con avance de onboarding (checklist del Módulo 1).
- Actividad reciente y alertas de inactividad.
- Tendencia de ventas y, si fue aprobado, detalle financiero — **nunca** el detalle operativo/financiero fino de un tenant que no aprobó ese módulo específico.

### 3.4 Entidades veedoras por código (flujo distinto al de Instituciones pre-registradas)

Esto resuelve un caso real que no estaba cubierto por la sección 3.1: una consultora financiera, una aceleradora o un VC que el equipo CEOM **presenta/conecta manualmente** con un emprendimiento, pero donde el permiso concreto de qué módulos ver lo decide el propio emprendimiento, no una solicitud previa de la entidad externa.

**Flujo:**
1. El equipo CEOM hace la introducción/match entre el emprendimiento y la entidad externa (fuera del sistema, es una gestión comercial/humana).
2. El tenant, **si su plan lo permite**, genera un **Código de Acceso**: elige qué módulos habilita (dentro de lo que su plan autoriza) y el sistema genera un código alfanumérico único.
3. El tenant comparte ese código con la entidad externa, por el canal que sea (fuera del sistema).
4. La entidad externa ingresa el código en un **Portal de Entidades Veedoras** (superficie separada, pensada para quien no tiene cuenta CEOM todavía).
5. Al canjear el código: si la entidad no existía como `Institución` en el sistema, se crea en el acto con los datos mínimos que ingresa; se genera su fila en `Cartera Institucional` y en `Aprobación de Tenant`, con `modulos_aprobados` = lo que el tenant eligió al generar el código.
6. Desde ahí, la entidad accede al mismo Panel Institucional (3.3) ya definido — no hay una vista distinta, solo una vía de alta distinta.

**Código de Acceso**

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `tenant_id` | uuid | FK |
| `modulos_habilitados` | enum[] | Restringido a lo que el plan del tenant permite (ver adenda al Módulo 1, abajo) |
| `codigo` | text, único | Alfanumérico, generado por el sistema |
| `estado` | enum | `activo` / `canjeado` / `revocado` |
| `creado_por` | uuid | Usuario del tenant que lo generó |
| `creado_en` | timestamp | |
| `institucion_id` | uuid, nullable | Se completa recién al canjearse |
| `canjeado_en` | timestamp, nullable | |
| `revocado_en` | timestamp, nullable | El tenant puede revocar un código activo antes de que se canjee, o el acceso ya otorgado después de canjeado — mismo criterio de revocación inmediata que el resto del sistema |

> **Adenda al Módulo 1 (Plan):** se agrega el campo `modulos_veedor_permitidos` (enum[]) al catálogo de Planes — define qué módulos puede un tenant optar por compartir mediante Código de Acceso, según el paquete que tenga contratado (ej. un plan básico solo permite compartir Financiero; un plan superior permite también Operativo). Regulable desde el Panel CEOM Admin, igual que el resto de la configuración de planes.

---

## 4. Reglas de negocio clave

1. **Ninguna institución ve nada sin aprobación explícita, módulo por módulo** — regla ya fijada en el Módulo 1, ahora con el modelo de datos concreto de la sección 3.1.
2. **El Panel CEOM Admin reutiliza el mismo motor de autorización que todo el sistema** — no es una aplicación aparte con su propia lógica de permisos.
3. **Ningún panel almacena copias de datos de negocio.** Todo se lee en vivo a través del Gateway — mismo principio ya aplicado en Reportes/Dashboard (Módulo 10): cero duplicación de datos entre módulos.
4. **Cada acción del Panel CEOM Admin queda auditada** (`creado_por`/`modificado_por`) — el equipo interno no es una excepción a las reglas de trazabilidad que aplican a todo el resto del sistema.
5. **El acceso del equipo CEOM a datos de un tenant no requiere consentimiento explícito** — se entiende como parte de los Términos de Servicio de la plataforma, no del mismo mecanismo de aprobación que usan las instituciones/veedores externos. Sí queda registrado en un log de auditoría **interno** (no visible para el tenant, solo para el propio equipo CEOM): `LogAccesoAdminCEOM` (`usuario_ceom_id`, `tenant_id`, `modulo_consultado`, `fecha`) — una traza liviana de solo lectura, distinta del mecanismo de consentimiento formal de la sección 3.

---

## 5. Casos de uso comunes

1. **Alta de un tenant nuevo** por el equipo de ventas (ya cubierto, Módulo 1).
2. **Crear un nuevo Plan** o ajustar el precio de un plan existente para un Nicho específico.
3. **Dar de alta una Institución** y asociarle su cartera de tenants (una cohorte).
4. **Una institución solicita seguimiento** de un tenant; el Owner de ese tenant aprueba solo los módulos que decide.
5. **Consultar la salud agregada de la plataforma** desde el Panel CEOM Admin.
6. **Un Owner revoca el consentimiento** a una institución en cualquier momento.

---

## 6. Casos borde

1. **Tenant con `estado_acceso = bloqueado` (suscripción vencida) que tiene una institución o entidad veedora con consentimiento aprobado:** confirmado — se aplica el **mismo criterio que al propio tenant**. Mientras dure el bloqueo, la institución/veedor también pierde acceso, sin excepción por tener consentimiento aprobado.
2. **Institución con una cartera grande (ej. 100 tenants):** el Panel Institucional debe soportar listar/paginar en vez de cargar todo de una vez — nota de rendimiento, no de lógica de negocio.
3. **Revocación de consentimiento a mitad de una consulta activa:** la próxima llamada a `tiene_permiso()` ya deniega — no hay "sesiones" de consentimiento persistentes (mismo criterio ya fijado en el Módulo 1).

---

## 7. Confirmaciones de esta ronda

1. **Acceso del equipo CEOM a datos de un tenant:** confirmado sin consentimiento explícito (parte de los Términos de Servicio), con auditoría interna general vía `LogAccesoAdminCEOM` (regla 5, sección 4) — no visible para el tenant.
2. **CEOM Edu:** confirmado, completamente fuera de este módulo/versión.
3. **Marketplace de Asesores/Veedores:** aclarado y resuelto con el flujo de Código de Acceso (sección 3.4) — el equipo CEOM conecta manualmente, pero el permiso concreto de qué módulos ver lo decide el propio tenant, con un código que la entidad externa canjea en un Portal de Entidades Veedoras separado. Como marketplace propiamente dicho (con descubrimiento, perfiles públicos de asesores, etc.) sigue fuera de alcance — lo que sí queda resuelto es el mecanismo de conexión y permisos para el caso ya operativo que describiste.
4. **Tenant bloqueado con institución/veedor con consentimiento aprobado:** confirmado — mismo criterio que el propio tenant, pierde acceso mientras dure el bloqueo.

Con esto, el Módulo 11 queda cerrado — y con él, el roadmap completo de los 11 módulos planteados.

---

*Módulo 11 — cerrado y confirmado. Roadmap completo.*