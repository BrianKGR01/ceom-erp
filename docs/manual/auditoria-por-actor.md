# Auditoría por actor — qué ve cada uno y en qué orden

> **Qué es este documento.** Para cada uno de los tres actores: a qué pantallas llega, qué puede
> hacer en cada una, y —lo importante— **en qué orden tiene sentido hacerlo**. Ese orden de
> dependencias es la columna vertebral del manual: define el índice de
> [`README.md`](README.md) y el orden interno de cada capítulo.
>
> **Fuentes.** Rutas reales de `src/app/`, gates de permiso de `src/modules/identidad/actions.ts`,
> los `ANCLA.md` de cada módulo y [`docs/ui/pantallas.md`](../ui/pantallas.md). Verificado contra el
> código el 2026-07-22.
>
> **Cómo leer las marcas.** ⚠️ = existe pero se comporta distinto de lo esperado; 🚧 = no existe.
> Cada una remite a un hallazgo en [`hallazgos.md`](hallazgos.md).

---

## Cómo se separan los tres actores

Tres superficies dentro de la misma aplicación:

| Superficie | Quién entra | Cómo entra | Cómo se controla |
|---|---|---|---|
| `/app` | Dueño y colaboradores de un negocio | Correo y contraseña | Sesión + rol. Si no hay sesión, va a `/login`. |
| `/admin` | Equipo CEOM | El mismo correo y contraseña | Sesión + rol `ceom_admin`. Con sesión pero sin ese rol, redirige a `/app`. |
| `/portal` | Instituciones | Sin cuenta de CEOM: primero un código de acceso de un solo uso, después un enlace mágico al correo | Vínculo `correo ↔ usuario de Auth`, resuelto al canjear |

`/app` y `/admin` comparten pantalla de entrada; lo que cambia es a dónde te manda después de
entrar, según tu rol. `/portal` es una autenticación completamente separada.

Los tres controles son de servidor (en el `layout.tsx` de cada superficie), no de interfaz.

---

# Actor 1 — Equipo CEOM

**Quién es.** El equipo que opera la plataforma. **No tiene roles internos**: quien entra a `/admin`
puede hacer todo lo que `/admin` permite. Su acceso a los datos de un negocio no pasa por
consentimiento —está cubierto por los términos del servicio— pero sí queda registrado.

**Superficie:** `/admin`. Alrededor de 15 pantallas.

## Orden de dependencias

Este orden no es una recomendación: cada eslabón necesita el anterior para existir.

```
  seed:admin (script)            ← 🚧 no hay pantalla; ver H-14
        ↓
  1. Planes                      ← tiene que existir al menos uno activo
        ↓
  2. Alta de negocio             ← elige un plan; crea negocio + sucursal + dueño + invitación
        ↓
  3. Seguimiento de negocios     ← listado, ficha, cambiar plan, cambiar estado
        ↓
  4. Instituciones               ← independiente de 2, pero su cartera necesita negocios
        ↓
  5. Cartera y solicitudes       ← vincular negocios a una institución, pedir acceso
        ↓
  6. Registro de accesos         ← solo tiene contenido después de consultar fichas
```

## Pantallas

### Paso 0 — El primer acceso

| Qué | Dónde | Notas |
|---|---|---|
| Crear el primer administrador | `pnpm seed:admin <correo>` | Resuelve el problema del huevo y la gallina: `crearTenant` exige un solicitante ya autenticado como `ceom_admin`, y la migración solo siembra el rol, nunca una persona. |

> 🚧 **No existe ninguna pantalla para sumar a otra persona al equipo CEOM.** Sumar a alguien
> requiere acceso al servidor. (H-14)

### 1 — Planes (`/admin/planes`)

Catálogo de los planes que se le pueden asignar a un negocio. Lista de tarjetas con un único diálogo
para crear y editar.

| Puede | Detalle |
|---|---|
| Crear y editar un plan | Nombre; incluye sucursales; permite más de un dueño; permite bajar de plan por autogestión; días de duración de la invitación (7 por defecto); días de etapa de solo lectura (3 por defecto); qué información se puede compartir con instituciones; precio mensual y moneda (BOB o USD). |
| Desactivar y reactivar | Es el atributo `activo`, no una baja: el plan sigue existiendo y un negocio puede seguir en un plan desactivado. |

