# Propuesta: roles por defecto para un negocio

> # ⚠️ ESTO NO EXISTE EN EL SISTEMA
>
> **Hoy CEOM no trae ningún rol predefinido.** Un negocio nuevo tiene exactamente dos roles, ambos
> de sistema y no editables: **Dueño** y **Administrador CEOM**. Cualquier otro rol lo tiene que
> construir el dueño a mano, marcando casilla por casilla una matriz de 10 módulos × 4 acciones.
>
> Este documento es **una propuesta de producto**, no documentación de una función. Nada de lo que
> hay acá abajo se puede hacer hoy sin construirlo.
>
> **La decisión es tuya.** Escribí esto porque el capítulo `negocio/09-tu-equipo.md` cambia mucho
> según qué se resuelva: si hay roles predefinidos, se documentan; si no, el manual tiene que
> enseñar a armar la matriz desde cero, que es bastante más largo y bastante más fácil de hacer mal.

---

## Por qué vale la pena tener roles por defecto

Tres razones, en orden de peso:

1. **La matriz en blanco es una mala primera experiencia.** Un dueño que invita a su primer
   empleado se encuentra con 40 casillas y ninguna pista de cuáles marcar. La consecuencia previsible
   no es que se equivoque en el detalle: es que **le dé todo a todos**, porque es lo único que con
   seguridad funciona. Un sistema de permisos que empuja a saltearse los permisos no está cumpliendo
   su función.
2. **Es donde se juega la confianza en los datos.** El modelo de corrección por ajuste
   —nada se edita, todo se corrige dejando rastro— solo tiene sentido si "anular o corregir" es un
   permiso escaso. Si todos lo tienen, la trazabilidad existe en la base y no en la práctica.
3. **Los roles son el vocabulario del negocio.** "Vendedor" y "Encargado de depósito" son palabras
   que el dueño ya usa. Partir de ellas y ajustar es un problema mucho más chico que partir de una
   grilla vacía.

---

## De dónde sale esta propuesta

Del denominador común de los ERPs y sistemas de gestión para pymes de la región y del mercado
general —Odoo, Alegra, Bind, Zoho, Contpaqi, SAP Business One—, que con nombres distintos convergen
casi siempre en el mismo puñado de perfiles:

| Perfil recurrente | Cómo suele llamarse |
|---|---|
| Quien atiende y cobra | Vendedor, Cajero, Punto de venta |
| Quien maneja la mercadería | Almacén, Inventario, Depósito |
| Quien le compra a proveedores | Compras, Abastecimiento |
| Quien lleva las cuentas | Administración, Contabilidad, Finanzas |
| Quien produce | Producción, Manufactura |
| Quien solo mira | Consulta, Solo lectura, Auditor |

La adaptación a CEOM es directa: los seis perfiles se mapean bien sobre los 10 módulos de la matriz.

**El criterio con el que los armé:** cada rol da **el permiso mínimo para hacer el trabajo**, no el
permiso cómodo. Es más fácil que un dueño agregue un permiso que le falta a un colaborador que
descubra que le sobraba.

---

## Los seis roles propuestos

Notación de la matriz:

| Marca | Significa |
|---|---|
| **—** | Sin acceso. El módulo no aparece. |
| **V** | Ver |
| **VC** | Ver y crear |
| **VCE** | Ver, crear y editar |
| **VCEA** | Todo, incluido anular o corregir |

| Módulo | Vendedor | Depósito | Compras | Administración | Producción | Consulta |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Productos** | V | VCE | V | VCE | V | V |
| **Stock** | V | VCEA | V | V | V | V |
| **Ventas** | VC | V | — | V + A | — | V |
| **Gastos** | — | — | VCE | VCEA | — | V |
| **Bienes y deudas** | — | V | — | VCEA | V | V |
| **Producción** | — | V | — | V | VCEA | V |
| **Finanzas** | — | — | — | V | — | V |
| **Simulador** | — | — | — | VC | — | V |
| **Reportes** | — | V | V | V | V | V |
| **Proveedores** | — | V | VCEA | VCE | — | V |
| **Permisos especiales** | ninguno | ninguno | ninguno | *importar histórico* | ninguno | ninguno |

### Qué hace cada uno, y la decisión que hay detrás

**Vendedor** — atiende, arma el carrito, cobra.
La decisión importante: **puede crear ventas pero no anularlas ni corregirlas**. Un error de
tipeo lo escala a quien tenga ese permiso. Es incómodo a propósito: es exactamente lo que hace que
el historial de ventas sea confiable. No ve reportes ni márgenes.

