# Auditoría de UI/UX — CEOM-ERP

> **Qué es este documento:** diagnóstico completo de la capa visual de CEOM-ERP tras el cierre de
> Fase 1 (117/117 pantallas construidas, ver `docs/ui/pantallas.md`). No propone ni contiene ningún
> cambio de código — es el insumo para planificar la Fase de refactor de UI/UX.
>
> **Fecha:** 2026-07-20. **Entorno auditado:** `https://ceom-erp.vercel.app` (owner@ceom.local,
> tenant "Mi Negocio de Prueba"; ceomadmin-qa@ceom-erp.test), más lectura completa del código fuente
> en `dev` al momento de esta auditoría.
>
> **Metodología:** (1) inventario de rutas vía `docs/ui/pantallas.md` + exploración de
> `src/app/**`; (2) fan-out de 14 agentes de solo-lectura, uno por clúster de módulo/admin/portal/
> componentes compartidos, cada uno leyendo el 100% de los archivos de su clúster y citando
> hallazgos con archivo:línea; (3) recorrido en vivo en el navegador (desktop 1440px como barrido
> principal; muestreo representativo en tablet 768px y móvil 375px sobre un patrón de pantalla por
> tipo — dashboard, POS, listado denso, listado de cards, maestro-detalle, formulario largo — en vez
> de las 117 pantallas × 3 anchos, decisión de alcance explícita dado el volumen; los modales/Dialog
> se cubrieron por lectura de código, no abriendo cada uno de los ~30 en vivo). Los screenshots del
> Browser pane fallaban por timeout en este entorno — se usó el árbol de accesibilidad
> (`read_page`), inspección de estilos computados vía JavaScript y texto de página como evidencia,
> que en la práctica da valores más literales que una captura para temas de layout/padding. Se
> verificaron y descartaron dos falsos positivos durante el propio recorrido (ver nota en UI-004)
> antes de reportarlos como hallazgo.
>
> El inventario completo pantalla-por-pantalla de qué existe y qué hace cada una **ya vive en
> `docs/ui/pantallas.md`** — este documento no lo repite, solo referencia rutas al citar hallazgos.

---

## 1. Resumen ejecutivo

Ocho problemas transversales explican la gran mayoría de las inconsistencias encontradas:

1. **No existe un componente de pestañas ni de "selector de opciones tipo tarjeta/pill" compartido.**
   Cada módulo que necesita sub-navegación interna o un toggle de opciones lo reinventa desde cero.
   El resultado, verificado en código y en vivo, son **al menos 7 mecanismos distintos** para
   resolver "moverse entre secciones hermanas de un módulo" (tab-bar persistente, sub-nav de texto
   que solo vive en la pantalla raíz, un único link "Ver X", un botón suelto, o directamente
   ninguno). Dos sub-módulos completos (Compras dentro de Proveedores, Insumos dentro de
   Producción) son inalcanzables por navegación desde su padre lógico.
2. **El ancho máximo del contenedor de página (`max-w-*`) no sigue ninguna regla.** Es el hallazgo
   más repetido de los 14 análisis de código: prácticamente todos los módulos usan entre 3 y 6
   valores de `max-w` distintos (`2xl` a `6xl`) entre pantallas del mismo tipo (listado vs. listado,
   formulario vs. formulario), sin relación visible con la densidad real de contenido.
3. ~~La navegación móvil está rota en producción~~ — **actualización 2026-07-20: era un falso
   positivo del entorno de pruebas, ya cerrado.** El hotfix de UI-001 encontró que el CSS/React del
   drawer siempre funcionó correctamente; lo que parecía "el sidebar nunca se anima a la vista" era
   que la pestaña de navegador usada para verificar corría con `document.timeline` congelado
   (`visibilityState: "hidden"`), lo que congela cualquier transición CSS en su fotograma inicial —
   confirmado deshabilitando transiciones, el valor final se aplicaba de inmediato. De paso se
   corrigió un gap real que sí existía: el drawer no cerraba con Escape, no atrapaba el foco de
   teclado ni bloqueaba el scroll de fondo — ver UI-001 para el detalle y la verificación.
4. **Dos librerías de formularios conviven sin criterio: react-hook-form+zod y `useState` manual.**
   Dentro del mismo módulo, a veces del mismo archivo, la mitad de los formularios valida con
   schema + mensajes por campo y la otra mitad valida con un `if` suelto y un único string de error
   al final. No hay ninguna señal de por qué un flujo usa uno u otro.
5. **El componente `EmptyState` compartido existe y es bueno, pero se usa por sorteo.** Sirve para
   "cero datos totales" en unas pantallas sí y en otras no; para "el filtro no encontró nada" casi
   nunca se usa (se reimplementa un `<p>` suelto cada vez); y en al menos dos lugares (Logs de
   `/admin`, `NoAutorizado` del Portal) se copia a mano el mismo patrón visual completo en vez de
   importar el componente.
6. **Ningún monto de la aplicación muestra el símbolo o código de moneda.** Confirmado en Dashboard,
   Reportes, Ventas, Patrimonio, Proveedores, Gastos, Producción, Simulaciones, Portal y la Ficha de
   Tenant de `/admin`: todos usan `Number.toLocaleString("es-BO", {...})` sin moneda. El único lugar
   que sí la muestra (Planes y Alta de Tenant en `/admin`, con `.toFixed(2) + " " + moneda`) prueba
   que el patrón existe pero no se aplicó al resto de la app.
7. **Hay al menos 6 utilidades (`formatMoneda`, `formatFecha`, `NavReportes`/`NavSimulaciones`,
   `KpiCard`, el checkbox cuadrado, el avatar circular con inicial) copiadas letra por letra en
   3 a 6 archivos cada una** en vez de vivir en un solo lugar compartido. No es solo deuda técnica:
   ya produjo al menos una divergencia visible al usuario (el sub-nav de "Mi negocio" tiene 5 ítems
   en 4 de sus 5 copias y 4 ítems —sin "Mi Plan"— en la copia de `/app/onboarding`).
8. **El sistema de tokens de diseño (`globals.css`) es sólido y coincide con `docs/design-system.md`
   casi punto por punto** — paleta, radios, sombra de card, tipografía. El problema no es la base,
   es que su aplicación es dispareja: `text-[11px]`/`text-[10px]` (tamaños fuera de la escala
   documentada) aparecen como "eyebrow label" no oficial en más de 15 archivos distintos, y el look
   de `<Card>` se reimplementa a mano con clases sueltas en docenas de lugares en vez de importar el
   componente.

Además de estos 8, se confirmaron en vivo **tres bugs concretos** con causa raíz identificada:
el drawer móvil (arriba), el desborde horizontal de `/app/proveedores/compras` en 375px (fila de
lista rígida sin manejo responsive), y el Dialog de "Nuevo Plan" en `/admin/planes` que se ve
"tipo mobile" en desktop porque el componente `Dialog` compartido fija `sm:max-w-sm` sin que ningún
consumidor lo sobrescriba (`src/components/ui/dialog.tsx:58`) — el mismo defecto está latente en
los otros 4 diálogos de `/admin` y solo se nota en el de Plan por ser el más denso en campos.

---

## 2. Inventario de pantallas y estado de revisión

El inventario funcional completo (117 pantallas/modales, qué hace cada una, qué Server Action usa)
ya vive en `docs/ui/pantallas.md` — no se duplica acá. Esta tabla es el mapa de **qué se revisó y
cómo** en esta auditoría.

Leyenda: **D** = recorrido en vivo en desktop 1440px · **R** = D + muestreo responsive en 768/375px
· **C** = cubierta solo por el análisis de código (no se abrió en vivo en esta tanda, por volumen).

| Ruta | Módulo | Rol | Revisión |
|---|---|---|---|
| `/login` | Auth | Público | D |
| `/app/onboarding` | Identidad | Owner | D |
| `/app` (Inicio/Dashboard) | Reportes/Dashboard | Cualquiera | R |
| `/app/mi-negocio/colaboradores` | Identidad | Owner | D |
| `/app/mi-negocio/roles` | Identidad | Owner | D |
| `/app/mi-negocio/capacidades` | Identidad | Owner | C |
| `/app/mi-negocio/plan` | Suscripción | Cualquiera | D |
| `/app/patrimonio` (+ `[id]`, `nuevo`, `[id]/editar`) | Patrimonio | Owner+permiso | D / C |
| `/app/patrimonio/pasivos` (+ `[id]`, `nuevo`, `[id]/refinanciar`) | Patrimonio | Owner+permiso | D / C |
| `/app/proveedores` (+ `[id]`) | Proveedores | Owner+permiso | D |
| `/app/proveedores/compras` (+ `nuevo`) | Proveedores | Owner+permiso | R (bug confirmado) |
| `/app/productos` (+ `[id]`, `nuevo`, `[id]/editar`) | Productos | Owner+permiso | D / C |
| `/app/produccion` (+ `nuevo`, `capacidad`) | Nicho 1 | Owner+permiso | D |
| `/app/produccion/insumos` (+ `[id]`, `nuevo`, `[id]/editar`) | Nicho 1 | Owner+permiso | D / C |
| `/app/produccion/recetas` | Nicho 1 | Owner+permiso | C |
| `/app/ventas` (POS) | Ventas | Owner+permiso | R |
| `/app/ventas/historial` (+ `[id]`) | Ventas | Owner+permiso | D / C |
| `/app/ventas/clientes` | Ventas | Owner+permiso | D |
| `/app/ventas/canales`, `/metodos-pago`, `/eventos`, `/importar` | Ventas | Owner+permiso | C |
| `/app/gastos` (+ `[id]`, `nuevo`, `[id]/editar`) | Gastos | Owner+permiso | D / C |
| `/app/gastos/recurrentes` | Gastos | Owner+permiso | D |
| `/app/consentimiento` (+ `codigos`, `aprobaciones`, `solicitudes`) | Consentimiento | Owner | D / C |
| `/app/simulaciones` (+ `comparativo`, `historial`, `margen-producto`) | Simulaciones | permiso simulaciones | D / C |
| `/app/reportes` (+ `historico-ventas`, `margen-canal-producto`, `ranking-productos`) | Reportes | permiso financiero/ventas | D / C |
| `/admin/tenants` (+ `nuevo`, `[tenantId]` con 3 tabs) | Panel Admin CEOM | ceom_admin | D |
| `/admin/planes` | Suscripción | ceom_admin | D (bug Dialog confirmado) |
| `/admin/instituciones`, `/admin/logs` | Consentimiento | ceom_admin | C |
| `/portal` (Canjear código / Mi Cartera) | Consentimiento / Monitoreo | Institución | D (canje real ejecutado) |
| `/portal/cartera/[tenantId]` (4 tabs) | Monitoreo Institucional | Institución | C (requiere magic-link a email real, no disponible en este entorno) |

Notas de alcance: los ~30 modales/Dialog del sistema (Ajustes, Registrar Pago, Recibir Compra,
Transferir Activo, etc.) se cubrieron por lectura de código completa, no abriendo cada uno en vivo
en los 3 breakpoints — multiplicaría el recorrido sin agregar hallazgos nuevos de patrón (los
patrones de Dialog ya quedaron establecidos con los que sí se abrieron). El muestreo responsive
se aplicó a un ejemplar representativo por tipo de pantalla, no a las 117 × 3 anchos.

---

## 3. Sistema de diseño: estado actual

### 3.1 Qué existe (y está bien)

`src/app/globals.css` ya define, en Tailwind v4 + shadcn (`style: "base-nova"`), **exactamente** la
paleta y los radios de `docs/design-system.md`:

