import {
  ArrowRight,
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
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { CONTACTO } from "@/lib/contacto";

// Landing publica de CEOM.
//
// Se reimplemento a partir de docs/ui/landing-referencia.html, que es
// referencia de estructura y de copy, no codigo a copiar. Lo que se saco de
// esa referencia y por que esta anotado en cada seccion: la regla es que la
// landing solo puede prometer lo que el sistema hace hoy, verificado contra
// docs/manual/hallazgos.md.
//
// Composicion visual: secciones alternando claro y azul, con el mismo
// degradado navy + circulos difuminados del sidebar y del login
// (docs/design-system.md 5.8) — es el unico degradado permitido.
//
// Sin interactividad: es un Server Component entero, sin JS de cliente.

/** Circulos difuminados de las secciones azules — misma composicion que el
 *  panel del login (login/page.tsx:48-59) y el sidebar (app-shell.tsx:355). */
function BrilloAzul() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -right-24 size-96 rounded-full bg-pastel-blue/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/3 -left-24 size-80 rounded-full bg-primary/25 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 right-1/4 size-96 rounded-full bg-pastel-blue/10 blur-3xl"
      />
    </>
  );
}

// Los nueve modulos reales, con los nombres exactos del nav
// (app-shell.tsx:180-255) y del glosario. Cada descripcion dice solo lo que
// el modulo hace hoy — ver el detalle de que NO promete cada uno en
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
    detalle:
      "Insumos y recetas. Cada lote descuenta la materia prima, acredita el producto terminado y calcula el costo real por unidad.",
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
    detalle:
      "Probás un precio nuevo sin tocar nada real: qué margen te deja ese producto y cuántas unidades necesitás para cubrir tus gastos fijos.",
  },
  {
    icono: KeyRound,
    nombre: "Compartir datos",
    detalle:
      "Le das a una institución acceso de solo lectura a la información que vos elijas, y se lo cortás cuando quieras.",
  },
] as const;

// El contraste "de como trabajas hoy" -> "con CEOM".
//
// De los cuatro pares de la referencia se reescribio el tercero: decia
// "Te enteras tarde" -> "El sistema te avisa", y **no existe ningun aviso
// automatico** en el producto (H-10 gastos recurrentes, H-28 stock minimo,
// H-37 sobreventa, H-45 vencimiento). Lo que si es cierto es que el dato
// esta disponible cuando lo mires, no que algo te empuje una alerta.
const CONTRASTES = [
  {
    // La referencia decia "Ves el resultado completo". **Completo es justo lo
    // que no es**: la comision del canal (H-24), la cuota de una deuda
    // (H-27), el ajuste de una compra (H-31) y un producto sin costo (H-15)
    // no llegan al resultado, y los cuatro huecos van en la direccion
    // optimista. Se promete lo que si hace: juntar venta y costo.
    hoy: "Confundís venta con ganancia",
    con: "Ves la venta y su costo juntos",
    detalle:
      "Cada venta se guarda con el precio y el costo que tenía el producto en ese momento, y el margen sale de ahí.",
  },
  {
    hoy: "Ponés precio por intuición",
    con: "Probás el precio antes de aplicarlo",
    detalle:
      "Simulás el cambio y mirás cómo queda tu margen. La simulación no toca el precio real del producto.",
  },
  {
    hoy: "Cerrás el mes sin saber cómo venías",
    con: "Mirás cómo venís cuando quieras",
    detalle:
      "El resultado del período está armado en todo momento; no hay que esperar a fin de mes para verlo.",
  },
  {
    hoy: "Aprendés a los golpes",
    con: "Aprendés con tus números",
    detalle:
      "Margen, punto de equilibrio y flujo de caja dejan de ser palabras: son tus datos, en tu pantalla.",
  },
] as const;

