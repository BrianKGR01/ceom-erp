# Módulo 10 — Reportes y Dashboard

## 0. Propósito del módulo y alcance (aclaración de fondo antes de empezar)

La arquitectura v3 es explícita en un punto que conviene confirmar antes de detallar nada: **"Reportes no es un módulo aparte. Cada módulo (Ventas, Financiero, Inventario Operativo, etc.) expone su propia función de reporte/exportación sobre sus propios datos. El Dashboard es una capa de presentación, no un módulo de datos: compone en una sola pantalla las métricas que cada módulo ya expone por su cuenta. No almacena ni recalcula nada — si un dato está mal en el Dashboard, el error está en el módulo dueño de ese dato, nunca en el Dashboard mismo."**

Esto es consistente con cómo terminaron Financiero (Módulo 7) y Simulaciones (Módulo 9): capas que leen de otros módulos en vez de duplicar datos. Reportes lleva ese mismo principio al extremo — **cero tablas propias, cero lógica de negocio propia**, solo composición de lo que ya existe.

**Punto de entrada por defecto al iniciar sesión** (mobile-first, confirmado en los documentos funcionales) — el Dashboard es lo primero que ve el usuario al entrar.

---

## 1. Vistas que este módulo compone (y de dónde viene cada dato)

| Vista | Origen del dato | ¿Existe ya la función, o hace falta agregarla? |
|---|---|---|
| Resumen del período (ventas, gasto, margen) | Ventas + Financiero | Existe (`estado_resultados()`, agregados simples) |
| Ranking histórico de rotación y margen por producto, filtro por canal | Ventas | **Falta agregar** `ranking_productos(periodo, canal_venta_id?, criterio: rotacion\|margen)` — adenda al Módulo 3 |
| Distribución de gastos por categoría | Costos y Gastos | Ya existe: `consultar_distribucion_por_categoria(periodo)` (Módulo 4) |
| Histórico de ventas diferenciado (regulares vs. eventos) | Ventas | **Falta agregar** `historico_ventas(periodo, incluir_eventos: boolean)`, filtrando por `evento_id` — adenda al Módulo 3 |
| Estado de Resultados simplificado | Financiero | Ya existe: `estado_resultados(periodo)` (Módulo 7) |
| Flujo de Caja del período | Financiero | Ya existe: `flujo_caja(periodo)` (Módulo 7) |
| Cruce canal × producto × margen | Ventas | **Falta agregar** `margen_por_canal_y_producto(periodo)` — adenda al Módulo 3 |
| Control de merma por período (costo de merma en Bs) | Módulo Operativo (Producción) | **Falta agregar** `consultar_merma_periodo(periodo)` — adenda al Módulo 6 |

**Tres adendas necesarias**, todas del mismo tipo: funciones de consulta agregada sobre datos que el módulo ya tiene, sin tablas nuevas ni cambios de modelo.

---

## 2. Adendas concretas a módulos ya cerrados

### 2.1 Adenda al Módulo 3 (Ventas)

Se agregan tres funciones de solo lectura, sin tablas nuevas — todas agregan sobre `Detalle de Venta` (que ya tiene `producto_id`, `canal_venta_id`, `evento_id`, `precio_venta_snapshot`, `costo_unitario_snapshot`):

- `ranking_productos(periodo, canal_venta_id?, criterio)` → lista de productos ordenada por unidades vendidas o por margen real, según `criterio`.
- `historico_ventas(periodo, incluir_eventos)` → serie de ventas del período, separando las que tienen `evento_id` no nulo de las que no, para no distorsionar el histórico regular con volúmenes de feria (regla ya fijada en el Módulo 3).
- `margen_por_canal_y_producto(periodo)` → tabla cruzada canal × producto × margen real.

### 2.2 Adenda al Módulo 6 (Módulo Operativo — Nicho 1)

- `consultar_merma_periodo(periodo)` → suma de `merma_costo` de todas las `Producción` del período — el dato ya existe campo por campo (Módulo 6, sección 1.7), solo faltaba la función de agregación.

---

## 3. Reglas de negocio clave

1. **Cero tablas propias, cero lógica propia.** Confirmado como principio rector de este módulo (v3). Cualquier corrección de un número mal mostrado se hace en el módulo dueño del dato, nunca acá.
2. **Todo reporte es filtrable por sucursal o consolidado a nivel tenant** — mismo criterio ya fijado en Financiero (Módulo 7).
3. **El Dashboard institucional respeta el mismo Gateway de Autorización, módulo por módulo.** Si una institución solo tiene aprobado el módulo Financiero (Módulo 1, sección 7.2), el Dashboard que ve esa institución compone únicamente las vistas de Financiero — nunca las de Ventas u Operativo, aunque técnicamente estén disponibles para el Owner.
4. **Prueba de caja negra explícita (ya anotada en v3):** este módulo se testea inyectando mocks de cada función fuente y verificando que el Dashboard arma la vista correctamente — nunca testea reglas de negocio, porque no las tiene.