| Token | Valor | Uso |
|---|---|---|
| `--navy` | `#094979` | Títulos, texto de marca |
| `--sidebar-from` / `--sidebar-to` | `#0e2a47` → `#0b2038` | Degradado del sidebar |
| `--primary` | `#2176bd` | Acciones, ítem activo, links |
| `--pastel-blue` / `--pastel-blue-bg` | `#abd8ff` / `#eaf3fd` | Fondos de badge/ícono |
| `--success-bg`/`--success-text`, `--warning-*`, `--error-*`, `--info-*` | — | Estados semánticos |
| `--gray-border` / `--gray-bg` | `#d9d9d9` / `#eaedf1` | Bordes, fondo de página |
| `--text-body` / `--text-muted` | `#545454` / `#6b7280` | Texto |
| `--radius` = `0.5rem` → `--radius-sm/md/lg/xl/2xl/3xl/4xl` | — | Escala de radios |
| `--shadow-card` | `0 1px 4px rgba(9,49,84,.05), 0 2px 8px rgba(9,49,84,.06)` | Sombra de card |

Componentes compartidos existentes y su cobertura real (`src/components/ui/*`,
`src/components/shared/*`):

- **Primitivas completas y bien resueltas:** `Button` (6 variantes × 8 tamaños, radio 8px exacto en
  el tamaño default), `Badge` (4 variantes semánticas + `outline`, pill correcto), `Card` (con
  `size="sm"|"default"`), `Dialog`, `Input`/`Textarea` (con `text-base`/`md:text-sm` responsive para
  evitar zoom de iOS), `Select`, `Checkbox`, `Switch`, `Skeleton` (existe, pero no se usa en ningún
  lado — ver UI-024), `Stepper` (existe, un solo consumidor — ver UI-013), `PageHeader`,
  `Breadcrumb`, `EmptyState`.
- **Formularios "grandes" compartidos:** `ActivoForm`, `GastoForm`, `InsumoForm`, `PasivoForm`,
  `ProductForm` (`src/components/shared/*-form.tsx`) — los 5 formularios de alta/edición de
  entidades principales.

### 3.2 Qué falta

- **No hay componente `Tabs`.** Es la ausencia con más impacto de todo el sistema — ver categoría
  Navegación, UI-002.
- **No hay `ToggleGroup`/`SegmentedControl`** para el patrón "grupo de botones tipo radio visual"
  (tipo de gasto, activo relacionado, categoría de producto, filtro de estado, criterio de
  ranking) — ver UI-014.
- **No hay `SearchInput`** (ícono + input, hoy compuesto a mano con clases ligeramente distintas en
  cada pantalla que lo necesita).
- **No hay `Avatar`** para el círculo con inicial que aparece en Colaboradores, Historial de Ventas,
  Clientes, Proveedores — cada uno con un tamaño distinto.
- **No hay `lib/format.ts`** — `formatMoneda`/`formatFecha` viven copiadas en más de 10 archivos.
- **`Button` no tiene estado `loading` incorporado** — y, confirmado por grep, **ningún** botón de
  toda la aplicación usa `animate-spin`; el único feedback de "está corriendo" es el texto cambiando
  a gerundio + `disabled`.
- **`Dialog` no tiene prop `size`** — todo diálogo hereda `sm:max-w-sm` (384px) salvo que el
  consumidor pase un `className` que lo sobrescriba explícitamente, cosa que ningún diálogo de
  `/admin` hace (ver UI-018).

### 3.3 Propuesta de tokens y layout estándar (sobre lo que ya existe, sin stack nuevo)

**No hace falta un token nuevo de color/radio/sombra** — el problema no es el token, es la
aplicación. Sí conviene:

1. **Tokenizar el "eyebrow label"** que hoy es `text-[11px] font-medium tracking-wide uppercase`
   copiado a mano en al menos 15 archivos (`plan/page.tsx`, `onboarding-wizard.tsx`,
   `login-form.tsx`, `activos-cliente.tsx`, `pasivo-form.tsx`, `product-form.tsx`,
   `pos-cliente.tsx`, `gastos-cliente.tsx`, `recurrentes-cliente.tsx`, `tenants-cliente.tsx`,
   `ficha-cliente.tsx` de `/admin`, `logs-cliente.tsx`, `canjear-cliente.tsx`,
   `cartera-cliente.tsx`, y más) — agregar `text-2xs` a la escala de Tailwind (o una clase
   utilitaria `.label-eyebrow`) resolvería esto sin decisión de diseño nueva, ya que el valor 11px
   ya está de facto estandarizado en la práctica.
2. **Un único layout de página estándar**, ya implícito en el 90% de las pantallas de `/app` pero
   nunca declarado como regla: `<div className="min-h-screen bg-gray-bg p-6"><div className="mx-auto max-w-{TOKEN} space-y-4 py-6">`.
   Falta decidir **una tabla de `max-w` por tipo de pantalla** (ver UI-009) en vez de dejarlo a
   criterio de quien construye cada ruta.
3. **Extender `PageHeader`** para aceptar `title: ReactNode` (no solo `string`) — resolvería de raíz
   por qué media docena de "fichas" (Producto, Gasto, Insumo, Tenant en `/admin`, Ficha de Tenant en
   `/portal`) reimplementan el header a mano: lo hacen porque necesitan un badge de estado junto al
   nombre y `PageHeader` no lo permite hoy.

---

## 4. Arquitectura de navegación propuesta

### 4.1 Árbol de sidebar — actual vs. propuesto

**Actual** (`src/components/shared/app-shell.tsx:102-115`, confirmado en vivo): 10 ítems planos,
sin submenús, sin excepción:

```
Inicio · Ventas · Catálogo · Patrimonio · Proveedores · Mi negocio (Owner) ·
Gastos · Producción · Simulaciones · Compartir Datos
```

**No están en el sidebar en absoluto:** Reportes (14 pantallas, solo alcanzable con 3 clics desde
el botón secundario "Ver reportes detallados" del Dashboard) y, por construcción, Financiero (nunca
tuvo rutas propias — vive repartido dentro de Reportes y Simulaciones, decisión ya documentada y
razonable, no es un hallazgo).

**Propuesto** — mismo set de 10-11 ítems de nivel superior (no se agranda el sidebar), pero cada uno
que hoy resuelve su sub-navegación con un mecanismo ad-hoc pasa a un submenú real:

```
Inicio
Ventas
  ├─ Vender (POS)              [default]
  ├─ Historial
  ├─ Clientes
  ├─ Canales de venta
  ├─ Métodos de pago
  ├─ Eventos
  └─ Importar histórico
Catálogo (Productos)
Patrimonio
  ├─ Activos                   [default]
  └─ Pasivos
Proveedores
  ├─ Directorio                [default]
  └─ Compras
Producción
  ├─ Producciones               [default]
  ├─ Insumos
  ├─ Recetas
  └─ Capacidad
Gastos
  ├─ Gastos                     [default]
  └─ Recurrentes
Simulaciones
  ├─ Simulador                  [default]
  ├─ Comparativo Multi-SKU
  ├─ Historial
  └─ Margen por Producto
Reportes                        ← nuevo ítem de nivel superior, hoy ausente
  ├─ Resumen Financiero          [default]
  ├─ Histórico de Ventas
  ├─ Margen por Canal
  └─ Ranking de Productos
Compartir Datos (Consentimiento)
  ├─ Generar Código              [default]
  ├─ Códigos Generados
  ├─ Aprobaciones
  └─ Solicitudes
Mi negocio (solo Owner)
  ├─ Negocio
  ├─ Colaboradores               [default]
  ├─ Roles
  ├─ Capacidades Especiales
  └─ Mi Plan
```

`/admin` (`admin-shell.tsx`) ya está bien resuelto a nivel de sidebar (4 ítems planos, sin
submódulos reales por debajo) — no requiere cambio de árbol, solo de consistencia interna (tabs de
Ficha de Tenant, ver UI-002/UI-016).

### 4.2 Regla de cuándo usar sidebar-con-submenú / tabs / breadcrumb

Hoy no existe ninguna regla escrita — cada módulo decidió por su cuenta, y de ahí salen los 7
mecanismos del hallazgo UI-002. Regla propuesta, derivada de lo que YA funciona bien en los
lugares donde el proyecto acertó (Consentimiento y Simulaciones, ambos con tab-bar persistente):

- **Submenú de sidebar** cuando las secciones son del mismo nivel jerárquico que el módulo padre y
  el usuario las visita con frecuencia comparable a lo largo del día (Ventas: POS/Historial/
  Clientes son todas de uso diario). Es el caso de **todos** los sub-módulos listados en 4.1.
- **Tabs horizontales dentro del content area** (debajo de `PageHeader`, mismo patrón ya usado por
  Consentimiento/Simulaciones/Reportes) cuando las secciones comparten el **mismo recurso/contexto
  de datos** y el usuario alterna vistas de un mismo objeto ya seleccionado — ej. Ficha de Tenant en
  `/admin` (Financiero/Operativo/Inventario del mismo tenant), Ficha de Proveedor (Historial de
  Compras/Precios del mismo proveedor), Ficha de Tenant en `/portal`. Esto **no** reemplaza al
  submenú de sidebar — son conceptos distintos (uno navega entre objetos, el otro entre vistas de
  un objeto ya elegido).
- **Breadcrumb** siempre que la pantalla esté a ≥1 nivel de profundidad de un listado (toda ficha,
  todo formulario de alta/edición). Nunca reemplaza al submenú — es wayfinding de "dónde estoy",
  no un menú de hermanos.
- **Nunca más** un link de texto suelto tipo "Ver pasivos"/"Ver activos" o un botón aislado como
  único mecanismo entre 2 secciones de igual jerarquía (Patrimonio, Gastos↔Recurrentes) — eso pasa
  a ser parte del submenú de sidebar.

### 4.3 Comportamiento del sidebar

- **Colapsado + hover-preview** en desktop (ya implementado y funciona bien en `app-shell.tsx`) se
  mantiene tal cual.
- **Drawer en mobile**: el mecanismo de apertura/cierre en sí ya funciona (ver UI-001, cerrado); con
  Escape/foco-atrapado/scroll-lock ya agregados, queda como base sólida para construir los submenús
  de 4.1 sin trabajo de reparación previo.
- Con submenús reales, el drawer mobile necesita un segundo nivel de expand/collapse por ítem
  (acordeón) — hoy no existe ninguna variante de sidebar con 2 niveles, es trabajo nuevo real, no
  solo reordenar lo existente.

---

## 5. Hallazgos detallados

### Navegación

### [UI-001] El drawer del sidebar no se abre visualmente en móvil — ~~RESUELTO~~ (falso positivo de metodología; se agregó accesibilidad real que sí faltaba)
- **Severidad original:** Crítica → **Estado: cerrado el 2026-07-20**, con un hallazgo secundario
  real (accesibilidad de teclado) corregido de paso.
- **Categoría:** Navegación
- **Causa raíz real, contraria a lo reportado originalmente:** el CSS y la lógica de React del
  drawer **estaban y están correctos**. Lo que se documentó como "el transform nunca cambia" era un
  artefacto del entorno de pruebas automatizado: la pestaña del navegador usada para verificar (tanto
  en la auditoría original contra Vercel como en la re-verificación local) se ejecuta con
  `document.visibilityState === "hidden"` y `document.timeline.currentTime` congelado en `0`. Una
  transición CSS en curso tiene la prioridad más alta de toda la cascada (por encima incluso de
  `!important` inline) mientras esté "corriendo" — y con el timeline del documento congelado en el
  instante 0, la transición de 200ms nunca avanza ni un milisegundo, quedando visualmente pegada en
  su valor de partida (`translateX(-100%)`) para siempre. Confirmado de forma concluyente:
  inyectando `* { transition: none !important; }` para sacar la transición de la ecuación, el
  `transform` calculado pasa inmediatamente al valor correcto (`translateX(0)`) — es decir, la regla
  `.app-sidebar.app-sidebar--abierto` (`src/app/globals.css:148-150`) sí gana la cascada como
  corresponde por especificidad, tal como predecía una lectura correcta del CSS. No hubo problema de
  especificidad, ni de orden/capas de Tailwind, ni de que la clase se aplicara a un nodo distinto del
  que tiene el `transform` — las tres sospechas a descartar quedaron descartadas; la causa fue una
  cuarta, no anticipada, específica de cómo esta herramienta de navegador automatizado renderiza la
  pestaña. Un usuario real en un teléfono, con la pestaña visible/enfocada, tiene
  `document.timeline` corriendo con normalidad y la animación completa sin problemas en 200ms.
