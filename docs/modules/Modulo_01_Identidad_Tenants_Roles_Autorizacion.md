# Módulo 1 — Identidad, Tenants, Sucursales, Roles y Autorización

## 0. Propósito del módulo

Este módulo es la base sobre la que corren todos los demás. Resuelve cuatro preguntas que cualquier otro módulo va a necesitar responder constantemente:

1. **¿A qué negocio pertenece este dato?** (Tenant / Sucursal)
2. **¿Quién es el usuario que está actuando?** (Identidad / Autenticación)
3. **¿Qué puede hacer ese usuario?** (Rol / Permiso)
4. **¿Está permitida esta acción específica, ahora mismo?** (Motor de Autorización)

Ningún otro módulo implementa su propia lógica de permisos o su propia noción de "a qué empresa pertenezco" — todos consumen este módulo.

---

## 1. Entidades y modelo de datos

### 1.1 Tenant (empresa / negocio)

Representa a un emprendimiento cliente de CEOM. Es la unidad de aislamiento de datos: prácticamente ninguna tabla del sistema existe sin apuntar, directa o indirectamente, a un `tenant_id`.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `nombre_negocio` | text | Ej. "Mi Negocio S.R.L." |
| `ciudad_base` | text | |
| `moneda_principal` | text (ISO 4217) | Ej. `BOB`. Ver sección 6 sobre multi-moneda futura |
| `logo_url` | text, nullable | Apunta a Storage (Supabase Storage con backend Backblaze B2) |
| `canales_venta` | text[] | Etiquetas: redes sociales, feria, local físico, boca a boca (multi-selección, ampliable) |
| `nicho_id` | uuid, nullable | `null` = Modo Básico. Ver sección 5 |
| `nicho_asignado_en` | timestamp, nullable | Fecha de migración a nicho, para auditoría |
| `plan_id` | uuid | FK a catálogo de planes (ver 1.6) |
| `estado_suscripcion` | enum: `activa` / `pausada` / `vencida` | Hoy la cambia manualmente el equipo CEOM; mismo campo que usará la pasarela de pago automática en el futuro |
| `estado_acceso` | enum: `activo` / `solo_lectura` / `bloqueado` | **Derivado**, no editable a mano. Se calcula a partir de `estado_suscripcion` y de la configuración de etapas de gracia (ver sección 9.5 y Módulo 11). El motor de Autorización lo consulta antes de evaluar cualquier permiso de rol |
| `fecha_inicio_suscripcion` | date | |
| `fecha_proximo_pago` | date, nullable | |
| `creado_por` | uuid (FK Usuario, tabla interna CEOM) | Quién del equipo de ventas dio de alta al tenant |
| `creado_en` | timestamp | |
| `eliminado_en` | timestamp, nullable | Soft delete — nunca hard delete |

**Regla clave:** el Core nunca sabe de negocio. `nicho_id` es la única señal que el Core expone hacia el Módulo Operativo; el Core no interpreta qué significa ese nicho.

### 1.2 Sucursal

Existe desde el día uno en el modelo de datos, aunque el plan básico no la exponga en la interfaz.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `tenant_id` | uuid | FK |
| `nombre` | text | Ej. "Sucursal Centro" |
| `direccion` | text, nullable | |
| `es_principal` | boolean | Toda empresa tiene exactamente una sucursal marcada como principal, creada automáticamente al dar de alta el tenant |
| `activa` | boolean | Para desactivar sin borrar |
| `eliminado_en` | timestamp, nullable | |

**Regla de convivencia con el plan:** si el `plan_id` del tenant no incluye multi-sucursal, el sistema simplemente no permite crear una segunda sucursal ni muestra el selector en la interfaz — pero el campo `sucursal_id` ya existe y se usa (apuntando siempre a la principal) en las tablas operativas de otros módulos (stock, ventas, activos). Esto evita una migración de datos el día que el negocio compre el plan con sucursales: solo se habilita la función, no se reestructuran tablas.

