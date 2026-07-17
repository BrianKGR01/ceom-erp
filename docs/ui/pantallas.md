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

## Progreso (actualizado 2026-07-16)

**33 construidas · 0 parciales · 83 pendientes**, de 116 pantallas/modales trackeados a este nivel
de detalle (el conteo original de "~85" era más grueso — agrupaba varios modales bajo una sola
pantalla; este número es más fino y es el que se mantiene de acá en adelante).

| Módulo | Construidas | Parciales | Pendientes | Total |
|---|---|---|---|---|
| 1. Identidad | 4 | 0 | 15 | 19 |
| 2. Suscripción | 0 | 0 | 5 | 5 |
| **3. Patrimonio** | **11** | 0 | 1 | 12 |
| 4. Proveedores/Compras | 0 | 0 | 9 | 9 |
| **5. Productos e Inventario** | **7** | 0 | 1 | 8 |
| 6. Nicho 1 (Insumos/Recetas/Producción) | 0 | 0 | 10 | 10 |
| **7. Ventas + Clientes** | **10** | **0** | 0 | 10 |
| 8. Egresos y Gastos | 0 | 0 | 6 | 6 |
| 9. Financiero | 0 | 0 | 3 | 3 |
| 10. Gateway de Consentimiento | 0 | 0 | 9 | 9 |
| 11. Monitoreo Institucional + Panel Admin | 0 | 0 | 10 | 10 |
| 12. Nicho 4 | 0 | 0 | 1 | 1 |
| 13. Simulaciones | 0 | 0 | 5 | 5 |
| **14. Reportes y Dashboard** | **1** | 0 | 8 | 9 |

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

### Próxima tanda sugerida

1. **Proveedores / Compras** — el próximo módulo de negocio completo sin ninguna pantalla
   todavía (0/9 construidas), según el orden ya fijado (roadmap + `CEOM_Arquitectura.md` §7 —
   Proveedores no depende de ningún módulo de UI pendiente). Incluye el flujo de Landed Cost/Orden
   de Compra de Nicho 4. **⚠️ Gap de backend a cerrar antes de construir "Listado de Compras":**
   no existe un `listarComprasPorTenant`/`listarCompras` con filtros por `estadoPago`/`estado` —
   hoy el único listado real disponible es indirecto, vía `fichaProveedor()` → `compras[]` (por
   proveedor) o `historialPrecio()` (por ítem). El resto de las pantallas (Proveedores completo,
   Alta de Compra, Recibir Compra, Registrar pago, Compra de Ajuste) no tiene gaps — sus acciones
   ya existen. Pantallas exactas de esta tanda (sección 4 de este documento):
   - Listado de Proveedores
   - Ficha de Proveedor
   - Alta de Proveedor
   - Listado de Compras
   - Alta de Compra
   - Historial de precios de un ítem
   - Recibir Compra
   - Registrar pago de Compra
   - Compra de Ajuste
2. **Egresos y Gastos** — depende conceptualmente de tener Proveedores para los gastos con
   `proveedorId`, aunque no es un bloqueo estricto. Poblar datos de Gastos también dejaría de
   mostrar la tarjeta "Gastos por categoría" del Dashboard vacía.
3. **Nicho 1 (Insumos/Recetas/Producción)** — solo relevante para tenants que elijan ese rubro.
4. **Reportes Detallados (Módulo 14, Sección B)** — Estado de Resultados, Histórico de Ventas,
   Margen por Canal y Producto, Ranking completo — habilita agregar de vuelta el botón "Ver
   reportes detallados" que se omitió del Dashboard por no tener destino todavía, y es donde va el
   widget "Valor patrimonial total" pendiente de Patrimonio.
5. El resto (Financiero como pantallas propias, Simulaciones, Nicho 4, Gateway de Consentimiento,
   Monitoreo Institucional, Panel Admin CEOM, Suscripción) — funcionalidad real pero ninguna
   bloquea el uso diario del producto; se ordenan cuando lleguemos ahí.

---

## 0. Arquitectura de superficies (decidida en esta sesión)

CEOM-ERP tiene **2 superficies de acceso**, como route groups dentro de la misma app Next.js (sin
subdominios separados por ahora — se evalúa recién en Fase 3 si hace falta):

| Superficie | Quién entra | Autenticación |
|---|---|---|
| **`/app`** | Owner y Colaborador de un tenant | Supabase Auth (email/contraseña) — comparte login con `/admin` |
| **`/admin`** | Equipo interno CEOM (`ceom_admin`) | Mismo Supabase Auth que `/app` — es el mismo motor de autorización (Módulo 1), no una app aparte. La diferencia es el **redirect post-login según rol**, no el mecanismo de entrada |
| **`/portal`** | Institución / entidad veedora (sin cuenta CEOM) | Auth completamente separada: primera vez vía **Código de Acceso** de un solo uso; visitas siguientes vía **magic link** a un email — requiere agregar el campo `email` a `instituciones` (ver gap de backend en la sección 10, no implementado todavía) |

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
Módulo 14 abajo). `/admin` sigue siendo landing provisoria, sin Panel Admin real construido.

---

## 1. Identidad, Tenants, Roles, Autorización

### `/app` — Login
**Login** `[x]` — autenticación compartida `/app`/`/admin`.
- Campos: `email`, `password` (inputs del form).
- Rol: público (no autenticado).
- Acción: `iniciarSesion()` → `supabase.auth.signInWithPassword`, con redirect por rol ya
  resuelto (ver sección 0).
- Nota: los enlaces "¿Olvidaste tu contraseña?" y "Crear cuenta gratis" del componente actual son placeholders sin flujo detrás — no hay alta de cuenta autoservicio (`crearTenant` está gateado a `ceom_admin` únicamente, ver pantalla 16).

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

### `/app` — Gestión de colaboradores (Owner)
**Listado de colaboradores** `[ ]` — usuarios del tenant con su rol y estado.
- Campos esperados: `nombreCompleto`, `email`, rol, `activo`, `esOwner`, `ultimoAccesoEn`.
- Rol: Owner.
- Acción: **⚠️ gap de backend** — no existe `listarUsuarios(tenantId)`.