**Por qué va primero.** El alta de negocio exige un plan. Si no hay ninguno activo, el formulario de
alta no tiene qué ofrecer.

> ⚠️ El atributo **"Múltiples sucursales"** no puede tener efecto hoy: no existe forma de crear una
> segunda sucursal. (H-02)

### 2 — Alta de negocio (`/admin/tenants/nuevo`)

Página dedicada, no diálogo. Es la única puerta de entrada de un cliente al sistema: **no hay
registro por autoservicio**.

| Entra | Sale |
|---|---|
| Nombre del negocio, moneda principal, plan (tarjetas de planes activos), fecha de inicio de suscripción, nombre y correo del dueño | Negocio + sucursal "Principal" + usuario dueño, creados en una sola transacción, más la invitación por correo al dueño |

**Lo que hay que saber para documentarlo bien:** lo que se crea acá es **todo** lo que el negocio
recibe. No se siembran canales de venta, ni métodos de pago, ni categorías. De ahí sale H-01.

> ⚠️ El correo del dueño es su identidad y no hay forma de corregirlo después desde la interfaz. Un
> error de tipeo acá deja al dueño sin poder entrar nunca. Combinado con H-05 (no hay recuperación
> de contraseña), es el punto más frágil del alta.

### 3 — Seguimiento de negocios (`/admin/tenants`, `/admin/tenants/[id]`)

| Pantalla | Puede |
|---|---|
| **Listado** | Ver todos los negocios con cuatro totales agregados: total, por estado de acceso, por plan, por rubro. Buscar por nombre. Entrar a cada ficha. |
| **Ficha** | Ver los datos del negocio, su plan vigente, estado de suscripción y de acceso, fechas. |
| **Cambiar plan** (diálogo) | Elegir otro plan activo. |
| **Cambiar estado de suscripción** (diálogo) | `activa` / `pausada` / `vencida`. Si se elige `vencida`, pide la fecha de próximo pago: es el ancla desde la que se mide la etapa de gracia. |
| **3 pestañas de consulta** | Financiero, Operativo, Inventario Operativo, con selector de período. **Estas tres sí quedan registradas** en el registro de accesos. |

**La distinción que el manual tiene que explicar bien:** hay dos estados y se confunden.

- **Estado de suscripción** (`activa` / `pausada` / `vencida`) es lo que se asigna a mano.
- **Estado de acceso** (`activo` / `solo lectura` / `bloqueado`) **se deriva** del anterior más la
  fecha de próximo pago. Nunca se asigna directamente.

Una suscripción `vencida` da `solo lectura` mientras dure la gracia y `bloqueado` después. Una
suscripción `pausada` da `bloqueado` de una. Y `vencida` **sin** fecha de próximo pago da
`bloqueado` inmediato, sin gracia.

**Alcance real de "salud":** solo esos cuatro agregados. El porcentaje de onboarding completado y la
retención, mencionados en el diseño del módulo, no están implementados.

> ⚠️ Abrir la ficha **sí** queda registrado, igual que las tres pestañas. Lo que no se distingue en
> el registro es una consulta de insumos de una de producción. (H-13)
> 🚧 El listado no pagina. (H-21)

### 4-5 — Instituciones, cartera y solicitudes (`/admin/instituciones`)

Maestro-detalle. La ficha de cada institución tiene una pestaña **Cartera**.

| Puede | Detalle |
|---|---|
| Crear, editar y eliminar una institución | Nombre, tipo (universidad / incubadora / organización), contacto. La baja es lógica. |
| Vincular un negocio a la cartera | Diálogo. Se puede vincular a mano, o la cartera se puebla sola cuando la institución canjea un código de ese negocio. |
| Quitar de la cartera | |
| Crear una solicitud de seguimiento | Diálogo dentro de la pestaña Cartera. El negocio se elige entre los ya vinculados. Se eligen los tipos de información que se piden. **El equipo CEOM pide; el dueño del negocio decide.** |

### 6 — Registro de accesos (`/admin/logs`)

Filtrable por negocio y por rango de fechas. Muestra quién consultó, de qué negocio, qué tipo de
información y cuándo.