**Encargado de depósito** — recibe mercadería, cuenta, ajusta.
Es el único rol, además de Administración, con "anular o corregir" sobre stock: los ajustes manuales
y las mermas son su trabajo diario, no una excepción. Puede crear y editar productos porque en la
práctica es quien conoce el catálogo. Ve ventas para saber qué está saliendo, pero no las registra.

**Compras** — proveedores, órdenes, recepciones, pagos a proveedores.
Tiene gastos en VCE porque una compra y un gasto son la misma decisión de plata desde su lado. No
tiene "anular o corregir" sobre gastos: revertir un pago es una decisión de administración.

**Administración** — el rol de mayor confianza después del dueño.
Es quien corrige. Tiene "anular o corregir" sobre ventas, gastos y bienes y deudas. Ve finanzas y
usa el simulador. **No vende ni ajusta stock**: separar quien registra de quien corrige es
justamente el punto. Es el único con un permiso especial (*importar histórico*), porque cargar
ventas viejas en masa es una tarea de puesta a punto, no de operación.

**Encargado de producción** — solo tiene sentido en el rubro de alimentos y bebidas por lotes.
Insumos, recetas, registro de lotes. Ve productos y stock para trabajar, no los modifica.
Deliberadamente **sin** el permiso especial de producir sin stock de insumo: producir con faltante
es una excepción que alguien tiene que autorizar.

**Consulta** — ve todo, no toca nada.
Para un contador externo, un socio que no opera, un mentor. Es el rol que evita el atajo de
compartir la contraseña del dueño, que hoy es la única alternativa.

---

## Cómo lo implementaría

Tres formas, de menor a mayor esfuerzo. Mi recomendación es la opción B.

| | Qué es | A favor | En contra |
|---|---|---|---|
| **A** | Sembrar los 6 roles al crear el negocio, como roles del negocio (editables). | Lo más simple. Reusa `crearRolPersonalizado` sin tocar nada. | Un negocio de una sola persona arranca con 6 roles que no usa. Ruido. |
| **B** | **Ofrecerlos como plantillas.** En "Roles", junto a "+ Nuevo rol", un botón **"Partir de una plantilla"** que abre los 6 con su descripción; al elegir uno se crea un rol normal, con la matriz precargada y totalmente editable. | No ensucia a quien no los quiere. Enseña el modelo mental por el ejemplo. El rol resultante es un rol común: no hay un concepto nuevo que mantener. | Hay que construir la pantalla de selección. |
| **C** | Roles de sistema globales, como Dueño y Administrador CEOM. | Consistentes entre negocios. | **Malo.** Los roles de sistema son globales y compartidos: un negocio no podría ajustar "su" Vendedor sin afectar a todos. Va en contra del diseño actual, que hace bien en tener los roles por negocio. |

**Por qué B.** Resuelve el problema real —la grilla en blanco— sin agregar un concepto nuevo al
modelo de datos ni imponerle nada a quien trabaja solo. Y como lo que queda es un rol normal, el
dueño puede renombrarlo a como le dice él a ese puesto, que es lo que va a terminar pasando.

---

## Antes de implementar esto, hay que verificar una cosa

**El mapeo entre cada acción de la matriz y cada pantalla concreta no está verificado en este
documento.** La matriz de arriba expresa una *intención* ("el depósito ajusta stock", "el vendedor
no anula"). Cuál de las cuatro acciones controla exactamente cada botón —si el ajuste manual de
stock exige `crear` o `anular_ajustar`, si registrar un pago de venta exige `editar`— hay que
comprobarlo en `actions.ts` de cada módulo, gate por gate.

Es trabajo acotado pero indispensable: una plantilla que deja a un vendedor sin poder cobrar, o a un
encargado de depósito sin poder ajustar, es peor que no tener plantillas. **Si esta propuesta se
aprueba, ese chequeo es el primer paso, antes de escribir una línea de UI.**

---

## Dos cosas que esta propuesta no resuelve

1. **Ningún rol puede administrar colaboradores.** Invitar gente, cambiar roles y otorgar permisos
   especiales están controlados con "¿sos el dueño?" directamente, no por la matriz —"identidad" no
   es uno de los 10 módulos. No hay forma de delegar la gestión del equipo, y estos seis roles no lo
   cambian. Es una decisión de diseño existente, con su ambigüedad ya registrada en
   `identidad/ANCLA.md`.

2. **Compartir datos con instituciones tampoco es delegable**, por el mismo motivo. Y en ese caso
   me parece correcto que siga así: es la decisión de a quién le mostrás tus números.