### 1.3 Usuario

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK, coincide con el id de Supabase Auth (GoTrue) |
| `tenant_id` | uuid | Un usuario pertenece a un solo tenant (decisión ya confirmada para el MVP) |
| `nombre_completo` | text | |
| `email` | text | Único por tenant (no global — dos tenants distintos podrían, en teoría, tener usuarios con el mismo email si en el futuro se permite; no es el caso hoy) |
| `telefono` | text, nullable | |
| `rol_id` | uuid | FK a Rol (ver 1.4). Un usuario tiene un solo rol activo a la vez en el MVP — ver sección 6 sobre roles múltiples |
| `es_owner` | boolean | Verdadero solo para el usuario Owner del tenant. Ver reglas de protección en 4.2 |
| `activo` | boolean | Para suspender acceso sin borrar el usuario |
| `ultimo_acceso_en` | timestamp, nullable | |
| `creado_por` | uuid, nullable | Quién invitó/creó a este usuario (otro usuario del mismo tenant, o el equipo CEOM si es el primer Owner) |
| `creado_en` | timestamp | |
| `eliminado_en` | timestamp, nullable | Soft delete |

### 1.4 Rol

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `tenant_id` | uuid, nullable | `null` para los roles de sistema (Owner, CEOM Admin); con valor para roles personalizados creados por cada tenant |
| `nombre` | text | Ej. "Owner", "Vendedor", "Encargado de Inventario" |
| `es_rol_sistema` | boolean | `true` para Owner y CEOM Admin — no editables ni eliminables |
| `creado_en` | timestamp | |
| `eliminado_en` | timestamp, nullable | |

### 1.5 Permiso (matriz rol × módulo × acción)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `rol_id` | uuid | FK |
| `modulo` | enum | `productos`, `inventario`, `ventas`, `costos_gastos`, `patrimonio`, `operativo`, `financiero`, `simulaciones`, `reportes` |
| `accion` | enum | `ver`, `crear`, `editar`, `anular_ajustar` |
| `permitido` | boolean | |

El Owner tiene automáticamente todos los permisos, en todos los módulos, y esa fila no se puede editar ni eliminar (ver 4.2).

### 1.6 Plan (catálogo, gestionado desde el Panel CEOM)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `nombre` | text | Ej. "Básico", "Pro con sucursales" |
| `nicho_id` | uuid, nullable | Permite precio distinto por nicho |
| `incluye_sucursales` | boolean | |
| `permite_multiples_owners` | boolean | Habilita el caso de cofundadores (ver 6.2). Por defecto `false` en el plan Básico |
| `permite_downgrade_autogestionado` | boolean | Si es `false` (default sugerido), un downgrade solo lo ejecuta CEOM Admin manualmente, aunque exista pasarela de pago. Ver sección 12 |
| `duracion_invitacion_dias` | integer | Días de validez de una invitación a colaborador antes de vencer. Default confirmado: 7 días |
| `duracion_etapa_solo_lectura_dias` | integer | Días en modo solo lectura/exportación antes de pasar a bloqueo total al vencer la suscripción. `0` = salta directo a bloqueo total. Configurable desde el Panel CEOM; default confirmado: 3 días |
| `modulos_veedor_permitidos` | enum[] | **Adenda originada en el Módulo 11.** Qué módulos puede un tenant optar por compartir con una entidad veedora externa mediante Código de Acceso (`financiero`, `operativo`, `inventario_operativo`), según el paquete contratado |
| `precio_mensual` | numeric | |
| `moneda` | text | |
| `activo` | boolean | Para dar de baja un plan sin borrar el histórico de quién lo tuvo |

---

## 2. Reglas transversales de manejo de datos (aplican a todo el módulo, y de hecho a todo el sistema)