**Invitar colaborador** `[ ]` (modal).
- Campos: `email`, `nombreCompleto`, `rolId`.
- Rol: Owner. Bloqueado si `estadoAcceso !== "activo"`.
- Acción: `invitarUsuario(solicitante, { email, nombreCompleto, rolId })`.

**Cambiar rol de un colaborador** `[ ]` (inline/modal desde el listado).
- Rol: Owner. Acción: `cambiarRolUsuario(solicitante, usuarioId, nuevoRolId)`.

**Suspender colaborador** `[ ]` (modal de confirmación).
- Caso borde a mostrar: si es el único Owner activo, el server devuelve `"No se puede suspender al unico Owner del tenant."`.
- Rol: Owner. Acción: `suspenderUsuario(solicitante, usuarioId)`.

**Reactivar colaborador.** `[ ]`
- Rol: Owner. Acción: `reactivarUsuario(solicitante, usuarioId)`.

### `/app` — Gestión de roles personalizados (Owner)
**Listado de roles** `[ ]` — roles del tenant + roles de sistema (no editables/eliminables).
- Campos: `nombre`, `esRolSistema`.
- Rol: Owner. Acción: **⚠️ gap de backend** — no existe `listarRolesPorTenant(tenantId)`.

**Crear rol personalizado** `[ ]` — nombre + matriz módulo × acción.
- Subpantalla: matriz de permisos — filas = los 10 módulos del enum (`productos`, `inventario`, `ventas`, `costos_gastos`, `patrimonio`, `operativo`, `financiero`, `simulaciones`, `reportes`, `proveedores`), columnas = `ver`/`crear`/`editar`/`anular_ajustar`.
- Rol: Owner. Acción: `crearRolPersonalizado(solicitante, { nombre, permisos })`.

**Editar permisos de un rol** `[ ]` — misma matriz, precargada. No aplica a roles de sistema.
- Rol: Owner. Acción: `actualizarPermisosRol(solicitante, rolId, permisos)`.

**Eliminar rol** `[ ]` (modal de confirmación).
- Caso borde: si hay usuarios activos con ese rol, el server devuelve `"Hay N usuario(s) con este rol; reasignalos antes de eliminarlo."`.
- Rol: Owner. Acción: `eliminarRol(solicitante, rolId)`.

### `/app` — Capacidades especiales (Owner)
**Capacidades especiales por rol** `[ ]` — toggles por rol para `vender_sin_stock`, `gestionar_eventos`, `importar_historico`, `producir_sin_stock_insumo`.
- Rol: Owner. No aplica a roles de sistema. Acción: `otorgarCapacidadEspecialPorRol(solicitante, rolId, capacidad, habilitado)`.

**Capacidades especiales por usuario** `[ ]` (override puntual, gana sobre el default de rol).
- Rol: Owner. Acción: `otorgarCapacidadEspecialPorUsuario(solicitante, usuarioId, capacidad, habilitado)`.

### `/admin` — Gestión de Tenants (ceom_admin)
**Alta de Tenant.** `[ ]`
- Campos de entrada: `nombreNegocio`, `ciudadBase?`, `monedaPrincipal`, `canalesVenta?`, `planId?` (default Plan Básico), `fechaInicioSuscripcion`, `ownerEmail`, `ownerNombreCompleto`.
- Salida: `tenantId`, `sucursalId`, `usuarioOwnerId`.
- Rol: `ceom_admin` únicamente. Acción: `crearTenant(solicitante, input)`.

**Listado de Tenants** `[ ]` (cross-tenant).
- Campos: `id`, `nombreNegocio`, `planId`, `nichoId`, `estadoSuscripcion`, `fechaProximoPago`.
- Nota: `listarTenants()` **no pagina** todavía — a tener en cuenta si crece el volumen.
- Rol: `ceom_admin`. Acción: `listarTenants(solicitante)`.

**Ficha de Tenant** `[ ]` (detalle, desde el listado).
- Campos: `nombreNegocio`, `ciudadBase`, `monedaPrincipal`, `logoUrl`, `canalesVenta`, `nichoId`, `nichoAsignadoEn`, `planId`, `estadoSuscripcion`, `fechaInicioSuscripcion`, `fechaProximoPago`, `estadoAcceso` (derivado).
- Rol: `ceom_admin`. Acción: `obtenerTenantPorId(solicitante, tenantId)`.

### `/app` — Estado propio (cualquier usuario del tenant)
**Banner de estado del tenant** `[ ]` — visible cuando `estadoAcceso !== "activo"` (un tenant `bloqueado` deniega incluso `ver`, salvo esta pantalla).
- Campos: `estadoAcceso` (`activo`/`solo_lectura`/`bloqueado`).
- Rol: cualquier usuario autenticado del tenant. Acción: `obtenerEstadoAccesoTenant(tenantId)` (sin gate, a propósito).

---

## 2. Suscripción (versión mínima)

### `/app` — Mi plan (Owner, solo lectura)
**Mi plan** `[ ]`
- Campos: `nombre`, `nichoId`, `incluyeSucursales`, `permiteMultiplesOwners`, `permiteDowngradeAutogestionado`, `duracionInvitacionDias`, `duracionEtapaSoloLecturaDias`, `modulosVeedorPermitidos`, `precioMensual`, `moneda`, `activo`.
- Sin acción de upgrade/downgrade autoservicio en el MVP (lo ejecuta `ceom_admin` manualmente).
- Rol: cualquier usuario del tenant. Acción: `obtenerPlanPorId(tenant.planId)`.

### `/admin` — Catálogo de Planes (ceom_admin)
**Listado de Planes.** `[ ]` Acción: `listarPlanes({ soloActivos })`.

**Crear Plan** `[ ]` (formulario).
- Campos: `nombre`, `nichoId?`, `incluyeSucursales`, `permiteMultiplesOwners`, `permiteDowngradeAutogestionado`, `duracionInvitacionDias` (default 7), `duracionEtapaSoloLecturaDias` (default 3), `modulosVeedorPermitidos` (multi-select: `financiero`/`operativo`/`inventario_operativo`), `precioMensual`, `moneda`.
- Rol: `ceom_admin`. Acción: `crearPlan(solicitante, input)`.