- **Lo que sí era un gap real** (parte de "reparar el drawer" en el sentido que pedía la tarea, aunque
  independiente del bug de transform): el drawer no tenía manejo de tecla Escape, no atrapaba el foco
  de teclado dentro de sí mismo mientras estaba abierto, no bloqueaba el scroll del `body`, y no
  devolvía el foco al botón que lo abrió al cerrarse — el único cierre disponible antes de este fix
  era con mouse/touch (clic en la "X" o en el overlay). Corregido en
  `src/components/shared/app-shell.tsx` y, por compartir el mismo mecanismo, también en
  `src/components/shared/admin-shell.tsx` (`AdminShell`). `PortalTopbar` (`/portal`) no tiene drawer
  ni menú mobile de ningún tipo — confirmado en código y en vivo (`document.querySelector('aside')`
  y `.app-mobile-bar` no existen en esa superficie), así que no había nada que corregir ahí.
- **Verificación real realizada** (servidor de desarrollo local, navegación fresca a 375px, tras el
  fix): abrir el drawer agrega la clase y bloquea `document.body.style.overflow` a `"hidden"`; el
  foco se mueve automáticamente al primer elemento enfocable del `<aside>` al abrir; `Tab` en el
  último elemento enfocable envuelve al primero y `Shift+Tab` en el primero envuelve al último
  (atrapado de foco confirmado en ambas direcciones, en `/app` con 14 elementos enfocables y en
  `/admin` con 6); `Escape` cierra el drawer, restaura el `overflow` original del `body` y devuelve
  el foco al botón "Abrir menú"; el clic en el overlay de fondo (comportamiento preexistente) se
  siguió verificando funcional tras el cambio. `pnpm typecheck`, `pnpm lint` y `pnpm test` (167/167)
  pasan limpios.
- **Impacto en el usuario:** ninguno del bug original (nunca existió para un usuario real). El gap de
  accesibilidad sí era real: un usuario de teclado no podía cerrar el drawer sin mouse/touch, y el
  scroll de fondo permanecía activo mientras el menú estaba abierto.
- **Esfuerzo real:** S — cambio acotado a los dos archivos de shell, sin tocar CSS ni estructura.
- **Depende de:** ninguno.

### [UI-002] No existe un componente de pestañas — 7 mecanismos ad-hoc distintos resuelven la misma necesidad
- **Severidad:** Crítica
- **Categoría:** Navegación
- **Alcance:** Ventas (POS), Mi negocio (4 pantallas), Producción, Patrimonio, Gastos, Consentimiento
  (4 pantallas), Simulaciones (4 pantallas), Reportes (4 pantallas), Proveedores (tabs de Ficha),
  Admin (Ficha de Tenant, Instituciones), Portal (Ficha de Tenant) — prácticamente todos los módulos
  con más de una pantalla.
- **Evidencia** (uno por mecanismo, con archivo:línea del primer caso):
  1. **Tab-bar persistente tipo botón, con el ítem actual incluido** — Consentimiento
     (`generar-cliente.tsx:44-70`, componente `NavConsentimiento` reusado por import),
     Simulaciones (`simulador-cliente.tsx:71-93`, **copiado** 4 veces en vez de importado —
     `comparativo-cliente.tsx:44-66`, `historial-cliente.tsx:50-72`,
     `margen-producto-cliente.tsx:25-47`), Reportes (`resumen-financiero-cliente.tsx:34-56`,
     también copiado 4 veces).
  2. **Sub-nav de texto persistente, ítem actual como `<span>` sin link** — Mi negocio
     (`colaboradores-cliente.tsx:59-77`, función local `SubnavMiNegocio` redefinida 6 veces, ver
     UI-006 para el bug de drift real que esto ya causó).
  3. **Sub-nav de texto que SOLO existe en la pantalla raíz y desaparece en las hijas** — Ventas
     (`ventas/page.tsx:56-77`, 6 links; ninguna de las 6 sub-páginas los repite, solo tienen
     `Breadcrumb` de vuelta a la raíz).
  4. **Fila de botones outline dentro del slot `action` de `PageHeader`, solo en la raíz** —
     Producción (`producciones-cliente.tsx:165-176`, Insumos/Recetas/Capacidad).
  5. **Un único link de texto suelto, bidireccional entre 2 secciones** — Patrimonio
     (`patrimonio/page.tsx:36-38` "Ver pasivos" ⟷ `pasivos/page.tsx:38-40` "Ver activos").
  6. **Un botón aislado en una sola dirección + Breadcrumb en la dirección inversa** — Gastos
     (`gastos-cliente.tsx:104-107` botón "Recurrentes" → `recurrentes/page.tsx:24` Breadcrumb de
     vuelta).
  7. **Tabs reales con `useState` + botones a mano, sin componente `Tabs`** — Ficha de Proveedor
     (`ficha-proveedor-cliente.tsx:64,160-179`), Ficha de Tenant en `/admin`
     (`ficha-cliente.tsx:75-79,308,406-419` — con un **segundo** selector de período apilado debajo,
     `líneas 423-438`, con un lenguaje visual completamente distinto: pill redondeada rellena vs.
     subrayado inferior), Instituciones en `/admin` (`instituciones-cliente.tsx:271-292`, tabs
     Cartera/Datos de contacto con `py-2.5` y color activo `text-navy`, distinto de los `py-3.5`/
     `text-primary` de la Ficha de Tenant del mismo panel), Ficha de Tenant en `/portal`
     (`ficha-cliente.tsx:154-177` y, apiladas debajo, pills de período en `líneas 180-197` — mismo
     patrón array→botón→clase condicional reescrito dos veces en el mismo archivo, con tratamiento
     visual distinto entre sí).
- **Impacto en el usuario:** cada módulo "se siente" construido por un equipo distinto. Además,
  3 de los 7 mecanismos (Ventas, Producción, Proveedores-directorio→Compras) directamente **rompen**
  la navegación entre secciones hermanas — ver UI-003.
- **Propuesta:** construir `components/ui/tabs.tsx` (activo derivado de `usePathname()`, nunca pasado
  a mano por archivo) para el caso "tabs de vista sobre el mismo recurso", y resolver el caso
  "sub-navegación de módulo" con el submenú de sidebar propuesto en 4.1 — eliminando la necesidad de
  reinventar un patrón de tabs para eso.
- **Esfuerzo:** M (el componente) + L (migrar los ~10 consumidores).
- **Depende de:** ninguno.

### [UI-003] Rutas huérfanas: no hay camino de navegación hacia/desde secciones enteras de un módulo
- **Severidad:** Crítica
- **Categoría:** Navegación
- **Alcance:** `/app/proveedores/compras` (+ `nuevo`), `/app/produccion/insumos` (+ `[id]`, `nuevo`,
  `[id]/editar`).
