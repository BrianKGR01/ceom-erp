# 5. Instituciones

Una **institución** es una universidad, incubadora u organización que hace seguimiento de negocios
que participan de sus programas. No tiene cuenta de CEOM y no es colaboradora de ningún negocio: es
una lectora externa, acotada y revocable.

**Instituciones** (`/admin/instituciones`). Pantalla partida: lista a la izquierda, ficha a la
derecha.

---

## Los dos caminos por los que aparece una institución

Es lo primero que hay que entender, porque cambia todo el trabajo posterior.

**Camino 1 — el negocio invita.** El dueño genera un código de acceso desde su aplicación y se lo da
a la institución. La institución lo canjea en el portal y **se registra sola**: aparece en esta lista
sin que vos hagas nada, ya con ese negocio en su cartera.

**Camino 2 — CEOM presenta.** Vos creás la institución acá, le vinculás negocios a su cartera, y
creás una solicitud de seguimiento hacia cada uno. El dueño de cada negocio decide qué aprueba.

**Los dos conviven** y una misma institución puede haber llegado por uno y seguir por el otro.

---

## Crear una institución

| Campo | Notas |
|---|---|
| **Nombre** | Obligatorio |
| **Tipo** | Universidad, incubadora u organización |
| **Contacto** | Opcional |
| **Correo** | Opcional en el formulario — **pero cargalo siempre.** Ver abajo. |

Eliminar es una baja lógica: la institución desaparece de la lista y sus datos quedan.

> ⚠️ **El correo figura como opcional y en la práctica no lo es.** Es lo único con lo que la
> institución puede entrar al portal: el acceso se pide como enlace mágico al correo registrado. Una
> institución creada sin correo **existe como registro pero no puede entrar a ver nada**, y el
> formulario no lo advierte. Si llegó por el camino 1 el problema no se da, porque ahí el portal sí
> lo exige. (ver H-43)

---

## La cartera

Pestaña **Cartera** dentro de la ficha. Es la lista de negocios que esa institución sigue.

| Acción | Qué hace |
|---|---|
| **Vincular negocio** | Agrega un negocio a la cartera, con cohorte y fechas opcionales. |
| **Quitar de la cartera** | Lo saca. |

**Estar en la cartera no da acceso a los datos.** Son dos cosas separadas y conviene no confundirlas:

- **La cartera** es la relación administrativa: qué negocios sigue esta institución. Es metadato —
  nombre, rubro, plan, estado— y la institución lo ve sin necesidad de aprobación.
- **El consentimiento** es lo que habilita ver los datos de negocio, y **lo otorga únicamente el
  dueño**.

Podés vincular un negocio a una cartera y la institución no va a ver ni una venta hasta que ese
dueño apruebe.

**La cartera también se puebla sola** cuando la institución canjea un código de ese negocio.

---

## Crear una solicitud de seguimiento

Botón **Nueva solicitud** dentro de la pestaña Cartera. El negocio se elige entre los ya vinculados,
y marcás qué tipos de información se piden.

**Lo que hacés acá es registrar un pedido, no otorgar un acceso.** La solicitud le aparece al dueño
del negocio en su propia aplicación, y él decide:

- Puede **aprobarla completa**.
- Puede **aprobar menos** de lo pedido, destildando tipos.
- Puede **rechazarla**.
- Puede **no responder**, y entonces no pasa nada.

**Nunca puede aprobar más de lo que pediste**: el checklist solo itera sobre lo solicitado.

**No hay aviso al dueño.** El sistema no le manda ningún correo: la solicitud aparece en su pantalla
y la va a ver cuando entre. Si el pedido es urgente, avisale por fuera.

---

## Qué información se puede pedir

Los tres tipos, siempre por separado:

| Tipo | Qué habilita ver |
|---|---|
| **Ventas y finanzas** | Tendencia de ventas, flujo de caja, estado de resultados, costos fijos |
| **Producción** | Producciones registradas y merma |
| **Insumos y stock** | Catálogo de insumos con su costo |

**Lo que ninguna institución ve nunca:** clientes, ventas individuales, colaboradores. Todo lo que
ve es agregado.

**El plan del negocio manda.** Si su plan no incluye un tipo, el negocio **no puede** compartirlo
aunque quiera: la validación es real y del lado del servidor. Si una institución necesita algo que el
plan del negocio no permite, primero hay que cambiarle el plan ([capítulo 4](04-seguimiento-de-negocios.md)).

---

## Revocación

**No la controlás vos.** El dueño del negocio puede revocar cualquier permiso en cualquier momento,
sin avisarle a nadie y sin que su decisión pase por CEOM. El corte es inmediato y real.

Si una institución te reporta que dejó de ver un negocio, la explicación más probable es que el dueño
revocó. Eso se consulta del lado del negocio, no desde acá.

---

## El orden recomendado

Para incorporar una institución con varios negocios:

1. **Creá la institución**, asegurándote de que quede con un correo cargado — si no, no va a poder
   entrar al portal.
2. **Vinculá los negocios** a su cartera.
3. **Creá una solicitud por negocio**, pidiendo solo los tipos que la institución realmente necesita.
4. **Avisale a cada dueño por fuera** de que le llegó una solicitud, porque el sistema no lo hace.
5. **Confirmá con la institución** que puede entrar al portal antes de dar el alta por cerrada.
