import {
  BarChart3,
  Building2,
  Calculator,
  ChefHat,
  KeyRound,
  Mail,
  MessageCircle,
  Package,
  Receipt,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { Caveat } from "next/font/google";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { CONTACTO } from "@/lib/contacto";
import "./landing.css";
import { LibretaCierre } from "./libreta";
import { NavMovil } from "./nav-movil";
import { PanelAntesDespues } from "./panel-antes-despues";
import { PanelCambio } from "./panel-cambio";
import { Revelaciones } from "./revelaciones";
import { VentanaPlataforma } from "./ventana-plataforma";

// Landing publica de CEOM.
//
// **La capa visual de esta pagina no se construye con la libreria del ERP.**
// El sistema prioriza densidad y consistencia; una landing prioriza impacto y
// narrativa. Comparten la marca —logo, azules, Poppins— y nada mas: la escala
// tipografica, las sombras, los radios y las animaciones viven en landing.css,
// bajo `.ceom-landing`, y no se filtran a /app ni a /admin.
//
// El copy y el reparto de secciones vienen del PR #25 y estan verificados
// contra el codigo (docs/manual/hallazgos.md): **no se reescriben acá**. Lo que
// cambia en esta pasada es solo como se ve. Lo que la referencia proponia y no
// entra sigue afuera por la misma razon de siempre — la landing solo puede
// prometer lo que el sistema hace hoy:
//   - Tuki (asistente IA) y CEOM EDU: no existen (H-06; Modulo_11:180).
//   - Alertas, avisos y "EN VIVO": no hay una sola notificacion (H-10, H-28,
//     H-37, H-45).
//   - "Mas elegido": prueba social inventada, no hay negocios con estos planes.
//   - Precios: no hay cobro ni facturacion (H-45).
//   - "Abrir mi cuenta" / demo: no hay alta autoservicio (`crearTenant` esta
//     gateado a `ceom_admin`).
//
// Al caer Tuki y CEOM EDU la pagina quedo dos secciones mas corta que la
// referencia, asi que el ritmo se rebalanceo: la plataforma pasa a ser la
// seccion protagonista (ventana + las nueve tarjetas) y el contraste
// hoy/con-CEOM se cuenta en un panel en vez de en cuatro tarjetas quietas.
// Las secciones siguen alternando claro y oscuro:
//   hero claro → cambio oscuro → antes/después claro → plataforma oscura →
//   planes claro → cierre oscuro → pie.

// Unica fuente que se suma a las del sistema, y solo en esta pagina: la letra
// de la libreta. No hay forma de escribir "a mano" con Poppins, y la libreta
// manuscrita es la pieza central del hero. Es una sola familia, un solo peso,
// subset latino, y se carga aca (no en el layout raiz) para que ni /app ni
// /admin la descarguen.
const caveat = Caveat({
  variable: "--l-fuente-mano",
  subsets: ["latin"],
  weight: ["600"],
  display: "swap",
});

const ENLACES = [
  { href: "#plataforma", texto: "La plataforma" },
  { href: "#planes", texto: "Planes" },
  { href: "#contacto", texto: "Contacto" },
] as const;

// Los nueve modulos reales, con los nombres exactos del nav
// (app-shell.tsx:180-255) y del glosario. Cada descripcion dice solo lo que el
// modulo hace hoy — ver el detalle de que NO promete cada uno en
// docs/manual/hallazgos.md.
const MODULOS = [
  {
    icono: ShoppingCart,
    nombre: "Ventas",
    detalle:
      "Registrás cada venta con su cliente, su canal y su cobro. Si algo salió mal se corrige con un ajuste: una venta nunca se edita.",
  },
  {
    icono: Package,
    nombre: "Catálogo",
    detalle:
      "Tus productos con precio, costo y stock. En la ficha de cada uno ves su margen y el historial de por qué el stock es el que es.",
  },
  {
    icono: Receipt,
    nombre: "Gastos",
    detalle:
      "Cada gasto con su categoría y su tipo, con pagos parciales, y plantillas para lo que se repite todos los meses.",
  },
  {
    icono: Truck,
    nombre: "Proveedores",
    detalle:
      "A quién le comprás y cuánto te cobró cada uno a lo largo del tiempo. Al recibir una compra, entra al stock y actualiza el costo.",
  },
  {
    icono: Building2,
    nombre: "Bienes y deudas",
    detalle:
      "Lo que tu negocio tiene, con su valor ya depreciado, y lo que debe, con el saldo bajando a medida que pagás las cuotas.",
  },
  {
    icono: ChefHat,
    nombre: "Producción",
    // Producción es del rubro de alimentos y bebidas por lotes (nicho-1).
    // Un comercio minorista no produce, asi que la tarjeta lo condiciona en
    // vez de dar por hecho que todo negocio fabrica algo.
    detalle:
      "Si producís por lotes: insumos y recetas. Cada lote descuenta la materia prima, acredita el producto terminado y calcula el costo real por unidad.",
  },
  {
    icono: BarChart3,
    nombre: "Reportes",
    detalle:
      "Estado de resultados, flujo de caja, histórico de ventas y ranking de productos, filtrando por el período que quieras.",
  },
  {
    icono: Calculator,
    nombre: "Simulador",
    // El simulador va del margen al precio, no al reves: `simularPrecio` toma
    // `margenDeseadoPct` y devuelve `precioSugerido`
    // (= costo / (1 - margen/100), simulaciones/actions.ts:23-28). Decir
    // "probas un precio y te muestra el margen" es invertir la herramienta.
    detalle:
      "Decís qué margen querés ganar y te dice a qué precio vender ese producto, con su costo real. Nada de esto toca el precio que tenés cargado.",
  },
  {
    icono: KeyRound,
    nombre: "Compartir datos",
    detalle:
      "Le das a una institución acceso de solo lectura a la información que vos elijas, y se lo cortás cuando quieras.",
  },
] as const;

// Los tres planes.
//
// Un plan solo puede prometer lo que el sistema aplica. De los siete atributos
// de un plan **hay exactamente uno con efecto real**: que informacion se puede
// compartir con una institucion, validado del lado del servidor en
// consentimiento/actions.ts:406-415. Por eso los tres planes escalan por eso y
// solo por eso, y por eso no se muestran precios (no hay cobro ni facturacion,
// H-45).
//
// ⚠️ Ojo, esto corrige a docs/manual/equipo-ceom/02-planes.md, que dice que son
// dos los atributos con efecto. **Los dias de gracia tambien son letra
// muerta.** `calcularEstadoAcceso()` (identidad/actions.ts:53-72) recibe
// `duracionEtapaSoloLecturaDias` como tercer parametro, pero **ningun llamador
// de produccion se lo pasa** — los nueve call sites reales lo invocan con un
// solo argumento, asi que la gracia sale siempre de la constante
// DURACION_ETAPA_SOLO_LECTURA_DIAS = 3 (identidad/constants.ts:22), igual para
// todos los negocios.
const PLANES = [
  {
    nombre: "Básico",
    para: "Para ordenar tu negocio",
    destacado: false,
    incluye: [
      "La aplicación completa: los nueve módulos",
      "Sumás colaboradores y les das permisos por rol",
      "Tu información queda solo para vos",
    ],
  },
  {
    nombre: "Pro+",
    para: "Si rendís cuentas a una institución",
    destacado: true,
    incluye: [
      "Todo lo del Básico",
      "Compartís ventas y finanzas: cuánto vendiste, tu flujo de caja y tu resultado",
      "Con un código que das vos, de solo lectura, y que cortás cuando quieras",
    ],
  },
  {
    nombre: "Integral",
    para: "Para programas y aceleradoras",
    destacado: false,
    incluye: [
      "Todo lo del Pro+",
      "Compartís también qué produjiste y cuánto se te fue en merma",
      // "Insumos y stock" es el nombre interno del tipo, pero la institucion
      // **no recibe cantidades**: detalleInventarioOperativo solo devuelve
      // listarInsumos (catalogo + costo vigente), y consultarStockInsumo esta
      // explicitamente fuera de alcance (monitoreo-institucional/actions.ts).
      "Y tu lista de insumos con el costo al que los comprás",
    ],
  },
] as const;

/** Par de botones de contacto. Es la unica accion de la landing: no hay alta de
 *  cuenta autoservicio, el negocio lo da de alta el equipo desde /admin. */
function AccionesContacto({ tono = "claro" }: { tono?: "claro" | "oscuro" }) {
  return (
    <div className="l-acciones">
      <a
        className="l-boton l-boton--primario"
        href={CONTACTO.whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
      >
        <MessageCircle aria-hidden />
        Escribinos por WhatsApp
      </a>
      <a
        className={`l-boton ${tono === "oscuro" ? "l-boton--linea-clara" : "l-boton--linea"}`}
        href={CONTACTO.correoHref}
      >
        <Mail aria-hidden />
        Escribinos por correo
      </a>
    </div>
  );
}

/** Tilde de las listas de plan. */
function Tilde({ className }: { className: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function Landing() {
  return (
    <div className={`ceom-landing ${caveat.variable}`}>
      {/* Entrada por seccion y sombra del encabezado. No oculta nada del HTML
          que llega del servidor: ver revelaciones.tsx. */}
      <Revelaciones />

      <a href="#contenido" className="l-saltar">
        Saltar al contenido
      </a>

      {/* -----------------------------------------------------------------
          Encabezado — claro, pegado arriba, con la sombra que aparece al
          scrollear (la pone Revelaciones sobre [data-cabecera]).
          ----------------------------------------------------------------- */}
      <header className="l-header" data-cabecera>
        <div className="l-header__barra">
          <Link href="/" aria-label="CEOM, inicio" className="l-header__logo">
            <Logo />
          </Link>

          <NavMovil enlaces={ENLACES}>
            <Link className="l-boton l-boton--linea l-boton--chico" href="/login">
              Entrar
            </Link>
          </NavMovil>
        </div>
      </header>

      <main id="contenido">
        {/* ---------------------------------------------------------------
            1. Hero — CLARO. El H1 pregunta y la libreta contesta a mano.
            Se sacaron los dos botones de la referencia ("Ver planes desde
            Bs 150" y "Recorrer la plataforma"): no se muestran precios y no
            hay demo detras. La accion es contacto.
            --------------------------------------------------------------- */}
        <section className="l-seccion l-claro--suave l-hero">
          <div
            className="l-mancha l-mancha--pastel"
            aria-hidden
            style={{ top: "-18%", right: "-12%", width: "620px", height: "620px" }}
          />
          <div
            className="l-mancha l-mancha--azul"
            aria-hidden
            style={{ bottom: "-30%", left: "-14%", width: "460px", height: "460px", opacity: 0.35 }}
          />

          <div className="l-contenedor l-hero__grid">
            <div>
              <p className="l-rotulo" data-revelar>
                Gestión para emprendimientos
              </p>

              <h1 className="l-titulo l-titulo--h1" data-revelar style={{ "--l-retraso": "80ms" } as React.CSSProperties}>
                Vendiste todo el mes. ¿Sabés <em>cuánto te quedó</em>?
              </h1>

              <p className="l-bajada" data-revelar style={{ "--l-retraso": "150ms" } as React.CSSProperties}>
                CEOM ordena las ventas, los costos y —si producís— también la
                producción de tu negocio, y con eso te arma el resultado del mes:
                cuánto entró, cuánto costó y cuánto quedó. Sin planillas sueltas y sin
                ser contador.
              </p>

              <div className="l-hero__pie" data-revelar style={{ "--l-retraso": "220ms" } as React.CSSProperties}>
                <AccionesContacto />
                <p className="l-nota" style={{ marginTop: "22px" }}>
                  Funciona en el navegador · Sin instalar nada · Vos decidís con quién
                  compartís tus datos
                </p>
              </div>
            </div>

            <div data-revelar style={{ "--l-retraso": "200ms" } as React.CSSProperties}>
              <LibretaCierre />
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------
            2. El cambio real — OSCURO. Los cuatro contrastes, como panel.
            --------------------------------------------------------------- */}
        <section className="l-seccion l-oscuro">
          <div
            className="l-mancha l-mancha--azul"
            aria-hidden
            style={{ top: "-14%", left: "-8%", width: "540px", height: "540px" }}
          />
          <div
            className="l-mancha l-mancha--realce"
            aria-hidden
            style={{ bottom: "-18%", right: "-6%", width: "620px", height: "620px" }}
          />

          <div className="l-contenedor">
            <div className="l-encabezado-seccion" data-revelar>
              <p className="l-rotulo">El cambio real</p>
              <h2 className="l-titulo l-titulo--h2">
                El problema no es trabajar poco. <em>Es decidir a ciegas.</em>
              </h2>
              <p className="l-bajada">
                La mayoría de los emprendimientos generan todos los datos que necesitan
                para decidir bien. El problema es que quedan repartidos entre cuadernos,
                capturas de WhatsApp y una planilla que solo entiende una persona.
              </p>
            </div>

            <div data-revelar style={{ "--l-retraso": "120ms" } as React.CSSProperties}>
              <PanelCambio />
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------
            3. Antes y después — CLARO. Los numeros son los mismos de la
            libreta del hero, para que la landing no se contradiga sola.
            --------------------------------------------------------------- */}
        <section className="l-seccion l-claro">
          <div className="l-contenedor l-ad-grid">
            <div data-revelar>
              <p className="l-rotulo">Antes y después</p>
              <h2 className="l-titulo l-titulo--h2">
                El mismo mes, con y sin la cuenta hecha.
              </h2>
              <p className="l-bajada">
                Un negocio real vende parecido todos los meses. Lo que cambia es si al
                final sabe qué pasó.
              </p>

              {/* La cuenta vale lo que valga lo que se cargo. Decirlo aca es lo
                  que separa esta seccion de una promesa: un producto sin costo
                  se vende igual y no avisa nada (H-15), y eso mueve el
                  resultado para arriba sin ninguna señal. */}
              <p className="l-nota" style={{ marginTop: "28px", fontSize: "0.9rem" }}>
                La cuenta sale de lo que cargues. Si un producto no tiene su costo
                cargado, esa venta va a contar como si no te hubiera costado nada — por
                eso el costo de cada producto es lo primero que conviene completar.
              </p>
            </div>

            <div data-revelar style={{ "--l-retraso": "100ms" } as React.CSSProperties}>
              <PanelAntesDespues />
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------
            4. La plataforma — OSCURO. La seccion protagonista: la ventana
            hace tangible el producto y las nueve tarjetas dicen qué hace
            cada modulo.
            La referencia cerraba este bloque con "Las funciones disponibles
            varian segun el plan". Se saco: **ningun plan restringe modulos**.
            --------------------------------------------------------------- */}
        <section
          id="plataforma"
          className="l-seccion l-oscuro l-oscuro--der"
          style={{ scrollMarginTop: "68px" }}
        >
          <div
            className="l-mancha l-mancha--azul"
            aria-hidden
            style={{ top: "6%", right: "-10%", width: "620px", height: "620px" }}
          />
          <div
            className="l-mancha l-mancha--pastel"
            aria-hidden
            style={{ bottom: "-16%", left: "-10%", width: "560px", height: "560px" }}
          />

          <div className="l-contenedor">
            <div className="l-encabezado-seccion" data-revelar>
              <p className="l-rotulo">La plataforma</p>
              <h2 className="l-titulo l-titulo--h2">
                Nueve módulos que <em>trabajan conectados</em> entre sí.
              </h2>
              <p className="l-bajada">
                No son nueve sistemas separados: lo que cargás en uno cambia el resultado
                de los demás. Una compra de insumos toca el costo, el stock, la producción
                y el margen en el mismo movimiento.
              </p>
            </div>

            <div data-revelar style={{ "--l-retraso": "120ms" } as React.CSSProperties}>
              <VentanaPlataforma />
            </div>

            <ul className="l-modulos">
              {MODULOS.map(({ icono: Icono, nombre, detalle }, i) => (
                <li
                  key={nombre}
                  className="l-modulo"
                  data-revelar
                  style={{ "--l-retraso": `${(i % 3) * 70}ms` } as React.CSSProperties}
                >
                  <span className="l-modulo__icono" aria-hidden>
                    <Icono />
                  </span>
                  <h3 className="l-modulo__nombre">{nombre}</h3>
                  <p className="l-modulo__detalle">{detalle}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------------------------------------------------------------
            5. Planes — CLARO. Sin precios y con contacto como accion.
            --------------------------------------------------------------- */}
        <section id="planes" className="l-seccion l-claro" style={{ scrollMarginTop: "68px" }}>
          <div className="l-contenedor">
            <div className="l-encabezado-seccion" data-revelar>
              <p className="l-rotulo">Planes</p>
              <h2 className="l-titulo l-titulo--h2">
                Elegí según la etapa en la que está tu negocio hoy.
              </h2>
              <p className="l-bajada">
                Todos los planes te dan la aplicación completa, con todos sus módulos. Lo
                único que cambia es qué información podés compartir con una institución.
                Contanos en qué etapa está tu negocio y vemos cuál te sirve.
              </p>
            </div>

            <ul className="l-planes">
              {PLANES.map(({ nombre, para, destacado, incluye }, i) => (
                <li
                  key={nombre}
                  className={`l-plan${destacado ? " l-plan--destacado" : ""}`}
                  data-revelar
                  style={{ "--l-retraso": `${i * 90}ms` } as React.CSSProperties}
                >
                  <span className="l-plan__filo" aria-hidden />

                  {/* La referencia ponia "Mas elegido". Es prueba social
                      inventada: no hay ningun negocio con estos planes
                      todavia ni telemetria de adopcion. "Recomendado" es una
                      opinion de CEOM, que si se puede sostener. */}
                  {destacado && <span className="l-plan__insignia">Recomendado</span>}

                  <div className="l-plan__cuerpo">
                    <h3 className="l-plan__nombre">{nombre}</h3>
                    <p className="l-plan__para">{para}</p>

                    <ul className="l-plan__incluye">
                      {incluye.map((linea) => (
                        <li key={linea}>
                          <Tilde className="l-plan__tilde" />
                          {linea}
                        </li>
                      ))}
                    </ul>

                    <a
                      className={`l-boton l-boton--ancho l-plan__cta ${
                        destacado ? "l-boton--primario" : "l-boton--linea"
                      }`}
                      href={CONTACTO.whatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Escribinos por {nombre}
                    </a>
                  </div>
                </li>
              ))}
            </ul>

            <p className="l-nota" data-revelar style={{ marginTop: "30px", maxWidth: "60ch" }}>
              El alta de un negocio la hace el equipo de CEOM: nos escribís, lo damos de
              alta y te llega la invitación por correo.
            </p>
          </div>
        </section>

        {/* ---------------------------------------------------------------
            6. Cierre — OSCURO. Accion principal de toda la landing.
            --------------------------------------------------------------- */}
        <section
          id="contacto"
          className="l-seccion l-oscuro l-oscuro--centro l-cierre"
          style={{ scrollMarginTop: "68px" }}
        >
          <div
            className="l-mancha l-mancha--azul"
            aria-hidden
            style={{ bottom: "-34%", left: "50%", transform: "translateX(-50%)", width: "820px", height: "620px" }}
          />

          <div className="l-contenedor" data-revelar>
            <p className="l-rotulo">Empezá hoy</p>
            <h2 className="l-titulo l-titulo--h2">
              Entender tu negocio cambia la forma en que decidís.
            </h2>
            <p className="l-bajada">
              Escribinos y vemos juntos si CEOM le sirve a tu negocio. Si va, lo damos de
              alta nosotros y te llega la invitación por correo.
            </p>

            <AccionesContacto tono="oscuro" />

            <p className="l-nota" style={{ marginTop: "26px" }}>
              {CONTACTO.whatsappVisible} · {CONTACTO.correo}
            </p>
          </div>
        </section>
      </main>

      {/* -----------------------------------------------------------------
          Pie. Solo contacto y ubicacion: se cayeron las columnas "Producto"
          (apuntaban a Tuki y CEOM EDU), los tres iconos de redes sociales
          (sin cuenta detras, iban a "#") y el enlace "Terminos y privacidad"
          (no existe esa pagina).
          ----------------------------------------------------------------- */}
      <footer className="l-pie">
        <div className="l-contenedor">
          <div className="l-pie__grid">
            <div>
              <span className="l-pie__logo">
                <Logo />
              </span>
              <p style={{ margin: "20px 0 0", maxWidth: "34ch", fontSize: "0.94rem" }}>
                Convertimos la información de tu negocio en decisiones que generan
                crecimiento.
              </p>
            </div>

            <div>
              <h2 className="l-pie__titulo">Contacto</h2>
              <ul className="l-pie__lista">
                <li>
                  <a href={CONTACTO.whatsappHref} target="_blank" rel="noopener noreferrer">
                    WhatsApp {CONTACTO.whatsappVisible}
                  </a>
                </li>
                <li>
                  <a href={CONTACTO.correoHref}>{CONTACTO.correo}</a>
                </li>
                <li>{CONTACTO.ciudad}</li>
              </ul>
            </div>

            <div>
              <h2 className="l-pie__titulo">¿Ya tenés cuenta?</h2>
              <p style={{ margin: "0 0 16px", fontSize: "0.94rem" }}>
                Entrá con el correo con el que te invitamos.
              </p>
              <Link className="l-boton l-boton--linea-clara l-boton--chico" href="/login">
                Entrar
              </Link>
            </div>
          </div>

          <div className="l-pie__legal">
            <span>© 2026 CEOM</span>
            <span>Hecho para emprendedores que quieren entender sus números.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
