# CEOM-ERP — Inventario y seguimiento de pantallas

> **Qué es este documento:** el inventario completo de qué pantallas hacen falta para exponer el
> backend ya construido en la Fase 1 (14/14 módulos cerrados, ver auditoría 2026-07-15), **y el
> seguimiento vivo de cuáles ya están construidas**. Cada pantalla lleva una marca de estado justo
> después de su nombre en negrita, mismo criterio que `docs/roadmap/roadmap.md`:
>
> - `[x]` — construida y verificada (typecheck/lint/test + recorrido en navegador).
> - `[~]` — parcialmente construida (ver la nota junto a la marca — normalmente significa "existe
>   como alta rápida embebida en otra pantalla, no como CRUD propio").
> - `[ ]` — todavía no construida. **Es el default: cualquier pantalla sin marca explícita se
>   considera `[ ]`.**
>
> Todos los campos listados salen literalmente de lo que cada `actions.ts` ya devuelve — donde
> falta algo en el backend para poblar una pantalla con datos reales, está marcado explícitamente
> como **⚠️ gap de backend**, no se inventó ningún campo nuevo.
>
> Nota de nomenclatura: el título original de este documento lo asociaba a una "Fase 2" de
> planificación de UI — eso predata el roadmap actual, donde la Fase 2 (`docs/roadmap/roadmap.md`)
> es integración end-to-end, no UI. La construcción de pantallas vive dentro/después de la Fase 1
> (ver el ítem #1 de Identidad ahí), no es una fase numerada aparte.

---

## Progreso (actualizado 2026-07-20)

**117 construidas · 0 parciales · 0 pendientes, de 117 pantallas/modales trackeados — inventario
100% completo.** (El conteo original de "~85" era más grueso — agrupaba varios modales bajo una
sola pantalla; este número es más fino y es el que se mantiene de acá en adelante. Sumó 1 al total
con "Transferir Owner", que no estaba en el inventario original.)

**Cierre final 2026-07-20** — los últimos 2 pendientes reales y 1 caveat se cerraron en la misma
tanda, sin mockup, todos verificados end-to-end en navegador:
1. **Banner de estado del tenant** (`/app`, en `AppShell`) — ámbar/rojo según `estadoAcceso`. Señal
   visual únicamente; confirmado explícitamente que `tienePermiso()` ya bloqueaba crear/editar del
   lado del servidor desde antes (probado: intento de creación rechazado en `solo_lectura`).
2. **Vincular a proceso operativo** (modal en Ficha de Producto) — vincula/desvincula un Producto a
   una Receta de Nicho 1, sin gap de backend.
3. **Selector de Evento en Registrar Venta** — campo opcional en el carrito, filtrado a eventos
   abiertos; cerró además un gap chico de validación (`eventoId` faltaba en `registrarVentaSchema`).

| Módulo | Construidas | Parciales | Pendientes | Total |
|---|---|---|---|---|
| 1. Identidad | 20 | 0 | 0 | 20 |
| 2. Suscripción | 5 | 0 | 0 | 5 |
| **3. Patrimonio** | **12** | 0 | 0 | 12 |
| **4. Proveedores/Compras** | **9** | 0 | 0 | 9 |
| **5. Productos e Inventario** | **8** | 0 | 0 | 8 |
| **6. Nicho 1 (Insumos/Recetas/Producción)** | **10** | 0 | 0 | 10 |
| **7. Ventas + Clientes** | **10** | **0** | 0 | 10 |
| **8. Egresos y Gastos** | **6** | 0 | 0 | 6 |
| **9. Financiero** | **3** | 0 | 0 | 3 |
| **10. Gateway de Consentimiento** | **9** | 0 | 0 | 9 |
| **11. Monitoreo Institucional + Panel Admin** | **10** | 0 | 0 | 10 |
| 12. Nicho 4 | 1 | 0 | 0 | 1 |
| **13. Simulaciones** | **5** | 0 | 0 | 5 |
| **14. Reportes y Dashboard** | **9** | 0 | 0 | 9 |

**Camino dorado (sección "Resumen" al final de este doc): 5 de 5 completo.** Login, Onboarding,
Catálogo, Punto de Venta y ahora Dashboard/Resumen Ejecutivo ya están construidos y verificados
end-to-end con datos reales (`owner@ceom.local`, ver `pnpm seed:demo`). **El MVP navegable de
punta a punta está cerrado.**

**Tanda cerrada el 2026-07-16: Ventas + Clientes, 5/5.** Gestión de Clientes, Canales de Venta,
Métodos de Pago, Gestión de Eventos e Importación de Venta Histórica — las 5 pantallas que
quedaban pendientes del módulo quedan `[x]`, verificadas end-to-end contra el tenant de prueba.
Detalle de decisiones y del bug de timezone encontrado y corregido: `src/modules/ventas/ANCLA.md`.

**Tanda cerrada el 2026-07-17: Patrimonio, 11/11 pantallas de negocio.** Tanda A (Activos, 6) +
Tanda B (Pasivos, 5) — Listado/Ficha/Alta/Editar/Dar de baja/Transferir de Activos, y
Listado/Ficha/Alta/Refinanciar/Registrar pago de Pasivos. Queda pendiente únicamente el widget
"Valor patrimonial total" — se construye junto con el Dashboard de Reportes (Módulo 14 Sección B),
no como pantalla propia de Patrimonio. Detalle completo: `src/modules/patrimonio/ANCLA.md`.

**Tanda cerrada el 2026-07-17: Proveedores/Compras, 9/9 pantallas — módulo completo.** Gap de
backend (`listarCompras` con filtros) cerrado primero, en un cambio separado, antes de construir
UI. Maestro-detalle de Proveedores (Listado + Ficha con tabs Historial de Compras/Historial de
Precios + Alta/Editar, route group `(directorio)` para no filtrar a `compras/*`), Listado de
Compras con pills de filtro (Estado/Pago) y 3 modales acoplados a la fila (Recibir, Registrar
pago — mismo patrón que Pasivos con saldo antes/después en vivo, Ajustar — mismo patrón que
Ajuste de Venta), y Alta de Compra. "Historial de precios de un ítem" del contrato original se
resolvió como una sección nueva en la Ficha de Producto existente (`historialPrecio()`), no como
ruta propia — ya cubierto también, con los mismos datos, en el tab de la Ficha de Proveedor.
Verificado end-to-end contra el tenant de prueba (alta/edición/baja de proveedor, alta de compra
en ambos estados, recepción, pago parcial con saldo en vivo, ajuste de anulación total). Detalle
completo: `src/modules/proveedores/ANCLA.md`.

**Tanda cerrada el 2026-07-17: Egresos y Gastos, 6/6 pantallas — módulo completo.** Sin gaps de
backend (se confirmó antes de construir: `listarGastos`, `fichaGasto`, CRUD de Gasto/Categoría/
Recurrente y `registrarPagoGasto` ya existían). Listado con 3 filtros por `Select` (Categoría/Tipo/
Estado de pago) + paginación "Cargar más", Ficha con banner de bloqueo real para gastos de origen
automático (regla 3.2 del módulo — nunca editables/eliminables, ni con pago manual, desde acá),
Alta/Editar de Gasto Manual (tipo bloqueado al editar, el backend no lo acepta), Registrar Pago de
Gasto (mismo patrón que Pasivo/Compra, saldo en vivo ya resuelto por `fichaGasto()` sin llamada
extra), Gestión de Categorías (mismo patrón Dialog que Productos + selector opcional de categoría
sugerida), y Gestión de Gastos Recurrentes (stat strip + grid de plantillas, "Próx. fecha"/
"Proyección mensual" calculados en cliente por simple aritmética de calendario — el módulo no
tiene scheduler ni esas funciones, es solo previsualización; cada gasto se sigue generando a mano
con el botón "Generar gasto de este período"). El toggle de una plantilla es de una sola dirección
(`desactivarGastoRecurrente` existe, no hay "reactivar" en el contrato) — la UI lo refleja
bloqueando el Switch una vez pausada, no se inventó una acción nueva. **Bug real encontrado y
corregido en esta tanda:** el formulario enviaba `sucursalId`/`proveedorId`/`fechaFin` como string
vacío en vez de `undefined` cuando no se completaban, y esas columnas son `uuid`/`date` — Postgres
rechazaba el insert (`invalid input syntax for type uuid: ""`). Corregido convirtiendo `"" →
undefined` en la capa de Server Actions de ruta, mismo criterio que ya usa Proveedores para
`proveedorId` opcional. Verificado end-to-end (alta/pago/eliminación de gasto, categoría nueva,
plantilla recurrente con generación manual y desactivación). Detalle completo:
`src/modules/gastos/ANCLA.md`.

**Tanda cerrada el 2026-07-17: Nicho 1 (Insumos/Recetas/Producción), 10/10 pantallas — módulo
completo.** Antes de tocar UI se cerraron los 3 gaps de backend anotados (`fichaInsumo`,
`listarMovimientosInsumo`, y un tercero encontrado en la revisión — `fichaReceta`, para ver/editar
la composición de una Receta por `recetaId` directo sin pasar por un producto vinculado — ver
`src/modules/operativo/nichos/nicho-1/ANCLA.md`). Catálogo de Insumos y Ficha de Insumo (con
historial de movimientos) reutilizan literalmente el patrón de Productos; Alta/Edición de Insumo,
Entrada de compra y Ajuste manual/Merma también. Gestión de Recetas es un maestro-detalle con
composición editable inline (según mockup). Registrar Producción de un lote es un formulario de una
sola pantalla (no un wizard real de varios pasos — el mockup muestra los 3 "pasos" como secciones
todas visibles a la vez, con un panel "Resumen" que recalcula Rendimiento Teórico/Merma/Costo
Operativo en vivo); esas 3 fórmulas puras están duplicadas a propósito en el cliente (no se puede
importar `nicho-1/actions.ts` desde un Client Component — ese archivo importa `db` y no es
`"use server"`). Producción de Ajuste, Listado de Producciones y Capacidad Operativa (barra de
progreso reutilizada del Dashboard) cierran el módulo. Verificado end-to-end de punta a punta,
incluyendo la cadena cross-módulo real (Insumo → Receta → Producción → acreditación de stock en
Productos e Inventario). Ninguna pantalla nueva importa `productos/schema.ts` ni su repository
directo — todo pasa por la capa pública ya expuesta, respetando el límite de caja negra del
Strategy Pattern (`CEOM_Arquitectura.md` §5.1). Detalle completo:
`src/modules/operativo/nichos/nicho-1/ANCLA.md`.

**Tanda cerrada el 2026-07-17: Reportes Detallados, Módulo 14 completo (9/9).** Antes de tocar UI
se verificaron las 4 adendas de agregación anotadas en `Modulo_10_reportes.md` (`rankingProductos`,
`historicoVentas`, `margenPorCanalYProducto`, `consultarMermaPeriodo`) — las 4 ya estaban
implementadas de una sesión anterior, solo se corrigió la doc del módulo que las seguía marcando
como pendientes (ningún código nuevo hizo falta ahí). Construidas las 4 pantallas de Sección B:
**Resumen Financiero** (`/app/reportes`, con mockup) — reusa el widget de Flujo de Caja del
Dashboard, agrega el Estado de Resultados formal (`FilaResultado` por línea + total "Utilidad
real") y embebe el widget **Valor Patrimonial Total** pendiente de Patrimonio (cierra ese gap
también); se omitió a propósito el botón de Export (fuera de alcance documentado) y el desglose
transaccional ítem por ítem del mockup (sin soporte de backend — se usó el shape agregado real de
4 campos). **Margen por Canal y Producto** (`/app/reportes/margen-canal-producto`, con mockup) —
tabla cruzada producto × canal, Total Ponderado/Promedio por Canal recalculados desde
`ingresos`/`costos` crudos (nunca promediando `margenPct` ya calculados). **Histórico de Ventas**
y **Ranking de Productos — vista completa** (sin mockup, por instrucción explícita: reusar
literalmente los patrones ya construidos en el Dashboard) — mismo gráfico de barras y misma
paleta categórica validada para daltonismo (`COLOR_REGULAR`/`COLOR_EVENTO` = mismo par usado en el
Dashboard), y el mismo widget de ranking horizontal extendido a lista completa con filtro de canal
agregado. Conectado el botón "Ver reportes detallados" del Dashboard (quedaba deshabilitado a
propósito desde la tanda anterior). Verificado end-to-end en navegador contra el tenant de prueba,
incluyendo interactividad de Selects/checkbox (toggle de eventos, cambio de período con
re-bucketing día↔mes, filtro de canal, toggle rotación/margen con re-ordenamiento confirmado
contra la respuesta real del servidor). Detalle completo: `src/modules/reportes/ANCLA.md`.

**Tanda cerrada el 2026-07-17: Simulaciones, Módulo 13 completo (5/5) + Financiero completo (3/3).**
Simular Precio y Punto de Equilibrio (`/app/simulaciones`, con mockup) — tabs dentro de una misma
pantalla, selector de producto por grid de cards (sin "código" en la card — ese campo no existe en
Productos), 3 KPI auto al elegir producto (rotación/margen actual/costo real) que se recalculan con
una Server Action de **solo lectura** (`obtenerDatosPreviaAction`) a propósito distinta de
`simularPrecio`/`calcularPuntoEquilibrio` (que sí persisten un registro en el historial cada vez que
se invocan) — así el usuario puede tantear producto/margen libremente sin ensuciar el Historial;
recién "Guardar simulación" persiste. Costo automático con toggle "Ajustar manualmente" ↔ "Usar
automático" (nunca cambia el costo real del producto, regla 3.3 del módulo verificada en
navegador). Comparativo Multi-SKU (`/app/simulaciones/comparativo`, con mockup) — tabla con fila
resaltada en ámbar cuando el margen se aleja del umbral configurado; sin el botón "Exportar Reporte"
del mockup (sin backend). Configuración de umbral resuelta como Dialog lanzado desde el propio
Comparativo (tal como estaba anotado, no ruta propia) — edición verificada end-to-end. Historial de
Simulaciones (`/app/simulaciones/historial`, sin mockup) reusa el patrón de lista de Ventas/Pasivos;
sin acción de borrado por diseño del módulo (`simulaciones` no tiene `eliminado_en`), mismo criterio
que Producción/GastoRecurrente. **Margen por Producto** (pendiente de Financiero, sumado a esta
tanda) construido en `/app/simulaciones/margen-producto` — mismo criterio que Flujo de
Caja/Estado de Resultados: sin ruta propia de Financiero, para no duplicar UI en dos módulos; cierra
Financiero 3/3. Nav item "Simulaciones" agregado al sidebar. Verificado end-to-end en navegador
contra el tenant de prueba (2 simulaciones guardadas y confirmadas en el Historial, override manual
de costo, ambos casos borde de Punto de Equilibrio, edición de umbral). Detalle completo:
`src/modules/simulaciones/ANCLA.md`.

**Tanda cerrada el 2026-07-17: Gateway de Consentimiento, Módulo 10 completo (9/9) — 3 superficies.**
Antes de construir se cerró un gap de seguridad real: `listarInstituciones()` no tenía gate de rol
(señalado en el análisis previo para "revisar en Fase 3") — se cerró de entrada, exige
`SolicitanteCeomAdmin` igual que el resto de las acciones de `/admin` del módulo. `/app`: Generar
Código de Acceso (con mockup, checklist de módulos con badges Disponible/Deshabilitado según el
plan del tenant), Códigos de Acceso generados y Aprobaciones/Consentimientos vigentes (sin mockup,
listado + revocar), Solicitudes de Seguimiento entrantes (sin mockup, Aprobar abre un Dialog con
checklist precargado que solo permite reducir, nunca ampliar, lo solicitado). `/portal`: Canjear
Código de Acceso (con mockup) — **primera pantalla de esta superficie, pública de verdad, sin
sesión** — reutiliza el layout split-screen del login; wizard de 2 pasos (código → alta mínima de
institución solo si hace falta). `/admin`: CRUD de Instituciones (con mockup, maestro-detalle) —
**primer shell real de `/admin`** (`admin-shell.tsx`, hasta ahora era una landing provisoria sin
sidebar) — con Cartera Institucional y Crear Solicitud de Seguimiento como tab/Dialog dentro de la
Ficha (no rutas propias, tal como mostraba el mockup), y Logs de Acceso (sin mockup, filtro de
tenant + rango de fechas). Adenda de backend agregada: `obtenerInstitucionPorId()` (lectura pública
de 1 institución, sin gate — necesaria para que el Owner resuelva nombres en sus propias
Aprobaciones/Solicitudes sin acceso al listado completo, que sigue gateado a `ceom_admin`).
**Verificación explícita de la propiedad de seguridad central del módulo** (pedida directamente):
se confirmó con `tieneConsentimiento()` llamado directo (no vía UI) que revocar un código o una
aprobación corta el acceso *en la base de datos* de inmediato, no solo actualiza la pantalla — dos
veces, por los dos caminos de revocación (código y aprobación directa). Verificado también el ciclo
completo Generar código → Canjear en `/portal` → ver en Aprobaciones → Solicitud desde `/admin` →
Aprobar con subconjunto → eliminar Institución (soft delete). Detalle completo:
`src/modules/consentimiento/ANCLA.md`.

### Próxima tanda sugerida

**Módulo 1 (Identidad) cerrado del todo 2026-07-18** — Colaboradores/Roles/Capacidades Especiales
(`/app/mi-negocio/`) era el último bloque pendiente, ver sección 1 más arriba para el detalle
completo. Con esto, el roadmap ítem #1 queda `[x]` sin caveats (antes tenía la nota "queda para
más adelante"). También cerró un bug real (`tieneCapacidadEspecial()` sin bypass de Owner) y un
gap de seguridad real (`invitarUsuario`/`cambiarRolUsuario` sin validar contra roles de sistema).

**Módulo 11 (Monitoreo Institucional + Panel Admin CEOM) cerrado 2026-07-18** — ver sección 11 más
abajo para el detalle completo. De paso se cerró también el Catálogo de Planes de Suscripción
(Módulo 2, item de roadmap #2) ya que su backend estaba 100% listo y el shell de `/admin` recién
creado lo necesitaba de todas formas.

**Gestión de Tenants (`/admin`, Módulo 1) cerrada 2026-07-18** — Alta de Tenant (con mockup),
botón "+ Nuevo Tenant" en el listado, y panel de acciones (Cambiar Plan / Cambiar Estado de
Suscripción) en la Ficha de Tenant. Detalle completo en la sección 1 más abajo.

**"Mi Plan" (Módulo 2, `/app`) cerrada 2026-07-18** — sin gap de backend (reusa
`obtenerTenantPorId`/`calcularEstadoAcceso` de Identidad y `obtenerPlanPorId` de Suscripción, ya
usados por el shell de `/app` y por `crearTenant`). Detalle completo en la sección 2 más abajo.

**Nicho 4 (widget de Capacidad de Almacenamiento Usada) cerrado 2026-07-20** — sin gap de backend
(`consultarCapacidadAlmacenamientoUsada` ya existía y ya estaba probada). Embebido en el Dashboard,
sin nav propia. Detalle completo en la sección 12 más abajo.

**Banner de estado del tenant, Vincular a proceso operativo y Selector de Evento cerrados
2026-07-20** — los 2 últimos pendientes reales del inventario más 1 caveat chico. **Con esto el
inventario completo de `docs/ui/pantallas.md` queda en `[x]` — 117/117, sin ningún ítem pendiente.**
Ver el detalle en "Progreso" más arriba y "Conteo total" más abajo.

---

## 0. Arquitectura de superficies (decidida en esta sesión)

CEOM-ERP tiene **2 superficies de acceso**, como route groups dentro de la misma app Next.js (sin
subdominios separados por ahora — se evalúa recién en Fase 3 si hace falta):

| Superficie | Quién entra | Autenticación |
|---|---|---|
| **`/app`** | Owner y Colaborador de un tenant | Supabase Auth (email/contraseña) — comparte login con `/admin` |
| **`/admin`** | Equipo interno CEOM (`ceom_admin`) | Mismo Supabase Auth que `/app` — es el mismo motor de autorización (Módulo 1), no una app aparte. La diferencia es el **redirect post-login según rol**, no el mecanismo de entrada |
| **`/portal`** | Institución / entidad veedora (sin cuenta CEOM) | Auth completamente separada: primera vez vía **Código de Acceso** de un solo uso; visitas siguientes vía **magic link** a un email (`instituciones.email`/`auth_user_id`, decisión completa en `CEOM_Arquitectura.md` §8.3) — **construido y verificado con un click real de email el 2026-07-18** |

**Regla de seguridad no negociable para cuando se construya esto:** el gate de cada superficie se
verifica **server-side a nivel de layout/middleware**, nunca solo ocultando componentes en el
cliente — mismo principio que ya sigue el backend (`Resultado<T>` tipado, nunca solo un
`try/catch` genérico).

Login único (`/app`+`/admin`): [`src/app/(auth)/login`](../../src/app/(auth)/login/page.tsx) ya
existe. **Resuelto (Etapa B, primer paso):** el redirect por rol ya está implementado en
[`login/actions.ts`](../../src/app/(auth)/login/actions.ts) — `rolId === ROL_CEOM_ADMIN_ID` va a
`/admin`, el resto a `/app`. Ambas superficies tienen gate server-side real en su propio
`layout.tsx` (`src/app/app/layout.tsx`, `src/app/admin/layout.tsx`): sin sesión redirige a
`/login`; en `/admin`, con sesión pero sin rol `ceom_admin` redirige a `/app`. Se agregó también
`src/proxy.ts` (convención Next.js 16, reemplaza `middleware.ts`) para refrescar la cookie de
sesión de Supabase en cada request. Verificado end-to-end en navegador con usuarios reales
temporales (login Owner → `/app`, login CEOM Admin → `/admin`, logout, gates sin sesión, gate de
rol cruzado, credenciales inválidas). **Actualización:** la landing de `/app` ya no es
provisoria — hoy es Inicio (checklist de sub-onboarding + placeholder de dashboard, ver Módulo 1 y
Módulo 14 abajo). **Actualización 2026-07-17:** `/admin` tiene su primer shell real
(`admin-shell.tsx`, route group `src/app/admin/(shell)/`) con Instituciones y Logs de Acceso — la
landing en `src/app/admin/page.tsx` sigue siendo provisoria (fuera de ese route group a propósito).
**Actualización 2026-07-18:** `admin-shell.tsx` ganó 2 nav items más — Tenants (salud agregada +
Ficha de Tenant con 3 tabs auditados, Módulo 11) y Planes (catálogo completo, Módulo 2) — quedan 4
nav items: Tenants, Planes, Instituciones, Logs de Acceso. `/portal` tiene su primera pantalla real
(`src/app/portal/`, Canjear Código de Acceso) — pública, sin `layout.tsx` de auth porque no hace
falta sesión para esta pantalla puntual (`canjearCodigoAcceso()` no recibe `solicitante`, a
propósito). El mecanismo de reingreso por magic link (`instituciones.email`/`auth_user_id`,
`obtenerInstitucionActual()`, `src/app/portal/auth/callback/route.ts`, decisión completa en
`CEOM_Arquitectura.md` §8.3) está verificado con un click real de email, y **Mi Cartera + Ficha de
Tenant (4 tabs) ya están construidos sobre él** (Módulo 11, 2026-07-18).

---

## 1. Identidad, Tenants, Roles, Autorización

### `/app` — Login
**Login** `[x]` — autenticación compartida `/app`/`/admin`.
- Campos: `email`, `password` (inputs del form).
- Rol: público (no autenticado).
- Acción: `iniciarSesion()` → `supabase.auth.signInWithPassword`, con redirect por rol ya
  resuelto (ver sección 0).
- Nota: "Crear cuenta gratis" sigue siendo un placeholder sin flujo detrás — no hay alta de cuenta
  autoservicio (`crearTenant` está gateado a `ceom_admin` únicamente, ver pantalla 16).
  **"¿Olvidaste tu contraseña?" ya no lo es** (2026-07-23): lleva a `/recuperar-contrasena`.
- El login además muestra el motivo cuando un enlace de correo no pudo canjearse
  (`?error=enlace_vencido|enlace_invalido|cuenta_incompleta`), que es a donde redirige el callback
  de Auth.

### `/app` — Recuperar contraseña (H-05)
**Pedir el enlace** `[x]` — `/recuperar-contrasena`, pública. Un solo campo (correo).
- Rol: público (no autenticado).
- Acción: `solicitarRecuperacion()` → `resetPasswordForEmail` con `redirectTo` al callback.
- Responde lo mismo exista o no el correo (anti-enumeración); el acuse reemplaza al formulario para
  no invitar a reintentar contra el cupo de envíos.

**Fijar contraseña** `[x]` — `/app/definir-contrasena?motivo=invitacion|recuperacion`.
- **Una sola pantalla para los tres casos** del alcance: dueño recién invitado, quien recupera, y
  quien la cambia desde adentro. Cambia el copy, no el formulario. Justificación completa en
  `docs/decisiones/recuperacion-de-acceso.md` §11.2/§11.3.
- Vive **fuera** del route group `(shell)`, al lado de `onboarding/`: adentro, el layout rebotaría al
  Owner con onboarding pendiente antes de que pueda tener contraseña.
- Acción: `definirContrasena()` → `updateUser({password})`, redirect por rol.

**Callback de Auth** — `/app/auth/callback` (route handler, no pantalla).
- Canjea con `verifyOtp({token_hash, type})`, **no** con `exchangeCodeForSession` como
  `/portal/auth/callback`: los correos de `/app` no son PKCE. Ver §11.1 del documento de decisiones.
- Requiere que las plantillas de correo de Supabase apunten acá con `{{ .TokenHash }}`.

### `/app` — Mi Cuenta
**Mi cuenta** `[x]` — `/app/mi-cuenta`. Nombre, correo y rol del usuario logueado + cambio de
contraseña.
- Rol: cualquier usuario del tenant (no sólo Owner — por eso no vive dentro de `/app/mi-negocio`).
- Se entra desde el bloque de usuario del sidebar.
- Acción: `solicitarCambioDeContrasena()` → manda el enlace al propio correo. **No** es un formulario
  de "contraseña actual + nueva": esa versión se construyó y se cayó en la verificación — cambiar la
  contraseña revoca todas las sesiones menos la que hace el cambio, y re-autenticar abre una sesión
  nueva. Ver §11.3 del documento de decisiones.

### `/app` — Onboarding del Owner (primer ingreso)
**Configurar negocio** `[x]` — nombre, ciudad, moneda, logo (dropzone, preview local sin conectar a Storage todavía), canales de venta.
- Campos: `tenants.nombreNegocio`, `ciudadBase`, `monedaPrincipal`, `logoUrl` (no persiste), `canalesVenta`.
- Rol: Owner.
- Acción: `actualizarTenant()` (gap de backend original ya cerrado).

**Elegir rubro/nicho** `[x]` — Modo Básico vs. Nicho específico, cards seleccionables + banner de advertencia inline + confirmación (sin modal).
- Subpantalla: confirmación de "esta elección no tiene vuelta atrás" (Módulo 1 §5).
- Campos: `tenants.nichoId`, `nichoAsignadoEn`.
- Rol: Owner.
- Acción: `asignarNicho(tenantId, nichoId)` (gap de backend original ya cerrado).

**Bienvenida / checklist progresivo** `[x]` — implementado como pantalla de Inicio (`/app`) con una sola tarjeta real ("Cargá tu primer producto"), no las 3 tarjetas originales de la referencia (Proveedor/Activos no tienen pantalla propia todavía — se agregan cuando esos módulos tengan UI). Se cierra sola al cargar el primer producto, o a mano (preferencia de UI en `localStorage`, no dato de negocio).
- Rol: Owner.
- Acción: `completarOnboarding()` (tracking de `onboarding_completado_en` en `tenants`, gap de backend original ya cerrado).

### `/app/mi-negocio` — Gestión de colaboradores (Owner)
Nueva sección dentro del hub "Mi negocio" (mismo nav item que Onboarding, `admin-shell.tsx` §5.1) —
vive en `src/app/app/(shell)/mi-negocio/`, separada de `/app/onboarding` (que sigue fuera del route
group `(shell)` a propósito, ver `identidad/ANCLA.md`) para no arriesgar el loop de redirect del
primer ingreso. Las 3 pantallas comparten un sub-nav de texto (Negocio/Colaboradores/Roles/
Capacidades Especiales), mismo patrón que los links de `/app/ventas`.

**Listado de Colaboradores** `[x]` (`/app/mi-negocio/colaboradores`, con mockup — mismo patrón de
cards que Instituciones) — usuarios del tenant con su rol y estado.
- Campos: `nombreCompleto`, `email`, `rol.nombre`, `activo`, `esOwner`. Búsqueda por nombre.
- **El Owner nunca puede tocar su propio rol ni suspenderse a sí mismo** — la card del Owner
  muestra los botones "Rol"/"Suspender" deshabilitados (verificado en navegador), consistente con
  la sección 6.2 ("de forma permanente y no editable").
- Rol: Owner. Acción: `listarUsuarios(solicitante)`.

**Invitar Colaborador** `[x]` (Dialog, mismo patrón que Nuevo Proveedor — react-hook-form + zod).
- Campos: `email`, `nombreCompleto`, `rolId` (selector — **excluye roles de sistema**, ver
  hallazgo de seguridad abajo).
- Rol: Owner. Bloqueado si `estadoAcceso !== "activo"`. Acción: `invitarUsuario(solicitante, {
  email, nombreCompleto, rolId })`.

**Cambiar rol de un colaborador** `[x]` (Dialog simple desde la card — botón "Rol").
- Rol: Owner. Acción: `cambiarRolUsuario(solicitante, usuarioId, nuevoRolId)`.

**Suspender / Reactivar colaborador** `[x]` (toggle inline en la card, sin modal — verificado en
navegador: el badge y el label del botón cambian de inmediato).
- Caso borde verificado: intentar suspender al único Owner está bloqueado a nivel de UI (botón
  deshabilitado en su propia card) y de backend (`"No se puede suspender al unico Owner..."`).
- Rol: Owner. Acciones: `suspenderUsuario`/`reactivarUsuario(solicitante, usuarioId)`.

**Transferir Owner** `[x]` (Dialog de confirmación, no estaba en el inventario original — se sumó
al construir esta tanda, sección 6.2/9.1).
- Campos: colaborador destino (solo activos, no-Owner), rol nuevo para el Owner saliente (solo
  roles personalizados del tenant — nunca de sistema, obligatorio, sin default implícito).
- Copy explícito de irreversibilidad ("Solo puede haber un Owner por negocio"). Verificado en
  navegador que el selector de destino solo lista colaboradores activos y el de rol solo roles
  personalizados — la transferencia real en sí (mutación atómica) está cubierta por 6 tests
  dedicados en `identidad.test.ts`, no se ejerció en vivo sobre el tenant de prueba persistente
  (`owner@ceom.local`) para no alterar su identidad de Owner entre tandas.
- Rol: Owner. Acción: `transferirOwner(solicitante, nuevoOwnerUsuarioId, rolParaOwnerSaliente)`.

### `/app/mi-negocio/roles` — Gestión de roles personalizados (Owner)
**Gestión de Roles** `[x]` (con mockup) — cards de Owner/CEOM Admin (badge "Rol de sistema", sin
iconos de editar/eliminar, descripción estática ya que `roles` no tiene campo `descripcion`) +
roles personalizados (editables, con conteo de colaboradores) + panel "Matriz de Permisos" que se
abre al elegir un rol o "+ Nuevo Rol".
- Campos: `nombre`, `esRolSistema`, conteo de colaboradores (relativo al tenant, incluso para
  roles de sistema). Matriz: filas = los 10 módulos del enum (`productos`, `inventario`, `ventas`,
  `costos_gastos`, `patrimonio`, `operativo`, `financiero`, `simulaciones`, `reportes`,
  `proveedores`), columnas = `ver`/`crear`/`editar`/`anular_ajustar`.
- Rol: Owner. Acciones: `listarRoles`, `listarPermisosPorRol`, `crearRolPersonalizado`,
  `actualizarPermisosRol`.

**Eliminar rol** `[x]` (modal de confirmación simple si no tiene colaboradores; modal de
reasignación forzada si sí los tiene — verificado en navegador de punta a punta: crear 2 roles,
asignar un colaborador a uno, intentar eliminarlo, reasignar desde el modal al otro rol, confirmar
que el rol se elimina y el colaborador queda en el nuevo).
- Caso borde: `"Hay N usuario(s) con este rol; reasignalos antes de eliminarlo."` — el modal lista
  esos colaboradores con un selector de rol destino cada uno (excluye el rol que se está
  eliminando), reasigna todos y recién ahí reintenta `eliminarRol`.
- Rol: Owner. Acción: `eliminarRol(solicitante, rolId)`.

### `/app/mi-negocio/capacidades` — Capacidades especiales (Owner)
**Capacidades Especiales** `[x]` (con mockup) — "Capacidades por Rol" (tabla, solo roles
personalizados — Owner/CEOM Admin **nunca aparecen**, ni con toggles deshabilitados: el bypass de
Owner es incondicional según `tieneCapacidadEspecial()`, no hay nada que mostrarle) + "Overrides
por Usuario" (cards, solo colaboradores con al menos un override ya otorgado — no todos los
usuarios × las 4 capacidades).
- Campos: `vender_sin_stock`, `gestionar_eventos`, `importar_historico`, `producir_sin_stock_insumo`
  (catálogo `capacidadEspecialEnum`, ampliable). Banner explícito: "Este ajuste anula los permisos
  del rol, aplicándose solo a esta persona."
- Verificado en navegador: toggle por rol persiste tras refresh; "Agregar" override queda
  deshabilitado si no hay colaboradores sin override todavía (el Owner nunca es candidato).
- Rol: Owner. Acciones: `listarCapacidadesEspeciales`, `otorgarCapacidadEspecialPorRol`,
  `otorgarCapacidadEspecialPorUsuario`.

**Bug real corregido en esta tanda (2026-07-18):** `tieneCapacidadEspecial()` no bypasseaba al
Owner — un Owner sin override puntual no podía usar ninguna capacidad especial, contra el
espíritu de la sección 6.2. Corregido: Owner ahora es el primer paso de la resolución,
incondicional. Detalle completo y verificación de que esto no invalida las pruebas end-to-end
previas de Ventas/Productos/Nicho 1 en `identidad/ANCLA.md`.

**Hallazgo de seguridad real corregido en esta tanda:** `invitarUsuario`/`cambiarRolUsuario` no
validaban que el rol asignado fuera personalizado — un llamado directo a la Server Action (no solo
la UI) podía asignarle `ROL_CEOM_ADMIN_ID` a un colaborador de tenant, otorgándole el bypass
cross-tenant real de `tienePermiso()`. Corregido en el backend (no solo ocultando la opción en el
selector de la UI) — ver `identidad/ANCLA.md`.

### `/admin` — Gestión de Tenants (ceom_admin)
**Alta de Tenant** `[x]` (`/admin/tenants/nuevo`, con mockup — página dedicada, no Dialog: el
formulario tiene demasiados campos para el patrón chico de Proveedores/Instituciones). El mockup no
traía `nombreNegocio` ni `monedaPrincipal` (ambos requeridos por el contrato real de `crearTenant`)
— se sumó una sección "Datos del Negocio" no prevista en el diseño. Las cards de plan del mockup
mostraban descripciones ficticias; `Plan` no tiene campo `descripcion` en el schema, así que las
cards reales muestran solo `nombre` + `precioMensual`/`moneda`.
- Campos de entrada: `nombreNegocio`, `monedaPrincipal`, `planId` (cards seleccionables, planes
  activos), `fechaInicioSuscripcion`, `ownerNombreCompleto`, `ownerEmail`.
- Salida: `tenantId`, `sucursalId`, `usuarioOwnerId`. Botón "+ Nuevo Tenant" agregado al listado
  (mismo lugar que "+ Nueva institución" en Instituciones).
- Rol: `ceom_admin` únicamente. Acción: `crearTenant(solicitante, input)`.
- **Verificado end-to-end (2026-07-18):** tenant + sucursal principal + Owner creados atómicamente;
  confirmado además, **independientemente de la UI**, que la invitación de Supabase Auth se disparó
  de verdad — un script ad-hoc contra `admin.auth.admin.listUsers()` mostró `invited_at` seteado
  para el email del Owner de prueba (`ceom.qa.alta.*@gmail.com`). Como es un email ficticio sin
  bandeja real, **queda pendiente de validación manual** el click del link recibido (mismo criterio
  ya usado para el magic link de Instituciones — ver pantalla de Consentimiento).

**Listado de Tenants** `[x]` (`/admin/tenants`, cross-tenant, salud agregada).
- Campos: `id`, `nombreNegocio`, `planId`, `nichoId`, `estadoAcceso` (derivado) + agregados
  `porEstadoAcceso`/`porPlan`/`porNicho`.
- Nota: `listarTenants()` **no pagina** todavía — a tener en cuenta si crece el volumen.
- Rol: `ceom_admin`. Acción: `listarTenants(solicitante)`, `saludAgregadaPlataforma`.

**Ficha de Tenant** `[x]` (`/admin/tenants/[tenantId]`, detalle desde el listado + 3 tabs veedor
auditados de Módulo 11 — ver pantalla en sección 11). Panel de acciones sumado esta tanda (sin
mockup — mismo patrón Dialog ya usado en Planes/Aprobaciones), sin tocar los 3 tabs existentes:
- **Cambiar Plan** `[x]` — Dialog con selector de plan (solo planes activos, más el plan actual del
  tenant aunque esté desactivado, para que el selector nunca quede en blanco). Acción:
  `cambiarPlanTenant(solicitante, tenantId, nuevoPlanId)`. Se agregó también un campo "Plan" al
  grid de datos de la Ficha — antes no se mostraba en ningún lado fuera del Dialog transitorio.
- **Cambiar Estado de Suscripción** `[x]` — Dialog con selector de estado. **Corrección respecto al
  mockup pedido:** el diseño describía un selector `activa/solo_lectura/bloqueado`, mezclando dos
  enums distintos — `estadoSuscripcion` (`activa`/`pausada`/`vencida`, el campo real y directamente
  asignable) y `estadoAcceso` (`activo`/`solo_lectura`/`bloqueado`, **derivado**, nunca asignable a
  mano — ver `identidad/ANCLA.md`). El Dialog implementado usa el enum real
  `estadoSuscripcion`; si se elige `vencida`, pide `fechaProximoPago` (ancla de la etapa de gracia).
  Acción: `cambiarEstadoSuscripcion(solicitante, tenantId, nuevoEstado, fechaProximoPago?)`.
- **Verificado end-to-end (2026-07-18):** Cambiar Plan confirmado contra el listado (conteo "Por
  plan" se movió correctamente). Cambiar Estado confirmado con las 3 transiciones: `vencida` sin
  fecha bloqueado por el schema (`.refine()`), `vencida` con fecha guardado y `estadoAcceso`
  recalculado correctamente a `solo_lectura` en la misma pantalla, y reseteado a `activa` al final.
- Rol: `ceom_admin`. Acción: `consultarTenantDetalle`/`obtenerTenantPorId(solicitante, tenantId)`.

### `/app` — Estado propio (cualquier usuario del tenant)
**Banner de estado del tenant** `[x]` (2026-07-20) — banner ámbar/rojo en `AppShell`
(`src/components/shared/app-shell.tsx`), arriba de todo el contenido, en todas las pantallas de
`/app` por igual. Ámbar (`solo_lectura`): "Tu suscripción está vencida — podés ver tus datos pero
no crear ni editar hasta regularizar el pago, fecha de próximo pago: [fecha]". Rojo (`bloqueado`):
"Acceso bloqueado — contactá a soporte para regularizar tu suscripción". Invisible si `activo`.
- Campos: `estadoAcceso` (`activo`/`solo_lectura`/`bloqueado`), `fechaProximoPago`.
- **Diferencia respecto al pedido original:** en vez de llamar a `obtenerEstadoAccesoTenant()`
  desde el shell, se calcula `calcularEstadoAcceso(tenant)` directo sobre el `tenant` que
  `src/app/app/(shell)/layout.tsx` **ya fetchea** (misma función pura por dentro) — evita un
  round-trip redundante y, sobre todo, `obtenerEstadoAccesoTenant()` no devuelve
  `fechaProximoPago` (necesario para el texto del banner ámbar), así que hacía falta el tenant
  completo de todas formas.
- **Es señal visual únicamente — el bloqueo real ya lo hacía `tienePermiso()` de antes, sin cambios
  acá.** Verificado explícitamente en navegador: con el tenant en `vencida` (etapa de gracia,
  `solo_lectura`), un intento de "Crear producto" fue rechazado server-side con "No tenés permiso
  para crear productos en este tenant." — el banner solo informa lo que el servidor ya aplicaba.
- Rol: cualquier usuario autenticado del tenant. No usa una Server Action nueva — el `tenant` ya
  resuelto en el layout es suficiente.

---

## 2. Suscripción (versión mínima)

### `/app` — Mi Plan (Owner y cualquier colaborador, solo lectura)
**Mi Plan** `[x]` (`/app/mi-negocio/plan`, sin mockup — dentro de "Mi negocio", mismo lugar que
Colaboradores/Roles/Capacidades Especiales, sub-nav compartido).
- Sin gap de backend: `obtenerMiPlanAction()` (nueva Server Action delgada en
  `mi-negocio/actions.ts`) compone `obtenerTenantPorId(usuario, usuario.tenantId)` +
  `calcularEstadoAcceso(tenant)` (ambas de Identidad, ya usadas por el shell de `/app`) +
  `obtenerPlanPorId(tenant.planId)` (de Suscripción, ya usado por `crearTenant`/`cambiarPlanTenant`)
  — ninguna función nueva en ningún módulo.
- 2-3 cards de métrica arriba (mismo estilo KPI que el resto de la app): nombre del plan + precio
  mensual; badges de `estadoSuscripcion`/`estadoAcceso` (mismos colores semánticos que en toda la
  app); card de advertencia con fecha de próximo pago, solo si `estadoSuscripcion === "vencida"`.
  Debajo, checklist de qué incluye el plan (sucursales/múltiples Owners/downgrade autogestionado,
  mismo patrón visual de atributos que la Ficha de Activo) + badges de módulos veedor permitidos.
  100% solo lectura — cambiar de plan sigue siendo exclusivo de `ceom_admin` desde `/admin`.
- **Bug real encontrado y corregido durante la verificación en navegador:** un Server Component
  (`page.tsx`, sin `"use client"`) importaba `MODULOS_VEEDOR_INFO` desde
  `consentimiento/generar-cliente.tsx` (que sí es `"use client"`) — en el servidor esa importación
  resuelve a una referencia vacía, no al objeto real, y `MODULOS_VEEDOR_INFO[m].label` tiraba
  `TypeError: Cannot read properties of undefined (reading 'label')` en cada request. Fix: el mapeo
  se duplicó localmente en `page.tsx` (mismo criterio ya usado para `CAMPOS_BOOLEANOS`, copiado de
  `planes-cliente.tsx`) — no importar constantes de datos desde un archivo `"use client"` hacia un
  Server Component, aunque typecheck no lo detecta (el tipo del import es correcto, el valor en
  runtime no).
- Rol: cualquier usuario autenticado del tenant (no solo Owner) — es puramente informativo.

### `/admin` — Catálogo de Planes (ceom_admin)
**Listado de Planes + Crear/Editar/Desactivar/Reactivar.** `[x]` (`/admin/planes`, sin mockup —
lista de cards + un solo Dialog reutilizado para crear/editar, no maestro-detalle: Plan es una
entidad chica y plana, sin sub-listados propios).
- Campos: `nombre`, `incluyeSucursales`, `permiteMultiplesOwners`, `permiteDowngradeAutogestionado`, `duracionInvitacionDias` (default 7), `duracionEtapaSoloLecturaDias` (default 3), `modulosVeedorPermitidos` (multi-select: `financiero`/`operativo`/`inventario_operativo`, reusa `MODULOS_VEEDOR_INFO` de Consentimiento), `precioMensual`, `moneda` (`BOB`/`USD`, mismo criterio que `monedaPrincipal` de Tenant). `nichoId` del schema queda fuera del formulario a propósito — es un `uuid` sin FK real todavía (el módulo de Nicho no existe, ya documentado en `suscripcion/ANCLA.md`), no hay nada contra qué resolverlo.
- Desactivar/Reactivar es el toggle `activo` (sin `eliminado_en` — la baja ES ese booleano, por diseño del schema).
- Rol: `ceom_admin`. Acciones: `listarPlanes` (pública, sin gate), `crearPlan`/`actualizarPlan`/`desactivarPlan`/`reactivarPlan` (gateadas).

---

## 3. Patrimonio / Activos

> Gap de backend transversal — **resuelto** (2026-07-16/17): `listarActivos`, `listarPasivos`,
> `obtenerActivoPorId`, `obtenerPasivoPorId`, `fichaPasivo` ya están en `actions.ts`. Detalle en
> `src/modules/patrimonio/ANCLA.md`.

### `/app` — Activos (Owner + permiso `"patrimonio"`) — Tanda A, cerrada 2026-07-17
**Listado de Activos** `[x]` — `/app/patrimonio`, grid de cards (design-system §5.3) con
búsqueda + filtro por estado (Todos/Activos/En mantenimiento/Dados de baja), valor actual
derivado por card, y una franja con Activos operativos + Valor patrimonial total (agregados
reales — se omitió "Próximos mantenimientos" de la referencia visual porque no existe esa
entidad en el modelo de datos del módulo). Verificado end-to-end con datos reales.
- Campos: `nombre`, `tipo`, `sucursalId`, `estado`, `valorCompra`, `fechaAdquisicion` + `valorActual` (`calcularValorActual()`).
- Acción: `listarActivos(solicitante, tenantId)`.

**Ficha de Activo** `[x]` — `/app/patrimonio/[id]`, detalle técnico/financiero + card de Pasivo
asociado si está financiado (saldo pendiente, cuota, estado — sin "próximo pago", no hay cálculo
real de esa fecha en el contrato actual). Botones Editar/Transferir/Dar de baja (estos dos
últimos se ocultan si el activo ya está dado de baja). Verificado end-to-end.
- Campos: `nombre`, `tipo`, `capacidadProduccionCantidad`/`Unidad`, `capacidadAlmacenamientoCantidad`/`Unidad`, `estado`, `valorCompra`, `fechaAdquisicion`, `vidaUtilMeses`, `proveedorId`, `numeroSerie`, `vencimientoGarantia`, `motivoBaja` + `valorActual` + pasivos asociados con `saldoPendiente`. **No incluidos en la UI de esta tanda** (existen en el schema/contrato pero sin campo en el formulario): `disponibilidadHorariaSemanal`, `requiereDescansoEntreCiclos`, `tiempoDescansoMinutos`, `tiempoEstimadoPorCicloMinutos` — mismo criterio que `configurarStockMinimo` en Productos (no todo campo de backend necesita UI día uno).
- Acciones: `obtenerActivoPorId`, `consultarPasivoDeActivo`, `obtenerPasivoPorId`, `calcularValorActual`.

**Alta de Activo** `[x]` y **Editar Activo** `[x]` — mismo componente (`ActivoForm`,
`src/components/shared/activo-form.tsx`), solo cambia título/texto del botón. Tres secciones:
Datos principales, Detalles de adquisición y operación, Capacidad (opcional). Verificado
end-to-end (creación, edición con precarga correcta de todos los campos).
- Acciones: `crearActivo(solicitante, tenantId, input)`, `actualizarActivo(solicitante, activoId, input)`.

**Dar de baja Activo** `[x]` (modal, `Dialog`) — motivo obligatorio (**cambio de contrato
aditivo**: `darDeBajaActivo` ahora exige un tercer parámetro `motivo`, columna nueva
`activos.motivo_baja`, migración `0026` — ver `src/modules/patrimonio/ANCLA.md` para el porqué).
Verificado end-to-end. Acción: `darDeBajaActivo(solicitante, activoId, motivo)`.

**Transferir Activo entre sucursales** `[x]` (modal, `Dialog`). Verificado end-to-end.
Campo: `nuevaSucursalId`. Acción: `transferirActivo(solicitante, activoId, nuevaSucursalId)`.

### `/app` — Pasivos (Tanda B, cerrada 2026-07-17)
**Listado de Pasivos** `[x]` — `/app/patrimonio/pasivos`, vista de lista (design-system §5.5, no
cards), con saldo pendiente por fila (agregado vía `fichaPasivo` por fila, mismo criterio que
`listarVentasConTotal`). Link cruzado "Ver activos"/"Ver pasivos" entre ambos listados. Verificado
end-to-end.
- Campos: `montoTotal`, `cuotaPeriodica`, `frecuenciaCuota`, `plazoCuotas`, `fechaInicio`, `estado` (`activo`/`pagado`/`refinanciado`), `activoId?` (se muestra el nombre del activo vinculado, o "Sin activo asociado"). **No incluido:** "próxima cuota"/vencido de la referencia visual — no hay cálculo de fecha de próxima cuota en el contrato, no se fabricó.
- Acción: `listarPasivos(solicitante, tenantId)`.

**Ficha de Pasivo** `[x]` — `/app/patrimonio/pasivos/[id]`, 3 stat cards (Monto original, Cuota,
Saldo pendiente — **sin "Tasa (TEA)"**: el doc del módulo confirma "cuota fija sin desglose de
interés/capital" para el MVP, ese campo no existe en el modelo) + historial completo de pagos
(cuota N/plazo, fecha, origen Automático/Manual, monto, saldo restante corrido). Botones
Refinanciar/Registrar pago se ocultan si el pasivo ya no está `activo`. Verificado end-to-end.
- Campos: los de arriba + `saldoPendiente` (derivado) + historial de pagos (`monto`, `fechaPago`, `origen`).
- Acción: `fichaPasivo(solicitante, pasivoId)`.

**Alta de Pasivo** `[x]` y **Refinanciar Pasivo** `[x]` — mismo componente compartido
(`PasivoForm`, `src/components/shared/pasivo-form.tsx`), páginas completas (no modal — la
referencia de "Refinanciar" mostraba una pantalla completa "Nuevo Pasivo" con un banner, no un
modal). Selector de Activo relacionado como cards (design-system §5.4), incluye "Sin activo
relacionado" ya que `activoId` es opcional. En modo Refinanciar, precarga los términos del pasivo
anterior (menos la fecha de inicio, que se pide de nuevo) y muestra el banner de aviso. Verificado
end-to-end (alta, refinanciación confirmada — el pasivo anterior queda `refinanciado` con su saldo
congelado, el nuevo arranca en `activo`).
- Campos: `activoId?`, `montoTotal`, `cuotaPeriodica`, `frecuenciaCuota` (`mensual`/`semanal`/`quincenal`/`anual`), `plazoCuotas`, `fechaInicio`.
- Acciones: `crearPasivo(solicitante, tenantId, input)`, `refinanciarPasivo(solicitante, pasivoAnteriorId, nuevosTerminos)`.

**Registrar pago de Pasivo** `[x]` (modal, `Dialog`, disparado desde la Ficha) — resumen
"Saldo actual / Pago a registrar / Saldo después" recalculado en vivo mientras se escribe el
monto, igual que la referencia. Verificado end-to-end.
- Campos: `monto`, `fechaPago`, `origen?` (default `"manual"`).
- Salida: `saldoPendiente`, `estadoPasivo` (pasa a `pagado` automáticamente al llegar a 0).
- Acción: `registrarPagoPasivo(solicitante, pasivoId, input)`.

### `/app` — Resumen patrimonial
**Valor patrimonial total** `[x]` — embebido en Reportes → Resumen Financiero (`/app/reportes`), no como pantalla propia de Patrimonio.
- Campo: `valorPatrimonialTotal`. Acción: `consultarValorPatrimonialTotal(solicitante, tenantId)`.

---

## 4. Proveedores / Compras

> **Módulo completo — tanda cerrada 2026-07-17 (9/9).** Gap de backend (`listarCompras` con
> filtros por `estadoPago`/`estado`) cerrado en un cambio previo a la UI. Detalle completo:
> `src/modules/proveedores/ANCLA.md`.

### `/app` — Proveedores (Owner + permiso `"proveedores"`)
**Listado de Proveedores.** `[x]` — maestro-detalle (design-system §5.6) en `/app/proveedores`:
panel izquierdo con buscador + cards de proveedor (badge de cantidad de compras), panel derecho
con el detalle del seleccionado. Route group `(directorio)` para que el layout maestro-detalle no
se filtre a `/app/proveedores/compras/*`. Verificado end-to-end.
- Campos: `nombre`, `contacto`, `notas`, `creadoPor`/`creadoEn`. Acción: `listarProveedores`.

**Ficha de Proveedor** `[x]` — panel derecho del maestro-detalle (`/app/proveedores/[id]`), con
tabs "Historial de Compras" e "Historial de Precios" (mismos datos de `compras[]` agrupados por
ítem en cliente, sin llamada aparte). Editar/Eliminar (soft delete) inline en el header. Verificado
end-to-end.
- Campos: `nombre`, `contacto`, `notas`, `cantidadCompras`, `montoTotalComprado`, `compras[]`.
- Acción: `fichaProveedor(solicitante, proveedorId)`.

**Alta de Proveedor** `[x]` y **Editar Proveedor** `[x]` — mismo `Dialog` compartido
(`proveedor-form-dialog.tsx`), disparado desde el listado o desde la Ficha. Verificado end-to-end
(alta, edición, eliminación).
- Campos: `nombre`, `contacto?`, `notas?`. Acciones: `crearProveedor`, `actualizarProveedor`,
  `eliminarProveedor` (soft delete).

### `/app` — Compras
**Listado de Compras** `[x]` — `/app/proveedores/compras`, vista de lista (design-system §5.5) con
pills de filtro por Estado (Todos/Pedido/Recibido) y Pago (Todos/Pendiente/Parcial/Pagado)
client-side. Acción contextual por fila: "Recibir" si está `pedido`; "Pagar"/"Ajustar" si está
`recibido`. Verificado end-to-end.
- Campos: `sucursalId`, `proveedorId?`, `tipo` (`insumo`/`reventa`), `insumoId`/`productoId`, `cantidad`, `costoUnitario`, `montoTotal`, `costoAdicionalTraslado?`, `fechaCompra`, `fechaVencimiento?`, `estado` (`pedido`/`recibido`), `fechaRecepcion`, `estadoPago`.
- Acción: `listarCompras(solicitante, tenantId, { estadoPago?, estado? })` (agregada en esta tanda, gap de backend original ya cerrado).

**Alta de Compra** `[x]` (`/app/proveedores/compras/nuevo`) — toggle Tipo (Producto para
reventa/Insumo de producción) que condiciona el selector de ítem, toggle Estado (Ya
recibida/Pedido, default "recibido") con nota inline de que "Pedido" no mueve stock todavía.
Verificado end-to-end en ambos estados.
- Campos de entrada: `sucursalId`, `proveedorId?`, `tipo`, `insumoId` **o** `productoId` (exactamente uno), `cantidad`, `montoTotal`, `costoAdicionalTraslado?`, `fechaCompra`, `fechaVencimiento?`, `estado?` (default `"recibido"`; `"pedido"` para el flujo tipo Orden de Compra de Nicho 4).
- Salida: `compraId`, `costoUnitario` (calculado), `entradaStock` (solo si `estado="recibido"`).
- Acción: `registrarCompra(solicitante, tenantId, input)`.

**Historial de precios de un ítem** `[x]` — sin mockup propio en esta tanda; resuelto como una
sección nueva ("Historial de precios de compra") en la Ficha de Producto ya existente
(`src/app/app/(shell)/productos/[id]/`), y cubierto también, con los mismos datos crudos, por el
tab "Historial de Precios" de la Ficha de Proveedor de arriba. No se creó ruta propia. Verificado
end-to-end.
- Acción: `historialPrecio(solicitante, tenantId, { insumoId } | { productoId })`.

**Recibir Compra** `[x]` (modal, disparado desde la fila de Listado de Compras) — sin mockup
propio (pantalla trivial): fecha de recepción (prellenada con hoy) + "Confirmar recepción". Dispara
la entrada real de stock. Verificado end-to-end.
- Acción: `recibirCompra(solicitante, compraId, fechaRecepcion?)` (extendida en esta tanda con
  `fechaRecepcion` opcional, default hoy si se omite — cambio de contrato aditivo).

**Registrar pago de Compra** `[x]` (modal) — mismo patrón visual que Registrar pago de Pasivo:
resumen "Saldo actual / Pago a registrar / Saldo después" recalculado en vivo. El saldo se pide al
abrir el modal (`consultarSaldoCompra`, agregada en esta tanda — mismo criterio que
`consultarPasivoDeActivo`), no en un `useEffect` (evita el lint `set-state-in-effect`; se dispara
en el handler de click que abre el modal). Verificado end-to-end.
- Campos: `monto`, `fechaPago`. Salida: `estadoPago`, `totalPagado`. Acción: `registrarPagoCompra`.

**Compra de Ajuste** `[x]` (modal — motivo obligatorio, nunca edita la Compra original) — mismo
patrón visual que Ajuste de Venta: banner de auditoría, tipo por `Select`, motivo en `Textarea`
obligatorio. Verificado end-to-end (incluida `anulacion_total` para revertir compras de prueba).
- Campos: `tipo` (`correccion`/`devolucion_a_proveedor`/`anulacion_total`), `montoAjuste`, `motivo` (obligatorio).
- Acción: `registrarCompraDeAjuste(solicitante, compraId, input)`.

---

## 5. Productos e Inventario

> ⚠️ Nota de datos: `listarProductos()` no trae stock por sucursal en la misma llamada — se
> obtiene por producto vía `fichaProducto()` o `consultarStock()` puntual. El listado tendrá que
> resolverlo con N llamadas, o pedir un endpoint agregado si el volumen lo justifica.

### `/app` — Catálogo (Owner + permiso `"productos"`/`"inventario"`)
**Catálogo de Productos** `[x]` (listado) — buscador por nombre + pills de categoría, botón "Gestionar categorías".
- Campos: `nombre`, `imagenUrl`, `unidadVenta`, `precioVenta`, `costoOperativoVigente`, `origenCosto`, `tipoOrigenProducto`, `activo`, `categoriaId`. Margen se calcula en cliente.
- Acción: `listarProductos(solicitante, tenantId)`.

**Ficha de Producto** `[x]` — detalle + stock por sucursal, breadcrumb, layout 2 columnas.
- Subpantallas construidas: Ajuste manual de stock, Transferencia de stock, Eliminar (con confirmación si stock > 0), **Vincular/Desvincular a receta** (`[x]`, 2026-07-20 — modal, sin mockup).
- Campos: todos los de `productos` + `stockPorSucursal[]` (`sucursalId`, `cantidadActual`, `stockMinimo`, `actualizadoEn`).
- Acción: `fichaProducto(solicitante, productoId)`.

**Vincular a proceso operativo** `[x]` (2026-07-20, modal desde Ficha de Producto). Selector de
Receta (`listarRecetas`, Nicho 1) + `cantidadBaseConsumidaPorUnidad`, botón "Vincular". Si el
producto ya está vinculado, muestra la receta actual (nombre + consumo por unidad) con opción
"Desvincular", en vez del selector. Cierra el gap que ya señalaba explícitamente el estado vacío de
"Registrar Producción" ("hace falta vincular uno primero desde Productos").
- No hace falta gatear por `tipoOrigenProducto` — `vincularProductoAReceta()` ya lo setea a
  `produccion_nicho` automáticamente vía `enviarProductoAOperaciones()` (ya existía, sin cambios).
- Campos: `recetaId`, `cantidadBaseConsumidaPorUnidad`. Acciones (todas ya existían y ya estaban
  probadas, sin gap de backend): `vincularProductoAReceta`, `desvincularProductoDeReceta`,
  `obtenerRecetaDeProducto` (Nicho 1).
- **Verificado end-to-end en navegador:** estado vacío sin Recetas cargadas, vinculación real
  (persiste tras reload), desvinculación real (persiste tras reload).

**Alta / Edición de Producto.** `[x]` Formulario en 2 columnas.
- Campos: `categoriaId`, `nombre`, `imagenUrl` (dropzone, preview local sin persistir), `unidadVenta` (`unidad`/`kg`/`g`/`l`/`ml`/`docena`), `precioVenta`, `costoOperativoVigente`, `origenCosto` (`manual`/`nicho_sugerido`/`proveedor_reventa`, solo lectura), `tipoOrigenProducto` (solo `reventa_simple`/`manual` desde acá — `produccion_nicho` solo vía "Vincular a receta"), `fechaVencimientoReferencia`, `vidaUtilDias`, `activo`.
- **Regla de UI:** si `tipoOrigenProducto === "produccion_nicho"`, `costoOperativoVigente` queda no editable (el backend lo rechaza). Implementado.
- Acciones: `crearProducto` / `actualizarProducto`.

**Gestión de Categorías.** `[x]` — implementada como `Dialog` desde el Catálogo, no como pantalla/ruta propia (decisión: categoría solo tiene `nombre`, no ameritaba una ruta nueva). Campos: `nombre`, `categoriaSugeridaId?`. Acciones: `crearCategoria`, `actualizarCategoria`, `eliminarCategoria`, `listarCategorias`. `listarCategoriasSugeridas` (lectura pública) todavía sin consumir en UI. La administración del catálogo global de sugerencias en `/admin` sigue sin construir.

**Ajuste manual de stock** `[x]` (modal, motivo obligatorio — ledger append-only). Toggle Entrada/Salida + preview del nuevo stock.
- Campos: `productoId`, `sucursalId`, `tipo` (`entrada_ajuste_manual`/`salida_ajuste_manual`), `cantidad`, `motivo`.
- Acción: `registrarAjusteManualStock`.

**Transferencia de stock entre sucursales** `[x]` (modal).
- Campos: `productoId`, `sucursalOrigenId`, `sucursalDestinoId`, `cantidad`. Siempre bloquea si no alcanza (no aplica `vender_sin_stock`, esa excepción es solo de Ventas).
- Acción: `registrarTransferenciaStock`.

**Historial de movimientos de stock de un producto.** `[x]` — panel dentro de la Ficha de Producto, con ícono de dirección por movimiento.
- Wrapper público `listarMovimientosStock` ya expuesto en `actions.ts` (gap de backend original ya cerrado).

**Vincular a proceso operativo** `[x]` (2026-07-20, modal desde Ficha de Producto — no gateado por
nicho, disponible para cualquier tenant que tenga al menos una Receta cargada). Detalle completo de
campos/acciones/verificación más arriba en esta misma sección ("Ficha de Producto").
- Nota técnica: el botón dispara `vincularProductoAReceta()` de **Módulo 6** (Nicho 1), que internamente llama a `enviarProductoAOperaciones()` de este módulo.

---

## 6. Módulo Operativo — Nicho 1 (Alimentos/Bebidas por Lotes)

> **Módulo completo — tanda cerrada 2026-07-17 (10/10).** Gaps de backend cerrados antes de
> construir UI — detalle completo: `src/modules/operativo/nichos/nicho-1/ANCLA.md`.

### `/app` — Insumos (Owner + permiso `"operativo"`)
**Catálogo de Insumos.** `[x]` — `/app/produccion/insumos`, grid de cards (mismo patrón que
Catálogo de Productos), buscador por nombre, sin filtro por categoría (Insumo no tiene). Verificado
end-to-end.
- Campos: `nombre`, `unidadMedida`, `vidaUtilDias`, `costoUnitarioVigente` (derivado), `stockMinimo`.
- Acción: `listarInsumos`.

**Ficha de Insumo con historial de movimientos.** `[x]` — `/app/produccion/insumos/[id]`, mismo
patrón que Ficha de Producto: stock por sucursal con acción "Ajustar"/"Merma" inline por fila,
historial de movimientos con selector de sucursal. Botón "Registrar compra" en el header.
Verificado end-to-end (compra, ajuste, merma, historial actualizándose en vivo tras cada mutación).
- Campos: `nombre`, `unidadMedida`, `vidaUtilDias`, `costoUnitarioVigente`, `stockMinimo` + `stockPorSucursal[]` (`sucursalId`, `cantidadActual`) + historial de movimientos (`tipo`, `cantidad`, `costoUnitarioEnMovimiento`, `fechaVencimiento?`, `motivo?`, `creadoEn`).
- Acciones: `fichaInsumo`, `listarMovimientosInsumo`.

**Alta / Edición de Insumo.** `[x]` — mismo componente compartido (`InsumoForm`,
`src/components/shared/insumo-form.tsx`), un solo `Card` (sin imagen ni precio de venta, a
diferencia de Producto). Verificado end-to-end.
- Campos: `nombre`, `unidadMedida` (`litros`/`ml`/`kg`/`g`/`unidad`/`metros`), `vidaUtilDias`, `stockMinimo`. `costoUnitarioVigente` nunca es editable a mano.
- Acciones: `crearInsumo` / `actualizarInsumo`.

**Entrada de compra de insumo** `[x]` (modal, disparado desde la Ficha de Insumo — recalcula costo
promedio ponderado). Fecha de vencimiento auto-calculada desde `vidaUtilDias` si se omite, editable
a mano. Verificado end-to-end.
- Campos: `insumoId`, `sucursalId`, `cantidad`, `costoCompra`, `fechaVencimiento?` (auto-calculada si se omite).
- Nota: también se dispara automáticamente desde Proveedores al recibir una Compra tipo `insumo` — esta pantalla es la vía manual directa.
- Acción: `registrarEntradaCompraInsumo`.

**Ajuste manual de insumo / Merma de almacenamiento** `[x]` (modales, disparados desde la fila de
stock en la Ficha de Insumo — mismo patrón que Ajuste manual de stock de Productos: toggle
entrada/salida para el ajuste, motivo obligatorio en ambos). Verificado end-to-end.
- Acciones: `registrarAjusteManualInsumo`, `registrarMermaAlmacenamiento`.

### `/app` — Recetas y Producción
**Gestión de Recetas.** `[x]` — `/app/produccion/recetas`, maestro-detalle (según mockup): lista +
buscador a la izquierda, composición editable inline a la derecha (select de insumo + cantidad por
línea, "+ Agregar insumo", conteo de "Total de insumos"). La composición completa de cada receta se
carga de una sola vez server-side (batch `fichaReceta` por receta) — cambiar de selección no
dispara un fetch nuevo. Verificado end-to-end (alta, composición, guardado, eliminación).
- Campos (receta): `nombre`, `rendimientoPorLote`, `unidadRendimiento`. Campos (composición): `insumoId`, `cantidadPorLote`, `costoUnitarioVigente`.
- Acciones: `crearReceta`, `actualizarReceta`, `eliminarReceta`, `listarRecetas`, `fichaReceta`, `actualizarComposicionReceta` (reemplaza toda la lista, no edición incremental).

**Registrar Producción de un lote** `[x]` — `/app/produccion/nuevo`. Según el mockup, no es un
wizard real de pasos secuenciales: los 3 "pasos" (Producto/Equipo y Fecha/Resultados) son secciones
todas visibles a la vez en una sola pantalla, con un panel "Resumen" a la derecha que recalcula
Rendimiento Teórico, Merma y Costo Operativo Resultante en vivo mientras se completa el formulario.
Esas 3 fórmulas puras (`calcularRendimientoTeorico`, `calcularMerma`,
`calcularCostoOperativoProduccion`) están **duplicadas a propósito en el cliente** — no se pueden
importar de `nicho-1/actions.ts` porque ese archivo no es `"use server"` e importa `db` (rompería
el bundle de cliente). Solo lista productos ya vinculados a una receta (`tipoOrigenProducto =
produccion_nicho`); si no hay ninguno, muestra un estado vacío explicando que hace falta vincular
uno primero desde Productos (pantalla `[x]` desde 2026-07-20, ver sección 5 "Vincular a proceso
operativo"). Verificado end-to-end de punta a
punta: descuento real de insumo, cálculo de merma/costo, y acreditación real de stock en Productos
e Inventario.
- Campos de entrada: `productoId`, `sucursalId`, `activoId` (equipo de Patrimonio), `fechaProduccion`, `cantidadLotesProducidos`, `cantidadRealObtenida`, `fechaVencimientoLote?`.
- Bloqueos: sin receta vinculada → error directo; insumo insuficiente → bloquea salvo capacidad `producir_sin_stock_insumo`.
- Salida mostrada: `costoOperativoCalculado`, `mermaCantidad`, `mermaCosto` (en vivo, antes de confirmar) — `acreditacionProductos` no se expone en la UI si falla (gap de atomicidad aceptado por diseño, ya documentado), redirige al Listado de Producciones igual.
- Acción: `registrarProduccion`.

**Producción de Ajuste** `[x]` (modal, disparado desde el Listado de Producciones — corrección sin
editar ni revertir movimientos, con referencia a la producción original). Verificado end-to-end
(la fila del Listado sigue mostrando los valores originales después del ajuste, como corresponde).
- Campos: `costoOperativoCorregido?`, `cantidadRealObtenidaCorregida?`, `motivo` (obligatorio).
- Acción: `registrarProduccionDeAjuste`.

**Listado de Producciones.** `[x]` — `/app/produccion` (landing del módulo), vista de lista (mismo
patrón que Historial de Ventas), badge de merma cuando corresponde. Botones de navegación a
Insumos/Recetas/Capacidad + CTA "Nueva producción". Verificado end-to-end.
- Campos: `fechaProduccion`, `productoId`, `sucursalId`, `activoId`, `cantidadLotesProducidos`, `cantidadRealObtenida`, `fechaVencimientoLote`, `costoOperativoCalculado`, `mermaCantidad`, `mermaCosto`.
- Acción: `listarProducciones`.

**Capacidad Operativa** `[x]` — `/app/produccion/capacidad`, solo lectura. Selector de Equipo +
período (desde/hasta, default mes en curso), barra de progreso reutilizada del Dashboard
(`h-1.5 rounded-full`) para producción y almacenamiento. Muestra "Sin datos suficientes" en vez de
una barra cuando al Activo le faltan los campos de ciclo (`disponibilidadHorariaSemanal`/
`tiempoEstimadoPorCicloMinutos`) — esos campos no tienen UI todavía en Alta/Editar Activo (gap ya
documentado en Patrimonio, no se resuelve acá). Verificado end-to-end.
- Campos (producción): `capacidadPeriodo`, `produccionReal`, `porcentajeUsado`. Campos (almacenamiento): `capacidadAlmacenamientoCantidad`, `stockActualTotal`, `porcentajeUsado`.
- Acciones: `consultarCapacidadProduccionUsada`, `consultarCapacidadAlmacenamientoUsada`.

---

## 7. Ventas + Clientes

> Pantalla más crítica del sistema junto con Productos y Login — es el flujo diario de uso.

### `/app` — Punto de Venta (Owner + permiso `"ventas"`)
**Registrar Venta** `[x]` (carrito) — buscador + pills de categoría, canal y método de pago como cards/pills reales del tenant.
- Campos de entrada: `sucursalId`, `clienteId` **o** `clienteNuevo` (`nombre`, `telefono?`, `email?`), `fechaVenta?`, `canalVentaId`, `eventoId?`, `lineas[]` (`productoId`, `cantidad`), `pagoInicial?` (`metodoPagoId`, `monto`), `origenRegistro?` (`en_vivo`/`offline_sincronizado`).
- **Selector de Evento** `[x]` (2026-07-20) — campo opcional en el carrito, filtrado a eventos
  `estado === "abierto"` (`listarEventos` de Ventas, ya existía). Sin eventos abiertos, el selector
  no se muestra (mismo criterio que "Transferir stock" cuando hay 1 sola sucursal — no clutter).
  `eventoId` no estaba en `registrarVentaSchema` (gap chico de validación, cerrado en el mismo
  cambio). **Verificado end-to-end:** venta confirmada con evento elegido, `eventoId` persistido
  correcto en la fila de `ventas` (confirmado contra la base, no solo por ausencia de error).
- Antes de confirmar: precio vigente y total en vivo por línea (carrito). Stock disponible por línea no se muestra todavía (ver nota de "Poco stock" más abajo en Catálogo — mismo criterio, evita N+1 queries).
- Salida manejada: `ventaId`, `totalVenta` — `descuentosStock[]`/avisos de stock insuficiente se calculan pero no se muestran explícitamente en la UI todavía.
- Acción: `registrarVenta`.

**Listado de Ventas** `[x]` (Historial) — buscador de cliente, pills de estado/canal, avatar con inicial, paginación client-side.
- Campos: `fechaVenta`, `clienteNombre` (resuelto), `canalNombre` (resuelto), `estadoPago`, `total` (vía `listarVentasConTotal`, gap de backend original ya cerrado).
- Acción: `listarVentasConTotal`.

**Ficha de Venta.** `[x]` Breadcrumb, cliente/canal visibles, layout 2 columnas, card Resumen.
- Campos: `venta` completa + `detalles[]` (`cantidad`, `precioVentaSnapshot`, `costoUnitarioSnapshot`, `subtotal`) + `pagos[]` + `ajustes[]` + `totalVenta`.
- Subpantallas construidas: Ajuste de Venta, Registrar Pago.
- Acción: `fichaVenta`.

**Ajuste de Venta** `[x]` (modal — nunca edita la venta original). Banner de auditoría, motivo en `Textarea`.
- Campos: `tipo` (`correccion`/`devolucion`/`descuento_posterior`/`anulacion_total`), `montoAjuste`, `productoId?`, `cantidadProductoAjustada?` (dispara devolución de stock real), `motivo` (obligatorio). **No implementado todavía:** `generaPagoNegativo?` (solo con `tipo=devolucion` + `metodoPagoId`) — el schema lo acepta, la UI no lo expone.
- Acción: `registrarAjusteVenta`.

**Registrar Pago de Venta** `[x]` (modal, para ventas a crédito/parciales). Monto prellenado con el saldo pendiente, fecha de pago, métodos como cards con ícono.
- Campos: `monto`, `metodoPagoId`, `fechaPago`. Salida: `estadoPago` (transición pendiente→parcial→pagado).
- Acción: `registrarPagoVenta`.

### `/app` — Catálogos de Ventas
**Gestión de Clientes.** `[x]` — listado propio en `/app/ventas/clientes` (buscador + lista tipo fila con "última compra" derivada, paginación client-side), alta/edición vía Dialog (react-hook-form + zod, `clienteFormSchema` extendido con `email`), eliminar (soft delete) con confirmación inline. Verificado end-to-end en navegador (alta, edición, eliminación, búsqueda) contra el tenant de prueba.
- Campos: `nombre`, `telefono`, `email`, `primeraCompraEn`/`ultimaCompraEn` (derivados). Acciones: `crearCliente`, `actualizarCliente`, `eliminarCliente`, `listarClientes`.

**Gestión de Canales de Venta.** `[x]` — listado propio en `/app/ventas/canales`, grid de cards (design-system §5.3) con `Switch` de `activo` inline, alta/edición de `nombre`/`porcentajeComisionDefault` vía Dialog, eliminar (soft delete) con confirmación inline. Verificado end-to-end en navegador contra el tenant de prueba.
- Campos: `nombre`, `porcentajeComisionDefault`, `activo`.

**Gestión de Métodos de Pago.** `[x]` — listado propio en `/app/ventas/metodos-pago`, filas simples (ícono + nombre + `Switch` de `activo`), alta/edición de `nombre` vía Dialog. Sin eliminar (sin soft delete por diseño — la baja es el booleano `activo`, `reactivarMetodoPago` agregado como simétrico de `desactivarMetodoPago`). Verificado end-to-end en navegador.
- Campos: `nombre`, `activo`.

**Gestión de Eventos** `[x]` (ferias/pop-ups) — listado propio en `/app/ventas/eventos`, filas con nombre/sucursal/canal, fechas, comisión, badge de estado y botón Cerrar/Reabrir según corresponda. Alta vía Dialog (sucursal + canal con precarga automática de `porcentajeComisionDefault` del canal elegido + fechas). Gateado por la capacidad especial `gestionar_eventos` (sin bypass de Owner, por diseño) — el error de "no tenés la capacidad" se muestra inline si falta. **No implementado:** editar comisión de un evento ya abierto (la acción `actualizarComisionEvento` existe en el módulo pero no tiene UI en esta tanda, no era parte de los campos mínimos de la referencia). Verificado end-to-end en navegador (alta, cerrar, reabrir) otorgando la capacidad temporalmente vía script de QA.
- Campos: `sucursalId`, `canalVentaId`, `nombre`, `porcentajeComision` (precargado del canal, editable), `fechaInicio`/`fechaFin`, `estado` (`abierto`/`cerrado`), `cerradoPor`/`cerradoEn`.
- ⚠️ El doc menciona un "modo de cierre agregado" (cargar el total vendido de una sola vez al cerrar) — no existe acción dedicada, hoy se resolvería con múltiples `registrarVenta`. Sigue sin implementar.
- Rol: capacidad especial `gestionar_eventos` para abrir/editar/cerrar/reabrir.
- Acciones: `abrirEvento`, `actualizarComisionEvento`, `cerrarEvento`, `reabrirEvento`, `listarEventos`.

### `/app` — Importación de Venta Histórica
**Importación de Venta Histórica** `[x]` — pantalla en `/app/ventas/importar`: dropzone de archivo
`.csv` (parser propio, sin librería nueva) con encabezado fijo
`fecha,canal,producto,cantidad,precioVenta,costoUnitario,cliente` (sin UI de mapeo interactivo de
columnas — decisión de esta tanda, ver `ventas/ANCLA.md`). Vista previa resuelve
`canal`/`producto`/`cliente` por nombre contra los ya cargados del tenant, marca filas inválidas
con motivo explícito, pide una sucursal para todo el lote, y "Confirmar importación" dispara una
`Venta` de una sola línea por fila válida (nuevo wrapper de lote
`importarVentaHistoricaLoteAction` en la ruta, itera una llamada a `importarVentaHistorica` por
fila) mostrando un resumen de importadas/errores. Verificado end-to-end simulando una carga real
de archivo (2 filas válidas + 1 con error de canal inexistente, detectado correctamente).
**Bug real encontrado y corregido en esta pantalla** (afecta también a `registrarVenta`): una
`fechaVenta` de solo-día (`"YYYY-MM-DD"`, típica de este flujo) se anclaba a medianoche UTC,
corriendo un día hacia atrás al mostrarse en husos horarios detrás de UTC — incluida Bolivia
(UTC-4), el mercado real del producto. Corregido anclando a mediodía UTC
(`parsearFechaVentaSoloFecha` en `ventas/actions.ts`) — ver detalle en `ventas/ANCLA.md`.
- Campos de entrada: `sucursalId`, `clienteId?`, `fechaVenta`, `canalVentaId`, `lineas[]` (`productoId`, `cantidad`, `precioVentaSnapshot`, `costoUnitarioSnapshot`).
- No descuenta stock, no calcula comisión — snapshots vienen directo del input.
- Rol: Owner (bypass explícito) o capacidad especial `importar_historico`.
- Acción: `importarVentaHistorica`.

---

## 8. Egresos y Gastos

> **Módulo completo — tanda cerrada 2026-07-17 (6/6).** Sin gaps de backend (confirmado antes de
> construir). Detalle completo: `src/modules/gastos/ANCLA.md`.

### `/app` — Gastos (Owner + permiso `"costos_gastos"`)
**Listado de Gastos** `[x]` — `/app/gastos`, lista de filas con 3 filtros por `Select`
(Categoría/Tipo de Gasto/Estado de Pago, client-side) + "Limpiar filtros", paginación "Cargar más"
(client-side, de a 10). Badge de origen ("Manual"/"Automático") visible por fila. Verificado
end-to-end.
- Campos: `sucursalId`, `tipo` (`fijo`/`variable_no_productivo`/`unico`), `categoriaId`, `monto`, `fechaGasto`, `proveedorId`, `origen` (`manual`/`comision_venta_automatica`/`cuota_pasivo_automatica`), `estadoPago` (derivado), `referenciaId`, `descripcion`.
- ⚠️ `listarGastos` no acepta filtros de servidor — se aplican en cliente (documentado, no es un gap; el volumen esperado no lo justifica todavía).
- Acción: `listarGastos`.

**Ficha de Gasto.** `[x]` — `/app/gastos/[id]`, stat card (monto/categoría/fecha/estado) + banner de
"Gasto automático" cuando `origen≠manual` (regla 3.2 del módulo — bloquea Editar/Eliminar/
Registrar pago de verdad, no solo visualmente: los botones no se renderizan y la ruta de Editar
redirige si se entra por URL directa). Historial de pagos con total pagado. Verificado end-to-end.
- Campos: gasto completo + `pagos[]`.
- Subpantallas: "Editar" y "Registrar pago" solo visibles si `origen=manual` (los automáticos nacen ya pagados).
- Acción: `fichaGasto`.

**Alta de Gasto Manual** `[x]` y **Editar Gasto Manual** `[x]` — mismo componente compartido
(`GastoForm`, `src/components/shared/gasto-form.tsx`). Tipo de Gasto como 3 cards seleccionables
(con descripción, igual que la referencia); bloqueado en modo Editar porque `actualizarGastoManual`
no acepta cambiar `tipo`. Sin campo de Sucursal en el formulario (opcional en el contrato, omitido
de la referencia — mismo criterio que otros campos opcionales sin UI día uno en el resto del app).
Verificado end-to-end (alta, edición, eliminación).
- Campos: `sucursalId?`, `tipo`, `categoriaId`, `monto`, `fechaGasto`, `proveedorId?`, `descripcion?`.
- Acciones: `crearGastoManual` / `actualizarGastoManual` (rechaza si `origen≠manual` o si el nuevo monto queda por debajo de lo ya pagado) / `eliminarGastoManual` (soft, rechaza si `origen≠manual`).

**Registrar Pago de Gasto** `[x]` (modal, disparado desde la Ficha) — mismo patrón visual que
Registrar pago de Pasivo/Compra: resumen "Saldo actual / Pago a registrar / Saldo después" en
vivo. El saldo ya lo trae `fichaGasto()` (no hace falta una consulta aparte tipo
`consultarSaldoCompra`, a diferencia de Compras donde el Listado no traía el dato). Verificado
end-to-end.
- Campos: `monto`, `fechaPago`. Acción: `registrarPagoGasto`.

**Gestión de Gastos Recurrentes** `[x]` — `/app/gastos/recurrentes`, stat strip (Plantillas
activas/Proyección mensual/Próximos 7 días) + grid de cards con `Switch` de `activo` (una sola
dirección: `desactivarGastoRecurrente` existe, no hay "reactivar" en el contrato, así que el
Switch queda bloqueado una vez pausado — no se inventó una acción nueva) y botón "Generar gasto"
por plantilla. "Próx. fecha" y "Proyección mensual" son cálculos puros de cliente por aritmética
de calendario simple desde `fechaInicio` — el módulo no tiene scheduler ni esas funciones
(ANCLA.md ya documentaba "sin scheduler real"), es solo previsualización, cada gasto se sigue
generando a mano. Verificado end-to-end (alta de plantilla, generación manual, desactivación).
- Campos: `sucursalId?`, `categoriaId`, `monto`, `frecuencia` (`mensual`/`semanal`/`quincenal`/`anual`), `fechaInicio`, `fechaFin?`, `activo`.
- ⚠️ Sin scheduler automático — cada gasto del período se dispara a mano con el botón "Generar gasto de este período".
- Acciones: `crearGastoRecurrente`, `actualizarGastoRecurrente`, `desactivarGastoRecurrente`, `listarGastosRecurrentes`, `generarGastoDesdeRecurrente`.

**Gestión de Categorías de Gasto.** `[x]` — mismo patrón `Dialog` que "Gestionar categorías" de
Productos (`src/app/app/(shell)/productos/gestionar-categorias-dialog.tsx`), disparado desde el
Listado de Gastos y también desde el Alta de Gasto ("+ Crear nueva" junto al select de Categoría,
misma instancia del Dialog). Única diferencia con el de Productos: selector opcional de categoría
sugerida al crear (oculto si el catálogo global todavía está vacío, que es el caso hoy — sin
seed). Verificado end-to-end.
- Campos: `nombre`, `categoriaGastoSugeridaId`. Subpantalla: picker de sugeridas (globales + por nicho).
- Nota: `sembrarCategoriasGastoDefault(tenantId)` precarga el set default — útil como botón "Cargar categorías sugeridas" hasta que exista onboarding automático. Sigue sin consumirse en UI (no era parte de esta tanda).
- La administración del catálogo global de sugerencias vive en `/admin`.

**Nota — sin pantalla propia:** `generarGastoCuotaPasivo` y `generarGastoComisionVenta` son funciones automáticas disparadas desde otros módulos (botón "Generar gasto" en la ficha del Pasivo en Patrimonio, y en la Ficha de Venta en Ventas respectivamente) — no se diseña una pantalla para ellas dentro de Egresos y Gastos. Ambas requieren `categoriaId` como parámetro obligatorio, así que esos botones necesitan un selector de categoría en el momento de dispararse.

---

## 9. Financiero

Sin tablas propias — capa de agregación pura sobre Ventas, Gastos y Proveedores. Todas las pantallas en `/app`, gateadas por permiso `"financiero"` × `ver`.

**Flujo de Caja** `[x]` — caja real (`Pago de Venta − Pago de Compra − Pago de Gasto`, por fecha de pago). Resuelto: vive como widget en Reportes (Dashboard Sección A y Resumen Financiero Sección B), no como ruta propia de Financiero — ver nota de diseño abajo.
- Campos: `flujoCaja`, `pagosVenta`, `pagosCompra`, `pagosGasto`. Filtros: período + sucursal opcional.
- Acción: `flujoCaja(solicitante, tenantId, periodo, { sucursalId? })`.

**Estado de Resultados** `[x]` — resultado devengado (ingresos − COGS − gastos ± ajustes), por fecha de ocurrencia económica. Resuelto: vista formal en Reportes → Resumen Financiero (`/app/reportes`), mismo criterio que Flujo de Caja.
- Campos: `estadoResultados`, `ingresos`, `costos`, `gastos`, `ajustesVenta`.
- Acción: `estadoResultados(solicitante, tenantId, periodo, { sucursalId? })`.
- **Nota de diseño:** Reportes (Módulo 14) re-expone literalmente estas dos mismas funciones para su propio Dashboard y para Resumen Financiero — decisión tomada: viven como widgets/vistas dentro de Reportes, no como pantallas propias separadas de Financiero (evita duplicar la misma UI en dos rutas).

**Margen por Producto.** `[x]` — resuelto como pantalla dentro de Simulaciones (`/app/simulaciones/margen-producto`), no ruta propia de Financiero (mismo criterio que Flujo de Caja/Estado de Resultados arriba: no duplicar UI en dos módulos).
- Campos: `margenPorcentaje` (nullable si no hubo ingresos), `ingresosAjustados`, `costos`. Selector de producto + período, 3 KPI cards reutilizando el patrón visual del Dashboard/Simulador.
- Acción: `margenPorProducto(solicitante, tenantId, productoId, periodo)`.
- **Módulo Financiero completo: 3/3 — sin ruta propia, sus 3 pantallas viven repartidas entre Reportes y Simulaciones.**

**`costoFijoTotal` — confirmado: NO tiene pantalla propia en `/app`.** Sus 3 consumidores reales son: Simulaciones → Punto de Equilibrio (Módulo 13), y el "Detalle Financiero" empaquetado tanto en `/portal` (Monitoreo Institucional) como en `/admin` (Panel Admin CEOM) — ver Módulo 11.

---

## 10. Gateway de Consentimiento

Unidad de concesión = **módulo veedor** (`financiero`/`operativo`/`inventario_operativo`), nunca por función individual (decisión confirmada, ver `CEOM_Arquitectura.md` §8.1). **Módulo completo, 9/9 pantallas — cerrado el 2026-07-17.**

### `/app` (Owner del tenant)
**Generar Código de Acceso.** `[x]` (`/app/consentimiento`, con mockup)
- Checklist de los 3 módulos veedor con badge Disponible/Deshabilitado según `plan.modulosVeedorPermitidos` del tenant (fetch server-side de `obtenerTenantPorId` + `obtenerPlanPorId`, sin route propia previa).
- Salida: `codigoAccesoId`, `codigo` (mostrado en un panel navy con botón copiar).
- Acción: `generarCodigoAcceso(solicitante, tenantId, { modulosHabilitados })`.

**Códigos de Acceso generados** `[x]` (`/app/consentimiento/codigos`, sin mockup — lista + revocar con confirmación inline, mismo patrón que Canales de Venta).
- Campos: `modulosHabilitados`, `codigo`, `estado` (`activo`/`canjeado`/`revocado`), `creadoEn`, `institucionId?` (null hasta canjear), `canjeadoEn?`, `revocadoEn?`.
- Acciones: `listarCodigosAcceso`, `revocarCodigoAcceso` (también corta el acceso ya otorgado si el código ya se había canjeado — **verificado en navegador con `tieneConsentimiento()` llamado directo, antes/después: `true`→`false` de inmediato**).

**Aprobaciones/Consentimientos vigentes** `[x]` (`/app/consentimiento/aprobaciones`, sin mockup).
- Campos: `institucionId` (resuelto a nombre vía `obtenerInstitucionPorId`, nueva — ver abajo), `modulosAprobados`, `aprobadoPor`, `fechaAprobacion`, `revocadoEn`, `codigoAccesoId?`.
- "Vigente" se calcula server-side igual que `tieneConsentimiento()`: la fila más reciente por institución sin `revocadoEn` es "Vigente"; una fila más vieja sin revocar queda "Histórica" (superada), nunca "Vigente" — verificado con 2 aprobaciones para la misma institución.
- Acciones: `consultarAprobacionesPorTenant`, `revocarConsentimiento` (revocación inmediata — **verificado con `tieneConsentimiento()` antes/después: `true`→`false`**).

**Solicitudes de Seguimiento entrantes** `[x]` (`/app/consentimiento/solicitudes`, sin mockup).
- Campos: `institucionId` (resuelto a nombre), `modulosSolicitados`, `estado` (`pendiente`/`aprobada`/`rechazada`). Pendientes arriba con Aprobar/Rechazar, resueltas abajo como historial.
- Aprobar abre un Dialog con checklist precargado con `modulosSolicitados` — el Owner puede destildar pero nunca agregar módulos fuera de lo pedido (checklist solo itera sobre `solicitud.modulosSolicitados`).
- Acciones: `listarSolicitudesPorTenant`, `aprobarSolicitud`/`rechazarSolicitud` — **verificado end-to-end: solicitud creada desde `/admin`, aprobada desde `/app`, y `tieneConsentimiento()` confirmó el módulo aprobado real (`financiero: true`, `operativo: false` — coincide exacto con lo solicitado/aprobado, no con lo pedido originalmente si eran distintos)**.

### `/portal` (Institución, sin cuenta CEOM)
**Canjear Código de Acceso** `[x]` (`/portal`, con mockup) — única puerta de entrada, superficie completamente nueva (sin `layout.tsx` de auth — pública a propósito, mismo criterio que `canjearCodigoAcceso()` sin `solicitante`). Reusa el layout split-screen del login (panel navy + card).
- Wizard de 2 pasos: código primero; alta mínima (`nombre`, `tipo`, `email`, `contacto?`) solo si hace falta — no existe lookup de código sin canjear, así que la validación real ocurre recién al confirmar el alta.
- ✅ **Gap de backend cerrado el 2026-07-18:** `email` ya se captura en la alta mínima y se persiste en `instituciones`. Habilita el magic link de reingreso — ver pantalla siguiente y `CEOM_Arquitectura.md` §8.3.
- Campos de entrada: `codigo`, `institucionId` (si ya existe) o `institucionNueva` (incluye `email`, obligatorio en este wizard aunque el campo del modelo es nullable a nivel de `DatosInstitucion`).
- Acción: `canjearCodigoAcceso({ codigo, institucionId?, institucionNueva? })` — sin `solicitante`, a propósito. Tras canjear, la pantalla confirma el acceso otorgado y aclara que el panel de seguimiento (Mi Cartera) todavía no existe — **verificado end-to-end: múltiples canjes reales, todos crearon la Institución y la Aprobación correctamente**.
- **Reingreso por magic link (2026-07-18, mismo `/portal`, toggle "¿Ya tenés acceso?" — no ruta propia):**
  la Institución pide un enlace por `email` (`solicitarMagicLinkInstitucionAction` →
  `solicitarMagicLinkInstitucion`, mensaje siempre genérico, nunca crea un `auth.users` huérfano),
  lo recibe por correo real, y al hacer click cae en `src/app/portal/auth/callback/route.ts`
  (primer Route Handler del proyecto) que resuelve el vínculo perezoso `email ↔ auth_user_id` y
  redirige a `/portal`, que muestra el estado logueado vía `obtenerInstitucionActual()`. **Verificado
  con un click real de correo (Gmail)** — no solo simulado. Decisión de arquitectura completa (por
  qué Institución no es un Usuario de tenant) en `CEOM_Arquitectura.md` §8.3, detalle de
  implementación en `src/modules/consentimiento/ANCLA.md`.

### `/admin` (ceom_admin)
**CRUD de Instituciones.** `[x]` (`/admin/instituciones`, con mockup — maestro-detalle, primera vez que `/admin` tiene un shell real con sidebar, ver `admin-shell.tsx`).
- Campos: `nombre`, `tipo` (`universidad`/`incubadora`/`organizacion`), `contacto?`, `creadoPor`, `creadoEn`, `eliminadoEn` (soft delete). Tab "Configuración" del mockup omitida — no hay campo/acción real detrás.
- Acciones: `crearInstitucion`, `actualizarInstitucion`, `eliminarInstitucion` (**verificado en navegador — soft delete confirmado**), `listarInstituciones`.
- ✅ **Gap de seguridad cerrado el 2026-07-17:** `listarInstituciones` ahora exige `SolicitanteCeomAdmin` (mismo patrón `requiereCeomAdmin()` que el resto de las acciones de `/admin` en este módulo) — cerrado antes de construir la pantalla que la consume, no se dejó para la auditoría de Fase 3.
- **Adenda de backend agregada en esta tanda:** `obtenerInstitucionPorId(institucionId)` (sin gate, catálogo público de solo lectura por 1 registro — mismo criterio RLS que `listarInstituciones` original, ver ANCLA) — hacía falta para que el Owner (no ceom_admin) resuelva nombres de institución en Aprobaciones/Solicitudes sin exponerle el listado completo.

**Gestión de Cartera Institucional.** `[x]` (tab "Cartera" dentro de la Ficha de Institución, tal como mostraba el mockup — no ruta propia).
- Campos: `institucionId`, `tenantId`, `cohorte?`, `fechaInicio`, `fechaFin?`, `eliminadoEn`.
- Acciones: `agregarTenantACartera` ("Vincular Tenant", Dialog), `quitarDeCartera`, `listarCarteraPorInstitucion` — **verificado end-to-end contra el tenant de prueba real (auto-poblada al canjear un código, y vía Vincular Tenant manual)**.

**Crear Solicitud de Seguimiento** `[x]` (botón "Nueva Solicitud" dentro del tab Cartera, Dialog — no pantalla propia; el tenant se elige entre los ya vinculados a esa cartera).
- Confirmado por el gate del código: CEOM registra el pedido de una institución pre-registrada, eligiendo qué módulos solicita; el Owner del tenant decide qué aprueba desde `/app`.
- Campos: `institucionId`, `tenantId`, `modulosSolicitados`.
- Acción: `crearSolicitudSeguimiento` — **verificado end-to-end (ver Solicitudes entrantes arriba)**.

**Logs de Acceso** `[x]` (`/admin/logs`, sin mockup — filtro de tenant + rango de fechas).
- Campos: `usuarioCeomId` (mostrado truncado — sin `listarUsuarios()` todavía, gap ya documentado de Identidad, fuera de esta tanda), `tenantId` (resuelto a nombre), `moduloConsultado`, `creadoEn`. Filtrable por tenant/rango de fechas.
- Acción: `listarLogsAcceso` — verificado en navegador (vacío porque ningún flujo de esta tanda dispara `registrarAccesoAdminCeom`, eso lo llama Panel Admin CEOM, módulo aparte).

---

## 11. Monitoreo Institucional + Panel Admin CEOM

### `/portal` (Institución, después de loguearse)
**Mi Cartera.** `[x]` (`/portal`, con mockup)
- Campos: `tenantId`, `cohorte` (o fecha de inicio formateada si no hay cohorte cargada), `fechaInicio`, `fechaFin`, `nombreNegocio`, `nichoId`, `planId` (resuelto a nombre vía `listarPlanes`), `estadoAcceso`. 4 cards de KPI (total/activos/solo lectura/bloqueados) derivadas en cliente, búsqueda por nombre.
- **Corrección de scope frente al mockup de referencia:** el mockup traía un botón "+Nuevo" y sugería checklist de onboarding/actividad reciente/alertas de inactividad — ninguno de los tres existe en el backend (`listarCartera()` no los expone, y una Institución no tiene acción para dar de alta un tenant), así que no se construyeron. Si se quieren más adelante, son gaps de backend a abrir aparte.
- No requiere módulo veedor aprobado (es metadato de la relación, no dato de negocio).
- Acciones: `listarCartera`, `estadoTenant` (ficha básica de un tenant puntual).

**Por cada tenant de la cartera — 4 tabs, cada uno gateado individualmente vía `tieneConsentimiento()`:** `[x]` los 4 (`/portal/cartera/[tenantId]`, con mockup — **una sola pantalla con tabs de cliente**, no rutas separadas, mismo criterio ya usado en Simulaciones y en la Ficha de Tenant de `/admin`).

1. **Tendencia de Ventas** (gateada bajo módulo veedor `"financiero"`). Campos: `{ autorizado, detalle: { ingresos } }`. Acción: `tendenciaVentas`.
2. **Detalle Financiero** (si `financiero` aprobado). Campos: `flujoCaja`, `estadoResultados`, `costoFijoTotal`. Acción: `detalleFinanciero`.
3. **Detalle Operativo** (si `operativo` aprobado). Campos: `producciones` (fecha + cantidad obtenida — sin nombre de producto, `productoId` es un uuid sin resolver a nombre en la respuesta veedor-segura), `mermaCostoTotal`. Acción: `detalleOperativo`. Pendiente documentado: `consultarCapacidadProduccionUsada` queda fuera (falta un `activoId` veedor-seguro).
4. **Detalle de Inventario Operativo** (si `inventario_operativo` aprobado). Campos: `insumos` (catálogo + costo vigente). Acción: `detalleInventarioOperativo`. Pendiente documentado: `consultarStockInsumo` queda fuera (falta `insumoId`+`sucursalId` veedor-seguros).
- Selector de período compartido (los 4 presets de Reportes/Dashboard, `periodo-presets.ts`) para Ventas/Financiero/Operativo — Inventario Operativo no lo usa (su acción no recibe período).

**Regla de privacidad central (no es un detalle menor) — implementada así:** las 4 funciones devuelven siempre `{ autorizado: true, detalle } | { autorizado: false }` — nunca datos parciales. **Decisión de UI tomada:** los 4 tabs se muestran siempre (set fijo, nunca se ocultan), pero el tab de un módulo no aprobado se ve con ícono de candado y, al abrirlo, muestra un estado "No autorizado" explícito ("Este tenant no aprobó el módulo X para tu institución todavía") — nunca una tabla vacía ni un tab oculto, para no confundir "sin permiso" con "sin datos". **Verificado en vivo** (2026-07-18): revocando el consentimiento de Financiero desde `/app/consentimiento/aprobaciones` mientras la Institución tenía la Ficha de Tenant abierta, al recargar el tab pasó correctamente a candado/"No autorizado" — detalle completo en `monitoreo-institucional/ANCLA.md`.

### `/admin` (ceom_admin)
**Listado de tenants con salud agregada.** `[x]` (`/admin/tenants`, sin mockup — reusa el patrón de KPIs+búsqueda de Mi Cartera)
- Campos agregados: `totalTenants`, `porEstadoAcceso`, `porPlan`, `porNicho` (`saludAgregadaPlataforma`) + tabla fila-por-fila de `listarTenants` (Identidad) para navegar a cada ficha.
- **Alcance real de "salud":** solo estos 4 agregados — `% onboarding completado` y `% retención` (mencionados en Módulo_11 sección 2.2 como visión del módulo) **no están implementados**, decisión ya confirmada en `panel-admin-ceom/ANCLA.md` (no hay checklist de onboarding ni definición de retención en el proyecto todavía).
- No dispara `registrarAccesoAdminCeom` (es consulta cross-tenant, no de un tenant puntual).

**Ficha de Tenant** `[x]` (`/admin/tenants/[tenantId]`, sin mockup) — detalle básico (nombre, ciudad, moneda, estado de suscripción/acceso, fechas de suscripción) + tabs.
- Acción: `consultarTenantDetalle`. Nota: esta consulta específica **no** queda logueada en `LogAccesoAdminCEOM` ("identidad" no es un valor de `moduloPermisoEnum` — pendiente documentado desde Módulo 10).

**Subpantallas/tabs de la Ficha de Tenant — 3 lecturas veedor-seguras, SÍ logueadas:** `[x]` las 3, mismo selector de período compartido que `/portal` (Inventario Operativo sin período).
1. **Financiero** — `flujoCaja`, `estadoResultados`, `costoFijoTotal`. Acción: `consultarFinancieroTenant` (loguea `moduloConsultado: "financiero"`).
2. **Operativo** — `producciones`, `mermaCostoTotal`. Acción: `consultarOperativoTenant` (loguea `"operativo"`).
3. **Inventario Operativo** — `insumos`. Acción: `consultarInventarioOperativoTenant` (loguea también `"operativo"`, no un valor separado — `moduloPermisoEnum` de Identidad no distingue insumos de producción, solo el `moduloVeedorEnum` del Gateway lo hace; importante para no confundir al leer la pantalla de Logs de Acceso).

`ceom_admin` no pasa por `tieneConsentimiento()` en ninguna de estas — su acceso está cubierto por Términos de Servicio, solo queda trazado, nunca bloqueado. Sin candado/"no autorizado" en esta superficie — a propósito, es la diferencia real entre `/portal` (consentimiento explícito) y `/admin` (ToS).

---

## 12. Módulo Operativo — Nicho 4 (Comercio Minorista y Distribución)

Sin entidades propias — Landed Cost y Orden de Compra viven en `Compra` (Módulo 4, ya cubierto arriba). Lo único específico de Nicho 4 es un widget de solo lectura.

**Widget: Capacidad de Almacenamiento Usada** `[x]` (2026-07-20) — embebido como una card más del
Dashboard/Home (`src/app/app/(shell)/dashboard-resumen.tsx`), junto a "Merma registrada" —
**no es una sección de navegación propia**, confirmado sin gap de backend antes de construir.
- Campos: `capacidadAlmacenamientoCantidad` (de Patrimonio), `stockActualTotal` (de Productos),
  `porcentajeUsado` (`null` si el activo no tiene capacidad definida — `×100` en la UI, la función
  devuelve el ratio 0..1, no el porcentaje). Mismo patrón visual de barra de progreso que "Capacidad
  Operativa" de Nicho 1 (`produccion/capacidad/capacidad-cliente.tsx`).
- `activoId`/`sucursalId` no los elige el usuario (es un widget, no una página con Select): el
  server (`obtenerCapacidadAlmacenamientoWidget()`, nuevo en `inicio-actions.ts`) elige el primer
  Activo activo (no dado de baja) con `capacidadAlmacenamientoCantidad` definida — si ninguno la
  tiene definida, usa el primero igual (así el widget puede mostrar "sin capacidad definida" en vez
  de desaparecer); la sucursal es la marcada `esPrincipal`. Si el tenant no tiene ningún Activo
  activo, el widget no se renderiza (`null`, mismo criterio que el `EmptyState` de Nicho 1).
- **No se gatea por `tenant.nichoId === "nicho_4"`** — mismo criterio que el resto de la app
  (`app-shell.tsx` no oculta nav por nicho; Modo Básico es un estado permanente válido). Cualquier
  tenant con un Activo con capacidad de almacenamiento cargada ve el widget, sea cual sea su nicho.
- **Verificado en navegador los 3 estados reales** (2026-07-20): con datos reales (stock/capacidad
  → barra + %), con `capacidadAlmacenamientoCantidad = null` (mensaje "Sin capacidad definida —
  cargala desde la Ficha del Activo en Patrimonio"), y sin ningún Activo activo (widget ausente).
- Rol: permiso `"operativo"` × `ver`.
- Acción: `consultarCapacidadAlmacenamientoUsada(solicitante, tenantId, activoId, sucursalId)` — ya
  existía, sin cambios; nueva la composición `obtenerCapacidadAlmacenamientoWidget()`.

---

## 13. Simulaciones

Todas las pantallas en `/app` (route group `simulaciones/`), gateadas por permiso `"simulaciones"` — módulo completo, 5/5.

**Simular Precio.** `[x]` (`/app/simulaciones`, con mockup)
- Auto-mostrado al elegir producto (`obtenerDatosPreviaAction`, de solo lectura — a propósito NO llama `simularPrecio`, que persiste un registro cada vez que se invoca): `rotacionPeriodo`, `margenActualPct`, `costoUsado` (cuando no es manual).
- Campos de entrada: `productoId` (grid de cards, ícono genérico — sin "código" porque ese campo no existe en el schema de Productos), `frecuencia` (`semanal`/`mensual`), `periodo` (reusa los 4 presets ya validados de Reportes/Dashboard, no un selector de mes libre), `margenDeseadoPct`, `costoManual?` (toggle "Ajustar manualmente" ↔ "Usar automático", override puntual — costo automático por defecto, nunca manual por defecto). El panel "Proyección de Precio" se recalcula en cliente con fórmulas puras duplicadas (mismo criterio que el wizard de Producción) — recién "Guardar simulación" llama a la Server Action que persiste.
- Salida: `simulacionId`, `costoUsado`, `costoEsManual`, `precioVentaActual`, `margenActualPct`, `rotacionPeriodo`, `precioSugerido`, `impactoProyectadoBs` (`null` si `rotacionPeriodo=0` — caso borde 1, verificado en navegador).
- Acción: `simularPrecio`. Rol: `simulaciones` × `crear`.

**Punto de Equilibrio.** `[x]` (misma pantalla, tab interna — sin mockup propio, mismo lenguaje visual)
- Campos de entrada: `productoId`, `frecuencia`, `periodo` (compartidos con la tab de Simular Precio).
- Salida: `costoFijoTotalPeriodo`, `costoVariableUnitario`, `precioVenta`, `margenContribucionUnitario`, `puntoEquilibrioUnidades` (`number | null`), `advertencia` (banner ámbar si el margen de contribución es ≤ 0 — caso borde 2). Caso borde 3 (costo fijo en 0 → 0 unidades) verificado en navegador contra datos reales, sin código especial.
- Acción: `calcularPuntoEquilibrio`. Rol: `simulaciones` × `crear`.

**Comparativo Multi-SKU.** `[x]` (`/app/simulaciones/comparativo`, con mockup)
- Cabecera: `umbralMargenAlertaPct`, `margenPromedioCatalogo` (`null` si ningún producto tiene costo cargado).
- Por fila: `productoId`, `nombre`, `costo` (`null` excluye del promedio/alerta), `precioVenta`, `margenPct`, `precioSugerido` (calculado contra el margen promedio del catálogo), `alerta` (boolean, fila resaltada en ámbar). Sin botón "Exportar Reporte" del mockup — no hay backend para exportación en este módulo (mismo criterio que Reportes).
- Acción: `comparativoMultiSku`. Rol: `simulaciones` × `ver`.

**Configuración de umbral de alerta** `[x]` — resuelto exactamente como estaba anotado: Dialog lanzado desde el pill "Umbral de alerta: X%" del Comparativo, no pantalla propia.
- Campo: `umbralMargenAlertaPct` (default `15` en memoria si el tenant nunca configuró nada).
- Acciones: `obtenerConfiguracion` (ver) / `actualizarUmbralAlerta` (editar). Verificado en navegador: edición persiste y la tabla se re-resalta con el nuevo umbral.

**Historial de Simulaciones.** `[x]` (`/app/simulaciones/historial`, sin mockup — mismo patrón de lista que Historial de Ventas/Pasivos)
- Campos: `productoId`, `tipo` (`simular_precio`/`punto_equilibrio`), `frecuencia`, `periodo`, `margenDeseadoPct`, `costoUsado`, `costoEsManual` (badge "Costo manual"), `precioSugerido`/`impactoProyectadoBs` o `puntoEquilibrioUnidades` según tipo, `creadoPor`, `creadoEn`. Filtro por producto. Sin `eliminadoEn` — se acumula, no se corrige (sin acción de borrado en la UI, por diseño del módulo, mismo criterio que Producción/GastoRecurrente).
- Acción: `listarSimulaciones(solicitante, tenantId, productoId?)`. Rol: `simulaciones` × `ver`.

---

## 14. Reportes y Dashboard

Cero tablas propias, cero lógica de negocio propia — es composición de funciones ya expuestas por Ventas, Financiero, Gastos y Operativo. **Es el punto de entrada por defecto de `/app` al iniciar sesión — Sección A ya construida** (`src/app/app/(shell)/dashboard-resumen.tsx` + `inicio-actions.ts`), reemplaza el placeholder anterior en cuanto el checklist de sub-onboarding se apaga.

Estructura implementada: **una sola pantalla con 2 secciones**, no 8 pantallas separadas (tal como estaba propuesto).

**Filtro global implementado:** selector de período (4 presets calculados en cliente: Hoy/Últimos 7 días/Este mes/Este año — sin backend de rangos custom) + sucursal opcional/consolidado. Confirmado en la implementación: el filtro de sucursal solo afecta `resumenPeriodo`/`flujoCaja` — `rankingProductos`/`distribucionGastos`/`controlMerma` no reciben `sucursalId` en su firma real (limitación de backend, no de la pantalla — ver `reportes/ANCLA.md`).

**Gráficas nuevas agregadas sobre lo documentado** (paleta categórica validada con la skill de dataviz, primera vez que la app necesita una — ver `dashboard-resumen.tsx`): barras horizontales Ingresos/Costos/Gastos en Resumen del Período, barra de 2 segmentos Entradas/Salidas en Flujo de Caja, barras por fila en Productos más vendidos, dona SVG en Gastos por categoría (sin librería, no hay ninguna instalada). Misma paleta reutilizada en Sección B para Histórico de Ventas (`COLOR_REGULAR`/`COLOR_EVENTO`).

**Botón "Ver reportes detallados" conectado** — navega a `/app/reportes` (Sección B, abajo), ya construida completa.

### Sección A — Resumen Ejecutivo (visible al entrar, sin acción del usuario) — `[x]` construida completa
1. **Resumen del Período** `[x]` (card destacada) — `estadoResultados`, `ingresos`, `costos`, `gastos`, `ajustesVenta`. Agrega delta real "% vs período anterior" (fetch adicional del período equivalente inmediatamente anterior). Acción: `resumenPeriodo` (delega en Financiero). Rol: `financiero` × `ver`.
2. **Flujo de Caja** `[x]` (card junto al resumen) — `flujoCaja`, `pagosVenta`, `pagosCompra`, `pagosGasto` (Salidas = `pagosCompra + pagosGasto` combinados, la referencia visual solo mostraba 2 líneas). Acción: `flujoCaja`. Rol: `financiero` × `ver`.
3. **Ranking de Productos** `[x]` (top 5, toggle rotación/margen — ambos criterios se pre-cargan juntos, el toggle es instantáneo sin round-trip nuevo) — `productoId`, `unidadesVendidas`, `ingresos`, `costos`, `margenPct`. Acción: `rankingProductos`. Rol: `ventas` × `ver`.
4. **Distribución de Gastos por Categoría** `[x]` (dona) — `categoriaId`, `total`. Estado vacío real implementado (tenant sin Gastos construido/cargado todavía). Acción: `distribucionGastos`. Rol: `costos_gastos` × `ver`.
5. **Control de Merma** `[x]` (card chica — 0 naturalmente en tenants sin producción, no error; texto distingue "0 real" de "hay merma, dentro del margen") — `mermaCostoTotal`, % contra `costos` del mismo período (derivado en la pantalla). Acción: `controlMerma` (delega en Nicho 1). Rol: `operativo` × `ver`.

### Sección B — Reportes Detallados (tab aparte, el usuario la abre a propósito, con sus propios filtros) — `[x]` construida completa
6. **Resumen Financiero / Estado de Resultados** `[x]` (`/app/reportes`, con mockup) — vista formal del Estado de Resultados (`FilaResultado` por línea + total "Utilidad real") + reuso del widget de Flujo de Caja del Dashboard + **Valor Patrimonial Total** embebido (cierra el pendiente de Patrimonio). Acción: `estadoResultados`, `flujoCaja`, `consultarValorPatrimonialTotal`.
7. **Histórico de Ventas** `[x]` (`/app/reportes/historico-ventas`, sin mockup — reusa literalmente el gráfico de barras del Dashboard) — bucketing día/mes según período, toggle "incluir eventos/ferias" (refetch real, no solo ocultar la serie) — `ventaId`, `fechaVenta`, `canalVentaId`, `eventoId?`, `montoTotal`. Acción: `historicoVentas`.
8. **Margen por Canal y Producto** `[x]` (`/app/reportes/margen-canal-producto`, con mockup) — tabla cruzada producto × canal, Total Ponderado/Promedio por Canal recalculados desde `ingresos`/`costos` crudos — `canalVentaId`, `productoId`, `ingresos`, `costos`, `margenPct`. Acción: `margenPorCanalYProducto`.
9. **Ranking de Productos — vista completa** `[x]` (`/app/reportes/ranking-productos`, sin mockup — reusa literalmente el widget de ranking horizontal del Dashboard) — misma acción que el widget 3, sin límite de N, con filtro de canal + toggle rotación/margen explícitos (ordenamiento verificado contra la respuesta real del servidor).

*(`distribucionGastos` y `controlMerma` reutilizan el mismo componente en ambas secciones con distinto tamaño — no se construyó una vista "detallada" separada dado lo compacto de sus campos, como estaba previsto.)*

**Exportación PDF/Excel:** confirmado fuera de alcance de esta fase (el propio módulo lo documenta) — no se propone pantalla/botón para esto todavía.

**Nota:** este inventario es exclusivamente la vista interna (`/app`). El Dashboard que ve una Institución en `/portal` es el de Monitoreo Institucional (Módulo 11) — compone únicamente los módulos veedor aprobados, nunca Ventas/Operativo sin consentimiento explícito.

---

## Resumen

### Conteo total
**117 pantallas/modales** trackeados en este documento (conteo fino), distribuidos en 14 módulos + Login, across 3 superficies:
- `/app` (Owner/Colaborador): la gran mayoría — el workspace operativo diario.
- `/admin` (ceom_admin): ~15 pantallas — gestión de tenants, planes, instituciones, logs. **Construido: Tenants (Alta + Listado con salud agregada + Ficha con 3 tabs y panel Cambiar Plan/Estado), Planes (CRUD completo), Instituciones, Logs.**
- `/portal` (Institución): ~6 pantallas — Canjear código, Mi Cartera, 4 tabs de detalle. **Construido completo (2026-07-18).**

### Las 5 pantallas más urgentes (flujo navegable de punta a punta) — **5 de 5 construidas ✅**
En este orden, porque cada una depende de la anterior para tener sentido:

1. **Login** `[x]` (con el redirect por rol resuelto) — bloqueante para absolutamente todo lo demás.
2. **Onboarding mínimo del Owner** `[x]` (Configurar negocio + Elegir rubro/nicho + checklist) — construido completo, gap de backend original ya cerrado.
3. **Catálogo + Ficha + Alta de Producto** `[x]` (Módulo 5) — construido completo, incluida gestión de categorías.
4. **Punto de Venta + Listado + Ficha de Venta** `[x]` (Módulo 7) — construido completo (el corazón del producto).
5. **Dashboard / Resumen Ejecutivo** `[x]` (Módulo 14, Sección A) — construido completo, cierra el loop.

Con estas 5, un tenant nuevo puede loguearse, elegir su rubro, cargar un producto, venderlo, y ver el resultado — el "camino dorado" mínimo del producto **ya está cerrado de punta a punta**. Verificado con datos de prueba reales (`pnpm seed:demo`, tenant `owner@ceom.local`).

### Lo que puede esperar
- Patrimonio, Proveedores, Gastos, Nicho 1 (Insumos/Recetas/Producción), Simulaciones — funcionalidad real e importante, pero no bloquean el camino dorado de arriba.
- Gestión de Tenants (`/admin`), "Mi Plan" (`/app`), el widget de Nicho 4, el Banner de estado del
  tenant, Vincular a proceso operativo y el Selector de Evento — las últimas tandas chicas
  pendientes, cerradas 2026-07-18/2026-07-20. `/admin` completo: Tenants, Planes, Instituciones,
  Logs.
- Exportación PDF/Excel de Reportes — explícitamente fuera de alcance, ya documentado en el propio módulo.

**No queda ningún ítem pendiente en el inventario — 117/117 `[x]`.**

### Gaps de backend encontrados durante este análisis (consolidado)
Ninguno de estos bloquea la Fase 1 (que sigue cerrada 14/14) — son necesarios recién cuando se implemente la pantalla correspondiente. **Los 3 marcados `resuelto` ya se cerraron durante la construcción de UI de esta sesión** — se dejan en la tabla para no perder el historial de qué gap habilitó qué pantalla:

**Nota (2026-07-20):** varias filas marcadas `pendiente` en tandas anteriores quedaron
desactualizadas — la pantalla que dependía de ellas ya se construyó en una tanda posterior y el gap
se cerró junto con esa UI, sin que esta tabla se actualizara en su momento. Verificado contra el
código real (no contra el historial) antes de corregir las marcas de abajo: `listarUsuarios`/
`listarRoles` (Identidad), `listarActivos`/`listarPasivos` (Patrimonio) y `listarCompras`
(Proveedores, wrapper de `listarComprasPorTenant`) **ya están expuestas** en sus `actions.ts`.

| Módulo | Gap | Bloquea | Estado |
|---|---|---|---|
| Identidad | Falta `listarUsuarios(tenantId)`, `listarRolesPorTenant(tenantId)` | Listado de colaboradores, listado de roles | **resuelto** (corregido 2026-07-20 — estaba desactualizado, ver nota arriba) |
| Identidad | Falta `actualizarTenant()`, y una acción para fijar `nichoId` (ej. `asignarNicho`) | Onboarding del Owner | **resuelto** |
| Identidad | Sin tracking persistido de progreso de onboarding | Checklist de bienvenida | **resuelto** (`onboarding_completado_en`) |
| Patrimonio | `listarActivos`/`listarPasivos`/`obtenerActivoPorId`/`obtenerPasivoPorId` existen en `repository.ts` pero no están expuestas en `actions.ts` | Listado y ficha de Activos/Pasivos | **resuelto** (corregido 2026-07-20 — estaba desactualizado, ver nota arriba) |
| Patrimonio | Sin función que exponga el historial completo de pagos de un Pasivo | Ficha de Pasivo (cronograma) | **resuelto** (Ficha de Pasivo con Registrar pago está `[x]` desde la tanda de Patrimonio) |
| Proveedores | Falta `listarComprasPorTenant` con filtro por estado/estadoPago | Listado general de Compras | **resuelto** (corregido 2026-07-20 — estaba desactualizado, ver nota arriba) |
| Productos | `listarMovimientosStock` existe en `repository.ts` pero no en `actions.ts` | Historial de movimientos de stock | **resuelto** |
| Nicho 1 | No existe `fichaInsumo()` combinada, y **`listarMovimientosInsumo` no existe ni en el repository** (a diferencia de Productos) | Ficha de Insumo con historial — requiere trabajo de backend nuevo, no solo un wrapper | **resuelto** (Ficha de Insumo con historial está `[x]` desde la tanda de Nicho 1) |
| Ventas | `listarVentas`/`listarGastos` sin filtros de servidor; listado de Ventas sin monto total ni nombres (solo IDs) | Listado de Ventas/Gastos con volumen — aceptable para MVP, revisar si crece | **resuelto** para Ventas (`listarVentasConTotal`); Gastos tiene su Listado `[x]` pero sin filtros server-side propios — nicety de escalabilidad, no bloquea la pantalla, no revisado en esta tanda |
| Ventas | Sin acción de "cierre agregado" de Evento (cargar el total vendido de una vez) | Gestión de Eventos, flujo de cierre rápido | Gestión de Eventos está `[x]` (con "Cerrar" simple); el cierre agregado con total vendido sigue sin construir — mejora de UX futura, no bloquea la pantalla existente |
| Ventas | `registrarPagoVentaSchema` (ruta) no reenviaba `fechaPago` — el módulo ya lo aceptaba | Registrar Pago de Venta con fecha explícita | **resuelto** |
| Consentimiento | `instituciones` no tiene campo `email` | Portal de Entidades Veedoras — magic link (decisión de esta sesión) | **resuelto** (2026-07-18, migración `0027`, verificado con un click real de email) |
| Consentimiento | `listarInstituciones` sin gate de rol visible en el código | Revisar en la auditoría de seguridad de Fase 3 | **resuelto** (cerrado el 2026-07-17, antes de construir CRUD de Instituciones) |

### Pendientes de pulido visual (consolidado)
Hallazgos de verificación manual en navegador que no afectan funcionalidad — ajustes de CSS/layout
puntuales, no se corrigen en la misma tanda en que se detectan salvo que se pida explícitamente:

| Pantalla | Hallazgo | Reportado |
|---|---|---|
| `/admin/planes` — Dialog de alta/edición de Plan | El modal se ve con estilo mobile (angosto) estando en viewport desktop | 2026-07-18 (verificación manual del usuario) |
