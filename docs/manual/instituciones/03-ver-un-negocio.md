# 3. Ver un negocio

Desde tu cartera, tocá cualquier negocio para abrir su ficha. Tiene **cuatro pestañas** y un selector
de período compartido.

---

## Las cuatro pestañas

| Pestaña | Qué muestra | Requiere que te aprueben |
|---|---|---|
| **Tendencia de ventas** | Los ingresos del período | *Ventas y finanzas* |
| **Detalle financiero** | Flujo de caja, estado de resultados y total de costos fijos | *Ventas y finanzas* |
| **Detalle operativo** | Producciones registradas y merma total | *Producción* |
| **Detalle de inventario** | Catálogo de insumos con su costo vigente | *Insumos y stock* |

Las dos primeras dependen del mismo permiso: si te aprobaron *ventas y finanzas*, se habilitan las
dos juntas.

El selector de período aplica a las tres primeras. El detalle de inventario muestra la situación
actual, sin período.

---

## Las cuatro cosas que puede decirte una pestaña

**Siempre vas a ver las cuatro pestañas**, incluso las que no te aprobaron. Lo que cambia es qué
encontrás al abrirlas, y son cuatro estados distintos que conviene no confundir:

| Lo que ves | Qué significa |
|---|---|
| 🔒 **Con candado** — *"Este negocio no aprobó…"* | El negocio **tiene** esos datos y decidió no compartirlos. Puede cambiar de opinión cuando quiera. |
| ⊖ **"Este negocio no usa este módulo"** | Por su rubro, ese módulo no forma parte de su operación. **No hay nada que registrar**, ni ahora ni nunca. Un comercio que revende no produce: su pestaña de Producción no está vacía, es inaplicable. |
| **Una tabla vacía**, sin candado ni aviso | Tenés acceso, el módulo aplica, y ese negocio **realmente no registró actividad** en el período. |
| ⚠️ **Un aviso amarillo** junto a los números | Los datos están, pero **hay algo que cambia cómo se leen**. Ver abajo. |

**Es deliberado que los cuatro se vean distinto.** Si "no me dieron permiso", "no aplica" y "no hubo
actividad" se vieran igual, sacarías conclusiones opuestas del mismo cuadro vacío — y la más
peligrosa es leer un "no aplica" como "este negocio no produjo nada".

**Nunca vas a ver datos parciales sin que te lo digan.** Cada pestaña devuelve todo o nada, y cuando
lo que hay no cubre todo el negocio, **te lo avisa**.

---

## ⚠️ Los avisos que cambian cómo se lee un número

Son la parte más importante de esta pantalla. No corrigen el número: te dicen **sobre qué está
calculado**, que es lo que necesitás para no leerlo de más.

**"X de los ingresos de este período son de productos sin costo cargado."** Esa parte de las ventas
se está contando **sin restarle su costo**, porque el negocio todavía no lo cargó. El resultado que
ves es, entonces, **un techo**: el real es menor. Es el aviso más frecuente y el más fácil de pasar
por alto, porque el número de arriba se ve perfectamente normal.

> Es exactamente el mismo aviso que ve el dueño en su propia aplicación. La diferencia es que él
> puede ir a cargar los costos que faltan; vos no. Por eso acá no hay ningún botón — solo la
> advertencia de cómo leerlo.

**"Este negocio tiene N sucursales y solo M están registrando operaciones."** Todo lo que ves cubre
esa parte. **No significa que las otras hayan cerrado**: significa que su operación no se está
registrando en CEOM. Si ves que la actividad de un negocio bajó y aparece este aviso, la explicación
probablemente sea ésta y no una caída de ventas.

---

## Si una pestaña se cierra de golpe

Puede pasar: estabas viendo el detalle financiero de un negocio y al recargar aparece el candado.

**Significa que el dueño revocó ese permiso.** Es su derecho, el corte es inmediato, y no requiere
avisarte ni pasar por CEOM.

No es un error ni un problema técnico. Si necesitás recuperar el acceso, hay que hablarlo con el
negocio: solo su dueño puede volver a otorgarlo.

---

## ⚠️ Cómo leer estos números

Los datos que ves son los mismos que ve el dueño en su propia aplicación, con los mismos límites.
Antes de sacar conclusiones —sobre todo si evaluás desempeño o asignás financiamiento— conviene saber
esto:

**El resultado que muestra el estado de resultados tiende a ser mejor que el real**, aunque menos que
antes: las comisiones de canal (H-24) y las correcciones de compra al alza (H-31) ya se descuentan
solas, y **el costo faltante ahora te lo avisa la propia pantalla** (ver arriba). Queda una que no:

| No se descuenta | Cuándo aplica |
|---|---|
| Las **cuotas** de sus deudas | Si tiene deudas cargadas (H-27) |

Un detalle de comparabilidad: las comisiones se descuentan **desde** que se corrigió H-24. Las ventas
registradas antes de esa corrección no generaron su gasto de comisión, así que los períodos viejos
siguen viéndose mejor que los nuevos por ese motivo, no por desempeño.

Y una que puede ir en cualquier dirección: un ajuste de venta cargado con el signo equivocado suma
en vez de restar (H-30).

**Qué hacer con esto:**

- **La tendencia de ventas y el flujo de caja son los números más confiables.** Salen de ventas y
  pagos reales.
- **El estado de resultados leelo como un techo**, no como la ganancia.
- **Si vas a tomar una decisión importante con estos datos, pedíselos al negocio también por otra
  vía** y contrastá. No porque el sistema mienta, sino porque depende enteramente de qué tan completo
  esté cargado.
- **Un negocio con mucha venta y poco costo cargado no es un negocio rentable**: es un negocio con
  los costos sin cargar. Es el patrón más común y el más fácil de malinterpretar — por eso ahora la
  pantalla te lo dice con el monto exacto en vez de dejártelo a vos.

---

## Lo que nunca vas a ver

Aunque el negocio te apruebe los tres tipos de información:

- **Sus clientes.** Ni nombres, ni teléfonos, ni a quién le vendió.
- **Sus ventas una por una.** Solo totales y tendencias.
- **Su equipo.** Ni quiénes son ni quién cargó qué.
- **Sus productos con nombre**, en el detalle operativo: las producciones se muestran con fecha y
  cantidad, sin identificar qué producto era.

Lo que ves es siempre agregado, por diseño. El portal está pensado para evaluar cómo va un negocio,
no para reconstruir su operación.

**Y no podés modificar nada.** No hay ninguna acción de escritura en todo el portal.

---

## Dos pendientes conocidos

> 🚧 El **detalle operativo** no muestra el uso de capacidad de producción, aunque el negocio lo tenga
> cargado. Quedó fuera del alcance del portal. (ver H-17)

> 🚧 El **detalle de inventario** muestra el catálogo de insumos con su costo, pero **no el stock
> disponible** de cada uno. (ver H-17)