// Los tres planes.
//
// Un plan solo puede prometer lo que el sistema aplica. De los siete
// atributos de un plan **hay exactamente uno con efecto real**: que
// informacion se puede compartir con una institucion, validado del lado del
// servidor en consentimiento/actions.ts:406-415. Por eso los tres planes
// escalan por eso y solo por eso.
//
// ⚠️ Ojo, esto corrige a docs/manual/equipo-ceom/02-planes.md, que dice que
// son dos los atributos con efecto. **Los dias de gracia tambien son letra
// muerta.** `calcularEstadoAcceso()` (identidad/actions.ts:53-72) recibe
// `duracionEtapaSoloLecturaDias` como tercer parametro, pero **ningun
// llamador de produccion se lo pasa** — los nueve call sites reales lo
// invocan con un solo argumento, asi que la gracia sale siempre de la
// constante DURACION_ETAPA_SOLO_LECTURA_DIAS = 3 (identidad/constants.ts:22),
// igual para todos los negocios. `planes.duracionEtapaSoloLecturaDias` se
// escribe y se edita en /admin/planes, y no lo lee nadie. Solo el archivo de
// tests pasa el tercer argumento, que es lo que hace que el atributo
// "parezca" andar si se mira la funcion aislada.
//
// Los otros cinco quedaron afuera por lo mismo: sucursales (H-02, no existe
// forma de crear una segunda), mas de un dueño (H-17), bajar de plan por
// autogestion (no hay pantalla), precio mensual (no hay cobro ni
// facturacion, H-45) y duracion de la invitacion (DURACION_INVITACION_DIAS
// tiene cero usos: las invitaciones no caducan).
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

/** Par de botones de contacto. Es la unica accion de la landing: no hay alta
 *  de cuenta autoservicio, el negocio lo da de alta el equipo desde /admin.
 *
 *  Desviacion declarada: el `size="lg"` del sistema es h-9 (36px), pensado
 *  para pantallas de gestion densas. Aca se sube a h-11 (44px) por className
 *  — es el area tactil minima comoda en celular y son los dos unicos botones
 *  que la landing realmente quiere que se toquen. No se cambia el componente. */
function AccionesContacto({ tono }: { tono: "claro" | "oscuro" }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <Button
        size="lg"
        className="h-11 px-5 text-sm"
        render={<a href={CONTACTO.whatsappHref} target="_blank" rel="noopener noreferrer" />}
        nativeButton={false}
      >
        <MessageCircle aria-hidden />
        Escribinos por WhatsApp
      </Button>
      <Button
        size="lg"
        variant="outline"
        className={
          tono === "oscuro"
            ? "h-11 border-white/30 bg-transparent px-5 text-sm text-white hover:bg-white/10 hover:text-white"
            : "h-11 px-5 text-sm"
        }
        render={<a href={CONTACTO.correoHref} />}
        nativeButton={false}
      >
        <Mail aria-hidden />
        Escribinos por correo
      </Button>
    </div>
  );
}

