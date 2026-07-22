# 10. Compartir datos con una institución

Si tu negocio participa de un programa de una universidad, una incubadora o una organización de
apoyo, esa institución probablemente necesite ver cómo te va. Esta sección existe para que puedas
mostrárselo **sin darle tu contraseña ni armar un informe a mano**, y sobre todo para que puedas
cortar el acceso cuando quieras.

**Nada de esto pasa sin que vos lo autorices.** Ninguna institución ve un solo dato tuyo hasta que
apruebes explícitamente qué puede ver.

---

## Qué se comparte, exactamente

No compartís "tu cuenta". Compartís **hasta tres tipos de información**, cada uno por separado:

| Tipo | Qué ve la institución |
|---|---|
| **Ventas y finanzas** | Tu tendencia de ventas, tu flujo de caja, tu estado de resultados y tus costos fijos. |
| **Producción** | Qué lotes produjiste y cuánta merma tuviste. |
| **Insumos y stock** | Tu catálogo de insumos con su costo vigente. |

**Elegís cuáles das y cuáles no.** Podés dar solo ventas y finanzas y nunca producción.

### Qué NO ve nunca

Aunque le des los tres:

- **No ve tus clientes.** Ni nombres, ni teléfonos, ni a quién le vendiste.
- **No ve tus ventas una por una.** Ve totales y tendencias, no el detalle transaccional.
- **No ve tu equipo** ni quién cargó qué.
- **No puede modificar nada.** El acceso es de lectura, sin excepción.

**Lo que ve es siempre agregado.** Está pensado para que alguien evalúe cómo va tu negocio, no para
que reconstruya tu operación.

---

## Los dos caminos

Hay dos formas de que una institución termine viendo tus datos. La diferencia está en quién empieza.

### Camino 1 — vos invitás, con un código

Sirve cuando la institución todavía no está en CEOM, o cuando querés tener vos la iniciativa.

1. **Compartir Datos** (`/app/consentimiento`) → marcás los tipos de información que querés dar.
2. El sistema genera un **código de acceso**. Lo copiás.
3. Se lo pasás a la institución por el medio que quieras.
4. La institución lo canjea y ya tiene acceso a exactamente lo que marcaste.

**El código sirve una sola vez** y no hay forma de consultar qué tiene adentro sin canjearlo — así
que anotá qué marcaste al generarlo.

**En el checklist vas a ver que algunos tipos aparecen deshabilitados.** Eso depende de tu plan: no
todos los planes permiten compartir los tres ([capítulo 11](11-tu-plan.md)). El bloqueo es real, no
solo visual: aunque se forzara, el sistema lo rechaza.

### Camino 2 — la institución pide, vos aprobás

Sirve cuando la institución ya trabaja con CEOM.

1. La institución le pide a CEOM que registre una **solicitud de seguimiento** hacia tu negocio,
   indicando qué tipos de información necesita.
2. A vos te aparece en **Compartir Datos › Solicitudes de acceso**
   (`/app/consentimiento/solicitudes`).
3. Aprobás o rechazás.

**Al aprobar podés dar menos de lo que te piden, nunca más.** La ventana muestra lo solicitado y
podés destildar lo que no quieras dar. No hay forma de agregar algo que no te pidieron.

**Nadie te apura y nadie decide por vos.** Una solicitud sin responder no otorga nada. Si no la
contestás, la institución no ve nada.

---

## Ver y cortar lo que diste

**Compartir Datos › Permisos vigentes** (`/app/consentimiento/aprobaciones`) es la pantalla a la que
volver: qué institución tiene acceso, a qué tipos de información, desde cuándo.

**Compartir Datos › Códigos** (`/app/consentimiento/codigos`) lista los códigos que generaste y su
estado: activo, canjeado o revocado.

### Revocar

Desde cualquiera de las dos pantallas, con confirmación.

**La revocación es inmediata y real.** No es que la institución "deja de ver la pantalla": el sistema
le corta el acceso a los datos en el momento. Si estaba mirando tu ficha, al recargar le aparece un
candado y un mensaje de que ya no tiene autorización.

**Revocar un código ya canjeado también corta el acceso** que ese código había otorgado. No hace
falta buscar la aprobación por separado.

**No tenés que dar explicaciones ni avisar.** Es tu decisión y no requiere aprobación de nadie.

---

## Lo que conviene saber antes de compartir

**Es una decisión que solo podés tomar vos.** Ningún colaborador, sin importar su rol, puede generar
un código, aprobar una solicitud ni revocar. Es la única función del sistema que no se puede delegar
de ninguna forma — y está bien que sea así.

**Compartí lo mínimo que resuelva.** Si la institución necesita saber cómo van tus ventas, dale
ventas y finanzas; no le agregues producción "por las dudas". Siempre podés ampliar después.

**Revisá la lista cada tanto.** Los programas terminan y los acuerdos vencen; el acceso no se corta
solo. Un repaso cada seis meses alcanza.

**Cuidá el código mientras esté sin canjear.** Es de un solo uso, pero quien lo tenga lo puede
canjear. Si se te traspapeló, revocalo y generá otro.

**Lo que vea depende de lo que cargues.** Si compartís ventas y finanzas pero no cargaste tus gastos,
la institución va a ver un resultado inflado igual que vos ([capítulo 8](08-entender-el-negocio.md)).
Compartir datos incompletos puede ser peor que no compartir.

---

## Cómo se ve del otro lado

Para que sepas qué está viendo: la institución entra a un portal aparte, con su propio acceso —nunca
al tuyo—, y ve una lista de los negocios que le dieron permiso. Al abrir el tuyo encuentra cuatro
pestañas, y **las que no autorizaste aparecen con un candado**, no vacías ni ocultas.

Esa diferencia importa: la institución sabe que existe información que no le diste, en vez de creer
que no tenés datos. La decisión es visible para ambos lados.

---

## El equipo de CEOM es un caso aparte

El equipo que opera la plataforma **puede ver los mismos tres tipos de información sin pedirte
permiso**. No pasa por este circuito: su acceso está cubierto por los términos del servicio que
aceptaste al contratar.

La contrapartida es que **cada una de esas consultas queda registrada**: qué persona del equipo miró
qué información de tu negocio y cuándo.

La diferencia es deliberada: una institución externa necesita tu permiso explícito y revocable; CEOM
necesita dejar rastro. Si querés saber qué consultó el equipo sobre tu negocio, pedíselo — el
registro existe.