> ⚠️ Identifica a la persona con 8 caracteres de un UUID, no con su nombre. (H-07)
> ⚠️ Las consultas de Inventario Operativo se registran como "operativo": no se distinguen de las
> de producción. (H-13)

---

# Actor 2 — Negocio

**Quién es.** La empresa cliente. Un **dueño** —creado junto con el negocio, único, permanente
salvo transferencia explícita— más los **colaboradores** que invite.

**Superficie:** `/app`. La gran mayoría de las 117 pantallas del inventario.

## Cómo funciona el permiso, en una frase por regla

Es lo que el capítulo de equipo tiene que enseñar, y se resuelve en este orden exacto
(`identidad/actions.ts:78-122`):

1. El equipo CEOM pasa siempre, en cualquier negocio.
2. Si el acceso del negocio está **bloqueado**, nadie hace nada — ni ver.
3. Si está en **solo lectura**, solo se puede ver.
4. **El dueño puede todo**, sin pasar por la matriz de permisos.
5. Cualquier otro: se consulta su rol en la matriz **módulo × acción**.

**La matriz** son 10 módulos (productos, stock, ventas, gastos, bienes y deudas, producción,
finanzas, simulador, reportes, proveedores) por 4 acciones (ver, crear, editar, anular o corregir).

**Los permisos especiales** son cuatro y viven aparte de la matriz, porque no son "poder usar una
pantalla" sino "poder saltarse una regla": vender sin stock, gestionar eventos, importar histórico,
producir sin stock de insumo. Se otorgan por rol o como excepción a una persona. El dueño los tiene
todos, siempre.

> ⚠️ La gestión del equipo (invitar, roles, permisos) **no** está en la matriz: se controla con
> "¿sos el dueño?" directamente. Por eso ningún rol personalizado puede administrar colaboradores.

## Orden de dependencias

```
  A. ENTRAR Y CONFIGURAR                        ← forzado, no se puede saltear
     invitación → contraseña → onboarding (negocio → rubro)
                                    ↓
  B. PODER VENDER                               ← el camino dorado
     producto  →  canal de venta  →  venta
                  (⚠️ paso no señalizado, H-01)
                                    ↓
  C. QUE LOS NÚMEROS SIGNIFIQUEN ALGO
     gastos  →  proveedores y compras  →  costo real de los productos
                                    ↓
  D. CRECER
     equipo  →  bienes y deudas  →  producción (solo un rubro)
                                    ↓
  E. DECIDIR CON DATOS                          ← necesita todo lo anterior cargado
     reportes  →  simulador y punto de equilibrio
                                    ↓
  F. COMPARTIR                                  ← necesita que exista una institución
     código de acceso  o  aprobar una solicitud
```

**La regla que ordena todo:** cada bloque produce los datos que el siguiente consume. El simulador
sin costos ni gastos devuelve números vacíos; los reportes sin ventas están en cero; compartir datos
no tiene sentido sin datos.

## Pantallas por bloque

### A — Entrar y configurar

| Pantalla | Ruta | Puede |
|---|---|---|
| Entrar | `/login` | Correo y contraseña. ⚠️ Recuperación de contraseña y registro son enlaces muertos (H-05); se anuncia un asistente de IA inexistente (H-06). |
| Onboarding, paso 1 | `/app/onboarding` | Nombre, ciudad, moneda, logo, "¿dónde vendés hoy?". ⚠️ Ese último campo no crea canales (H-01); quitar el logo no lo quita (H-04). |
| Onboarding, paso 2 | `/app/onboarding` | Elegir rubro: alimentos y bebidas por lotes, comercio minorista, o Modo Básico. **Irreversible.** ⚠️ Después de elegirlo, el paso 1 queda inalcanzable (H-03). |
| Inicio | `/app` | Tarjeta de bienvenida mientras no haya productos; después, el panel del negocio. |

**Forzado:** mientras el dueño no complete el onboarding, cualquier entrada a `/app` lo devuelve
ahí. Los colaboradores no pasan por esto.

### B — Poder vender