1. **Nunca hard-delete.** Todas las tablas de este módulo usan `eliminado_en` (timestamp nulo). Toda consulta filtra por defecto los registros eliminados; internamente quedan disponibles para auditoría.
2. **Auditoría por fila:** `creado_por` / `creado_en` como mínimo en toda tabla; se añade `modificado_por` / `modificado_en` en las entidades editables (Tenant, Usuario, Rol, Sucursal).
3. **Nada se resuelve en el navegador.** Toda validación de permiso y toda escritura sensible ocurre en la capa de servidor (Server Actions / Route Handlers de Next.js), nunca confiando únicamente en la interfaz. Row Level Security de Postgres queda como segunda capa de defensa, no como el único control.

---

## 3. Flujo de alta de un Tenant (modelo sales-led, sin pasarela de pago todavía)

1. El negocio contacta al equipo de ventas de CEOM desde la landing page.
2. El equipo de ventas evalúa la necesidad y acuerda el pago (fuera del sistema, por ahora).
3. Un miembro del equipo CEOM, desde el **Panel Administrativo CEOM** (rol `ceom_admin`), crea el Tenant manualmente:
   - Define `plan_id`, `estado_suscripcion = activa`, `fecha_inicio_suscripcion`.
   - El sistema crea automáticamente: la Sucursal principal, el rol Owner (rol de sistema, no editable), y el primer Usuario con `es_owner = true`.
   - El sistema envía al Owner una invitación (email) para fijar su contraseña y acceder por primera vez. **La invitación vence** después de `duracion_invitacion_dias` (default confirmado: 7 días); pasado ese plazo, hay que reenviarla. La misma regla de vencimiento aplica a las invitaciones que un Owner envía a sus propios colaboradores (sección 8.1).
4. A partir de aquí, el flujo pasa a manos del negocio: Onboarding (sección 4).

Este flujo dejará de ser 100% manual cuando se conecte una pasarela de pago (fuera de alcance del MVP), pero el modelo de datos no cambia — solo cambia quién/qué actualiza `estado_suscripcion`.

---

## 4. Onboarding del negocio (una vez que el Owner ingresa por primera vez)

Flujo confirmado con las imágenes ya diseñadas:

1. **Configurar negocio:** nombre del negocio, ciudad base, moneda principal, logo (formato PNG/JPG, cuadrado, mínimo 512×512px, máximo 2MB — regla a validar en la interfaz y en el servidor), canales de venta principales (multi-selección de etiquetas).
2. **Elegir rubro/nicho:** ver reglas de la sección 5.
3. **Pantalla de bienvenida con checklist progresivo:** cargar primer producto, registrar un proveedor (opcional), configurar activos. Cada tarjeta lleva a su módulo correspondiente; ninguna es bloqueante para seguir usando el sistema.

### 4.1 Reglas del onboarding

- El progreso del checklist se guarda por tenant (`onboarding_completado_en` por tarea, o un registro de tareas pendientes) — el Owner puede cerrar sesión y retomar donde quedó.
- Ninguna tarjeta del checklist es obligatoria para operar; es una guía, no un bloqueo.

---

## 5. Selección de rubro / Nicho

- Un tenant tiene **como máximo un nicho activo** en el MVP. Multi-nicho por tenant queda explícitamente fuera de alcance por ahora.
- **La migración es de un solo sentido:** Modo Básico → Nicho específico. No existe camino de vuelta de Nicho → Modo Básico ni de un Nicho a otro Nicho en el MVP.
- Si el negocio elige un nicho directamente en el onboarding (no pasa por Modo Básico), el nicho queda fijado desde el inicio.
- **Vinculación explícita, no automática:** si el negocio venía en Modo Básico con productos ya cargados manualmente y luego migra a un Nicho, el sistema **no infiere** automáticamente qué receta u operación le corresponde a cada producto existente. La vinculación producto-por-producto (o en lote, pero siempre como acción deliberada del Owner) ocurre dentro del Módulo de Productos/Operativo, no en este módulo — aquí solo se registra `nicho_id` y `nicho_asignado_en` en el Tenant.