**Editar Plan** `[ ]` — mismo formulario precargado. Acción: `actualizarPlan(solicitante, planId, input)`.

**Desactivar / Reactivar Plan** `[ ]` (modal de confirmación, no borra). Acciones: `desactivarPlan` / `reactivarPlan`.

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
**Valor patrimonial total** `[ ]` (widget, probablemente embebido en el Dashboard de Reportes).
- Campo: `valorPatrimonialTotal`. Acción: `consultarValorPatrimonialTotal(solicitante, tenantId)`.

---

## 4. Proveedores / Compras

### `/app` — Proveedores (Owner + permiso `"proveedores"`)
**Listado de Proveedores.** `[ ]` Campos: `nombre`, `contacto`, `notas`, `creadoPor`/`creadoEn`. Acción: `listarProveedores`.

**Ficha de Proveedor** `[ ]` — con historial de precios/compras.
- Campos: `nombre`, `contacto`, `notas`, `cantidadCompras`, `montoTotalComprado`, `compras[]`.
- Acción: `fichaProveedor(solicitante, proveedorId)`.

**Alta de Proveedor** `[ ]` (modal). Campos: `nombre`, `contacto?`, `notas?`. Acción: `crearProveedor`. (También `actualizarProveedor` y `eliminarProveedor` — soft delete.)

### `/app` — Compras
**Listado de Compras** `[ ]` — filtro por `estadoPago` y por `estado` (pedido/recibido).
- Campos: `sucursalId`, `proveedorId?`, `tipo` (`insumo`/`reventa`), `insumoId`/`productoId`, `cantidad`, `costoUnitario`, `montoTotal`, `costoAdicionalTraslado?`, `fechaCompra`, `fechaVencimiento?`, `estado` (`pedido`/`recibido`), `fechaRecepcion`, `estadoPago`.
- ⚠️ Gap de backend: no hay un `listarComprasPorTenant` con filtros — hoy el listado real disponible es por proveedor (`fichaProveedor` → `compras[]`) o por ítem (`historialPrecio`).

**Alta de Compra** `[ ]` (formulario).
- Campos de entrada: `sucursalId`, `proveedorId?`, `tipo`, `insumoId` **o** `productoId` (exactamente uno), `cantidad`, `montoTotal`, `costoAdicionalTraslado?`, `fechaCompra`, `fechaVencimiento?`, `estado?` (default `"recibido"`; `"pedido"` para el flujo tipo Orden de Compra de Nicho 4).
- Salida: `compraId`, `costoUnitario` (calculado), `entradaStock` (solo si `estado="recibido"`).
- Acción: `registrarCompra(solicitante, tenantId, input)`.

**Historial de precios de un ítem** `[ ]` (insumo o producto). Acción: `historialPrecio(solicitante, tenantId, { insumoId } | { productoId })`.

**Recibir Compra** `[ ]` (acción sobre una compra en estado `"pedido"`).
- Valida que no esté ya `"recibido"`. Dispara la entrada real de stock.
- Acción: `recibirCompra(solicitante, compraId)`.

**Registrar pago de Compra** `[ ]` (modal). Campos: `monto`, `fechaPago`. Salida: `estadoPago`, `totalPagado`. Acción: `registrarPagoCompra`.

**Compra de Ajuste** `[ ]` (modal — motivo obligatorio, nunca edita la Compra original).
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
- Subpantallas construidas: Ajuste manual de stock, Transferencia de stock, Eliminar (con confirmación si stock > 0). **No construida:** Vincular/Desvincular a receta (depende de Nicho 1).
- Campos: todos los de `productos` + `stockPorSucursal[]` (`sucursalId`, `cantidadActual`, `stockMinimo`, `actualizadoEn`).
- Acción: `fichaProducto(solicitante, productoId)`.

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

**Vincular a proceso operativo** `[ ]` (modal, desde Ficha de Producto — solo si hay Nicho 1 activo).
- Campos: selector de Receta + `cantidadBaseConsumidaPorUnidad`.
- Nota técnica: el botón dispara `vincularProductoAReceta()` de **Módulo 6** (Nicho 1), que internamente llama a `enviarProductoAOperaciones()` de este módulo.
- Acción: `vincularProductoAReceta` / `desvincularProductoDeReceta` (Nicho 1).

---

## 6. Módulo Operativo — Nicho 1 (Alimentos/Bebidas por Lotes)

### `/app` — Insumos (Owner + permiso `"operativo"`)
**Catálogo de Insumos.** `[ ]`
- Campos: `nombre`, `unidadMedida`, `vidaUtilDias`, `costoUnitarioVigente` (derivado), `stockMinimo`.
- ⚠️ No trae stock por sucursal en la misma llamada — se pide aparte con `consultarStockInsumo`.
- Acción: `listarInsumos`.

**Ficha de Insumo con historial de movimientos.** `[ ]`
- ⚠️ **Doble gap de backend**: (1) no hay una `fichaInsumo()` que junte insumo+stock en una llamada; (2) **no existe ninguna función, ni en el repository, que liste `movimientos_insumo`** — a diferencia de Productos, acá el historial de movimientos requiere trabajo de backend nuevo, no solo exponer un wrapper.
- Campos disponibles hoy: `nombre`, `unidadMedida`, `vidaUtilDias`, `costoUnitarioVigente`, `stockMinimo` + `cantidadActual` por sucursal.

**Alta / Edición de Insumo.** `[ ]`
- Campos: `nombre`, `unidadMedida` (`litros`/`ml`/`kg`/`g`/`unidad`/`metros`), `vidaUtilDias`, `stockMinimo`. `costoUnitarioVigente` nunca es editable a mano.
- Acciones: `crearInsumo` / `actualizarInsumo`.

**Entrada de compra de insumo** `[ ]` (modal — recalcula costo promedio ponderado).
- Campos: `insumoId`, `sucursalId`, `cantidad`, `costoCompra`, `fechaVencimiento?` (auto-calculada si se omite).
- Nota: también se dispara automáticamente desde Proveedores al recibir una Compra tipo `insumo` — esta pantalla es la vía manual directa.
- Acción: `registrarEntradaCompraInsumo`.

