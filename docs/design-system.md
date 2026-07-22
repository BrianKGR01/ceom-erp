# Sistema de Diseño — CEOM

> Documento de referencia visual para desarrollo (uso como contexto para Claude Code).
> Aún no hay nada construido en la capa de UI — este documento define el estilo a seguir desde cero.

---

## 1. Estilo general

**Categoría:** ERP / dashboard SaaS moderno, con componentes tipo tarjeta y relieve casi imperceptible (no plano, pero tampoco skeuomórfico ni cargado de degradados).

Principios visuales:

- **Sidebar fijo a la izquierda**, en tono navy oscuro con un degradado vertical muy sutil (de `#0E2A47` a `#0B2038`), nunca protagonista — el contenido central es lo que debe captar la atención.
- **Contenido principal en tarjetas (cards)** blancas, esquinas redondeadas (12–14px), con sombra muy suave (`box-shadow: 0 1px 4px rgba(9,49,84,0.05)` a `0 2px 8px rgba(9,49,84,0.06)`) — suficiente para separar la card del fondo, sin que se note como efecto decorativo.
- **Sin degradados decorativos en botones ni barras** — colores sólidos (`#2176BD` para acciones primarias, navy para elementos oscuros). El único degradado permitido es el del sidebar.
- **Iconografía lineal simple** dentro de badges cuadrados con esquinas redondeadas (7–8px) y fondo de color pastel (ej. azul pastel para info, rojo pastel para alerta).
- **Badges de estado** tipo pill (bordes muy redondeados, ~20px), fondo pastel + texto en el tono fuerte correspondiente.
- **Barras de progreso** delgadas (6px), fondo gris claro, relleno sólido en azul.
- **Mucho espacio en blanco**, jerarquía clara, un dato protagonista por card (número grande, etiqueta pequeña arriba).

---

## 2. Paleta de colores

| Uso | Color | Hex |
|---|---|---|
| Azul primario / Títulos | Azul marino oscuro | `#094979` |
| Sidebar (más oscuro que el azul de marca, para dar contraste con el contenido) | Navy | `#0E2A47` → `#0B2038` (degradado vertical) |
| Azul secundario / Botones y acentos interactivos | Azul medio | `#2176BD` |
| Azul claro / Fondos suaves de badges e íconos | Azul pastel | `#ABD8FF` / `#EAF3FD` |
| Gris neutro / Bordes, separadores, barras vacías | Gris claro | `#D9D9D9` / `#EAEDF1` |
| Fondo base / Cards | Blanco | `#FFFFFF` |
| Texto de contenido | Gris oscuro | `#545454` / `#6B7280` |

**Colores de estado** (confirmados, sin observaciones del cliente):

| Estado | Fondo pastel | Texto |
|---|---|---|
| Éxito / Activo / Completado / Pagado | `#E7F6EC` | `#227A44` |
| Advertencia / Pendiente | `#FCF3D9` | `#8A6D1D` |
| Error / Bloqueado / Requiere atención | `#FCEBEA` | `#D64545` |
| Información | `#EAF3FD` | `#2176BD` |

**Reglas de aplicación:**
- El navy domina solo el sidebar.
- El azul medio (`#2176BD`) es el único color de acción (botones primarios, links, barra de progreso rellena, ítem activo del menú).
- El azul pastel se usa solo como fondo de apoyo (íconos, badges), nunca como texto ni botón.
- No introducir tonos de azul fuera de esta escala.

---

## 3. Tipografía

| Rol | Fuente |
|---|---|
| Cuerpo de texto (por defecto, en toda la interfaz) | **Poppins** |
| Acentos puntuales (citas, tips, callouts destacados — uso ocasional, no estructural) | **Quicksand** |

Jerarquía sugerida:
- Título de página (H1): 18–20px, Poppins 600, navy
- Subtítulo de página: 12–13px, Poppins 400, gris
- Título de card / dato protagonista: 16–18px, Poppins 600, navy
- Etiqueta pequeña sobre un dato: 10–11px, Poppins 400, gris
- Cuerpo general: 12–13px, Poppins 400, gris oscuro

---

## 4. Identidad de marca — logo e ícono