---

## 6. Roles y permisos

### 6.1 Modelo elegido: RBAC con matriz de permisos por módulo y acción

Se descarta un modelo de permisos dinámico (ABAC) por ser sobreingeniería para esta etapa. Se adopta el estándar usado por la mayoría de plataformas B2B de esta escala (Odoo, QuickBooks, Slack): **roles como conjuntos de permisos (módulo × acción)**, asignables y personalizables por cada tenant.

### 6.2 Rol Owner (rol de sistema)

- Se crea automáticamente al dar de alta el tenant.
- Tiene todos los permisos en todos los módulos, de forma permanente y no editable.
- **Default: un solo Owner por tenant.** Es el comportamiento estándar y el que trae cualquier plan que no habilite explícitamente lo contrario.
- **Cofundadores (múltiples Owners simultáneos):** se permite como función de plan, no como regla general. Un plan con `permite_multiples_owners = true` habilita que el Owner actual designe a otro usuario como Owner adicional, sin perder su propia condición. Es una decisión de negocio correcta técnicamente: no genera ambigüedad de datos porque `es_owner` ya es un booleano por usuario, no una relación exclusiva 1 a 1 con el tenant.
- **Regla de protección (ajustada):** el tenant **siempre debe conservar al menos un Owner activo**. Si el plan no permite múltiples Owners, esto se reduce al caso ya descrito (no se puede eliminar/degradar al único Owner sin transferir primero). Si el plan sí permite cofundadores, se puede eliminar o degradar a un Owner mientras quede al menos otro activo — no hace falta transferencia explícita en ese caso, pero sigue quedando auditado (`modificado_por`, `modificado_en`).
- Si un tenant con cofundadores hace *downgrade* a un plan que no admite múltiples Owners, el sistema debe forzar quedarse con un solo Owner antes de completar el downgrade (el Owner que ejecuta el cambio elige cuál se mantiene).

### 6.3 Roles personalizados

- El Owner puede crear roles nuevos dentro de su tenant (ej. "Vendedor", "Encargado de Inventario", "Contador") y definir, para cada uno, qué puede hacer por módulo: ver / crear / editar / anular-ajustar.
- Un rol personalizado puede combinar varios módulos (ej. un colaborador con acceso a Ventas e Inventario, pero no a Financiero) — esto es exactamente el caso que se pidió resolver.
- Eliminar un rol (soft delete) no elimina a los usuarios que lo tenían asignado; el sistema debe forzar reasignar esos usuarios a otro rol antes de permitir la eliminación (regla de integridad, no de borrado).

### 6.4 Un rol por usuario (para el MVP)

- Cada usuario tiene un único rol activo a la vez. Si una persona necesita permisos de dos "perfiles" distintos, la solución es crear un rol combinado (ej. "Ventas + Inventario"), no asignar múltiples roles a un mismo usuario.
- Roles múltiples simultáneos por usuario quedan fuera de alcance del MVP; se deja como posible extensión si el caso de uso real lo exige.

### 6.5 Rol CEOM Admin (rol de sistema, transversal a todos los tenants)

- Es el rol que opera el Panel Administrativo de CEOM.
- Alcance cross-tenant: gestión de tenants, planes, precios por nicho, alianzas institucionales, y el panel de instituciones que consultan datos con consentimiento.
- Usa el mismo motor de Autorización que el resto del sistema — no es una aplicación aparte, es el mismo backend con un rol de alcance más amplio.

---

## 7. Motor de Autorización

### 7.1 Diseño: in-process, sin gateway de red, sin microservicios

El patrón "Gateway de Consentimiento" mencionado en versiones anteriores de la arquitectura **no implica infraestructura de red separada**. Se implementa como una función de dominio, invocada dentro de la misma capa de servidor (Server Actions / Route Handlers):