**Ajuste manual de insumo / Merma de almacenamiento** `[ ]` (modales, motivo obligatorio).
- Acciones: `registrarAjusteManualInsumo`, `registrarMermaAlmacenamiento`.

### `/app` — Recetas y Producción
**Gestión de Recetas.** `[ ]`
- Campos (receta): `nombre`, `rendimientoPorLote`, `unidadRendimiento`. Campos (composición): `insumoId`, `cantidadPorLote`, `costoUnitarioVigente`.
- Acciones: `crearReceta`, `actualizarReceta`, `eliminarReceta`, `listarRecetas`, `actualizarComposicionReceta` (reemplaza toda la lista, no edición incremental).

**Registrar Producción de un lote** `[ ]` — pantalla central del módulo.
- Antes de confirmar: mostrar preview de costo+merma usando las funciones puras exportadas (`calcularRendimientoTeorico`, `calcularMerma`, `calcularCostoOperativoProduccion`) sobre los datos de `obtenerRecetaDeProducto()`.
- Campos de entrada: `productoId`, `sucursalId`, `activoId` (equipo de Patrimonio), `fechaProduccion`, `cantidadLotesProducidos`, `cantidadRealObtenida`, `fechaVencimientoLote?`.
- Bloqueos: sin receta vinculada → error directo; insumo insuficiente → bloquea salvo capacidad `producir_sin_stock_insumo`.
- Salida a mostrar: `costoOperativoCalculado`, `mermaCantidad`, `mermaCosto`, `acreditacionProductos` (si falla, mostrar advertencia — no hay rollback automático, gap de atomicidad aceptado por diseño).
- Acción: `registrarProduccion`.

**Producción de Ajuste** `[ ]` (modal, corrección sin editar ni revertir movimientos).
- Campos: `costoOperativoCorregido?`, `cantidadRealObtenidaCorregida?`, `motivo` (obligatorio).
- Acción: `registrarProduccionDeAjuste`.

**Listado de Producciones.** `[ ]`
- Campos: `fechaProduccion`, `productoId`, `sucursalId`, `activoId`, `cantidadLotesProducidos`, `cantidadRealObtenida`, `fechaVencimientoLote`, `costoOperativoCalculado`, `mermaCantidad`, `mermaCosto`.
- Acción: `listarProducciones`.

**Capacidad Operativa** `[ ]` (solo lectura — producción y almacenamiento en paralelo, sin alertas automáticas en el MVP).
- Campos (producción): `capacidadPeriodo`, `produccionReal`, `porcentajeUsado`. Campos (almacenamiento): `capacidadAlmacenamientoCantidad`, `stockActualTotal`, `porcentajeUsado`. Extra: `mermaCostoTotal` del período.
- Acciones: `consultarCapacidadProduccionUsada`, `consultarCapacidadAlmacenamientoUsada`, `consultarMermaPeriodo`.

---

## 7. Ventas + Clientes

> Pantalla más crítica del sistema junto con Productos y Login — es el flujo diario de uso.

### `/app` — Punto de Venta (Owner + permiso `"ventas"`)
**Registrar Venta** `[x]` (carrito) — buscador + pills de categoría, canal y método de pago como cards/pills reales del tenant.
- Campos de entrada: `sucursalId`, `clienteId` **o** `clienteNuevo` (`nombre`, `telefono?`, `email?`), `fechaVenta?`, `canalVentaId`, `eventoId?`, `lineas[]` (`productoId`, `cantidad`), `pagoInicial?` (`metodoPagoId`, `monto`), `origenRegistro?` (`en_vivo`/`offline_sincronizado`). `eventoId` no expuesto todavía en la UI (Gestión de Eventos sigue `[ ]`).
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

### `/app` — Gastos (Owner + permiso `"costos_gastos"`)
**Listado de Gastos** `[ ]` (filtro por categoría/estado de pago).
- Campos: `sucursalId`, `tipo` (`fijo`/`variable_no_productivo`/`unico`), `categoriaId`, `monto`, `fechaGasto`, `proveedorId`, `origen` (`manual`/`comision_venta_automatica`/`cuota_pasivo_automatica`), `estadoPago` (derivado), `referenciaId`, `descripcion`.
- ⚠️ `listarGastos` no acepta filtros de servidor — se aplican en cliente.
- Sugerencia de diseño: distinguir visualmente los gastos `origen ≠ manual` (badge "automático"), no son editables/eliminables desde acá.
- Acción: `listarGastos`.

**Ficha de Gasto.** `[ ]`
- Campos: gasto completo + `pagos[]`.
- Subpantallas: "Editar" y "Registrar pago" solo visibles si `origen=manual` (los automáticos nacen ya pagados).
- Acción: `fichaGasto`.

**Alta de Gasto Manual.** `[ ]`
- Campos: `sucursalId?`, `tipo`, `categoriaId`, `monto`, `fechaGasto`, `proveedorId?`, `descripcion?`.
- Acciones: `crearGastoManual` / `actualizarGastoManual` (rechaza si `origen≠manual` o si el nuevo monto queda por debajo de lo ya pagado) / `eliminarGastoManual` (soft, rechaza si `origen≠manual`).

**Registrar Pago de Gasto** `[ ]` (modal). Campos: `monto`, `fechaPago`. Acción: `registrarPagoGasto`.

**Gestión de Gastos Recurrentes** `[ ]` (plantillas: alquiler, sueldos, seguros).
- Campos: `sucursalId?`, `categoriaId`, `monto`, `frecuencia` (`mensual`/`semanal`/`quincenal`/`anual`), `fechaInicio`, `fechaFin?`, `activo`.
- ⚠️ Sin scheduler automático — cada gasto del período se dispara a mano con el botón "Generar gasto de este período".
- Acciones: `crearGastoRecurrente`, `actualizarGastoRecurrente`, `desactivarGastoRecurrente`, `listarGastosRecurrentes`, `generarGastoDesdeRecurrente`.

**Gestión de Categorías de Gasto.** `[ ]`
- Campos: `nombre`, `categoriaGastoSugeridaId`. Subpantalla: picker de sugeridas (globales + por nicho).
- Nota: `sembrarCategoriasGastoDefault(tenantId)` precarga el set default — útil como botón "Cargar categorías sugeridas" hasta que exista onboarding automático.
- La administración del catálogo global de sugerencias vive en `/admin`.

