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

*Este documento resume decisiones ya confirmadas con el cliente: paleta, tipografía (Poppins), intensidad de relieve, tratamiento del sidebar, preferencia de cards sobre listas, y referencia exacta de login. No quedan pendientes abiertos de diseño en este momento.*