```
tiene_permiso(solicitante, tenant_objetivo, modulo, accion) → boolean
```

Donde `solicitante` puede ser:
- Un **usuario interno** del mismo tenant (caso más común — se valida contra su rol y la matriz de permisos).
- El **rol CEOM Admin** (acceso administrativo cross-tenant).
- Una **institución externa** con consentimiento otorgado (ver 7.2).

Cada Server Action o Route Handler que lea o escriba datos de negocio llama a esta función antes de ejecutar la operación. No existe camino de acceso a datos que la eluda.

**Orden de evaluación:** antes de consultar la matriz de permisos por rol, `tiene_permiso()` siempre revisa primero `estado_acceso` del tenant:
- `activo` → continúa evaluando normalmente contra rol y matriz de permisos.
- `solo_lectura` → solo se permiten acciones `ver` y exportación, sin importar el rol; `crear`, `editar` y `anular_ajustar` se deniegan globalmente en todos los módulos.
- `bloqueado` → se deniega todo, incluso `ver`, salvo la pantalla de estado de la suscripción y el aviso de pago (que no pasa por este motor, es una vista fija del sistema).

Esto evita tener que replicar la lógica de "¿está vencida la suscripción?" en cada módulo — se resuelve una sola vez, en este punto de entrada común.

### 7.2 Consentimiento externo (instituciones)

- Una institución (ej. una incubadora) solicita ver datos de un tenant específico.
- El Owner del tenant aprueba el consentimiento **por módulo** (ej. Financiero sí, Operativo no) — el nivel de granularidad confirmado para el MVP es por módulo completo, no campo por campo.
- Esa aprobación se guarda como una fila más en el mismo esquema de permisos (rol "institución X", tenant "Y", módulo, acción `ver` únicamente — las instituciones nunca tienen permisos de escritura).
- El Owner puede revocar el consentimiento en cualquier momento; la revocación es un cambio de estado (`permitido = false` o fila con `eliminado_en`), nunca se borra el registro de que alguna vez existió ese consentimiento (trazabilidad para auditoría).

---

## 8. Casos de uso comunes

1. **Alta de un colaborador:** el Owner (o cualquier usuario con permiso `crear` en este módulo) invita a un nuevo usuario, le asigna un rol existente o crea uno nuevo. El usuario recibe invitación por email para fijar su contraseña.
2. **Cambio de rol de un colaborador:** el Owner reasigna el `rol_id` del usuario. Se audita `modificado_por`/`modificado_en`.
3. **Suspensión temporal de acceso:** se marca `activo = false` en Usuario, sin eliminarlo — reversible.
4. **Consulta de "quién hizo qué":** cualquier reporte de auditoría cruza `creado_por` / `modificado_por` contra la tabla Usuario, dentro del mismo tenant.
5. **Un negocio compra el plan con sucursales:** se habilita la creación de nuevas Sucursales; no hay migración de datos, solo se libera la función en la interfaz.

---

## 9. Casos especiales / bordes