**Nota — sin pantalla propia:** `generarGastoCuotaPasivo` y `generarGastoComisionVenta` son funciones automáticas disparadas desde otros módulos (botón "Generar gasto" en la ficha del Pasivo en Patrimonio, y en la Ficha de Venta en Ventas respectivamente) — no se diseña una pantalla para ellas dentro de Egresos y Gastos. Ambas requieren `categoriaId` como parámetro obligatorio, así que esos botones necesitan un selector de categoría en el momento de dispararse.

---

## 9. Financiero

Sin tablas propias — capa de agregación pura sobre Ventas, Gastos y Proveedores. Todas las pantallas en `/app`, gateadas por permiso `"financiero"` × `ver`.

**Flujo de Caja** `[ ]` — caja real (`Pago de Venta − Pago de Compra − Pago de Gasto`, por fecha de pago).
- Campos: `flujoCaja`, `pagosVenta`, `pagosCompra`, `pagosGasto`. Filtros: período + sucursal opcional.
- Acción: `flujoCaja(solicitante, tenantId, periodo, { sucursalId? })`.

**Estado de Resultados** `[ ]` — resultado devengado (ingresos − COGS − gastos ± ajustes), por fecha de ocurrencia económica.
- Campos: `estadoResultados`, `ingresos`, `costos`, `gastos`, `ajustesVenta`.
- Acción: `estadoResultados(solicitante, tenantId, periodo, { sucursalId? })`.
- **Nota de diseño:** Reportes (Módulo 14) re-expone literalmente estas dos mismas funciones para su propio Dashboard — es una decisión de UI (no de backend) si Flujo de Caja y Estado de Resultados terminan viviendo como pantallas propias de Financiero, como widgets dentro del Dashboard, o ambas cosas a la vez.

**Margen por Producto.** `[ ]`
- Campos: `margenPorcentaje` (nullable si no hubo ingresos), `ingresosAjustados`, `costos`. Selector de producto + período.
- Acción: `margenPorProducto(solicitante, tenantId, productoId, periodo)`.

**`costoFijoTotal` — confirmado: NO tiene pantalla propia en `/app`.** Sus 3 consumidores reales son: Simulaciones → Punto de Equilibrio (Módulo 13), y el "Detalle Financiero" empaquetado tanto en `/portal` (Monitoreo Institucional) como en `/admin` (Panel Admin CEOM) — ver Módulo 11.

---

## 10. Gateway de Consentimiento

Unidad de concesión = **módulo veedor** (`financiero`/`operativo`/`inventario_operativo`), nunca por función individual (decisión confirmada, ver `CEOM_Arquitectura.md` §8.1).

### `/app` (Owner del tenant)
**Generar Código de Acceso.** `[ ]`
- Subpantalla: selector de módulos, limitado a `plan.modulosVeedorPermitidos` (la action rechaza si se marca uno no permitido por el plan).
- Salida: `codigoAccesoId`, `codigo`.
- Acción: `generarCodigoAcceso(solicitante, tenantId, { modulosHabilitados })`.

**Códigos de Acceso generados** `[ ]` (listado + revocar).
- Campos: `modulosHabilitados`, `codigo`, `estado` (`activo`/`canjeado`/`revocado`), `creadoEn`, `institucionId?` (null hasta canjear), `canjeadoEn?`, `revocadoEn?`.
- Acciones: `listarCodigosAcceso`, `revocarCodigoAcceso` (también corta el acceso ya otorgado si el código ya se había canjeado).

**Aprobaciones/Consentimientos vigentes** `[ ]` (listado + revocar).
- Campos: `institucionId`, `modulosAprobados`, `aprobadoPor`, `fechaAprobacion`, `revocadoEn`, `codigoAccesoId?`.
- Nota: `consultarAprobacionesPorTenant` devuelve TODAS las filas, incluidas las revocadas — la UI debe filtrar/etiquetar vigente vs. revocada client-side.
- Acciones: `consultarAprobacionesPorTenant`, `revocarConsentimiento` (revocación inmediata).

**Solicitudes de Seguimiento entrantes** `[ ]` (responder).
- Campos: `institucionId`, `modulosSolicitados`, `estado` (`pendiente`/`aprobada`/`rechazada`). Al aprobar, el Owner elige `modulosAprobados` (puede ser subconjunto de lo solicitado).
- Acciones: `listarSolicitudesPorTenant`, `aprobarSolicitud`/`rechazarSolicitud`.

### `/portal` (Institución, sin cuenta CEOM)
**Canjear Código de Acceso** `[ ]` — única puerta de entrada.
- Subpantalla condicional: si la institución no existe todavía, formulario de alta mínima (`nombre`, `tipo`, `contacto?`).
- ⚠️ **Gap de backend bloqueante para la decisión tomada en esta sesión:** para el magic link de visitas posteriores hace falta capturar `email` acá, pero **ese campo no existe hoy** en `DatosInstitucion` ni en la tabla `instituciones` (columnas actuales: `id`, `nombre`, `tipo`, `contacto`, `creadoPor`, `creadoEn`, `eliminadoEn`). Falta: migración que agregue `email`, y el flujo de magic link vía Supabase Auth.
- Campos de entrada: `codigo`, `institucionId` (si ya existe) o `institucionNueva`.
- Acción: `canjearCodigoAcceso({ codigo, institucionId?, institucionNueva? })` — sin `solicitante`, a propósito.

### `/admin` (ceom_admin)
**CRUD de Instituciones.** `[ ]`
- Campos: `nombre`, `tipo` (`universidad`/`incubadora`/`organizacion`), `contacto?`, `creadoPor`, `creadoEn`, `eliminadoEn` (soft delete).
- Acciones: `crearInstitucion`, `actualizarInstitucion`, `eliminarInstitucion`, `listarInstituciones`.
- ⚠️ **Posible gap de seguridad a revisar en Fase 3:** `listarInstituciones` no tiene gate de rol en el código actual — señalarlo en la auditoría de RLS/permisos ya prevista en el roadmap.