- **Logo completo:** `CE` + ícono (tucán estilizado en dos tonos de azul) + `M` — texto en azul marino oscuro, ícono en azul medio/oscuro. Archivo: `public/logo-CEOM.svg`.
- **Ícono solo** (para favicon, avatar de marca, estados colapsados de sidebar): el tucán solo, mismo tratamiento de dos tonos de azul. Archivo: `public/icono-CEOM.svg`.
- Ambos archivos ya están en la carpeta `public` del repo (`CEOM-ERP/public/`).
- **Regla:** usar siempre estos dos archivos SVG tal cual existen — no recrear el ícono ni generar una versión nueva. El logo completo va en el sidebar expandido y en la pantalla de login; el ícono solo va en espacios reducidos (sidebar colapsado, favicon, loaders).

---

## 5. Componentes base

### 5.1 Sidebar
- Fondo con degradado navy sutil (sección 1).
- Logo completo arriba (`logo-CEOM.svg`).
- Botón principal de acción (ej. "+ Nuevo registro") en azul sólido `#2176BD`, sin degradado.
- Ítems de navegación: icono + texto; el ítem activo tiene fondo `rgba(255,255,255,0.07)` sutil, no un color sólido fuerte.
- No repetir estas opciones como cards en el contenido central.

### 5.2 Cards de métrica (KPI)
- Grid de 2 a 4 columnas.
- Cada card: badge cuadrado de ícono (fondo pastel, esquinas 7–8px) → etiqueta pequeña gris → número grande en navy.
- Sombra muy suave, sin borde visible.

### 5.3 Cards de registro (activos, productos, proveedores)
- Card blanca con sombra suave, imagen o bloque de color arriba, badge de estado tipo pill en la esquina superior derecha.
- Debajo: nombre + metadata corta (ID, categoría).
- Si aplica: barra de progreso delgada con etiqueta ("Capacidad usada", "Kilometraje mensual", etc.), relleno sólido azul.
- Estas cards son la **vista principal** para catálogos y consulta rápida — la vista de lista queda como alternativa secundaria.

### 5.4 Formularios multi-paso (wizard/stepper)
- Para procesos con pasos secuenciales (ej. registrar producción): stepper horizontal numerado arriba, panel lateral derecho con resumen en vivo de lo que se está registrando.
- Selección de opciones (ej. elegir receta/producto) como cards seleccionables, no como dropdown de lista — la card seleccionada se marca con borde azul + badge "Seleccionado".

### 5.5 Listas (vista secundaria)
- Fila simple: ícono/avatar circular + nombre + metadata + badge de estado + monto/acción a la derecha.
- Se usa para historiales (ventas, movimientos) donde el volumen de datos hace más práctico el formato de lista que el de card — pero sigue llevando badges y espaciado generoso, nunca una tabla densa tipo spreadsheet.

### 5.6 Cards de proveedor/cliente con panel de detalle
- Grid de cards resumen a la izquierda + panel de detalle expandido a la derecha al seleccionar una card (patrón maestro-detalle).
- El panel de detalle reutiliza los mismos badges y tipografía que el resto del sistema.

### 5.7 Botones
- Primario: fondo `#2176BD` sólido, texto blanco, radio 8px.
- Secundario/outline: borde `#2176BD`, texto `#2176BD`, fondo transparente.
- Destructivo: mismo estilo outline, en rojo de estado.
- Sin sombras ni degradados en ningún botón.

### 5.8 Login
- Se toma como **referencia directa** la pantalla de login ya definida por el cliente (panel izquierdo navy con mensaje de marca + bullets de valor, panel derecho blanco con formulario en card centrada, ícono de candado circular arriba del formulario).
- Ajustar únicamente para que los colores, tipografía (Poppins) y radios de esquina coincidan con este sistema de diseño — la estructura y composición general se mantienen tal como fueron aprobadas por el cliente.

---

## 6. Principios de producto a respetar

1. **No duplicar navegación** entre sidebar y contenido central.
2. **Cards antes que listas/formularios largos** — la vista de cards es la principal; la lista es la alternativa para volumen o revisión masiva.
3. **Relieve casi imperceptible** — sombra suave únicamente para separar planos, nunca degradados decorativos ni efectos marcados.
4. **Un solo sidebar navy con degradado sutil**, nunca un color más llamativo que el contenido.
5. **Consistencia de marca azul** — un solo azul oscuro, un solo azul medio, un solo azul pastel.
6. **Mensajes vacíos, nunca errores** — si una sección no tiene datos, se muestra vacío/cero.
7. **Modo claro únicamente** por ahora — no implementar modo oscuro en esta etapa.
8. **Logo e ícono oficiales** (`public/logo-CEOM.svg`, `public/icono-CEOM.svg`) se usan tal cual existen, sin recrearlos.

