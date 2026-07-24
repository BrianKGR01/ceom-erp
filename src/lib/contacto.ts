// Datos de contacto publicos de CEOM.
//
// Viven en un solo lugar a proposito: son lo unico que la landing ofrece como
// accion, porque **CEOM-ERP no tiene alta de cuenta autoservicio**. El alta de
// un negocio la hace el equipo desde /admin (`crearTenant` esta gateado a
// `ceom_admin`) y la persona recibe la invitacion por correo. Cambiar un
// telefono o un correo tiene que ser editar esta constante, no salir a buscar
// cadenas por el JSX.

/** Numero de WhatsApp, solo digitos, como lo pide la URL de wa.me. */
const WHATSAPP_E164 = "59170059388";

export const CONTACTO = {
  /** Como se muestra en pantalla. */
  whatsappVisible: "+591 700 59388",
  /** Enlace directo al chat, con el primer mensaje ya escrito. */
  whatsappHref: `https://wa.me/${WHATSAPP_E164}?text=${encodeURIComponent(
    "Hola, quiero saber mas sobre CEOM para mi negocio."
  )}`,
  correo: "grupoceom.sc@gmail.com",
  correoHref: `mailto:grupoceom.sc@gmail.com?subject=${encodeURIComponent(
    "Quiero conocer CEOM"
  )}`,
  ciudad: "Santa Cruz de la Sierra, Bolivia",
} as const;