export function Landing() {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      {/* Enlace de salto.
          El relleno va en el <span>, no en el <a>, a proposito: `not-sr-only`
          fuerza `padding: 0`, asi que un px-4/py-2 puesto sobre el ancla se
          pierde y el enlace aparece sin area de clic. Sobre el hijo no lo
          toca. Tampoco sirve mover el ancla con `-translate-y-*` +
          `focus:translate-y-0`: las dos escriben la misma custom property y
          gana la primera. Las dos variantes se comprobaron en el DOM real. */}
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
      >
        <span className="block rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">
          Saltar al contenido
        </span>
      </a>

      {/* ---------------------------------------------------------------
          Encabezado — claro. Anclas ocultas en celular: la accion util en
          pantalla chica es entrar o escribir, no navegar la propia landing.
          --------------------------------------------------------------- */}
      <header className="sticky top-0 z-40 border-b border-gray-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3">
          <Link href="/" aria-label="CEOM, inicio" className="shrink-0 rounded-lg">
            <Logo className="h-8 w-auto" />
          </Link>

          <nav aria-label="Secciones" className="ml-auto hidden items-center gap-1 md:flex">
            {[
              { href: "#modulos", label: "La plataforma" },
              { href: "#planes", label: "Planes" },
              { href: "#contacto", label: "Contacto" },
            ].map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="rounded-lg px-3 py-2 text-sm text-text-body transition-colors hover:bg-muted hover:text-navy focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {label}
              </a>
            ))}
          </nav>

          <Button
            variant="outline"
            className="ml-auto h-9 px-4 md:ml-0"
            render={<Link href="/login" />}
            nativeButton={false}
          >
            Entrar
          </Button>
        </div>
      </header>

      <main id="contenido" className="flex-1">
        {/* -------------------------------------------------------------
            1. Hero — AZUL.
            El H1 y la bajada vienen de la referencia. Se sacaron sus dos
            botones: "Ver planes desde Bs 150" (no se muestran precios: el
            sistema no cobra ni factura, H-45) y "Recorrer la plataforma"
            (no hay demo detras). La accion es contacto, porque el alta la
            hace el equipo CEOM desde /admin.
            ------------------------------------------------------------- */}
        <section className="relative overflow-hidden bg-gradient-to-b from-sidebar-from to-sidebar-to text-white">
          <BrilloAzul />

          <div className="relative z-10 mx-auto grid max-w-6xl gap-12 px-5 py-16 md:py-24 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
            <div>
              <p className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/80">
                Gestión para emprendimientos
              </p>

              <h1 className="mt-5 font-heading text-3xl leading-tight font-semibold sm:text-4xl xl:text-5xl">
                Vendiste todo el mes.
                <br />
                ¿Sabés{" "}
                <span className="bg-gradient-to-r from-pastel-blue to-white bg-clip-text text-transparent">
                  cuánto te quedó
                </span>
                ?
              </h1>

              <p className="mt-5 max-w-xl text-base text-white/80">
                CEOM ordena las ventas, los costos y la producción de tu negocio, y con
                eso te arma el resultado del mes: cuánto entró, cuánto costó y cuánto
                quedó. Sin planillas sueltas y sin ser contador.
              </p>

              <div className="mt-8">
                <AccionesContacto tono="oscuro" />
              </div>

              <p className="mt-6 text-xs text-white/70">
                Funciona en el navegador · Sin instalar nada · Vos decidís con quién
                compartís tus datos
              </p>
            </div>

            {/* Card de cierre de mes. Marcada como ejemplo para que no se
                lea como dato real. Los numeros cierran entre si con la
                formula que usa el sistema (financiero/actions.ts:37-44):
                ingresos - costos - gastos. 24.500 - 12.300 - 6.000 = 6.200,
                y 6.200 / 24.500 = 25%. */}
            <div className="rounded-2xl bg-card p-6 shadow-card">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <p className="text-xs text-text-muted">Cierre de mes · Mayo</p>
                  <p className="font-heading text-base font-semibold text-navy">
                    Panadería La Esquina
                  </p>
                </div>
                <span className="rounded-full bg-warning-bg px-2 py-0.5 text-xs font-medium text-warning-text">
                  Ejemplo
                </span>
              </div>

              <dl className="mt-5 space-y-3 border-t border-gray-border pt-5">
                {[
                  ["Ventas del mes", "Bs 24.500"],
                  ["Costo de lo vendido", "− Bs 12.300"],
                  ["Gastos", "− Bs 6.000"],
                ].map(([etiqueta, valor]) => (
                  <div key={etiqueta} className="flex items-center justify-between gap-4">
                    <dt className="text-sm text-text-body">{etiqueta}</dt>
                    <dd className="text-sm font-medium text-text-body">{valor}</dd>
                  </div>
                ))}

                <div className="flex items-center justify-between gap-4 border-t border-gray-border pt-4">
                  <dt className="text-sm font-medium text-navy">Resultado del mes</dt>
                  <dd className="font-heading text-2xl font-semibold text-navy">
                    Bs 6.200
                  </dd>
                </div>
              </dl>

              <div className="mt-5 rounded-xl bg-pastel-blue-bg p-4">
                <div className="flex items-center justify-between gap-3">
                  {/* "Margen real" era el rotulo de la referencia. Se evita
                      "real": el margen no descuenta comisiones (H-24) ni
                      cuotas de deuda (H-27). Es el margen del periodo. */}
                  <p className="text-xs text-info-text">Margen del período</p>
                  <p className="text-xs font-medium text-info-text">25%</p>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                  <div className="h-full w-1/4 rounded-full bg-primary" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------------
            2. El problema — CLARO.
            ------------------------------------------------------------- */}
        <section className="bg-background">
          <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
            <p className="text-xs tracking-wide text-primary uppercase">El cambio real</p>
            <h2 className="mt-3 max-w-2xl font-heading text-2xl leading-snug font-semibold text-navy sm:text-3xl">
              El problema no es trabajar poco. Es decidir a ciegas.
            </h2>
            <p className="mt-4 max-w-2xl text-base text-text-body">
              La mayoría de los emprendimientos generan todos los datos que necesitan
              para decidir bien. El problema es que quedan repartidos entre cuadernos,
              capturas de WhatsApp y una planilla que solo entiende una persona.
            </p>

            <ul className="mt-10 grid gap-4 sm:grid-cols-2">
              {CONTRASTES.map(({ hoy, con, detalle }) => (
                <li
                  key={hoy}
                  className="rounded-2xl bg-card p-6 shadow-card ring-1 ring-gray-border/60"
                >
                  <p className="text-sm text-text-muted line-through decoration-error-text/60">
                    {hoy}
                  </p>
                  <p className="mt-2 flex items-start gap-2 font-heading text-base font-semibold text-navy">
                    <ArrowRight aria-hidden className="mt-1 size-4 shrink-0 text-primary" />
                    {con}
                  </p>
                  <p className="mt-2 text-sm text-text-body">{detalle}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* -------------------------------------------------------------
            3. Antes y despues — AZUL. Los numeros son los mismos de la
            card del hero, para que la landing no se contradiga sola.
            ------------------------------------------------------------- */}
        <section className="relative overflow-hidden bg-gradient-to-b from-sidebar-from to-sidebar-to text-white">
          <BrilloAzul />

          <div className="relative z-10 mx-auto max-w-6xl px-5 py-16 md:py-24">
            {/* Sobre navy el rotulo va en blanco atenuado, no en azul pastel:
                el pastel es color de fondo de apoyo y nunca de texto
                (docs/design-system.md seccion 2, reglas de aplicacion). */}
            <p className="text-xs tracking-wide text-white/70 uppercase">
              Antes y después
            </p>
            <h2 className="mt-3 max-w-2xl font-heading text-2xl leading-snug font-semibold sm:text-3xl">
              El mismo mes, con y sin la cuenta hecha.
            </h2>
            <p className="mt-4 max-w-2xl text-base text-white/80">
              Un negocio real vende parecido todos los meses. Lo que cambia es si al
              final sabe qué pasó.
            </p>

            <div className="mt-10 grid gap-5 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/15 bg-white/5 p-6">
                <p className="text-xs tracking-wide text-white/60 uppercase">
                  Antes · el cuaderno
                </p>
                <p className="mt-4 font-heading text-2xl font-semibold">Bs 24.500</p>
                <p className="text-sm text-white/70">vendidos este mes</p>

                <ul className="mt-6 space-y-3 border-t border-white/10 pt-5 text-sm text-white/80">
                  {[
                    "¿Cuánto ganaste? No sabés.",
                    "El precio lo pusiste a ojo.",
                    "Los gastos fijos están en tu cabeza.",
                    "El costo de cada producto, tampoco.",
                  ].map((linea) => (
                    <li key={linea} className="flex items-start gap-2">
                      <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-error-text" />
                      {linea}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl bg-card p-6 text-text-body shadow-card">
                <p className="text-xs tracking-wide text-primary uppercase">
                  Después · con CEOM
                </p>

                <dl className="mt-4 space-y-3">
                  {[
                    ["Ventas del mes", "Bs 24.500"],
                    ["Costo de lo vendido", "− Bs 12.300"],
                    ["Gastos", "− Bs 6.000"],
                  ].map(([etiqueta, valor]) => (
                    <div key={etiqueta} className="flex items-center justify-between gap-4">
                      <dt className="text-sm">{etiqueta}</dt>
                      <dd className="text-sm font-medium">{valor}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-gray-border pt-4">
                  <p className="text-sm font-medium text-navy">Resultado del mes</p>
                  <p className="font-heading text-2xl font-semibold text-navy">Bs 6.200</p>
                </div>

                <ul className="mt-5 space-y-2 border-t border-gray-border pt-4 text-sm">
                  {[
                    "Margen del período: 25%.",
                    "Cada producto con su costo y su margen.",
                    "Y el mes que viene, la misma cuenta sola.",
                  ].map((linea) => (
                    <li key={linea} className="flex items-start gap-2">
                      <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-success-text" />
                      {linea}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* La cuenta vale lo que valga lo que se cargo. Decirlo aca es
                lo que separa esta seccion de una promesa: un producto sin
                costo se vende igual y no avisa nada (H-15), y eso mueve el
                resultado para arriba sin ninguna señal. */}
            <p className="mt-6 max-w-2xl text-sm text-white/70">
              La cuenta sale de lo que cargues. Si un producto no tiene su costo
              cargado, esa venta va a contar como si no te hubiera costado nada — por
              eso el costo de cada producto es lo primero que conviene completar.
            </p>
          </div>
        </section>

        {/* -------------------------------------------------------------
            4. Los modulos — CLARO.
            La referencia cerraba este bloque con "Las funciones disponibles
            varian segun el plan". Se saco: **ningun plan restringe modulos**
            — los dos atributos con efecto real son que se puede compartir y
            los dias de gracia (02-planes.md).
            ------------------------------------------------------------- */}
        <section id="modulos" className="scroll-mt-16 bg-gray-bg">
          <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
            <p className="text-xs tracking-wide text-primary uppercase">La plataforma</p>
            <h2 className="mt-3 max-w-2xl font-heading text-2xl leading-snug font-semibold text-navy sm:text-3xl">
              Nueve módulos que trabajan conectados entre sí.
            </h2>
            <p className="mt-4 max-w-2xl text-base text-text-body">
              No son nueve sistemas separados: lo que cargás en uno cambia el resultado
              de los demás. Una compra de insumos toca el costo, el stock, la producción
              y el margen en el mismo movimiento.
            </p>

            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {MODULOS.map(({ icono: Icono, nombre, detalle }) => (
                <li key={nombre} className="rounded-2xl bg-card p-6 shadow-card">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-pastel-blue-bg">
                    <Icono aria-hidden className="size-5 text-primary" />
                  </span>
                  <h3 className="mt-4 font-heading text-base font-semibold text-navy">
                    {nombre}
                  </h3>
                  <p className="mt-2 text-sm text-text-body">{detalle}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* -------------------------------------------------------------
            5. Planes — AZUL. Ver el comentario de PLANES arriba: escalan
            solo por los dos atributos que el sistema aplica de verdad.
            ------------------------------------------------------------- */}
        <section
          id="planes"
          className="relative scroll-mt-16 overflow-hidden bg-gradient-to-b from-sidebar-from to-sidebar-to text-white"
        >
          <BrilloAzul />

          <div className="relative z-10 mx-auto max-w-6xl px-5 py-16 md:py-24">
            <p className="text-xs tracking-wide text-white/70 uppercase">Planes</p>
            <h2 className="mt-3 max-w-2xl font-heading text-2xl leading-snug font-semibold sm:text-3xl">
              Elegí según la etapa en la que está tu negocio hoy.
            </h2>
            <p className="mt-4 max-w-2xl text-base text-white/80">
              Todos los planes te dan la aplicación completa, con todos sus módulos. Lo
              único que cambia es qué información podés compartir con una institución.
              Contanos en qué etapa está tu negocio y vemos cuál te sirve.
            </p>

            <ul className="mt-10 grid gap-5 lg:grid-cols-3">
              {PLANES.map(({ nombre, para, destacado, incluye }) => (
                <li
                  key={nombre}
                  className={
                    destacado
                      ? "relative rounded-2xl bg-card p-6 text-text-body shadow-card ring-2 ring-primary"
                      : "rounded-2xl border border-white/15 bg-white/5 p-6"
                  }
                >
                  {/* La referencia ponia "Mas elegido". Es prueba social
                      inventada: no hay ningun negocio con estos planes
                      todavia (el unico plan sembrado es un placeholder de la
                      migracion 0007) ni telemetria de adopcion. "Recomendado"
                      es una opinion de CEOM, que si se puede sostener. */}
                  {destacado && (
                    <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                      Recomendado
                    </span>
                  )}

                  <h3
                    className={
                      destacado
                        ? "font-heading text-xl font-semibold text-navy"
                        : "font-heading text-xl font-semibold"
                    }
                  >
                    {nombre}
                  </h3>
                  <p className={destacado ? "text-sm text-text-muted" : "text-sm text-white/70"}>
                    {para}
                  </p>

                  <ul
                    className={
                      destacado
                        ? "mt-5 space-y-3 border-t border-gray-border pt-5 text-sm"
                        : "mt-5 space-y-3 border-t border-white/10 pt-5 text-sm text-white/80"
                    }
                  >
                    {incluye.map((linea) => (
                      <li key={linea} className="flex items-start gap-2">
                        <span
                          aria-hidden
                          className={
                            destacado
                              ? "mt-2 size-1.5 shrink-0 rounded-full bg-primary"
                              : "mt-2 size-1.5 shrink-0 rounded-full bg-pastel-blue"
                          }
                        />
                        {linea}
                      </li>
                    ))}
                  </ul>

                  <Button
                    className={
                      destacado
                        ? "mt-6 h-10 w-full"
                        : "mt-6 h-10 w-full border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
                    }
                    variant={destacado ? "default" : "outline"}
                    render={
                      <a href={CONTACTO.whatsappHref} target="_blank" rel="noopener noreferrer" />
                    }
                    nativeButton={false}
                  >
                    Escribinos por {nombre}
                  </Button>
                </li>
              ))}
            </ul>

            <p className="mt-8 max-w-2xl text-xs text-white/70">
              El alta de un negocio la hace el equipo de CEOM: nos escribís, lo damos de
              alta y te llega la invitación por correo.
            </p>
          </div>
        </section>

        {/* -------------------------------------------------------------
            6. Contacto — CLARO. Accion principal de toda la landing.
            ------------------------------------------------------------- */}
        <section id="contacto" className="scroll-mt-16 bg-background">
          <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
            <div className="rounded-2xl bg-gray-bg p-8 md:p-12">
              <h2 className="max-w-2xl font-heading text-2xl leading-snug font-semibold text-navy sm:text-3xl">
                Entender tu negocio cambia la forma en que decidís.
              </h2>
              <p className="mt-4 max-w-2xl text-base text-text-body">
                Escribinos y vemos juntos si CEOM le sirve a tu negocio. Si va, lo damos
                de alta nosotros y te llega la invitación por correo.
              </p>

              <div className="mt-8">
                <AccionesContacto tono="claro" />
              </div>

              <p className="mt-6 text-sm text-text-body">
                {CONTACTO.whatsappVisible} · {CONTACTO.correo}
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* ---------------------------------------------------------------
          Footer — AZUL. Rehecho: solo contacto y ubicacion. Se cayeron las
          columnas "Producto" (apuntaban a Tuki y CEOM EDU), los tres iconos
          de redes sociales (sin cuenta detras, iban a "#") y el enlace
          "Terminos y privacidad" (no existe esa pagina).
          --------------------------------------------------------------- */}
      <footer className="relative overflow-hidden bg-gradient-to-b from-sidebar-from to-sidebar-to text-white">
        <div className="relative z-10 mx-auto max-w-6xl px-5 py-12">
          <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
            <div className="max-w-sm">
              <Logo className="h-9 w-auto brightness-0 invert" />
              <p className="mt-4 text-sm text-white/70">
                Convertimos la información de tu negocio en decisiones que generan
                crecimiento.
              </p>
            </div>

            <div>
              <h2 className="font-heading text-sm font-semibold">Contacto</h2>
              <ul className="mt-3 space-y-2 text-sm text-white/70">
                <li>
                  <a
                    href={CONTACTO.whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block rounded py-1 transition-colors hover:text-white focus-visible:ring-3 focus-visible:ring-white/50 focus-visible:outline-none"
                  >
                    WhatsApp {CONTACTO.whatsappVisible}
                  </a>
                </li>
                <li>
                  <a
                    href={CONTACTO.correoHref}
                    className="inline-block rounded py-1 transition-colors hover:text-white focus-visible:ring-3 focus-visible:ring-white/50 focus-visible:outline-none"
                  >
                    {CONTACTO.correo}
                  </a>
                </li>
                <li>{CONTACTO.ciudad}</li>
              </ul>
            </div>

            <div>
              <h2 className="font-heading text-sm font-semibold">¿Ya tenés cuenta?</h2>
              <p className="mt-3 text-sm text-white/70">
                Entrá con el correo con el que te invitamos.
              </p>
              <Button
                variant="outline"
                className="mt-4 h-9 border-white/30 bg-transparent px-4 text-white hover:bg-white/10 hover:text-white"
                render={<Link href="/login" />}
                nativeButton={false}
              >
                Entrar
              </Button>
            </div>
          </div>

          <p className="mt-10 border-t border-white/10 pt-6 text-xs text-white/60">
            © 2026 CEOM · Hecho para emprendedores que quieren entender sus números.
          </p>
        </div>
      </footer>
    </div>
  );
}