---

## 7. Layout de página estándar (Fase A del refactor de UI/UX, 2026-07-20)

> Origen: `docs/ui/AUDITORIA-UI-UX.md`, hallazgo UI-009 — el ancho máximo del contenedor no seguía
> ninguna regla (3 a 6 valores de `max-w` por módulo). Esta sección fija la regla, derivada de qué
> valor ya usaba la mayoría de las pantallas que se ven bien — no se inventó ningún valor nuevo.

### 7.1 Wrapper estándar

Toda pantalla de `/app` y `/admin` (excepto `/login` y `/portal`, que tienen su propio layout de
pantalla completa) usa exactamente:

```tsx
<div className="min-h-screen bg-gray-bg p-6">
  <div className="mx-auto max-w-{TOKEN} space-y-4 py-6">
    {/* contenido de la pantalla */}
  </div>
</div>
```

`space-y-4` es el valor por defecto; el Dashboard/Inicio y el Catálogo de Productos usan `space-y-6`
porque agrupan secciones más grandes (varias cards por bloque) — mantenido tal cual, no es una
inconsistencia a corregir.

### 7.2 Tabla de `max-w` por tipo de pantalla

| Tipo de pantalla | `max-w` | Por qué este valor | Pantalla de referencia (ya aplicada) |
|---|---|---|---|
| Dashboard / resumen ejecutivo | `max-w-5xl` | Ya era el valor mayoritario para pantallas con varias cards de KPI en grid | `/app` (Inicio) — ya cumplía, queda como referencia |
| POS / flujo operativo de una sola pantalla | `max-w-5xl` | Necesita espacio para catálogo + panel de carrito lado a lado | `/app/ventas` (Vender) — ya cumplía, queda como referencia |
| Listado denso (filas/tabla) | `max-w-4xl` | Valor mayoritario entre Historial de Ventas, Clientes, Pasivos, Logs de `/admin`, Ranking de Productos | `/app/ventas/eventos` — corregido de `5xl` a `4xl` |
| Listado de cards / catálogo (grid) | `max-w-6xl` | Mismo ancho que Catálogo de Productos y Catálogo de Insumos, que ya necesitan 3-4 columnas | `/app/patrimonio` (Activos) — corregido de `5xl` a `6xl` |
| Ficha de detalle (1 panel) | `max-w-4xl` | Valor mayoritario entre Ficha de Venta, Ficha de Gasto, Ficha de Producto, Ficha de Insumo | `/app/patrimonio/[id]` — corregido de `5xl` a `4xl` |
| Maestro-detalle (2 paneles) | `max-w-6xl` | Necesita espacio para panel lateral + panel de detalle (Directorio de Proveedores, Gestión de Recetas ya lo usan) | sin cambios en esta fase — ya cumplía |
| Formulario de 1 columna | `max-w-2xl` | Los 5 formularios compartidos (`ActivoForm`, `GastoForm`, `InsumoForm`, `PasivoForm`) ya se auto-limitan a `max-w-2xl` en su propio `<form>` — el wrapper de página en `4xl`/`5xl` no hacía nada, era ancho muerto. Bajar el wrapper de página a `2xl` elimina el doble contenedor sin cambiar ni un píxel de lo que el usuario ya ve. | `/app/patrimonio/nuevo` y `/app/patrimonio/[id]/editar` — corregidos de `4xl` a `2xl` |
| Formulario multi-columna / con panel lateral | `max-w-4xl` a `max-w-6xl` según cantidad de columnas | Excepción documentada: `ProductForm` (grid de 2 columnas, sin auto-límite propio) necesita `max-w-4xl` de la página; "Registrar Producción" (formulario + panel de resumen) necesita `max-w-6xl`. No se tocan en esta fase — ya usaban estos valores. | `/app/productos/nuevo`, `/app/produccion/nuevo` — sin cambios, quedan como referencia de la excepción |