- **Evidencia:** confirmado en vivo (árbol de accesibilidad completo de `/app/proveedores`, sin
  ningún link/botón hacia Compras) y en código: `src/components/shared/app-shell.tsx:107` el sidebar
  solo apunta a `/app/proveedores`; ni `directorio-cliente.tsx` ni `ficha-proveedor-cliente.tsx`
  importan un link hacia `/app/proveedores/compras` — confirmado por el agente de código ("el
  Directorio... NO tiene ningún link/tab hacia 'Compras'"). Dirección inversa sí existe
  (`compras/page.tsx:35`, `Breadcrumb` de vuelta a Proveedores) — es un huérfano de un solo sentido.
  Peor aún, `/app/produccion/insumos` no tiene **ningún** camino en ninguna dirección: el listado no
  tiene `Breadcrumb` ni link de vuelta a Producción, confirmado por el agente de código ("Insumos-
  listado... ausente [Breadcrumb]... la ausencia en Insumos-ficha es la más notoria").
- **Impacto en el usuario:** un Owner que use Compras o Insumos con cierta frecuencia solo puede
  llegar ahí por historial del navegador o memorizando la URL — cada sesión nueva, cada vez que
  entra desde el sidebar, tiene que "descubrir" de nuevo que esas pantallas existen.
- **Propuesta:** cubierto por el submenú de sidebar de la sección 4.1 (Proveedores→Compras,
  Producción→Insumos), que resuelve ambos casos de una sola vez sin necesitar un mecanismo nuevo por
  módulo.
- **Esfuerzo:** S (una vez que exista el submenú de sidebar).
- **Depende de:** el submenú de sidebar (4.1), o al menos un breadcrumb/link mínimo como parche
  previo.

### [UI-004] Reportes es un módulo completo de 14 pantallas sin ítem propio en el sidebar
- **Severidad:** Alta
- **Categoría:** Navegación
- **Alcance:** `/app/reportes` y sus 3 sub-rutas.
- **Evidencia:** confirmado en vivo y en código — el array `items` de `app-shell.tsx:102-115` no
  incluye Reportes. El único camino de entrada es el botón "Ver reportes detallados" dentro del
  Dashboard (`dashboard-resumen.tsx:98`), confirmado por el agente de código del clúster
  reportes-dashboard: "Reportes no tiene ítem propio en el sidebar... 3 clics mínimo desde el
  sidebar para llegar a cualquier reporte que no sea el Resumen Financiero, y el módulo entero es
  inalcanzable si el usuario no repara en ese botón secundario dentro de Inicio".
- **Impacto en el usuario:** un usuario que quiera consultar el Histórico de Ventas o el Ranking de
  Productos sin pasar por el Dashboard primero no tiene manera de saber que esas pantallas existen.
- **Propuesta:** agregar "Reportes" como ítem de nivel superior del sidebar (ver 4.1) — es la
  correción de mayor impacto por esfuerzo de toda esta auditoría.
- **Esfuerzo:** S.
- **Depende de:** ninguno. **Decisión abierta** — ver sección 7.

### [UI-005] El sub-nav de "Mi negocio" está duplicado 6 veces y ya divergió (falta un ítem en una copia)
- **Severidad:** Alta
- **Categoría:** Navegación
- **Alcance:** `/app/mi-negocio/colaboradores`, `/roles`, `/capacidades`, `/plan`, y
  `/app/onboarding` (que reusa la sección "Negocio" del mismo sub-nav).
- **Evidencia:** confirmado en vivo (comparando el árbol de accesibilidad de
  `/app/mi-negocio/colaboradores`, que muestra 5 ítems — Negocio/Colaboradores/Roles/Capacidades
  Especiales/Mi Plan — contra `/app/onboarding`, que muestra solo 4, sin "Mi Plan") y en código: la
  función `SubnavMiNegocio()` está redefinida por separado en `colaboradores-cliente.tsx:59-77`,
  `roles-cliente.tsx:88-106`, `capacidades-cliente.tsx:63-81`, `plan/page.tsx:41-59`, y una **quinta**
  variante inline y distinta en `onboarding/page.tsx:21-32` — a esta última le falta el link "Mi
  Plan" y usa `mb-6` en vez de `mb-4` que usan las otras 4. No hay estado activo derivado de
  `usePathname()` en ninguna de las 5 — el ítem "activo" está hardcodeado por archivo.
- **Impacto en el usuario:** desde `/app/onboarding` (reusado como pantalla "Editar Negocio"), el
  usuario no tiene forma de llegar a "Mi Plan" sin volver primero a Colaboradores.
- **Propuesta:** extraer un único componente `SubnavMiNegocio` (o reemplazarlo directamente por el
  submenú de sidebar de 4.1) con `activo` derivado de `usePathname()`, nunca pasado a mano.
- **Esfuerzo:** S.
- **Depende de:** ninguno.

### [UI-006] Breadcrumb con adopción inconsistente — presente en unas fichas, ausente en sus pares del mismo nivel
- **Severidad:** Media
- **Categoría:** Navegación
- **Alcance:** `/app/produccion/insumos/[id]` (sin, mientras `[id]/editar` sí tiene), `/app/proveedores`
  y `/app/proveedores/[id]` (sin, en todo el maestro-detalle), `/app/patrimonio/pasivos` (sin, resuelto
  con un link "Ver activos" en su lugar), `/admin` (solo 1 de 6 pantallas lo usa — `/admin/tenants/nuevo`
  — el resto reimplementa un link "← Volver a X" con clases distintas al componente real), `/portal`
  (ninguna de las 3 pantallas lo usa, mismo patrón "← Volver a Mi Cartera" ad-hoc).
- **Evidencia:** `ficha-insumo-cliente.tsx:542-578` (header ad-hoc, sin Breadcrumb) vs.
  `editar-insumo-cliente.tsx`/`editar/page.tsx:26-32` (sí tiene, 3 niveles) — mismo sub-módulo, misma
  profundidad. `admin/(shell)/tenants/[tenantId]/ficha-cliente.tsx:349-352` usa
  `<Link className="... text-xs ... "><ArrowLeft className="size-3.5" />Volver a Tenants</Link>` en
  vez de `<Breadcrumb>` (que usa `ChevronRight` y `text-sm`, no `text-xs` + flecha).
- **Impacto en el usuario:** en las pantallas sin breadcrumb ni sub-nav, la única forma de "volver"
  es el sidebar (que no necesariamente apunta al lugar correcto) o el botón atrás del navegador.
- **Propuesta:** regla simple y ya semi-aplicada: toda pantalla a ≥1 nivel de un listado lleva
  `<Breadcrumb>`, sin excepción — reemplazar los "← Volver a X" ad-hoc de `/admin` y `/portal` por el
  componente real.
- **Esfuerzo:** S.
- **Depende de:** ninguno.

### [UI-007] Terminología de nivel superior no coincide entre sidebar, H1 y breadcrumb para el mismo destino
- **Severidad:** Baja
- **Categoría:** Navegación / Copy
- **Alcance:** Ventas (sidebar "Ventas" → H1 "Vender"), Consentimiento (sidebar "Compartir Datos"
  describe solo 1 de sus 4 funciones), Ventas/Importar ("Importar historial" en nav/breadcrumb vs.
  "Importar ventas históricas" en H1), Producción/Nuevo ("Registrar Lote" en breadcrumb vs.
  "Registrar Producción de un lote" en H1 vs. "Confirmar Producción" en el botón), Consentimiento/
  Códigos ("Códigos Generados" en el pill de nav vs. "Códigos de Acceso generados" en el H1).
- **Evidencia:** citada arriba, archivo:línea disponible en los reportes de clúster de Ventas
  (`page.tsx:54,59,64`), Producción (`nuevo/page.tsx:33,58-61`) y Consentimiento
  (`generar-cliente.tsx:51` vs. `codigos-cliente.tsx:57`).
- **Impacto en el usuario:** fricción menor de reconocimiento ("¿estoy en el lugar que pensaba?"),
  más relevante para un usuario nuevo que para uno frecuente.
- **Propuesta:** unificar cada trío sidebar-label/H1/breadcrumb a una sola redacción por destino.
- **Esfuerzo:** S.
- **Depende de:** ninguno.

### [UI-008] Los 4 stat-cards de "Mi Cartera" (Portal) y los chips "Por plan"/"Por nicho" (Admin/Tenants) invitan a un clic que no filtra nada
- **Severidad:** Baja
- **Categoría:** Navegación
- **Alcance:** `/portal` (Mi Cartera), `/admin/tenants`.
- **Evidencia:** `cartera-cliente.tsx:107-142` (4 stat-cards de Total/Activos/Solo lectura/
  Bloqueados) y `tenants-cliente.tsx:119-140` (chips "Por plan"/"Por nicho") no tienen `onClick` —
  son puramente informativos pese a la afordancia visual de tarjeta/chip clickeable.
- **Impacto en el usuario:** affordance falsa — visualmente invitan a filtrar, no lo hacen.
- **Propuesta:** conectar el `onClick` al filtro existente, o quitarles el tratamiento visual de
  "elemento interactivo" (hover, cursor) si se decide dejarlos puramente informativos.
- **Esfuerzo:** S.
- **Depende de:** ninguno.

---

### Layout

### [UI-009] El ancho máximo del contenedor (`max-w-*`) no sigue ninguna regla — 3 a 6 valores por módulo
- **Severidad:** Alta
- **Categoría:** Layout
- **Alcance:** transversal — confirmado en los 12 clústeres de módulo con al menos 3 valores
  distintos cada uno. Ejemplos literales:
  - **Patrimonio:** `max-w-5xl` (Activos, `patrimonio/page.tsx:31`) vs. `max-w-4xl` en las otras 6
    rutas del mismo módulo (Editar, Nuevo, Pasivos-listado, Pasivo-ficha, Refinanciar, Pasivo-nuevo).
  - **Proveedores:** `max-w-6xl` (Directorio/Ficha, `(directorio)/layout.tsx:32`) vs. `max-w-5xl`
    (Compras, `compras/page.tsx:34`) vs. `max-w-2xl` (Nueva compra, `nuevo/page.tsx:29`).
  - **Producción:** 6 valores distintos en 8 rutas (`5xl`, `6xl`×3, `3xl`, `4xl`, `2xl`×2).
  - **Ventas:** `5xl` (raíz, Eventos), `4xl` (detalle, Historial, Clientes, Canales, Importar), `3xl`
    (Métodos de pago).
  - **Gastos:** `5xl` (listado, Recurrentes), `4xl` (detalle), `2xl` (Nuevo, Editar).
  - **Simulaciones:** `5xl` (Simulador, Comparativo), `4xl` (Historial), `3xl` (Margen por Producto).
  - **Reportes:** `5xl` (Resumen, Histórico), `6xl` (Margen por Canal), `4xl` (Ranking).
  - **Admin:** ninguno (Tenants, Ficha, Planes) vs. `6xl` (Instituciones) vs. `2xl` (Nuevo Tenant)
    vs. `4xl` (Logs).
- **Impacto en el usuario:** el contenido "salta" de ancho al navegar entre pantallas del mismo
  módulo sin ninguna razón de contenido perceptible — la sensación es de inconsistencia visual
  constante, el hallazgo con más superficie de todos los reportados.
- **Propuesta:** definir 3-4 anchos con criterio explícito y aplicarlos por tipo de pantalla, no por
  módulo — ej.: `max-w-4xl` para fichas/formularios de una columna, `max-w-6xl` para listados densos
  o maestro-detalle, `max-w-3xl` para formularios cortos (1-2 secciones). Esto es la base de la
  Fase A del backlog.
- **Esfuerzo:** M (es mecánico pero toca ~50 archivos).
- **Depende de:** ninguno — es fundación pura, debería ir antes que cualquier otro trabajo visual.

### [UI-010] Tamaño del H1 de página inconsistente cuando no se usa `PageHeader`
- **Severidad:** Media
- **Categoría:** Layout / Componentes
- **Alcance:** `/admin` (3 tamaños en 6 pantallas: `text-2xl` en Tenants/Ficha/Planes, `text-lg` en
  Instituciones, `text-xl` correcto vía `PageHeader` en Nuevo Tenant/Logs), `/portal` (`text-2xl` en
  ambas pantallas que reimplementan el header a mano), `/app/gastos/[id]` y `/app/gastos/nuevo`
  (`text-xl` correcto pero con 2 estructuras JSX distintas), `/app/proveedores` y `/app/proveedores/[id]`
  (`text-sm`/`text-lg` ad-hoc, ninguno usa `PageHeader`).
- **Evidencia:** `tenants-cliente.tsx:58` (`text-2xl`) vs. `instituciones-cliente.tsx:121`
  (`text-lg`) vs. `page-header.tsx:17` (`text-xl`, el real) — 3 tamaños para el mismo elemento
  conceptual dentro de un panel de 6 pantallas.
- **Impacto en el usuario:** jerarquía visual de "qué pantalla es esta" varía sin razón entre
  módulos que deberían sentirse parte del mismo sistema (especialmente notorio dentro de `/admin`,
  que es un panel interno chico donde la inconsistencia es más visible por comparación directa).
- **Propuesta:** extender `PageHeader` para aceptar `title: ReactNode` (ver 3.3) y migrar los ~10
  headers ad-hoc a usarlo.
- **Esfuerzo:** M.
- **Depende de:** la extensión de `PageHeader` (3.3).

### [UI-011] Bug confirmado: `/app/proveedores/compras` desborda horizontalmente en móvil
- **Severidad:** Alta
- **Categoría:** Layout
- **Alcance:** `/app/proveedores/compras` (375px).
- **Evidencia:** verificado en vivo — a 375px, `document.documentElement.scrollWidth` = 460px contra
  un `clientWidth` de 375px (85px de desborde de página completa, no contenido). Causa raíz
  identificada con inspección de estilos computados: cada fila de compra es
  `<div className="flex items-center gap-3 p-4 text-sm">` (`compras-cliente.tsx`, confirmado por el
  agente de código como el mismo contenedor en `líneas 444` para el ancho fijo del monto) — nombre +
  fecha + monto + 2 badges + botón "Pagar" en una sola línea flex sin `flex-wrap` ni manejo
  responsive alternativo. Contraste positivo confirmado en la misma sesión: `/admin/tenants` (tabla
  real) resuelve el mismo problema de "contenido denso en viewport angosto" correctamente, con un
  wrapper `overflow-x-auto` que contiene el scroll dentro de la tabla en vez de desbordar la página.
- **Impacto en el usuario:** en un teléfono, la página entera de Compras se corre lateralmente — un
  usuario mobile que llegue a esta pantalla la encontraría rota.
- **Propuesta:** aplicar el mismo patrón que ya funciona en `/admin/tenants` (`overflow-x-auto` en
  el contenedor de la lista) como parche mínimo, o rediseñar la fila para que colapse a 2 líneas en
  mobile (nombre+fecha arriba, monto+badges+acción abajo).
- **Esfuerzo:** S.
- **Depende de:** ninguno.

### [UI-012] Bug confirmado: Dialog de "Nuevo Plan" en `/admin/planes` se ve "mobile" en desktop
- **Severidad:** Alta
- **Categoría:** Layout / Componentes
- **Alcance:** `/admin/planes` (confirmado); latente en los otros 4 diálogos de `/admin`
  (`CambiarPlanDialog`, `CambiarEstadoSuscripcionDialog`, `InstitucionFormDialog`,
  `VincularTenantDialog`, `NuevaSolicitudDialog`) — no visible ahí solo porque tienen menos campos.
  Hallazgo ya registrado como "pendiente de pulido visual" en `docs/ui/pantallas.md` (verificación
  manual del usuario, 2026-07-18) — esta auditoría le agrega la causa raíz exacta.
- **Evidencia:** verificado en vivo con `getBoundingClientRect()` sobre el diálogo en un viewport de
  1440px: ancho real 364.8px (`left: 537.6, right: 902.4`). Causa raíz: `src/components/ui/dialog.tsx:58`
  fija `sm:max-w-sm` (384px) como ancho máximo por defecto de **todo** `DialogContent`, sin prop
  `size`; `planes-cliente.tsx:167` solo agrega `className="max-h-[90vh] overflow-y-auto"`, nunca
  sobrescribe el `max-w`. El formulario de Plan tiene 9 campos/controles (nombre, precio+moneda,
  días de invitación+gracia, 3 switches, checklist de módulos veedor) — el más denso de todo el
  panel — comprimidos en una columna de 384px incluso en un viewport de 1440px.
- **Impacto en el usuario:** el modal más importante del catálogo de planes (con el que se configura
  qué ve cada tenant) se percibe como un bug obvio de "mobile en desktop" para cualquier admin de
  CEOM.
- **Propuesta:** agregar un `size` (o simplemente un `className` con `sm:max-w-lg`/`sm:max-w-2xl`)
  específico para `PlanFormDialog`, sin tocar el default de `Dialog` (que puede seguir siendo angosto
  para diálogos de 1-3 campos).
- **Esfuerzo:** S.
- **Depende de:** ninguno.

### [UI-013] `Stepper` existe pero casi no se usa — 2 "wizards" lo simulan a mano sin serlo
- **Severidad:** Media
- **Categoría:** Layout / Componentes
- **Alcance:** `/app/produccion/nuevo`, `/app/ventas/importar`.
- **Evidencia:** `components/ui/stepper.tsx` tiene un solo consumidor real
  (`onboarding-wizard.tsx`, confirmado por grep). En `nueva-produccion-cliente.tsx:160-173`, el
  indicador de "3 pasos" es un `<span>` numerado a mano que ni siquiera es secuencial (los 3
  "pasos" se muestran todos a la vez, sin next/back — decisión de producto ya documentada y
  razonable, pero el indicador visual promete un flujo que no existe). En `importar-cliente.tsx:182,237`,
  los "pasos" son texto plano numerado (`"1. Cargar archivo"`, `"2. Vista previa de datos"`) sin
  ningún indicador visual de progreso.
- **Impacto en el usuario:** menor — es más una oportunidad de reuso perdida que un problema visible,
  pero el indicador de pasos de Producción puede confundir (parece un wizard navegable y no lo es).
- **Propuesta:** decidir explícitamente si estas 2 pantallas deberían ser wizards reales con
  `Stepper` (cambio de producto, no solo de UI) o si el indicador debería dejar de parecer uno —
  ver sección 7.
- **Esfuerzo:** S (quitar la falsa promesa visual) / M (convertir a wizard real).
- **Depende de:** decisión de producto (sección 7).

---

### Componentes

### [UI-014] No existe `ToggleGroup`/selector de tarjetas compartido — reimplementado de forma independiente en 10+ lugares
- **Severidad:** Alta
- **Categoría:** Componentes
- **Alcance:** Gasto (tipo de gasto, `gasto-form.tsx:82-100`), Pasivo (activo relacionado,
  `pasivo-form.tsx:112-154`, con iconos + badge "Seleccionado" que Gasto no tiene), Ventas (pills de
  categoría, `pos-cliente.tsx:200-227`; pills de estado en Historial, `historial-cliente.tsx:73-99`;
  toggle tipo/estado en Nueva Compra, `nueva-compra-cliente.tsx:74-88,242-256`), Proveedores (tabs de
  Ficha con el mismo patrón de clases, `ficha-proveedor-cliente.tsx:163-166`; pills de filtro en
  Compras, `compras-cliente.tsx:395-416`), Onboarding (selector de canales y de rubro,
  `onboarding-wizard.tsx:367-394,467-491`), Admin (selector de plan en Nuevo Tenant,
  `nuevo-tenant-cliente.tsx:118-133`), Dashboard/Ranking (toggle "Por cantidad/Por margen" con
  padding distinto entre `dashboard-resumen.tsx:257-266` y `ranking-productos-cliente.tsx:93-104`).
- **Evidencia:** cada instancia reimplementa el mismo concepto ("grupo de opciones mutuamente
  excluyentes, mostradas como pill o card, con borde/fondo condicional") con clases casi idénticas
  pero nunca la misma función ni el mismo padding — confirmado archivo por archivo en 6 de los 14
  clústeres.
- **Impacto en el usuario:** pequeñas variaciones de padding/color activo entre instancias que
  deberían verse y comportarse igual (ej. el toggle "rotación/margen" tiene `px-2 py-1` en Dashboard
  y `px-3 py-1.5` en Ranking).
- **Propuesta:** un componente `ToggleGroup` (pills, para filtros/criterios) y un componente
  `OptionCard`/`SelectableCard` (tarjetas con icono, para selección de entidad relacionada) cubrirían
  la mayoría de estos casos.
- **Esfuerzo:** M (componentes) + L (migrar ~10 consumidores).
- **Depende de:** ninguno.

### [UI-015] react-hook-form+zod convive con `useState` manual sin ningún criterio, incluso dentro del mismo archivo
- **Severidad:** Alta
- **Categoría:** Componentes
- **Alcance:** transversal. Ejemplos confirmados:
  - **Mi negocio:** RHF+zod en `InvitarColaboradorDialog`/`EditarRolDialog`; `useState` plano en
    `TransferirOwnerDialog`, el form principal de Roles, y `AgregarOverrideDialog` — 3 patrones en un
    mismo módulo de 4 pantallas.
  - **Proveedores/Compras:** RHF+zod en `ProveedorFormDialog` y `NuevaCompraCliente`; `useState`
    suelto en `RecibirDialog`, `RegistrarPagoDialog` y `AjusteDialog` (los 3 en
    `compras-cliente.tsx`).
  - **Ventas:** RHF+zod en las páginas dedicadas de Clientes/Canales/Métodos/Eventos; `useState`
    plano en los diálogos rápidos de "Nuevo canal"/"Nuevo método" **dentro del propio POS**
    (`pos-cliente.tsx:436-479`) para la **misma** acción de negocio.
  - **Gastos:** RHF+zod en `GastoForm`/`NuevaPlantillaDialog`; `useState` en
    `GestionarCategoriasGastoDialog`/`RegistrarPagoDialog`.
  - **Producción:** el único formulario con RHF+zod de sus 8 rutas es `InsumoForm` — los otros 6
    (Ajuste de Producción, Nueva Producción completa, Receta nueva/detalle, Compra/Ajuste/Merma de
    Insumo) usan `useState`.
  - **Admin:** único RHF+zod es `/admin/tenants/nuevo`; los 6 diálogos restantes del panel usan
    `useState`.
  - **Portal, Consentimiento, Simulaciones:** ninguno de sus formularios usa RHF+zod.
- **Impacto en el usuario:** los formularios con `useState` manual, sin excepción, no muestran
  mensaje de error por campo individual — solo un string genérico al pie tras el submit fallido; los
  formularios con RHF+zod sí. La experiencia de "qué pasa si me equivoco" cambia según en qué modal
  esté el usuario, dentro del mismo flujo de negocio.
- **Propuesta:** definir una regla simple ("todo formulario con ≥2 campos usa RHF+zod") y aplicarla
  primero a los formularios de mayor uso diario (POS, Compras).
- **Esfuerzo:** L (toca ~25 formularios).
- **Depende de:** ninguno.

### [UI-016] `EmptyState` compartido existe pero se usa de forma inconsistente
- **Severidad:** Alta
- **Categoría:** Componentes / Estados
- **Alcance:** transversal — confirmado en los 14 clústeres.
- **Evidencia:**
  - **Se usa correctamente** para "cero datos totales" en: Patrimonio (Activos/Pasivos), Proveedores
    (índice), Productos, Producción (los 4 listados), Ventas (Clientes/Canales/Métodos/Eventos),
    Gastos.
  - **Nunca se usa** para "el filtro/búsqueda no encontró nada" en ninguna de esas mismas pantallas
    — todas reimplementan un `<p className="... text-text-muted">` suelto para ese caso, pese a que
    es exactamente el mismo componente el que ya resuelve el otro caso en la misma pantalla.
  - **Nunca se usa** en absoluto en: Historial de Ventas (mezcla "cero total" y "cero por filtro" en
    el mismo `<p>`), Consentimiento (3 pantallas), Simulaciones (4 pantallas), Reportes (5
    pantallas), Admin (6 pantallas), Portal (3 pantallas).
  - **Se reimplementa a mano el patrón visual completo** (ícono en círculo pastel + texto) en vez de
    importar el componente en: `/admin/logs` (`logs-cliente.tsx:128-133`) y `NoAutorizado` del Portal
    (`ficha-cliente.tsx:60-72`, con `gap-2/py-16` en vez de `gap-3/p-10` del original — ni siquiera
    es una copia exacta).
- **Impacto en el usuario:** el "vacío por filtro" se ve y se siente distinto según el módulo — a
  veces con ícono y CTA, casi siempre solo texto gris centrado.
- **Propuesta:** usar `<EmptyState>` también para "vacío por filtro" (con un título distinto, sin
  `action` de creación ya que no aplica) en las ~15 pantallas que hoy lo reimplementan a mano.
- **Esfuerzo:** M.
- **Depende de:** ninguno.

### [UI-017] `formatMoneda`/`formatFecha` y otras utilidades duplicadas letra por letra en 6-10+ archivos
- **Severidad:** Media
- **Categoría:** Componentes
- **Alcance:** al menos `activos-cliente.tsx`, `ficha-activo-cliente.tsx`, `pasivos-cliente.tsx`,
  `ficha-pasivo-cliente.tsx` (Patrimonio); `ficha-proveedor-cliente.tsx`, `compras-cliente.tsx`
  (Proveedores); `gastos-cliente.tsx`, `ficha-gasto-cliente.tsx`, `recurrentes-cliente.tsx`
  (Gastos); `simulador-cliente.tsx`, `comparativo-cliente.tsx`, `historial-cliente.tsx`,
  `margen-producto-cliente.tsx` (Simulaciones); `dashboard-resumen.tsx`,
  `resumen-financiero-cliente.tsx`, `historico-ventas-cliente.tsx` (Reportes); `ficha-cliente.tsx`
  de `/admin` y de `/portal`. También `NavReportes`/`NavSimulaciones` (ver UI-002) y `KpiCard`
  (Simulaciones, duplicado 2 veces con una prop `destacada` de más en una copia).
- **Evidencia:** confirmado como código byte-idéntico en cada uno de los reportes de clúster citados
  arriba, con archivo:línea específico en cada uno.
- **Impacto en el usuario:** indirecto pero real — es la causa raíz de que el formato de moneda/fecha
  termine divergiendo entre pantallas sin que nadie lo decida a propósito (ver UI-030, UI-031). Cada
  copia es una oportunidad de que una futura corrección (ej. agregar "Bs") se aplique en un lugar y
  se olvide en los otros 9.
- **Propuesta:** extraer a `src/lib/format.ts` (junto a `cn()` que ya vive en `lib/utils.ts`).
- **Esfuerzo:** M.
- **Depende de:** ninguno — es la base técnica que hace viable arreglar UI-030/031 de una sola vez.

### [UI-018] `Dialog` no tiene prop de tamaño — todo diálogo hereda 384px salvo override manual
- **Severidad:** Media
- **Categoría:** Componentes
- **Alcance:** los ~30 diálogos de la aplicación; manifestado visiblemente solo en el de Plan
  (UI-012), pero latente en cualquier diálogo con más de 3-4 campos.
- **Evidencia:** `src/components/ui/dialog.tsx:58`.
- **Impacto en el usuario:** ver UI-012 — mismo origen, cualquier diálogo futuro con varios campos
  reproducirá el mismo problema si nadie recuerda pasar un `className` de ancho.
- **Propuesta:** agregar `size?: "sm" | "md" | "lg"` a `DialogContent` con valores por defecto
  sensatos (`sm` = actual 384px, `md` ≈ 512px, `lg` ≈ 640px).
- **Esfuerzo:** S.
- **Depende de:** ninguno.

### [UI-019] Bug de interacción: botón anidado dentro de botón en el checklist de módulos veedor de Planes
- **Severidad:** Alta
- **Categoría:** Componentes
- **Alcance:** `/admin/planes` (`PlanFormDialog`).
- **Evidencia:** `planes-cliente.tsx:264-286` — cada opción de "Módulos veedor permitidos" es un
  `<button type="button" onClick={() => toggleModulo(modulo)}>` que contiene en su interior un
  `<Switch checked={marcado} onCheckedChange={() => toggleModulo(modulo)} />` (línea 282).
  `Switch` renderiza internamente su propio elemento interactivo (base-ui `SwitchPrimitive.Root`) —
  es HTML inválido (control interactivo dentro de otro) y, salvo que el primitivo detenga la
  propagación del evento, un clic exactamente sobre el switch dispara `toggleModulo` dos veces (una
  por `onCheckedChange`, otra por el `onClick` del `<button>` padre al burbujear), anulando el
  toggle. El bloque equivalente de booleanos simples en el mismo archivo (`CAMPOS_BOOLEANOS`, líneas
  244-256) no tiene este problema porque ahí el `Switch` está dentro de un `<div>`, no de un
  `<button>`.
- **Impacto en el usuario:** un admin de CEOM que intente activar/desactivar un módulo veedor de un
  plan puede ver que "no pasa nada" al hacer clic justo sobre el control.
- **Propuesta:** envolver la opción en un `<div>` en vez de `<button>` (como ya hace
  `CAMPOS_BOOLEANOS` en el mismo archivo).
- **Esfuerzo:** S.
- **Depende de:** ninguno.

### [UI-020] Checkbox cuadrado reimplementado a mano en 3 lugares con 3 tamaños distintos
- **Severidad:** Baja
- **Categoría:** Componentes
- **Alcance:** `/app/consentimiento` (generar código, `generar-cliente.tsx:147-154`, `size-6`),
  `/app/consentimiento/solicitudes` (`solicitudes-cliente.tsx:217-224`, `size-5`),
  `/admin/instituciones` (`instituciones-cliente.tsx`, checklist "Módulos a solicitar", `size-5`).
- **Evidencia:** ninguna de las 3 usa `components/ui/checkbox.tsx` (que ya define `size-4`,
  `rounded-[4px]`, estado `data-checked`).
- **Impacto en el usuario:** menor — pero es exactamente el mismo dato/concepto de negocio
  (seleccionar módulos veedor) resuelto con 2 widgets visualmente distintos entre Planes (`Switch`)
  e Instituciones (checkbox) para la misma fuente `MODULOS_VEEDOR_INFO`.
- **Propuesta:** usar `Checkbox` real en los 3 lugares; decidir un único widget (switch o checkbox)
  para "elegir módulos veedor" en todo el sistema.
- **Esfuerzo:** S.
- **Depende de:** decisión de widget único (sección 7).

### [UI-021] Avatar circular con inicial en al menos 3 tamaños/radios sin componente compartido
- **Severidad:** Baja
- **Categoría:** Componentes
- **Alcance:** Mi negocio (`size-11` en Colaboradores, `size-10` en Capacidades, `size-8` en el
  diálogo de invitar), Proveedores (`size-8 rounded-lg` en Directorio, `size-8 rounded-full` en el
  Dialog, `size-11 rounded-xl` en la Ficha), Historial de Ventas y Clientes (`size-8 rounded-full`,
  consistente entre esos dos).
- **Evidencia:** citada arriba con archivo:línea en los reportes de Identidad y Proveedores.
- **Impacto en el usuario:** menor, cosmético.
- **Propuesta:** extraer `<Avatar>` (ícono/inicial + tamaño estandarizado).
- **Esfuerzo:** S.
- **Depende de:** ninguno.

### [UI-022] Ningún botón de la aplicación tiene estado de carga visual — feedback limitado a texto + disabled
- **Severidad:** Media
- **Categoría:** Componentes / Estados
- **Alcance:** transversal — confirmado por grep: cero usos de `animate-spin` en todo el repositorio.
- **Evidencia:** el único feedback de "está procesando" en cualquier submit de la aplicación es el
  texto del botón cambiando a gerundio ("Guardando...", "Confirmando...") + `disabled`. Y ni siquiera
  eso es parejo: los botones de confirmación de borrado en Clientes/Canales de Venta
  (`clientes-cliente.tsx:231-238`, `canales-cliente.tsx:205-212`) se deshabilitan pero **no** cambian
  de texto durante el borrado, a diferencia de todos los demás botones de submit del mismo módulo.
  Los toggles `Switch` de activar/desactivar (Canales, Eventos) tampoco se deshabilitan mientras
  corre el server action.
- **Impacto en el usuario:** en una conexión lenta, no hay ninguna señal visual (más allá de texto)
  de que algo está pasando — y en los casos de borrado, ni siquiera eso.
- **Propuesta:** agregar un estado `loading` visual a `Button` (spinner + texto opcional) y aplicarlo
  de forma pareja a los botones de confirmación destructiva que hoy no cambian de texto.
- **Esfuerzo:** M.
- **Depende de:** ninguno.

### [UI-023] `PageHeader.title` es `string`, no `ReactNode` — obliga a reimplementar el header a mano en toda ficha con badge de estado
- **Severidad:** Media
- **Categoría:** Componentes
- **Alcance:** consecuencia directa: Ficha de Gasto, Ficha de Insumo, Ficha de Tenant (`/admin` y
  `/portal`), Directorio/Ficha de Proveedor — todas reimplementan el `<h1>` a mano en vez de usar
  `PageHeader` precisamente porque necesitan poner un `Badge` junto al nombre.
- **Evidencia:** `page-header.tsx:5-13` (`title: string`); confirmado como causa explícita por el
  agente del clúster de primitivas UI, cruzado con los headers ad-hoc reales encontrados en los
  clústeres de Gastos, Producción, Admin y Portal.
- **Impacto en el usuario:** consecuencia del hallazgo, no causa directa — pero es la raíz técnica de
  buena parte de UI-010.
- **Propuesta:** ver 3.3 — `title: ReactNode`.
- **Esfuerzo:** S (el cambio del componente) — el trabajo real está en UI-010.
- **Depende de:** ninguno.

---

### Estados

### [UI-024] No hay ningún `<Skeleton>` en uso en toda la aplicación — el propio componente existe pero 0 consumidores
- **Severidad:** Media
- **Categoría:** Estados
- **Alcance:** transversal — confirmado en los 14 clústeres, ninguno reporta un uso de `<Skeleton>`.
- **Evidencia:** `components/ui/skeleton.tsx` existe (`animate-pulse rounded-md bg-muted`) pero no
  tiene consumidores confirmados en ningún archivo leído. La carga se resuelve mayormente
  server-side sin boundary de Suspense visible; donde sí hay una espera cliente-side (cambio de
  filtro/período), el patrón es atenuar el contenido ya renderizado con
  `opacity-60`/`pointer-events-none` (consistente en Dashboard, Reportes, Simulaciones) o mostrar el
  texto plano "Cargando..." (Ficha de Insumo, Ficha de Tenant en `/admin`, historial de pagos en
  varias fichas).
- **Impacto en el usuario:** en conexiones lentas, las pantallas con fetch inicial pesado (fichas con
  varios `Promise.all`) no dan ninguna señal de progreso hasta que todo el contenido aparece de
  golpe.
- **Propuesta:** el patrón de "opacity-60 sobre contenido ya cargado al cambiar un filtro" es
  correcto y no hace falta tocarlo. Para la carga inicial de fichas/listados pesados, sí conviene
  introducir `<Skeleton>` con boundaries de Suspense donde el fetch tarde perceptiblemente.
- **Esfuerzo:** M.
- **Depende de:** ninguno.

### [UI-025] Errores de sesión expirada / fallo de servidor se tragan silenciosamente y se muestran como "sin datos"
- **Severidad:** Alta
- **Categoría:** Estados
- **Alcance:** las 5 pantallas de Reportes/Dashboard (`dashboard-resumen.tsx`,
  `resumen-financiero-cliente.tsx`, `historico-ventas-cliente.tsx`,
  `margen-canal-producto-cliente.tsx`, `ranking-productos-cliente.tsx`), `/portal` (Mi Cartera),
  `/app/gastos` y `/app/patrimonio` (listados que no distinguen error de "cero registros").
- **Evidencia:** patrón repetido literal en las 4 pantallas de Reportes:
  `const filas = datos.ok ? datos.data : []` (ej. `ranking-productos-cliente.tsx:84`) — cuando la
  Server Action devuelve `{ok:false, error:"Tu sesión expiró..."}`, ese mensaje **nunca se
  renderiza**; el usuario ve el mismo "Sin ventas en este período" que si legítimamente no hubo
  datos. Mismo patrón en `/portal` (`page.tsx:31`, cartera cae a `[]` silenciosamente).
- **Impacto en el usuario:** un usuario cuya sesión expiró mientras miraba Reportes ve "no tengo
  ventas este mes" en vez de "iniciá sesión de nuevo" — puede llevar a conclusiones de negocio
  incorrectas sin que el usuario sepa que los datos no son reales.
- **Propuesta:** renderizar el `error` real cuando `ok === false`, distinguiéndolo visualmente del
  estado "vacío legítimo" (que sí debería seguir siendo un mensaje neutro, per el principio 6 del
  design system: "Mensajes vacíos, nunca errores" — pero ESE principio aplica a "no hay datos", no a
  "no pude consultar los datos", que son casos distintos).
- **Esfuerzo:** M.
- **Depende de:** ninguno.

### [UI-026] Dos patrones de confirmación para acciones destructivas, sin criterio, a veces en el mismo archivo
- **Severidad:** Media
- **Categoría:** Estados
- **Alcance:** Consentimiento/Solicitudes (Rechazar = confirmación inline de fila; Aprobar = `Dialog`
  completo, en el mismo archivo `solicitudes-cliente.tsx`), y en general: confirmación inline
  (swap de botones "Sí, eliminar"/"Cancelar" reemplazando la fila) en Clientes, Canales,
  Instituciones, Códigos de Acceso, Aprobaciones; `Dialog` de confirmación en Dar de Baja de Activo,
  eliminar Producto.
- **Evidencia:** citada en el reporte de clúster de Consentimiento ("2 patrones distintos en el mismo
  archivo... sin criterio aparente documentado").
- **Impacto en el usuario:** menor — ambos patrones son utilizables, pero la falta de criterio hace
  impredecible qué esperar antes de un borrado.
- **Propuesta:** confirmación inline para acciones reversibles/de bajo impacto (desactivar,
  suspender); `Dialog` con texto explícito para las verdaderamente irreversibles (eliminar,
  transferir Owner).
- **Esfuerzo:** M.
- **Depende de:** ninguno.

### [UI-027] `role="alert"` en mensajes de error aplicado por sorteo
- **Severidad:** Baja
- **Categoría:** Estados / Accesibilidad
- **Alcance:** presente en Login, Onboarding, `insumo-form.tsx`, `gasto-form.tsx` (solo en el modo
  editar); ausente en la enorme mayoría de los `<p className="text-xs text-error-text">` del resto
  de la aplicación (decenas de archivos, confirmado en cada uno de los 14 clústeres).
- **Evidencia:** ver detalle por módulo en las secciones de "Estados de interfaz" de cada clúster
  leído.
- **Impacto en el usuario:** un lector de pantalla no anuncia la mayoría de los errores de
  validación de la aplicación en el momento en que aparecen.
- **Propuesta:** agregar `role="alert"` al patrón estándar de mensaje de error (idealmente
  centralizado en un componente `<FormError>` que además resolvería la duplicación de
  `<p className="text-xs text-error-text">{error}</p>` repetida en decenas de archivos).
- **Esfuerzo:** S.
- **Depende de:** ninguno.

### [UI-028] Semántica de color no refleja la severidad real del dato — margen fuertemente negativo mostrado en verde
- **Severidad:** Alta
- **Categoría:** Estados / Datos
- **Alcance:** `/app/productos` (Catálogo).
- **Evidencia:** confirmado en vivo contra datos reales del tenant de prueba: "Queso Cheddar Añejo
  250g" muestra "-465% margen" (margen fuertemente negativo, real, no un error de datos de prueba —
  el precio/costo cargados lo producen genuinamente) en un `<span className="text-xs font-medium
  text-success-text">` — el mismo color verde que un margen sano de 99% en la misma pantalla. La
  lógica de color, a nivel de componente, parece verificar únicamente "hay un margen calculado" en
  vez de "el margen está en un rango saludable".
- **Impacto en el usuario:** un producto que pierde dinero en cada venta se muestra con la misma
  señal visual (verde) que uno rentable — es exactamente el tipo de error que el sistema de badges
  semánticos (success/warning/error) existe para prevenir.
- **Propuesta:** definir umbrales (ej. `margen < 0` → `error`, `0-15%` → `warning`, `>15%` →
  `success`) y aplicarlos donde se calcula/muestra el margen en Catálogo (y verificar si el mismo
  patrón se repite en Simulaciones/Comparativo, que sí tiene lógica de umbral para su propio "alerta"
  pero podría no compartirla con Catálogo).
- **Esfuerzo:** S.
- **Depende de:** ninguno.

### [UI-029] "+Crear categoría" y otras micro-asimetrías funcionales entre crear/editar sin explicación visual
- **Severidad:** Baja
- **Categoría:** Estados
- **Alcance:** `/app/gastos/nuevo` (tiene el atajo "+Crear nueva" categoría) vs.
  `/app/gastos/[id]/editar` (no lo tiene — el botón simplemente no se renderiza, sin explicación).
  El diálogo de categorías tampoco se cierra automáticamente tras "Agregar" (`gestionar-categorias-
  dialog.tsx:96-112`).
- **Evidencia:** confirmado en el reporte de clúster de Gastos.
- **Impacto en el usuario:** menor, fricción puntual.
- **Propuesta:** documentado como trivial-de-arreglar en el backlog (Fase D).
- **Esfuerzo:** S.
- **Depende de:** ninguno.

---

### Datos

### [UI-030] Ningún monto de la aplicación muestra el símbolo o código de moneda
- **Severidad:** Alta
- **Categoría:** Datos
- **Alcance:** transversal — confirmado en vivo (Dashboard, Reportes) y en código en Patrimonio,
  Proveedores, Productos, Producción, Ventas, Gastos, Simulaciones, Portal, y la Ficha de Tenant de
  `/admin`. Todos usan `Number.toLocaleString("es-BO", {minimumFractionDigits:2,
  maximumFractionDigits:2})` sin prefijo/sufijo de moneda.
- **Evidencia:** confirmado por grep explícito del agente del clúster Dashboard/Reportes ("cero
  ocurrencias de 'Bs' como prefijo" en todo el directorio `(shell)`), y replicado igual en los otros
  8 clústeres con montos. **Contraste que prueba que el patrón sí existe en el proyecto:** `/admin/planes`
  y `/admin/tenants/nuevo` sí muestran `{precio.toFixed(2)} {moneda} / mes` (con el código ISO
  pospuesto, aunque sin separador de miles ni símbolo real).
  `docs/design-system.md` no dicta el formato exacto, pero el propio brief de esta auditoría
  referencia "Bs" como formato esperado, señal de que es una expectativa de negocio, no solo de
  diseño.
- **Impacto en el usuario:** dado que un tenant puede operar en `BOB` o `USD` (ver `monedaPrincipal`
  en Suscripción/Planes), un usuario nunca tiene, dentro de las pantallas del día a día, una
  confirmación visual de en qué moneda está viendo sus propios números.
- **Propuesta:** decidir el formato exacto (símbolo "Bs" prefijo, o código ISO sufijo como ya hace
  Planes) y aplicarlo desde el `lib/format.ts` propuesto en UI-017 — de una sola vez en todos los
  consumidores.
- **Esfuerzo:** M (una vez existe el helper compartido, es mecánico).
- **Depende de:** UI-017 (helper compartido) y una decisión de formato (sección 7).

### [UI-031] Precisión decimal del mismo dato distinta entre pantallas
- **Severidad:** Media
- **Categoría:** Datos
- **Alcance:** `costoUnitarioVigente` de Insumo (2 decimales en el listado
  `insumos-cliente.tsx:64`, 4 decimales en la Ficha `ficha-insumo-cliente.tsx:611`); "% de comisión"
  (1 decimal en Eventos `eventos-cliente.tsx:291`, 2 decimales en Canales
  `canales-cliente.tsx:200`); costo operativo de producción (4 decimales en el listado
  `producciones-cliente.tsx:212`, 2 decimales vía `toLocaleString` en el resumen del wizard
  `nueva-produccion-cliente.tsx:53,364`).
- **Evidencia:** citada arriba, confirmada en los reportes de clúster de Producción y Ventas.
- **Impacto en el usuario:** el mismo número de negocio "cambia" de precisión según en qué pantalla
  se mire — puede leerse como que el dato realmente cambió.
- **Propuesta:** fijar una precisión estándar por tipo de magnitud (moneda: 2 decimales siempre;
  costo unitario de insumo, que puede ser una fracción muy chica: definir explícitamente si necesita
  más precisión que la moneda, y aplicarla en todos lados por igual).
- **Esfuerzo:** S.
- **Depende de:** UI-017.

### [UI-032] Formato de fecha inconsistente — con y sin opciones explícitas de `Intl` en el mismo módulo
- **Severidad:** Media
- **Categoría:** Datos
- **Alcance:** Ventas (Historial/Ficha de venta usan `.toLocaleDateString("es-BO")` sin opciones →
  formato corto tipo "20/7/2026"; Eventos usa opciones explícitas + `timeZone:"UTC"` → "20 jul
  2026"), Admin (Ficha de Tenant sin opciones vs. Logs con opciones + hora), Portal
  (`formatCohorte` con opciones vs. fecha de producción en Ficha de Tenant sin opciones), Productos
  (`timeZone:"UTC"` presente en `ficha-cliente.tsx` pero ausente en el cálculo equivalente de
  `[id]/page.tsx:62-65`, mismo archivo/función).
- **Evidencia:** citada con archivo:línea en los reportes de clúster de Ventas, Admin, Portal y
  Productos.
- **Impacto en el usuario:** dos formatos visuales de fecha ("20/7/2026" vs. "20 jul 2026")
  conviven dentro del mismo módulo sin razón de negocio.
- **Propuesta:** un único `formatFecha` (parte de UI-017) con las opciones ya correctas que usan la
  mayoría de las pantallas (`day:"2-digit", month:"short", year:"numeric"`, con `timeZone:"UTC"`
  cuando la fecha de origen no tiene componente horario).
- **Esfuerzo:** S (una vez existe el helper).
- **Depende de:** UI-017.

### [UI-033] Tablas de negocio y administrativas sin paginación real — todo el dataset se trae y se corta en cliente (o ni eso)
- **Severidad:** Media
- **Categoría:** Datos
- **Alcance:** `/admin/tenants`, `/admin/logs` (sin ningún corte, ni siquiera client-side),
  Ventas/Historial y Clientes (paginación client-side sobre un array ya completo — confirmado:
  `listarVentasConTotal` trae **todo** el historial del tenant en un solo `Promise.all`), Gastos
  ("Cargar más" client-side, mismo problema), Proveedores/Compras, Simulaciones, Reportes (sin
  límite en ninguna lista).
- **Evidencia:** ya señalado como gap de backend aceptado en `docs/ui/pantallas.md`
  ("`listarTenants()` no pagina todavía", "`listarGastos` no acepta filtros de servidor") — esta
  auditoría confirma que, del lado de UI, hoy no hay ningún indicio visual de que la lista está
  incompleta ni una advertencia de volumen; simplemente "funciona" mientras el tenant de prueba tiene
  pocos registros.
- **Impacto en el usuario:** no es un problema hoy con datos de prueba, pero es una bomba de tiempo
  de UX real a medida que crecen los tenants — no requiere trabajo de UI todavía, pero si se decide
  encarar antes de que el volumen lo fuerce, es una decisión de backlog explícita (fuera del alcance
  puramente visual de esta auditoría, se documenta para que no se pierda).
- **Propuesta:** no urgente para esta fase de refactor visual — dejar como ítem de vigilancia,
  revisitar cuando el backend exponga paginación real.
- **Esfuerzo:** L (requiere backend).
- **Depende de:** trabajo de backend fuera del alcance de esta auditoría.

---

### Accesibilidad

### [UI-034] Elemento accionable implementado como `<span role="button" tabIndex={0}>` sin `onKeyDown`
- **Severidad:** Media
- **Categoría:** Accesibilidad
- **Alcance:** `/app/mi-negocio/roles` (editar/eliminar rol).
- **Evidencia:** `roles-cliente.tsx:352-374` — dos `<span role="button" tabIndex={0} onClick={...}>`
  (para los íconos `Pencil`/`Trash2`) sin `onKeyDown`, por lo que Enter/Space no activan el control
  pese al `tabIndex` que promete que sí es alcanzable por teclado.
- **Impacto en el usuario:** un usuario de teclado/lector de pantalla puede llegar al control por
  Tab pero no puede activarlo sin un mouse.
- **Propuesta:** reemplazar por `<Button variant="ghost" size="icon-xs">` (el tamaño ya existe en
  `button.tsx:29-30`).
- **Esfuerzo:** S.
- **Depende de:** ninguno.

### [UI-035] Botón anidado dentro de botón también rompe accesibilidad, no solo interacción
- **Severidad:** Media
- **Categoría:** Accesibilidad
- **Alcance:** mismo caso que UI-019 (`/admin/planes`).
- **Evidencia:** HTML inválido (`<button>` dentro de `<button>`) — el comportamiento de foco y
  anuncio de lectores de pantalla para controles interactivos anidados no está definido por la
  especificación y varía por navegador/AT.
- **Impacto en el usuario:** además del bug funcional ya descrito en UI-019, un usuario de lector de
  pantalla puede recibir un anuncio confuso o duplicado al llegar a este control.
- **Propuesta:** la misma que UI-019 — resuelve ambos de una vez.
- **Esfuerzo:** S.
- **Depende de:** ninguno (mismo fix que UI-019).

### [UI-036] Formularios con selección de tarjetas sin agrupación semántica para lectores de pantalla
- **Severidad:** Baja
- **Categoría:** Accesibilidad
- **Alcance:** GastoForm (selector "Tipo de Gasto", `gasto-form.tsx:81`), PasivoForm (selector
  "Activo relacionado", `pasivo-form.tsx:111`).
- **Evidencia:** ninguno de los dos asocia el `<Label>` del grupo a los botones vía `htmlFor`,
  `fieldset`/`legend` o `aria-labelledby` — confirmado en el reporte de clúster de Formularios
  Compartidos.
- **Impacto en el usuario:** un lector de pantalla no anuncia que ese grupo de botones pertenece a la
  pregunta "Tipo de Gasto"/"Activo relacionado".
- **Propuesta:** envolver en `<fieldset>` con `<legend>` (visualmente oculto si hace falta mantener
  el look actual) o agregar `role="radiogroup"` + `aria-labelledby`.
- **Esfuerzo:** S.
- **Depende de:** UI-014 (si se resuelve construyendo el componente `OptionCard`, agregarlo ahí
  directamente).

---

### Copy

### [UI-037] Terminología distinta para el mismo concepto de negocio, repetida en varios pares de pantallas
- **Severidad:** Baja
- **Categoría:** Copy
- **Alcance:** "Sin activo relacionado" (`pasivo-form.tsx:126`) vs. "Sin activo asociado"
  (`pasivos-cliente.tsx:70`) vs. "Pasivo asociado" (`ficha-activo-cliente.tsx:394`) — mismo vínculo
  activo↔pasivo, 3 palabras. "Var. No Productivo" (badge/filtro de Gastos) vs. "Variable no
  productivo" (ficha de detalle del mismo Gasto) — mismo valor de enum. "und" / "unidades" / "un." —
  3 abreviaciones del mismo concepto, 2 de ellas en el mismo archivo de Simulaciones
  (`simulador-cliente.tsx:230,278`).
- **Evidencia:** citada con archivo:línea en los reportes de clúster de Patrimonio, Gastos y
  Simulaciones.
- **Impacto en el usuario:** menor — ambigüedad léxica, no funcional.
- **Propuesta:** un glosario corto de términos de negocio (parte del trabajo de Fase D) que fije una
  sola forma por concepto.
- **Esfuerzo:** S.
- **Depende de:** ninguno.

### [UI-038] Copy desactualizado en `/portal` — dice que una funcionalidad "está por construirse" cuando ya existe
- **Severidad:** Media
- **Categoría:** Copy
- **Alcance:** `/portal` (pantalla de confirmación tras canjear un código de acceso).
- **Evidencia:** confirmado en vivo — se generó un código real desde `/app/consentimiento`
  (owner@ceom.local) y se canjeó como institución nueva ("Institución QA Auditoría") contra
  `/portal`. La pantalla de confirmación dice textualmente: *"El panel donde vas a ver los datos
  compartidos está por construirse"*. Según `docs/ui/pantallas.md`, Mi Cartera y la Ficha de Tenant
  (4 tabs) **ya están construidas y verificadas end-to-end desde 2026-07-18** — el copy quedó
  desactualizado de una tanda anterior. Confirmado también en el código:
  `canjear-cliente.tsx` línea con ese texto literal, señalado también por el agente del clúster
  Portal como "copy de producto en desarrollo expuesto directamente al usuario final".
- **Impacto en el usuario:** una institución real que canjee un código hoy recibe el mensaje de que
  la funcionalidad no existe todavía, cuando en realidad sí puede ver su cartera y las 4 pestañas de
  datos (sujeto a los módulos que el tenant le haya aprobado) — subestima lo que el producto
  realmente ofrece frente al usuario externo más sensible (una institución que recién está evaluando
  confiar en la plataforma).
- **Propuesta:** actualizar el copy para reflejar que el panel ya existe, indicando en su lugar cómo
  reingresar (el propio flujo de magic link, ya construido, ver `docs/ui/pantallas.md` sección 10).
- **Esfuerzo:** S.
- **Depende de:** ninguno — es el arreglo de copy de mayor impacto de toda la auditoría por ser
  cara al usuario externo.

### [UI-039] Anglicismo aislado en un dominio 100% en español
- **Severidad:** Baja
- **Categoría:** Copy
- **Alcance:** `/admin/planes` ("Downgrade autogestionado", `planes-cliente.tsx:57`); botón "Close"
  en inglés dentro de `DialogFooter` si algún consumidor activa su prop `showCloseButton` (hoy
  ninguno lo hace, pero el string vive en `dialog.tsx:116-118`, listo para aparecer el día que
  alguien la active).
- **Evidencia:** confirmado en los reportes de clúster de Admin y de Primitivas UI.
- **Impacto en el usuario:** bajo hoy (el botón "Close" no se usa todavía); "Downgrade" es
  reconocible mayormente por su frecuencia en SaaS, pero rompe la regla implícita del resto del
  copy.
- **Propuesta:** traducir "Downgrade autogestionado" a algo como "Bajar de plan sin intervención de
  CEOM"; traducir el string "Close" de `dialog.tsx:118` de forma preventiva aunque no tenga
  consumidor activo hoy.
- **Esfuerzo:** S.
- **Depende de:** ninguno.

### [UI-040] Copy potencialmente engañoso: "Los cambios se aplican al instante" en pantallas de edición que sí requieren guardar
- **Severidad:** Baja
- **Categoría:** Copy
- **Alcance:** `/app/patrimonio/[id]/editar`, `/app/productos/[id]/editar`,
  `/app/produccion/insumos/[id]/editar`, `/app/gastos/[id]/editar` — las 4 pantallas de edición que
  reutilizan esta frase como subtítulo.
- **Evidencia:** ej. `editar/page.tsx:40` (Productos) — el flujo real requiere completar el
  formulario y hacer clic explícito en "Guardar cambios"; no hay autosave. Confirmado en 4 clústeres
  distintos con la misma observación.
- **Impacto en el usuario:** puede sugerir que basta con escribir para que el cambio ya haya
  "aplicado", generando incertidumbre sobre si hace falta guardar.
- **Propuesta:** cambiar a algo como "Los cambios se guardan al confirmar" o directamente quitar la
  frase (el propio botón "Guardar cambios" ya comunica la acción).
- **Esfuerzo:** S.
- **Depende de:** ninguno.

---

## 6. Backlog priorizado en fases

### Fase A — Fundaciones (tokens, layout base, navegación)
**Objetivo:** que toda pantalla nueva a partir de acá nazca sobre una base consistente, sin tener
que re-tocar cada pantalla existente todavía.

| ID | Descripción |
|---|---|
| ~~UI-001~~ | ~~Reparar el drawer móvil~~ — cerrado 2026-07-20, era falso positivo; Escape/foco/scroll-lock ya agregados |
| UI-009 | Definir y documentar la tabla de `max-w` por tipo de pantalla |
| UI-004 | Agregar "Reportes" al sidebar |
| UI-002 | Construir `components/ui/tabs.tsx` |
| UI-014 | Construir `ToggleGroup`/`OptionCard` |
| UI-017 | Extraer `lib/format.ts` (`formatMoneda`, `formatFecha`) |
| UI-018 | `Dialog` con prop `size` |
| UI-023 | `PageHeader.title: ReactNode` |

**Criterio de "hecho":** existe una regla escrita de `max-w` por tipo de pantalla; `Tabs`/
`ToggleGroup` existen y tienen al menos 1 consumidor real cada uno; `lib/format.ts` existe y
`Dialog`/`PageHeader` aceptan `size`/`ReactNode` respectivamente (sin necesidad todavía de haber
migrado todos los consumidores viejos — eso es Fase C). El drawer móvil (UI-001) ya quedó resuelto
fuera de esta fase, como hotfix aislado.

### Fase B — Componentes compartidos
**Objetivo:** cerrar los huecos de la capa de primitivas que hoy fuerzan la reimplementación ad-hoc.

| ID | Descripción |
|---|---|
| UI-021 | `<Avatar>` |
| UI-022 | Estado `loading` visual en `Button` |
| UI-024 | Introducir `<Skeleton>` con boundaries de Suspense en fichas/listados pesados |
| UI-019 / UI-035 | Fix del botón anidado en Planes (mecánico, pero valida el patrón antes de generalizar) |
| UI-020 | Unificar checkbox/switch para "elegir módulos veedor" |
| UI-027 | `<FormError>` centralizado con `role="alert"` |

**Criterio de "hecho":** cada componente nuevo tiene al menos 2 consumidores migrados como prueba de
concepto; el bug de Planes está corregido.

### Fase C — Pantalla por pantalla
**Objetivo:** aplicar las fundaciones y componentes de A/B a las 117 pantallas existentes, módulo por
módulo (mismo orden en que se construyeron originalmente es razonable, para no perder contexto).

| ID | Descripción |
|---|---|
| UI-003 / UI-005 / UI-006 / UI-007 / UI-008 | Migrar navegación de cada módulo al submenú de sidebar / breadcrumb consistente |
| UI-010 | Migrar headers ad-hoc a `PageHeader` |
| UI-011 | Fix de overflow mobile en Compras |
| UI-012 | Fix de ancho del Dialog de Plan |
| UI-013 | Decidir y ajustar los 2 falsos wizards |
| UI-015 | Migrar formularios `useState` manual a RHF+zod (empezando por POS y Compras, los de mayor uso) |
| UI-016 | Aplicar `EmptyState` también a "vacío por filtro" |
| UI-025 | Mostrar errores reales de sesión/servidor en vez de "sin datos" |
| UI-026 | Unificar patrón de confirmación destructiva |
| UI-028 | Corregir semántica de color de margen negativo |
| UI-030 / UI-031 / UI-032 | Aplicar moneda/decimales/fechas unificados desde `lib/format.ts` |

**Criterio de "hecho":** cada módulo, al cerrarse, pasa el mismo checklist con el que se auditó acá
(layout, navegación, componentes, estados, datos) sin hallazgos nuevos de las categorías ya
resueltas en A/B.

### Fase D — Pulido y accesibilidad
**Objetivo:** cerrar los hallazgos de menor severidad y los de accesibilidad que no bloquean uso
pero sí calidad.

| ID | Descripción |
|---|---|
| UI-029 / UI-037 / UI-039 / UI-040 | Copy: asimetrías funcionales, glosario de términos, anglicismos, frases engañosas |
| UI-038 | Corregir copy desactualizado de `/portal` (podría adelantarse antes si se prioriza cara a usuario externo) |
| UI-034 / UI-036 | Accesibilidad: teclado en controles custom, agrupación semántica de selectores |
| UI-033 | Paginación real (depende de backend, fuera de alcance — solo vigilancia) |

**Criterio de "hecho":** auditoría de accesibilidad básica (contraste, foco visible, navegación por
teclado) sin hallazgos nuevos sobre lo ya cerrado; glosario de términos de negocio publicado y
aplicado.

---

## 7. Decisiones que necesito tomar

Estas son las preguntas donde hay más de un camino razonable y la decisión es del equipo de
producto, no técnica:

1. **¿"Reportes" merece su propio ítem de sidebar (UI-004), o se prefiere mantenerlo accesible solo
   desde el Dashboard a propósito** (para no competir visualmente con los módulos "operativos") **y
   en cambio reforzar el botón de entrada?** Mi lectura del uso real (14 pantallas, con datos que un
   Owner probablemente quiere consultar sin pasar por Inicio) inclina a agregarlo, pero es una
   decisión de cuántos ítems tolera el sidebar antes de sentirse sobrecargado.

2. **¿Vale la pena mostrar el símbolo/código de moneda (UI-030) ahora, dado que hoy la enorme
   mayoría de tenants de prueba usan `BOB` y el impacto visible es bajo, o se prioriza porque ya
   existen (o existirán) tenants en `USD`?** Afecta directamente cuánto esfuerzo dedicarle en la
   Fase C.

3. **¿El link "Negocio" del sub-nav de Mi Negocio debería seguir reabriendo el wizard completo de
   onboarding (con Stepper de 2 pasos), o merece una pantalla de edición dedicada y más liviana** —
   dado que hoy un Owner que solo quiere corregir la ciudad del negocio pasa por la misma experiencia
   que un tenant que recién se está dando de alta? Es una decisión de producto, no solo de UI (el
   componente `PasoNegocio` ya existe y podría desacoplarse del wizard).

4. **¿Los dos "falsos wizards" (Nueva Producción, Importar Ventas Históricas — UI-013) deberían
   convertirse en flujos reales de pasos con `Stepper`, o se prefiere quitarles el indicador visual
   de pasos y dejarlos como formularios largos de una sola pantalla** (que es, en la práctica, lo
   que ya son)? Cambia el esfuerzo de S a M según la respuesta.

5. **¿Se estandariza "Switch" o "checkbox cuadrado" (UI-020) como el único widget para "elegir
   módulos veedor" en toda la aplicación** (hoy Planes usa uno e Instituciones el otro para la misma
   fuente de datos)?

6. **¿La sub-navegación de Consentimiento/Simulaciones/Reportes (tab-bar persistente, hoy el patrón
   mejor resuelto) se migra también al submenú de sidebar propuesto en la sección 4, quedando el
   tab-bar reservado solo para "vistas del mismo recurso" (ficha de tenant, ficha de proveedor), o
   se mantiene como está porque ya funciona razonablemente bien y no amerita el costo de migración?**
   Es la decisión de mayor impacto en el esfuerzo total de la Fase C — determina si el trabajo de
   navegación es "unificar 7 patrones en 2" o "unificar 7 patrones en 1".