**Gestión de Cartera Institucional.** `[ ]`
- Campos: `institucionId`, `tenantId`, `cohorte?`, `fechaInicio`, `fechaFin?`, `eliminadoEn`.
- Acciones: `agregarTenantACartera`, `quitarDeCartera`, `listarCarteraPorInstitucion`.

**Crear Solicitud de Seguimiento** `[ ]` (en nombre de la institución).
- Confirmado por el gate del código: CEOM registra el pedido de una institución pre-registrada, eligiendo qué módulos solicita; el Owner del tenant decide qué aprueba desde `/app`.
- Campos: `institucionId`, `tenantId`, `modulosSolicitados`.
- Acción: `crearSolicitudSeguimiento`.

**Logs de Acceso** `[ ]` (auditoría interna, nunca visible para el tenant).
- Campos: `usuarioCeomId`, `tenantId`, `moduloConsultado`, `creadoEn`. Filtrable por tenant/rango de fechas.
- Acción: `listarLogsAcceso`.

---

## 11. Monitoreo Institucional + Panel Admin CEOM

### `/portal` (Institución, después de loguearse)
**Mi Cartera.** `[ ]`
- Campos: `tenantId`, `cohorte`, `fechaInicio`, `fechaFin`, `nombreNegocio`, `nichoId`, `planId`, `estadoAcceso`.
- No requiere módulo veedor aprobado (es metadato de la relación, no dato de negocio).
- Acciones: `listarCartera`, `estadoTenant` (ficha básica de un tenant puntual).

**Por cada tenant de la cartera — 4 tabs, cada uno gateado individualmente vía `tieneConsentimiento()`:** `[ ]` los 4

1. **Tendencia de Ventas** (gateada bajo módulo veedor `"financiero"`). Campos: `{ autorizado, detalle: { ingresos } }`. Acción: `tendenciaVentas`.
2. **Detalle Financiero** (si `financiero` aprobado). Campos: `flujoCaja`, `estadoResultados`, `costoFijoTotal`. Acción: `detalleFinanciero`.
3. **Detalle Operativo** (si `operativo` aprobado). Campos: `producciones`, `mermaCostoTotal`. Acción: `detalleOperativo`. Pendiente documentado: `consultarCapacidadProduccionUsada` queda fuera (falta un `activoId` veedor-seguro).
4. **Detalle de Inventario Operativo** (si `inventario_operativo` aprobado). Campos: `insumos` (catálogo + costo vigente). Acción: `detalleInventarioOperativo`. Pendiente documentado: `consultarStockInsumo` queda fuera (falta `insumoId`+`sucursalId` veedor-seguros).

**Regla de privacidad central (no es un detalle menor):** las 4 funciones devuelven siempre `{ autorizado: true, detalle } | { autorizado: false }` — nunca datos parciales. Si `autorizado=false`, la UI debe mostrar explícitamente "no autorizado" u ocultar el tab — nunca confundir "no hay datos" con "no tenés permiso para verlos".

### `/admin` (ceom_admin)
**Listado de tenants con salud agregada.** `[ ]`
- Campos agregados: `totalTenants`, `porEstadoAcceso`, `porPlan`, `porNicho` (`saludAgregadaPlataforma`) + tabla fila-por-fila de `listarTenants` (Identidad) para navegar a cada ficha.
- No dispara `registrarAccesoAdminCeom` (es consulta cross-tenant, no de un tenant puntual).

**Ficha de Tenant** `[ ]` — detalle completo de un tenant.
- Acción: `consultarTenantDetalle`. Nota: esta consulta específica **no** queda logueada en `LogAccesoAdminCEOM` ("identidad" no es un valor de `moduloPermisoEnum` — pendiente documentado desde Módulo 10).

**Subpantallas/tabs de la Ficha de Tenant — 3 lecturas veedor-seguras, SÍ logueadas:** `[ ]` las 3
1. **Financiero** — `flujoCaja`, `estadoResultados`, `costoFijoTotal`. Acción: `consultarFinancieroTenant` (loguea `moduloConsultado: "financiero"`).
2. **Operativo** — `producciones`, `mermaCostoTotal`. Acción: `consultarOperativoTenant` (loguea `"operativo"`).
3. **Inventario Operativo** — `insumos`. Acción: `consultarInventarioOperativoTenant` (loguea también `"operativo"`, no un valor separado — `moduloPermisoEnum` de Identidad no distingue insumos de producción, solo el `moduloVeedorEnum` del Gateway lo hace; importante para no confundir al leer la pantalla de Logs de Acceso).

`ceom_admin` no pasa por `tieneConsentimiento()` en ninguna de estas — su acceso está cubierto por Términos de Servicio, solo queda trazado, nunca bloqueado.

---

## 12. Módulo Operativo — Nicho 4 (Comercio Minorista y Distribución)

Sin entidades propias — Landed Cost y Orden de Compra viven en `Compra` (Módulo 4, ya cubierto arriba). Lo único específico de Nicho 4 es un widget de solo lectura.

**Widget: Capacidad de Almacenamiento Usada** `[ ]` — embebido en el Dashboard de Patrimonio o en el Home, **no es una sección de navegación propia**.
- Campos: `capacidadAlmacenamientoCantidad` (de Patrimonio), `stockActualTotal` (de Productos), `porcentajeUsado` (`null` si el activo no tiene capacidad definida). Requiere `activoId` y `sucursalId` explícitos como input.
- Rol: permiso `"operativo"` × `ver`.
- Acción: `consultarCapacidadAlmacenamientoUsada(solicitante, tenantId, activoId, sucursalId)`.

---

## 13. Simulaciones

Todas las pantallas en `/app`, gateadas por permiso `"simulaciones"`.

**Simular Precio.** `[ ]`
- Auto-mostrado al elegir producto: `rotacionPeriodo`, `margenActualPct`, `costoUsado` (cuando no es manual).
- Campos de entrada: `productoId`, `frecuencia` (`semanal`/`mensual`), `periodo`, `margenDeseadoPct`, `costoManual?` (override puntual — costo automático por defecto, nunca manual por defecto).
- Salida: `simulacionId`, `costoUsado`, `costoEsManual`, `precioVentaActual`, `margenActualPct`, `rotacionPeriodo`, `precioSugerido`, `impactoProyectadoBs` (`null` si `rotacionPeriodo=0`).
- Acción: `simularPrecio`. Rol: `simulaciones` × `crear`.