| Pantalla | Ruta | Puede |
|---|---|---|
| Catálogo | `/app/productos` | Buscar, filtrar por categoría, gestionar categorías (diálogo). |
| Alta y edición de producto | `/app/productos/nuevo`, `/[id]/editar` | Nombre, unidad de venta y precio son obligatorios; categoría, costo, imagen, stock inicial y vida útil son opcionales. ⚠️ Sin costo, seis pantallas quedan degradadas sin aviso (H-15). |
| Ficha de producto | `/app/productos/[id]` | Stock por sucursal, historial de movimientos, historial de precios de compra. Desde acá: ajuste manual de stock, transferencia entre sucursales, vincular a una receta, eliminar. |
| **Canales de venta** | `/app/ventas/canales` | **El paso que falta en la guía.** Nombre y comisión por defecto. |
| Métodos de pago | `/app/ventas/metodos-pago` | Nombre y activo. Sin baja lógica: la baja es el atributo. |
| Vender | `/app/ventas` | Carrito, cliente (existente, nuevo o ninguno), canal (obligatorio), evento (si hay alguno abierto), pago inicial (opcional). |
| Historial de ventas | `/app/ventas/historial` | Buscar por cliente, filtrar por estado y canal. |
| Ficha de venta | `/app/ventas/[id]` | Detalle con precios y costos congelados, pagos, ajustes. Desde acá: registrar pago, ajustar. |
| Clientes | `/app/ventas/clientes` | Alta, edición, baja lógica, con última compra derivada. |
| Eventos | `/app/ventas/eventos` | Ferias y pop-ups. **Requiere el permiso especial `gestionar eventos`**, que el dueño tiene por defecto. Abrir, cerrar, reabrir. ⚠️ No se puede editar la comisión de un evento abierto, ni cerrar con un total agregado (H-17). |
| Importar histórico | `/app/ventas/importar` | Archivo CSV con encabezado fijo. Requiere ser dueño o tener el permiso especial. No descuenta stock ni calcula comisión. |

**El modelo de corrección.** Una venta no se edita nunca. Se corrige con un **ajuste** —corrección,
devolución, descuento posterior o anulación total— que exige motivo y queda al lado de la original.
Es la regla más importante que el manual tiene que enseñar, y aplica igual a compras, producciones y
stock. ⚠️ Una devolución no puede generar todavía el egreso de caja correspondiente (H-17).

### C — Que los números signifiquen algo

| Pantalla | Ruta | Puede |
|---|---|---|
| Gastos | `/app/gastos` | Filtros por categoría, tipo y estado de pago. Categorías de gasto por diálogo. |
| Ficha de gasto | `/app/gastos/[id]` | ⚠️ Los gastos de **origen automático** (comisión de venta, cuota de deuda) no se pueden editar, eliminar ni pagar a mano. Nacen ya pagados. Se corrigen corrigiendo su origen. |
| Alta y edición de gasto | `/app/gastos/nuevo`, `/[id]/editar` | Tipo (fijo, variable no productivo, único), categoría, monto, fecha, proveedor. El tipo se bloquea al editar. |
| Gastos recurrentes | `/app/gastos/recurrentes` | Plantillas con frecuencia. ⚠️ **No se generan solos**: hay un botón por plantilla, y la "próxima fecha" es solo una previsualización (H-10). Pausar es irreversible (H-11). |
| Proveedores | `/app/proveedores` | Maestro-detalle, con historial de compras y de precios por proveedor. |
| Compras | `/app/proveedores/compras` | Listado con filtros por estado y pago. Por fila: recibir, pagar, ajustar. |
| Alta de compra | `/app/proveedores/compras/nuevo` | De producto para reventa o de insumo. Estado "ya recibida" o "pedido" — **"pedido" no mueve stock todavía**; lo mueve recibirla. |

**La cadena que hay que explicar:** comprar → recibir → el stock entra y el costo del producto se
actualiza con el costo unitario de esa compra. El costo deja de ser una estimación del dueño y pasa
a salir de lo que pagó. ⚠️ Para productos de reventa el costo se **reemplaza** por el de la última
compra recibida; no es un promedio ponderado (H-25).

### D — Crecer