1. **Intento de eliminar al único Owner:** bloqueado por regla de negocio explícita — el sistema exige transferir la condición de Owner antes de permitir baja o degradación.
2. **Intento de que un usuario se quite permisos a sí mismo dejando el tenant sin nadie con acceso a un módulo crítico:** no se bloquea automáticamente (el Owner sigue teniendo acceso total por diseño), pero se registra igual que cualquier cambio de permisos.
3. **Eliminación de un rol con usuarios activos asignados:** bloqueado hasta reasignar a esos usuarios a otro rol.
4. **Revocación de consentimiento institucional a mitad de una sesión de consulta activa:** la próxima llamada a `tiene_permiso()` ya devuelve `false` — no hay "sesiones" de consentimiento persistentes fuera de la validación en cada solicitud.
5. **Tenant con `estado_suscripcion = vencida`:** el acceso pasa por etapas configurables desde el Panel CEOM (parametrización completa en el Módulo 11; aquí solo se define el efecto sobre `estado_acceso`):
   - **Etapa de gracia — `solo_lectura`:** dura `duracion_etapa_solo_lectura_dias`. El tenant puede ver y exportar sus datos, pero no crear, editar ni anular/ajustar nada en ningún módulo. La interfaz muestra un aviso de pago con cuenta regresiva hacia el bloqueo total.
   - **Bloqueo total — `bloqueado`:** al agotarse la etapa de gracia (o de inmediato, si `duracion_etapa_solo_lectura_dias = 0`, cubriendo el caso de bloqueo directo sin etapa intermedia). Ningún usuario del tenant puede operar; la única salida es regularizar el pago.
   - El paso de una etapa a otra lo dispara automáticamente el sistema al cumplirse los plazos configurados; no requiere intervención manual del equipo CEOM salvo para reactivar tras el pago.
6. **Intento de crear una segunda Sucursal en un plan sin soporte multi-sucursal:** bloqueado en la capa de servidor (no solo oculto en la interfaz), para que no sea evadible manipulando el cliente.
7. **Migración de Modo Básico a Nicho con productos ya cargados:** el sistema no autoasigna receta/operación; permanece "sin vincular" hasta que el Owner lo haga explícitamente en Productos.

---

## 10. Autenticación (aspectos técnicos)

- Autenticación delegada a **Supabase Auth (GoTrue)** — no se construye un sistema propio de manejo de contraseñas.
- El `id` de Usuario en la tabla de este módulo coincide con el `id` de Supabase Auth, para no duplicar identidad.
- Verificación por email (ya contemplada en el flujo de invitación).
- La sesión se valida en cada Server Action / Route Handler antes de invocar `tiene_permiso()` — nunca se confía en el estado de sesión del cliente para decisiones de autorización.

---

## 11. Cambios de plan (upgrade / downgrade)

Ejemplo guía: SanttiCampo está en plan Básico, abre una segunda sucursal y necesita el plan con soporte multi-sucursal.

- **Upgrade, en el MVP:** siempre manual, mismo circuito que el alta — el tenant contacta al equipo de ventas de CEOM, y un `ceom_admin` cambia el `plan_id` desde el Panel Administrativo. No existe todavía autogestión vía catálogo web con pago automático.
- **Upgrade, cuando exista pasarela de pago (fuera de alcance del MVP, pero contemplado en el diseño):** el mismo cambio de `plan_id` lo dispara el propio Owner desde un catálogo de planes en la plataforma, sin intervención de CEOM. El modelo de datos no cambia entre uno y otro caso — solo cambia quién/qué actualiza `plan_id` y `estado_suscripcion`.
- **Downgrade:** se habilitan **ambos caminos en paralelo**, gobernados por el campo `permite_downgrade_autogestionado` del plan (o de configuración global, ver Módulo 11):
  - Si está en `false` (default sugerido): el downgrade solo lo ejecuta CEOM Admin manualmente, incluso si ya existe pago automático. Esto es intencional — un downgrade suele ser una señal de salud del cliente (insatisfacción, dificultades económicas, etc.) y CEOM quiere enterarse y poder conversar con el cliente antes de que se ejecute.
  - Si está en `true`: el Owner puede bajar de plan de forma autogestionada desde la plataforma, sin pasar por CEOM.
  - El valor por defecto y la posibilidad de activar la autogestión quedan como configuración regulable desde el Panel Administrativo, no como una decisión fija de código.
- Un downgrade que reduzca funciones activas (ej. quitar soporte multi-sucursal, o quitar cofundadores) requiere que el tenant primero resuelva la inconsistencia (ej. quedarse con una sola sucursal activa, o con un solo Owner) antes de completarse — el sistema no elimina datos automáticamente para "hacer caber" al tenant en el plan nuevo.