**Punto de Equilibrio.** `[ ]`
- Campos de entrada: `productoId`, `frecuencia`, `periodo`.
- Salida: `costoFijoTotalPeriodo`, `costoVariableUnitario`, `precioVenta`, `margenContribucionUnitario`, `puntoEquilibrioUnidades` (`number | null`), `advertencia` (texto simple si el margen de contribución es ≤ 0, ej. "a este precio nunca vas a cubrir tus costos fijos").
- Acción: `calcularPuntoEquilibrio`. Rol: `simulaciones` × `crear`.

**Comparativo Multi-SKU.** `[ ]`
- Cabecera: `umbralMargenAlertaPct`, `margenPromedioCatalogo` (`null` si ningún producto tiene costo cargado).
- Por fila: `productoId`, `nombre`, `costo` (`null` excluye del promedio/alerta), `precioVenta`, `margenPct`, `precioSugerido` (calculado contra el margen promedio del catálogo), `alerta` (boolean).
- Acción: `comparativoMultiSku`. Rol: `simulaciones` × `ver`.

**Configuración de umbral de alerta** `[ ]` (probablemente un modal/panel simple lanzado desde el Comparativo, no pantalla propia).
- Campo: `umbralMargenAlertaPct` (default `15` en memoria si el tenant nunca configuró nada).
- Acciones: `obtenerConfiguracion` (ver) / `actualizarUmbralAlerta` (editar).

**Historial de Simulaciones.** `[ ]`
- Campos: `productoId`, `tipo` (`simular_precio`/`punto_equilibrio`), `frecuencia`, `periodo`, `margenDeseadoPct`, `costoUsado`, `costoEsManual`, `precioSugerido`/`impactoProyectadoBs` o `puntoEquilibrioUnidades` según tipo, `creadoPor`, `creadoEn`. Sin `eliminadoEn` — se acumula, no se corrige.
- Acción: `listarSimulaciones(solicitante, tenantId, productoId?)`. Rol: `simulaciones` × `ver`.

---

## 14. Reportes y Dashboard

Cero tablas propias, cero lógica de negocio propia — es composición de funciones ya expuestas por Ventas, Financiero, Gastos y Operativo. **Es el punto de entrada por defecto de `/app` al iniciar sesión — Sección A ya construida** (`src/app/app/(shell)/dashboard-resumen.tsx` + `inicio-actions.ts`), reemplaza el placeholder anterior en cuanto el checklist de sub-onboarding se apaga.

Estructura implementada: **una sola pantalla con 2 secciones**, no 8 pantallas separadas (tal como estaba propuesto).

**Filtro global implementado:** selector de período (4 presets calculados en cliente: Hoy/Últimos 7 días/Este mes/Este año — sin backend de rangos custom) + sucursal opcional/consolidado. Confirmado en la implementación: el filtro de sucursal solo afecta `resumenPeriodo`/`flujoCaja` — `rankingProductos`/`distribucionGastos`/`controlMerma` no reciben `sucursalId` en su firma real (limitación de backend, no de la pantalla — ver `reportes/ANCLA.md`).

**Gráficas nuevas agregadas sobre lo documentado** (paleta categórica validada con la skill de dataviz, primera vez que la app necesita una — ver `dashboard-resumen.tsx`): barras horizontales Ingresos/Costos/Gastos en Resumen del Período, barra de 2 segmentos Entradas/Salidas en Flujo de Caja, barras por fila en Productos más vendidos, dona SVG en Gastos por categoría (sin librería, no hay ninguna instalada).

**Desviación:** sin botón "Ver reportes detallados" — la Sección B (abajo) no tiene ninguna pantalla construida todavía, no se linkea a algo que no existe.

### Sección A — Resumen Ejecutivo (visible al entrar, sin acción del usuario) — `[x]` construida completa
1. **Resumen del Período** `[x]` (card destacada) — `estadoResultados`, `ingresos`, `costos`, `gastos`, `ajustesVenta`. Agrega delta real "% vs período anterior" (fetch adicional del período equivalente inmediatamente anterior). Acción: `resumenPeriodo` (delega en Financiero). Rol: `financiero` × `ver`.
2. **Flujo de Caja** `[x]` (card junto al resumen) — `flujoCaja`, `pagosVenta`, `pagosCompra`, `pagosGasto` (Salidas = `pagosCompra + pagosGasto` combinados, la referencia visual solo mostraba 2 líneas). Acción: `flujoCaja`. Rol: `financiero` × `ver`.
3. **Ranking de Productos** `[x]` (top 5, toggle rotación/margen — ambos criterios se pre-cargan juntos, el toggle es instantáneo sin round-trip nuevo) — `productoId`, `unidadesVendidas`, `ingresos`, `costos`, `margenPct`. Acción: `rankingProductos`. Rol: `ventas` × `ver`.
4. **Distribución de Gastos por Categoría** `[x]` (dona) — `categoriaId`, `total`. Estado vacío real implementado (tenant sin Gastos construido/cargado todavía). Acción: `distribucionGastos`. Rol: `costos_gastos` × `ver`.
5. **Control de Merma** `[x]` (card chica — 0 naturalmente en tenants sin producción, no error; texto distingue "0 real" de "hay merma, dentro del margen") — `mermaCostoTotal`, % contra `costos` del mismo período (derivado en la pantalla). Acción: `controlMerma` (delega en Nicho 1). Rol: `operativo` × `ver`.

### Sección B — Reportes Detallados (tab aparte, el usuario la abre a propósito, con sus propios filtros)
6. **Estado de Resultados** `[ ]` (vista formal, mismos campos que el widget 1). Acción: `estadoResultados`.
7. **Histórico de Ventas** `[ ]` (tabla/serie temporal, toggle "incluir eventos/ferias") — `ventaId`, `fechaVenta`, `canalVentaId`, `eventoId?`, `montoTotal`. Acción: `historicoVentas`.
8. **Margen por Canal y Producto** `[ ]` (tabla cruzada canal × producto) — `canalVentaId`, `productoId`, `ingresos`, `costos`, `margenPct`. Acción: `margenPorCanalYProducto`.
9. **Ranking de Productos — vista completa** `[ ]` (misma acción que el widget 3, sin límite de N, con filtro de canal/criterio explícitos).