| Pantalla | Ruta | Puede |
|---|---|---|
| Colaboradores | `/app/mi-negocio/colaboradores` | Invitar, cambiar rol, suspender y reactivar. **Solo el dueño.** El dueño no puede tocar su propio rol ni suspenderse. |
| Pasar el negocio a otra persona | diálogo | Elige un colaborador activo y un rol para uno mismo. Irreversible. Solo puede haber un dueño. 🚧 No existe *sumar* un segundo dueño (H-17). |
| Roles | `/app/mi-negocio/roles` | Crear roles y marcar la matriz de 10 módulos × 4 acciones. Eliminar un rol con gente asignada abre un diálogo de reasignación forzada. ⚠️ Muestra "(Módulo 1, sección 6.3)" al usuario (H-18). |
| Permisos especiales | `/app/mi-negocio/capacidades` | Los cuatro permisos, por rol o como excepción a una persona. El dueño nunca aparece: los tiene siempre. |
| Mi plan | `/app/mi-negocio/plan` | Solo lectura. ⚠️ Dice "tenant" cuatro veces (H-12). |
| Bienes | `/app/patrimonio` | Listado, ficha, alta, edición, baja con motivo obligatorio, transferencia entre sucursales. |
| Deudas | `/app/patrimonio/pasivos` | Listado, ficha con historial de pagos, alta, refinanciación, registrar pago. Se pueden vincular a un bien. |
| Producción | `/app/produccion/*` | **Solo tiene sentido en el rubro de alimentos y bebidas.** Insumos, recetas, registrar producción, corregir producción, capacidad. ⚠️ El menú lo muestra a todos los rubros (H-08). |

**La cadena de producción, que es la más larga del sistema:** insumo → receta → vincular un producto
a la receta (desde la ficha del producto) → registrar la producción → se descuentan los insumos, se
calcula la merma y el costo del lote, y se acredita stock del producto.

### E — Decidir con datos

| Pantalla | Ruta | Necesita |
|---|---|---|
| Panel de inicio | `/app` | Resultado del período, flujo de caja, ranking de productos, gastos por categoría, control de merma, capacidad de depósito. ⚠️ El filtro de sucursal solo afecta a dos de las cinco tarjetas (H-16). |
| Resumen financiero | `/app/reportes` | Estado de resultados formal + flujo de caja + valor total de bienes y deudas. |
| Histórico de ventas | `/app/reportes/historico-ventas` | Con o sin eventos. |
| Margen por canal y producto | `/app/reportes/margen-canal-producto` | **Es lo que justifica haber cargado bien los canales.** |
| Ranking de productos | `/app/reportes/ranking-productos` | Por rotación o por margen, filtrable por canal. |
| Simulador de precios | `/app/simulaciones` | Producto con costo + historial de ventas. Tantear es gratis; solo "Guardar simulación" deja registro. |
| Punto de equilibrio | `/app/simulaciones` (pestaña) | **Gastos fijos cargados.** Sin ellos el número no significa nada. |
| Comparar productos | `/app/simulaciones/comparativo` | Resalta los que se alejan del umbral de margen configurado. |
| Margen por producto | `/app/simulaciones/margen-producto` | |
| Historial de simulaciones | `/app/simulaciones/historial` | Sin borrado, por diseño. |

> 🚧 Sin exportación a PDF ni Excel en ninguna de estas pantallas (H-20).

### F — Compartir

| Pantalla | Ruta | Puede |
|---|---|---|
| Generar código de acceso | `/app/consentimiento` | Elegir qué tipos de información se comparten, según lo que permita el plan. Devuelve un código para entregarle a la institución. |
| Códigos generados | `/app/consentimiento/codigos` | Ver y revocar. **Revocar corta el acceso ya otorgado**, no solo invalida el código. |
| Permisos vigentes | `/app/consentimiento/aprobaciones` | Ver qué institución tiene qué, y revocar. El corte es inmediato. |
| Solicitudes de acceso | `/app/consentimiento/solicitudes` | Aprobar o rechazar. Al aprobar se puede **quitar** información de lo pedido, nunca agregar. |

**Solo el dueño.** Es la única decisión del sistema que no se puede delegar por rol.

---

# Actor 3 — Institución

**Quién es.** Universidad, incubadora u organización que hace seguimiento de negocios. **No tiene
cuenta de CEOM** y no es un colaborador de ningún negocio: es un lector externo, acotado y
revocable.

**Superficie:** `/portal`. Alrededor de 6 pantallas.

