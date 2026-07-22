# 6. Registro de accesos

**Registro de accesos** (`/admin/logs`). Es la pantalla de auditoría: qué persona del equipo consultó
datos de qué negocio y cuándo.

Existe por una razón concreta. El equipo de CEOM puede ver los datos financieros y operativos de
cualquier negocio **sin pedirle permiso** —a diferencia de una institución, que necesita
consentimiento explícito—. La contrapartida de esa potestad es que **cada consulta queda trazada**.
Es la garantía que se le ofrece al cliente, y solo vale si el registro se lee de vez en cuando.

---

## Qué muestra

Filtrable por negocio y por rango de fechas. Cada fila tiene:

| Columna | Qué es |
|---|---|
| **Usuario CEOM** | Quién consultó |
| **Negocio** | De quién eran los datos |
| **Módulo consultado** | Qué tipo de información |
| **Fecha** | Cuándo |

---

## Qué queda registrado

La cobertura es buena. Se registra:

| Acción | Se registra como |
|---|---|
| Abrir la ficha de un negocio | `identidad` |
| Ver la pestaña **Financiero** | `financiero` |
| Ver la pestaña **Operativo** | `operativo` |
| Ver la pestaña **Inventario Operativo** | `operativo` |
| Ver la pantalla de salud agregada de la plataforma | `identidad` |

---

## Los dos puntos ciegos

Ninguno es de cobertura: los dos son de **granularidad**, y conviene conocerlos antes de usar esta
pantalla para responderle a un cliente.

**1. Producción e insumos no se distinguen.** Las pestañas Operativo e Inventario Operativo se
registran las dos como `operativo`. Leyendo el registro **no hay forma de saber cuál de las dos se
consultó**. Es deliberado —el catálogo interno de permisos no separa insumos de producción— pero
significa que una fila `operativo` es ambigua.

**2. La consulta de salud agregada se registra contra el negocio "CEOM Ops", no contra los negocios
que incluye.** Es coherente: es una consulta que abarca a toda la plataforma, no a un negocio puntual. Pero la
consecuencia importa: **filtrar el registro por un negocio nunca va a mostrar esas consultas**, aunque
los datos de ese negocio hayan estado en el agregado.

(ver H-13)

---

## ⚠️ La columna que hoy no sirve

**"Usuario CEOM" muestra los primeros 8 caracteres de un identificador interno**, en tipografía
monoespaciada, en vez del nombre de la persona.

En una pantalla de auditoría, cuya razón de ser es responder *quién* miró *qué*, la mitad de la
pregunta queda sin respuesta legible. Para saber quién es `a3f81c2b…` hay que consultar la base de
datos.

**Mientras tanto:** si necesitás responderle a un cliente quién consultó sus datos, vas a poder darle
la fecha y el tipo de información con esta pantalla, pero **no el nombre**. (ver H-07)

---

## Qué no está acá

**No registra lo que hace una institución.** Este registro es solo del equipo de CEOM. Lo que ve una
institución está controlado por el consentimiento del negocio, que es un mecanismo distinto: se
autoriza y se revoca, pero no deja una bitácora de consultas.

**No registra los cambios que hacés.** Cambiar el plan de un negocio o su estado de suscripción **no
genera una entrada acá**: esta pantalla traza *lecturas* de datos de negocio, no modificaciones
administrativas. No hay historial de cambios de plan ni de estado en ninguna parte del producto.

> 🚧 **No hay historial de cambios administrativos.** El negocio guarda quién lo modificó por última
> vez y cuándo, pero ese dato **se pisa en cada cambio** y no se muestra en ninguna pantalla. Si un
> cliente pregunta "¿cuándo me cambiaron de plan?" o "¿quién puso mi cuenta en vencida?", solo se
> puede responder por el último cambio, consultando la base a mano. (ver H-44)

---

## Cómo usarla

**Revisala periódicamente**, aunque nadie la pida. Una consulta a datos de un negocio fuera de un
contexto de soporte es exactamente lo que esta pantalla existe para detectar.

**Filtrá por negocio antes de responder un reclamo**, recordando que las consultas agregadas no van a
aparecer ahí.

**Si el registro está vacío**, no significa que nadie miró: significa que nadie abrió una ficha ni una
pestaña de consulta. El listado general de negocios y su búsqueda no generan entradas.