**Regla para pantallas nuevas:** identificar el tipo de la tabla de arriba y usar ese `max-w`
directamente. Si una pantalla nueva no encaja claramente en ningún tipo, es señal de que puede
necesitar descomponerse (¿es en realidad un formulario multi-columna disfrazado de ficha?) antes de
inventar un noveno valor de ancho.

## 8. Componentes compartidos (Fase A en adelante)

> Cada primitiva nueva se documenta acá con su API real y cuándo usarla, a medida que se construye.
> Ver `src/components/ui/*.tsx` para la implementación.

### 8.1 `Tabs` (`src/components/ui/tabs.tsx`)
Extraído del patrón de tab-bar persistente que ya usaban Consentimiento y Simulaciones (el mecanismo
mejor resuelto de los 7 que documentaba UI-002) — no es un patrón nuevo, es el mismo con estado
`activo` derivado de `usePathname()` en vez de pasado a mano por archivo.

- **Cuándo usar:** vistas múltiples de un mismo recurso/contexto de datos ya elegido (Ficha de
  Tenant en `/admin` y `/portal`, Ficha de Proveedor) — regla de navegación completa en
  `docs/ui/AUDITORIA-UI-UX.md` sección 4.2/4.4.
- **Cuándo NO usar:** para moverse entre las secciones de un módulo (Ventas → Historial/Clientes/
  etc.) — eso es el submenú de sidebar (sección 4 de la auditoría), no `Tabs`.
- **API:**
  ```tsx
  <Tabs
    items={[
      { href: "/app/consentimiento", label: "Generar Código", icon: KeyRound },
      { href: "/app/consentimiento/codigos", label: "Códigos Generados", icon: ListChecks },
    ]}
  />
  ```
  `href` se resuelve contra `usePathname()` automáticamente (coincidencia exacta para el ítem que no
  tiene sub-rutas propias) — no recibe una prop `activo`, para que sea imposible que quede
  desincronizado como pasaba con `NavReportes`/`NavSimulaciones` copiados a mano.

### 8.2 `Dialog` — prop `size`
- Escala corta de 3 valores, **default `md`** (antes todo diálogo heredaba `sm:max-w-sm`, 384px,
  sin poder optar por otro ancho — causa raíz de UI-012/UI-018): `sm` (384px) para diálogos de 1-3
  campos simples (confirmar borrado, un solo input); `md` (576px, **default**) para la mayoría de
  los formularios de 4-9 campos — este cambio de default corrige de paso el Dialog de "Nuevo Plan"
  en `/admin/planes` sin tocar ese archivo; `lg` (768px) para diálogos con tabla o contenido ancho.
- Ver detalle completo de props en el propio archivo.

### 8.3 `PageHeader` — `title: ReactNode`
- Ahora acepta cualquier `ReactNode` como título, no solo `string` — permite poner un `<Badge>` de
  estado junto al nombre (Ficha de Gasto, Ficha de Producto, Ficha de Tenant) sin reimplementar el
  header a mano.
- De paso se agregó `flex-wrap` al wrapper del header (antes solo `flex items-center
  justify-between gap-4`) — corrige un overflow horizontal real encontrado en Colaboradores a 375px
  cuando el header tiene ≥2 botones de acción.

### 8.4 `ToggleGroup` (`src/components/ui/toggle-group.tsx`)
Extraído de las pills de filtro reimplementadas a mano en Historial de Ventas, Compras, Catálogo de
Productos, criterio de Ranking, etc. — ver UI-014.

- **Cuándo usar:** un solo valor seleccionado entre N opciones cortas sin icono/descripción (filtros,
  criterios de orden).
- **Cuándo NO usar:** si la opción necesita icono o descripción — usar `OptionCard` en su lugar.
- **API:**
  ```tsx
  <ToggleGroup
    value={estado}
    onValueChange={setEstado}
    options={[
      { value: "todos", label: "Todos" },
      { value: "pagado", label: "Pagado" },
    ]}
  />
  ```
  Genérico en `T extends string` — `value`/`onValueChange` tipan contra los `value` de `options`.

### 8.5 `OptionCard` (`src/components/ui/option-card.tsx`)
Extraído de los selectores tipo "radio visual" reimplementados a mano en `GastoForm` (tipo de gasto,
horizontal) y `PasivoForm` (activo relacionado, vertical con ícono) — ver UI-014. Es la tarjeta
individual; el consumidor arma su propio grid (`grid-cols-N`) alrededor, porque la cantidad de
columnas varía según cuántas opciones haya.