*(`distribucionGastos` y `controlMerma` pueden reutilizar el mismo componente en ambas secciones con distinto tamaño — no necesitan una vista "detallada" separada dado lo compacto de sus campos.)*

**Exportación PDF/Excel:** confirmado fuera de alcance de esta fase (el propio módulo lo documenta) — no se propone pantalla/botón para esto todavía.

**Nota:** este inventario es exclusivamente la vista interna (`/app`). El Dashboard que ve una Institución en `/portal` es el de Monitoreo Institucional (Módulo 11) — compone únicamente los módulos veedor aprobados, nunca Ventas/Operativo sin consentimiento explícito.

---

## Resumen

### Conteo total
**116 pantallas/modales** trackeados en este documento (conteo fino), distribuidos en 14 módulos + Login, across 3 superficies:
- `/app` (Owner/Colaborador): la gran mayoría — el workspace operativo diario.
- `/admin` (ceom_admin): ~15 pantallas — gestión de tenants, planes, instituciones, logs.
- `/portal` (Institución): ~6 pantallas — Canjear código, Mi Cartera, 4 tabs de detalle.

### Las 5 pantallas más urgentes (flujo navegable de punta a punta) — **5 de 5 construidas ✅**
En este orden, porque cada una depende de la anterior para tener sentido:

1. **Login** `[x]` (con el redirect por rol resuelto) — bloqueante para absolutamente todo lo demás.
2. **Onboarding mínimo del Owner** `[x]` (Configurar negocio + Elegir rubro/nicho + checklist) — construido completo, gap de backend original ya cerrado.
3. **Catálogo + Ficha + Alta de Producto** `[x]` (Módulo 5) — construido completo, incluida gestión de categorías.
4. **Punto de Venta + Listado + Ficha de Venta** `[x]` (Módulo 7) — construido completo (el corazón del producto).
5. **Dashboard / Resumen Ejecutivo** `[x]` (Módulo 14, Sección A) — construido completo, cierra el loop.

Con estas 5, un tenant nuevo puede loguearse, elegir su rubro, cargar un producto, venderlo, y ver el resultado — el "camino dorado" mínimo del producto **ya está cerrado de punta a punta**. Verificado con datos de prueba reales (`pnpm seed:demo`, tenant `owner@ceom.local`).

### Lo que puede esperar
- Patrimonio, Proveedores, Gastos, Nicho 1 (Insumos/Recetas/Producción), Nicho 4, Simulaciones — funcionalidad real e importante, pero no bloquean el camino dorado de arriba.
- Todo `/admin` salvo Alta de Tenant (que sí es prerequisito real, ya que no hay signup autoservicio) — el resto (catálogo de Planes, Instituciones, Logs) puede operarse manualmente contra la base mientras no haya UI.
- Todo `/portal` — depende de que exista al menos un tenant con Ventas/Financiero cargados para tener algo que mostrarle a una Institución, y del gap de backend del campo `email`.
- Exportación PDF/Excel de Reportes — explícitamente fuera de alcance, ya documentado en el propio módulo.

### Gaps de backend encontrados durante este análisis (consolidado)
Ninguno de estos bloquea la Fase 1 (que sigue cerrada 14/14) — son necesarios recién cuando se implemente la pantalla correspondiente. **Los 3 marcados `resuelto` ya se cerraron durante la construcción de UI de esta sesión** — se dejan en la tabla para no perder el historial de qué gap habilitó qué pantalla:

| Módulo | Gap | Bloquea | Estado |
|---|---|---|---|
| Identidad | Falta `listarUsuarios(tenantId)`, `listarRolesPorTenant(tenantId)` | Listado de colaboradores, listado de roles | pendiente |
| Identidad | Falta `actualizarTenant()`, y una acción para fijar `nichoId` (ej. `asignarNicho`) | Onboarding del Owner | **resuelto** |
| Identidad | Sin tracking persistido de progreso de onboarding | Checklist de bienvenida | **resuelto** (`onboarding_completado_en`) |
| Patrimonio | `listarActivos`/`listarPasivos`/`obtenerActivoPorId`/`obtenerPasivoPorId` existen en `repository.ts` pero no están expuestas en `actions.ts` | Listado y ficha de Activos/Pasivos | pendiente |
| Patrimonio | Sin función que exponga el historial completo de pagos de un Pasivo | Ficha de Pasivo (cronograma) | pendiente |
| Proveedores | Falta `listarComprasPorTenant` con filtro por estado/estadoPago | Listado general de Compras | pendiente |
| Productos | `listarMovimientosStock` existe en `repository.ts` pero no en `actions.ts` | Historial de movimientos de stock | **resuelto** |
| Nicho 1 | No existe `fichaInsumo()` combinada, y **`listarMovimientosInsumo` no existe ni en el repository** (a diferencia de Productos) | Ficha de Insumo con historial — requiere trabajo de backend nuevo, no solo un wrapper | pendiente |
| Ventas | `listarVentas`/`listarGastos` sin filtros de servidor; listado de Ventas sin monto total ni nombres (solo IDs) | Listado de Ventas/Gastos con volumen — aceptable para MVP, revisar si crece | **resuelto** para Ventas (`listarVentasConTotal`); Gastos sigue pendiente |
| Ventas | Sin acción de "cierre agregado" de Evento (cargar el total vendido de una vez) | Gestión de Eventos, flujo de cierre rápido | pendiente |
| Ventas | `registrarPagoVentaSchema` (ruta) no reenviaba `fechaPago` — el módulo ya lo aceptaba | Registrar Pago de Venta con fecha explícita | **resuelto** |
| Consentimiento | `instituciones` no tiene campo `email` | Portal de Entidades Veedoras — magic link (decisión de esta sesión) | pendiente |
| Consentimiento | `listarInstituciones` sin gate de rol visible en el código | Revisar en la auditoría de seguridad de Fase 3 | pendiente |