---

## 4. Casos de uso comunes

1. **Ver el Dashboard al iniciar sesión** — resumen de ventas, gasto y margen del período.
2. **Ver el ranking de productos** por rotación y por margen, filtrado por canal.
3. **Ver la distribución de gastos por categoría** del período.
4. **Ver el histórico de ventas** separando regulares de eventos.
5. **Ver Estado de Resultados y Flujo de Caja** del período.
6. **Ver el cruce canal × producto × margen** para decidir en qué canal enfocar esfuerzo.
7. **Ver el control de merma** del período, en unidades y en Bs.
8. **Exportar** cualquiera de estos reportes, con co-branding negocio + CEOM (ver sección 6).

---

## 5. Casos borde

1. **Un módulo fuente no tiene datos para el período consultado** (ej. tenant recién creado, sin pasivos ni gastos aún): el Dashboard muestra ceros/vacíos en esa sección, nunca un error — cada función fuente ya está diseñada para devolver vacío en vez de fallar (mismo criterio ya aplicado en Financiero).
2. **Institución con consentimiento parcial:** el Dashboard institucional oculta por completo las secciones no autorizadas, no las muestra "en gris" ni con datos parciales — la autorización es todo o nada por módulo.

---

## 6. Exportación — investigado y confirmado (julio 2026)

Investigué el estándar actual de exportación/reporting en SaaS multi-tenant (2026). El patrón consistente entre las plataformas de "white-label reporting" (Toucan, Bold Reports, y similares, que es exactamente tu caso: CEOM sirviendo a muchos negocios, cada uno dueño de sus propios datos) es:

1. **Co-branding, no exclusividad de marca.** Ningún estándar serio asume que el reporte lleva *solo* la marca de la plataforma o *solo* la del cliente — la práctica normal es que el reporte muestre el logo/nombre del negocio (dueño de los datos) en el lugar principal, y una marca del proveedor de software (CEOM) de forma más discreta, típicamente en el pie de página ("Generado con CEOM"). Remover por completo la marca del proveedor ("white-label total") es normalmente una función de planes superiores, no del plan base — encaja naturalmente con el sistema de planes que ya definimos en el Módulo 1.
2. **Separación entre motor de datos y plantilla de presentación.** El patrón universal es que la capa que genera el PDF/Excel es un consumidor más de las mismas funciones de datos (igual que el Dashboard) — nunca recalcula nada. Esto significa que rediseñar el formato de exportación más adelante (para un banco o institución) es un cambio de **plantilla visual únicamente**, sin tocar ningún módulo de datos.

**Confirmado para el MVP, tal como pediste:** exportar tal cual se ve en pantalla (mismo layout del Dashboard/reporte), en PDF y/o Excel, con:
- Nombre y logo del negocio (Tenant, Módulo 1) como identidad principal — son los dueños de los datos.
- Una marca discreta de CEOM en el pie (ej. "Generado con CEOM"), consistente con el estándar de co-branding de la industria.

**Dejado explícitamente abierto para trabajar después, como pediste:** un diseño de exportación "formal" (para compartir con bancos o instituciones), como una plantilla visual separada que reutiliza exactamente las mismas funciones de datos de este módulo — no requiere ningún cambio de arquitectura cuando se aborde, solo una plantilla nueva. Es, además, un candidato natural para diferenciar planes superiores más adelante (ej. reporte "formal" solo disponible en el plan Pro), aunque esa decisión de negocio queda para cuando se retome.

---

## 7. Confirmaciones de esta ronda

1. **Enfoque de fondo:** confirmado — Reportes es puramente una capa de presentación, sin tablas propias, tal como lo fija la arquitectura v3.
2. **Las tres adendas** (sección 2): confirmadas tal como quedaron planteadas.
3. **Exportación:** confirmada la investigación y el enfoque de la sección 6 — MVP con co-branding simple (negocio + marca discreta de CEOM), mismo layout que pantalla, y la plantilla formal para bancos/instituciones queda anotada para retomar después, sin deuda de arquitectura.

Con esto, el Módulo 10 queda cerrado.

---

*Módulo 10 — cerrado y confirmado. Continúa el Módulo 11 (Suscripción y Panel Administrativo CEOM).*