## Orden de dependencias

Una institución no puede hacer absolutamente nada por iniciativa propia. Su acceso siempre nace
afuera, por uno de dos caminos:

```
  CAMINO 1 — el negocio invita
  el negocio genera un código  →  la institución lo canjea en /portal
                                  (se registra sola, si no existía)
                                          ↓
  CAMINO 2 — CEOM presenta
  CEOM crea la institución  →  la vincula a la cartera  →  crea una solicitud
                                          ↓
                            el dueño del negocio aprueba (o recorta)
                                          ↓
                          la institución ve ese negocio en su cartera
```

**La diferencia entre los dos caminos importa para el manual:** en el camino 1 la institución se
registra sola al canjear y no necesita que CEOM haga nada. En el camino 2 tiene que existir antes,
creada por CEOM, y el negocio decide después.

## Pantallas

| Pantalla | Ruta | Puede |
|---|---|---|
| Canjear código de acceso | `/portal` | Asistente de dos pasos: el código primero; después, el alta mínima de la institución (nombre, tipo, correo, contacto) solo si no existía. **Pública, sin sesión.** No hay forma de validar un código sin canjearlo: el error aparece recién al confirmar. |
| Volver a entrar | `/portal`, opción "¿Ya tenés acceso?" | Pide un enlace al correo registrado. El mensaje es siempre genérico, exista o no ese correo. |
| Mi cartera | `/portal` (con sesión) | Los negocios que le dieron acceso, con cohorte, fechas, rubro, plan y estado. Cuatro totales y búsqueda. **No requiere aprobación**: es metadato de la relación, no dato de negocio. ⚠️ Dice "tenant" cinco veces, en la superficie de menor alfabetización técnica del producto (H-12). |
| Ficha de un negocio | `/portal/cartera/[tenantId]` | Cuatro pestañas: Tendencia de ventas y Detalle financiero (requieren *ventas y finanzas*), Detalle operativo (requiere *producción*), Detalle de inventario (requiere *insumos y stock*). |

**La regla de privacidad, que es el corazón del actor.** Las cuatro consultas devuelven o bien los
datos completos o bien "no autorizado" — **nunca datos parciales**.

Y la decisión de interfaz correspondiente: **las cuatro pestañas se muestran siempre**. Una pestaña
sin permiso aparece con candado y, al abrirla, dice explícitamente que ese negocio todavía no
aprobó esa información — nunca una tabla vacía. Es deliberado: una tabla vacía haría creer que el
negocio no tiene datos, cuando lo que pasa es que no dio permiso.

**Revocación en caliente.** Si el negocio revoca mientras la institución está mirando, al recargar
la pestaña pasa a candado. El corte es en la base de datos, no en la pantalla.

**La diferencia con `/admin`:** el equipo CEOM ve estas mismas tres consultas sin candado y sin
consentimiento —su acceso está cubierto por los términos del servicio— pero **queda registrado**.
La institución necesita permiso explícito y revocable; CEOM necesita dejar rastro. El manual tiene
que explicar esta asimetría en los dos capítulos, porque es la garantía que se le vende al negocio.

---

## Tres cosas que esta auditoría dejó en claro

1. **El camino dorado tiene un escalón sin señalizar.** Entre "cargar el producto" y "vender" hace
   falta un canal de venta, y las dos únicas guías que el usuario ve (el onboarding y la tarjeta de
   bienvenida) sugieren lo contrario — una de ellas con una afirmación directamente falsa. No
   bloquea: el canal se crea desde el propio punto de venta. Es el hallazgo H-01 y ordena el
   capítulo 1 del manual.

2. **La sucursal no es un paso de configuración: es un supuesto.** Viene una, no se puede crear otra,
   y hay funciones construidas que asumen que hay varias. Cualquier documentación que diga "configurá
   tus sucursales antes de vender" sería falsa (H-02).

3. **Los tres actores no son simétricos y no hay que documentarlos igual.** El equipo CEOM es un
   operador con acceso total y trazado. El negocio es el único que acumula datos y el único con una
   estructura interna de permisos. La institución no tiene iniciativa propia: todo su acceso nace de
   una decisión de otro. Esa asimetría define cuánto ocupa cada capítulo y qué tiene que enseñar.