---

## 12. Parámetros de configuración — confirmados

Quedan fijados como valores default (siempre ajustables desde el Panel Administrativo CEOM por tenant o por plan, sin requerir cambio de código):

1. `duracion_invitacion_dias` = **7 días**.
2. `duracion_etapa_solo_lectura_dias` = **3 días** de gracia en solo lectura antes del bloqueo total.
3. El plan Básico de arranque (el que usará SanttiCampo) queda con `permite_multiples_owners = false` y `permite_downgrade_autogestionado = false`; ambas se activan recién en planes superiores.

Con esto, el Módulo 1 queda cerrado.

---

## 13. Adenda (originada en el Módulo 2) — Permisos especiales fuera de la matriz genérica

Al definir Productos e Inventario surgió un caso que no encaja en las 4 acciones genéricas de la matriz de permisos (`ver`/`crear`/`editar`/`anular_ajustar`): la capacidad puntual de **vender sin stock disponible** (`vender_sin_stock`), pensada para pre-ventas o pedidos anticipados.

Se resuelve con una tabla adicional, separada de la matriz genérica de permisos:

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `rol_id` | uuid | FK |
| `capacidad` | enum | Ej. `vender_sin_stock`, `gestionar_eventos`, `importar_historico`, `producir_sin_stock_insumo` (Módulo 6). Catálogo ampliable a medida que aparezcan más casos puntuales de este tipo en otros módulos |
| `habilitado` | boolean | |

Esto evita forzar que todo módulo tenga una acción "extra" que en la práctica solo aplica a uno o dos casos concretos. El motor de Autorización (`tiene_permiso()`) consulta esta tabla además de la matriz genérica cuando la acción solicitada es una capacidad especial, no una acción CRUD estándar.

### 13.1 Override por usuario específico (no solo por rol)

Necesidad real: el Owner quiere poder activar o desactivar una capacidad especial (ej. `gestionar_eventos`) para uno o varios usuarios puntuales, sin tener que crear un rol nuevo solo para esa excepción. Esto **no contradice** el modelo de "un rol por usuario" fijado en la sección 6.4 — ese modelo aplica a la matriz genérica de permisos (ver/crear/editar/anular), que sigue intacta. Lo que se agrega es una segunda capa, solo para capacidades especiales, exactamente el mismo patrón que usan sistemas como Salesforce (*Permission Sets* sobre el Profile base) o GitHub (permisos por repositorio sobre el rol de la organización): **el rol da el default, un override puntual por usuario resuelve la excepción.**

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `usuario_id` | uuid | FK |
| `capacidad` | enum | Mismo catálogo que `permisos_especiales_por_rol` (`vender_sin_stock`, `gestionar_eventos`, `importar_historico`, `producir_sin_stock_insumo`, ampliable) |
| `habilitado` | boolean | |
| `creado_por` / `creado_en` | uuid / timestamp | Quién otorgó o quitó la excepción |
| `eliminado_en` | timestamp, nullable | |

**Orden de resolución en `tiene_permiso()` para una capacidad especial:**
1. ¿Existe un override en `permisos_especiales_por_usuario` para este usuario y esta capacidad? → se usa ese valor, sin importar el rol.
2. Si no existe override → se usa el valor definido en `permisos_especiales_por_rol` para el rol del usuario.
3. Si tampoco existe ahí → `false` por defecto.

Esto le da al Owner exactamente la flexibilidad pedida (activar/desactivar por rol, por un usuario puntual, o por varios usuarios uno por uno) sin reabrir la complejidad de un modelo de permisos dinámico (ABAC) que ya se descartó deliberadamente por sobreingeniería — la excepción queda acotada a estas capacidades puntuales, no se extiende a la matriz general de módulo × acción.

---

*Fin del Módulo 1 — cerrado y confirmado. Continúa el Módulo 2 (Productos e Inventario).*