- **Cuándo usar:** elegir una entidad/opción relacionada donde vale la pena mostrar ícono y/o
  descripción corta debajo del label.
- **API:**
  ```tsx
  <OptionCard
    selected={tipo === "fijo"}
    onSelect={() => setTipo("fijo")}
    label="Fijo"
    description="Se repite todos los meses"
    icon={Repeat}
    orientation="horizontal" // o "vertical" — layout existente en PasivoForm
    showSelectedBadge // opcional: pill "Seleccionado" en la esquina, patrón de PasivoForm
  />
  ```

### 8.6 `Avatar` (`src/components/ui/avatar.tsx`)
Extraído del círculo con inicial reimplementado con 3 tamaños distintos en Colaboradores
(`size-11`), Capacidades Especiales (`size-10`) y el diálogo de invitar (`size-8`) — ver UI-021. Los
3 tamaños ya existían en la práctica; se preservan como variantes en vez de forzar un único valor.

- **API:** `<Avatar nombre={persona.nombreCompleto} size="sm" | "md" (default) | "lg" />` — muestra
  la primera letra del nombre en mayúscula sobre fondo `pastel-blue-bg`.

### 8.7 `SearchInput` (`src/components/ui/search-input.tsx`)
Extraído del bloque ícono+`Input` reimplementado con valores ligeramente distintos en Tenants
(`/admin`, `pl-8`/`left-2.5`) e Instituciones (`/admin`, `pl-9`/`left-3`, sin
`pointer-events-none`) — ver UI-014.

- **API:** `<SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar..." className="sm:w-64" />`
  — el ancho queda a criterio del consumidor vía `className`, igual que antes.

### 8.8 `FormError` (`src/components/ui/form-error.tsx`)
- **API:** `<FormError>{mensaje}</FormError>` — no renderiza nada si `children` es falsy. Agrega
  `role="alert"` (ausente en todas las copias manuales anteriores: `<p className="text-xs
  text-error-text">{error}</p>`), para que un lector de pantalla anuncie el error sin que el usuario
  tenga que encontrarlo visualmente.

### 8.9 `Button` — prop `loading`
- `<Button loading={guardando}>Guardar</Button>` agrega un spinner (`Loader2` girando) antes del
  contenido y fuerza `disabled` mientras `loading` es `true`, sin que el consumidor tenga que
  combinar manualmente texto-en-gerundio + `disabled` (antes el único feedback de "esto está
  corriendo" en toda la app era ese combo, ni siquiera parejo entre botones) — ver UI-022.

### 8.10 `SwitchRow` (`src/components/ui/switch-row.tsx`) — Fase B
Fila "opción con interruptor". Extraída de las 4 superficies que resolvían **el mismo** concepto de
negocio (elegir un subconjunto de Módulos Veedor) con 3 widgets distintos — ver UI-019/UI-020/UI-035.

- **Cuándo usar:** activar/desactivar cada ítem de una lista de opciones independientes entre sí
  (no mutuamente excluyentes). Si son mutuamente excluyentes, es `ToggleGroup` u `OptionCard`.
- **Regla estructural, no negociable:** la fila es un `<div>` y el **único** control interactivo es
  el `Switch`. Envolver la fila en un `<button>` con el `Switch` adentro es HTML inválido y hace que
  un clic sobre el switch dispare el toggle dos veces, anulándose — ese era exactamente el bug
  UI-019. Para no perder área de clic, el texto es un `<label>` asociado al switch por `id`.
- **API:**
  ```tsx
  <SwitchRow
    checked={marcado}
    onCheckedChange={() => toggle(modulo)}
    label="Módulo Financiero"
    description="Flujo de caja y estado de resultados" // opcional
    icon={Wallet}                                      // opcional
    disabled={!permitido}                              // opcional
    trailing={<Badge variant="success">Disponible</Badge>} // opcional, va antes del switch
  />
  ```
- **Verificado en vivo** (DOM real, dev server): clic en el switch y clic en el texto toggleaen
  exactamente una vez cada uno; `Space`/`Enter` con foco en el switch toggleaen; la fila `disabled`
  no reacciona ni por switch ni por label; el nombre accesible que anuncia un lector de pantalla
  incluye label + description, porque base-ui cablea solo su `aria-labelledby` contra el `<label>`
  asociado. **Detalle de implementación a no romper:** base-ui renderiza el switch como
  `<span role="switch">` y aparte un `<input type="checkbox" tabindex="-1">` fuera de ese span; el
  `id` que recibe `Switch` aterriza en ese input, que es lo que hace que el `<label htmlFor>`
  funcione. El tab-stop es el `<span>`, no el input.

### 8.11 `Skeleton` (`src/components/ui/skeleton.tsx`) — Fase B
El componente existía desde el scaffolding inicial de shadcn pero no tenía **ningún** consumidor en
toda la aplicación (UI-024). No cambió su implementación; lo que se agregó es la regla de uso.

- **Cuándo usar:** una espera con contenido que todavía no llegó y cuya forma ya se conoce (tabs de
  una ficha que traen sus datos por separado, listados pesados). Reemplaza al texto plano
  "Cargando...".
- **Cuándo NO usar:** cuando el contenido **ya está en pantalla** y se está refrescando por un
  cambio de filtro/período — ahí el patrón correcto, ya consistente en Dashboard/Reportes/
  Simulaciones, es atenuar lo que ya se ve con `opacity-60`/`pointer-events-none`. Cambiar eso por
  un skeleton haría parpadear la pantalla entera en cada cambio de filtro.
- **Dos reglas al componer:** (1) el placeholder reproduce la **forma** del contenido real (card de
  dato, fila de tabla) para que el layout no salte cuando llegan los datos; (2) el contenedor lleva
  `role="status"` + `aria-label="Cargando…"`, porque un skeleton sin eso es completamente invisible
  para un lector de pantalla — el texto "Cargando..." que reemplaza sí se anunciaba.
- **Referencia aplicada:** Ficha de Tenant de `/admin`, en sus 3 tabs
  (`src/app/admin/(shell)/tenants/[tenantId]/ficha-cliente.tsx`).

---

## 9. Arquitectura de navegación — regla de los tres mecanismos (decisión 6)

> Origen: `docs/ui/AUDITORIA-UI-UX.md` UI-002, decisión 6 de la sección 7. Antes de esta regla
> existían 7 mecanismos ad-hoc distintos para navegar entre las secciones de un mismo módulo. De
> ahora en adelante hay exactamente tres, cada uno con un criterio de cuándo usarlo — nunca a
> criterio libre de quien construye la pantalla.

**Submenú de sidebar** — para módulos cuyas secciones son de uso diario y heterogéneas entre sí:
Ventas, Producción, Patrimonio, Proveedores, Gastos, Mi Negocio. Implementado en
`src/components/shared/app-shell.tsx` (ver también hallazgo UI-002 resuelto).

**Tab-bar persistente** — para un módulo que es una familia de vistas del mismo dato: Reportes,
Simulaciones, Consentimiento (Compartir Datos). Estos tres módulos ya resolvían bien su navegación
antes del refactor y quedan **a propósito sin submenú** — no se migran, son la referencia canónica
del patrón. También aplica a fichas de un solo recurso: Ficha de Tenant (`/admin` y `/portal`),
Ficha de Proveedor. Componente: `Tabs` (sección 8.1).

**Breadcrumb** — siempre que la pantalla esté ≥1 nivel debajo de un listado (ej. `Ficha → Editar`).
Nunca como sustituto de un menú de hermanos: si dos pantallas son hermanas de igual jerarquía dentro
de un módulo, van en el submenú o el tab-bar, no en un breadcrumb.

**Prohibido como único mecanismo:** un link de texto suelto ("Ver pasivos") o un botón aislado entre
dos secciones hermanas de igual jerarquía — el mecanismo ad-hoc original que documentaba UI-002.

---

*Este documento resume decisiones ya confirmadas con el cliente: paleta, tipografía (Poppins), intensidad de relieve, tratamiento del sidebar, preferencia de cards sobre listas, y referencia exacta de login. Las secciones 7, 8 y 9 se agregaron en la Fase A del refactor de UI/UX (2026-07-20, ver `docs/ui/AUDITORIA-UI-UX.md`); las subsecciones 8.10 y 8.11 se agregaron en la Fase B (2026-07-22) — no son parte del diseño visual original aprobado con el cliente, son reglas de consistencia técnica derivadas de él.*
