"use client";

import {
  BarChart3,
  Building2,
  Calculator,
  ChefHat,
  KeyRound,
  Package,
  Receipt,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Barras, Filas, Mosaicos, type Barra, type FilaDato, type Mosaico } from "./piezas";

const CICLO_MS = 4200;

/**
 * La ventana de la aplicacion: el mockup que hace tangible el producto.
 *
 * Los nombres son los exactos del nav de /app (app-shell.tsx:180-255) y el
 * orden es el mismo. `conecta` existe para sostener la frase de la seccion —
 * "lo que cargás en uno cambia el resultado de los demás"—: al elegir un modulo
 * se marcan los que se mueven con el.
 *
 * Las cifras son ilustracion y salen todas del mismo cierre de mayo de la
 * libreta, para que la pagina no se contradiga sola. Lo que **no** hay acá es
 * ninguna alerta, aviso ni indicador "en vivo": el producto no tiene una sola
 * notificacion (H-10, H-28, H-37, H-45) y el mockup no puede inventarla.
 */
type Modulo = {
  id: string;
  nombre: string;
  icono: typeof ShoppingCart;
  conecta: readonly string[];
  mosaicos: readonly Mosaico[];
  viz: { tipo: "barras"; datos: readonly Barra[] } | { tipo: "filas"; datos: readonly FilaDato[] };
};

const MODULOS: readonly Modulo[] = [
  {
    id: "ventas",
    nombre: "Ventas",
    icono: ShoppingCart,
    conecta: ["catalogo", "reportes", "compartir"],
    mosaicos: [
      { etiqueta: "Ventas del mes", valor: "Bs 24.500" },
      { etiqueta: "Margen del período", valor: "25%", tono: "azul" },
    ],
    viz: {
      tipo: "barras",
      datos: [
        { etiqueta: "Sem 1", pct: 52, valor: "5.400" },
        { etiqueta: "Sem 2", pct: 70, valor: "7.100" },
        { etiqueta: "Sem 3", pct: 46, valor: "4.800" },
        { etiqueta: "Sem 4", pct: 88, valor: "7.200", color: "#227a44" },
      ],
    },
  },
  {
    id: "catalogo",
    nombre: "Catálogo",
    icono: Package,
    conecta: ["ventas", "produccion", "proveedores"],
    mosaicos: [
      { etiqueta: "Productos", valor: "48" },
      { etiqueta: "Con costo cargado", valor: "46", tono: "azul" },
    ],
    viz: {
      tipo: "filas",
      datos: [
        { etiqueta: "Empanada de pollo", valor: "Bs 12,00" },
        { etiqueta: "Cuñapé", valor: "Bs 8,00" },
        { etiqueta: "Pan especial", valor: "Bs 6,00" },
      ],
    },
  },
  {
    id: "gastos",
    nombre: "Gastos",
    icono: Receipt,
    conecta: ["reportes", "proveedores"],
    mosaicos: [
      { etiqueta: "Gastos del mes", valor: "Bs 6.000" },
      { etiqueta: "Plantillas activas", valor: "4", tono: "azul" },
    ],
    viz: {
      tipo: "barras",
      datos: [
        { etiqueta: "Alquiler", pct: 74 },
        { etiqueta: "Sueldos", pct: 58 },
        { etiqueta: "Servicios", pct: 32 },
        { etiqueta: "Otros", pct: 18 },
      ],
    },
  },
  {
    id: "proveedores",
    nombre: "Proveedores",
    icono: Truck,
    conecta: ["catalogo", "produccion", "gastos"],
    mosaicos: [
      { etiqueta: "Proveedores", valor: "12" },
      { etiqueta: "Última compra", valor: "Bs 1.840", tono: "azul" },
    ],
    viz: {
      tipo: "filas",
      datos: [
        { etiqueta: "Molino Santa Cruz", valor: "Bs 4,10", tono: "ok" },
        { etiqueta: "Distribuidora Sur", valor: "Bs 4,50" },
        { etiqueta: "Mayorista Norte", valor: "Bs 4,90" },
      ],
    },
  },
  {
    id: "patrimonio",
    nombre: "Bienes y deudas",
    icono: Building2,
    conecta: ["reportes"],
    mosaicos: [
      { etiqueta: "Bienes", valor: "Bs 62.000" },
      { etiqueta: "Deudas", valor: "Bs 18.000", tono: "azul" },
    ],
    viz: {
      tipo: "barras",
      datos: [
        { etiqueta: "Bienes", pct: 92, valor: "62.000", color: "#227a44" },
        { etiqueta: "Deudas", pct: 30, valor: "18.000", color: "#b4462f" },
        { etiqueta: "Neto", pct: 66, valor: "44.000" },
      ],
    },
  },
  {
    id: "produccion",
    nombre: "Producción",
    icono: ChefHat,
    conecta: ["catalogo", "proveedores", "ventas"],
    mosaicos: [
      { etiqueta: "Lotes del mes", valor: "24" },
      { etiqueta: "Costo por unidad", valor: "Bs 3,80", tono: "azul" },
    ],
    viz: {
      tipo: "barras",
      datos: [
        { etiqueta: "Producido", pct: 88, valor: "3.200" },
        { etiqueta: "Vendido", pct: 80, valor: "2.900", color: "#227a44" },
        { etiqueta: "Merma", pct: 14, valor: "130", color: "#b4462f" },
      ],
    },
  },
  {
    id: "reportes",
    nombre: "Reportes",
    icono: BarChart3,
    conecta: ["ventas", "gastos", "patrimonio", "compartir"],
    mosaicos: [
      { etiqueta: "Resultado del mes", valor: "Bs 6.200" },
      { etiqueta: "Margen del período", valor: "25%", tono: "azul" },
    ],
    viz: {
      tipo: "barras",
      datos: [
        { etiqueta: "Ventas", pct: 92, valor: "24.500" },
        { etiqueta: "Costos", pct: 48, valor: "12.300", color: "#b4462f" },
        { etiqueta: "Gastos", pct: 24, valor: "6.000", color: "#b4462f" },
        { etiqueta: "Resultado", pct: 26, valor: "6.200", color: "#227a44" },
      ],
    },
  },
  {
    id: "simulador",
    nombre: "Simulador",
    icono: Calculator,
    conecta: ["catalogo", "ventas"],
    // La direccion importa: se pide el margen y sale el precio.
    // `simularPrecio` toma `margenDeseadoPct` y devuelve `precioSugerido`
    // (= costo / (1 - margen/100), simulaciones/actions.ts:23-28).
    // 8,00 / (1 − 0,35) = 12,31.
    mosaicos: [
      { etiqueta: "Margen que querés", valor: "35%" },
      { etiqueta: "Precio sugerido", valor: "Bs 12,31", tono: "azul" },
    ],
    viz: {
      tipo: "filas",
      datos: [
        { etiqueta: "Costo real del producto", valor: "Bs 8,00" },
        { etiqueta: "Margen deseado", valor: "35%" },
        { etiqueta: "A qué precio vender", valor: "Bs 12,31", tono: "ok" },
      ],
    },
  },
  {
    id: "compartir",
    nombre: "Compartir datos",
    icono: KeyRound,
    conecta: ["ventas", "reportes"],
    mosaicos: [
      { etiqueta: "Código activo", valor: "1" },
      { etiqueta: "Acceso", valor: "Solo lectura", tono: "azul" },
    ],
    viz: {
      tipo: "filas",
      datos: [
        { etiqueta: "Ventas del período", valor: "Compartido", tono: "ok" },
        { etiqueta: "Flujo de caja", valor: "Compartido", tono: "ok" },
        { etiqueta: "Producción", valor: "No compartido" },
      ],
    },
  },
];

export function VentanaPlataforma() {
  const [activo, setActivo] = useState(0);
  const [quieto, setQuieto] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (quieto) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const t = window.setInterval(() => setActivo((i) => (i + 1) % MODULOS.length), CICLO_MS);
    return () => window.clearInterval(t);
  }, [quieto]);

  // Abajo de 820px el sidebar es una fila que se desplaza, y el modulo activo
  // se iba de pantalla al rotar. Se centra a mano en vez de con
  // scrollIntoView() porque ese tambien mueve el scroll vertical de la pagina.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav || nav.scrollWidth <= nav.clientWidth) return;

    const boton = nav.querySelectorAll<HTMLElement>("[role='tab']")[activo];
    if (!boton) return;

    nav.scrollTo({
      left: boton.offsetLeft - (nav.clientWidth - boton.clientWidth) / 2,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, [activo]);

  const actual = MODULOS[activo];

  return (
    <div
      className="l-ventana l-claro-datos"
      onMouseEnter={() => setQuieto(true)}
      onMouseLeave={() => setQuieto(false)}
      onFocusCapture={() => setQuieto(true)}
      onBlurCapture={() => setQuieto(false)}
    >
      <div className="l-ventana__filo" aria-hidden />

      {/* Cromo de ventana. Decorativo: no simula una barra de navegador
          funcional ni promete una URL publica. */}
      <div className="l-ventana__barra" aria-hidden>
        <span className="l-ventana__punto" style={{ background: "#e06c5b" }} />
        <span className="l-ventana__punto" style={{ background: "#e6b23c" }} />
        <span className="l-ventana__punto" style={{ background: "#4ec48a" }} />
        <span className="l-ventana__url">CEOM · Panadería La Esquina</span>
      </div>

      <div className="l-ventana__cuerpo">
        <div
          ref={navRef}
          className="l-ventana__nav"
          role="tablist"
          aria-label="Módulos de la plataforma"
          aria-orientation="vertical"
        >
          <p className="l-ventana__nav-titulo">Módulos</p>

          {MODULOS.map(({ id, nombre, icono: Icono }, i) => {
            const seleccionado = i === activo;
            const conectado = actual.conecta.includes(id);
            return (
              <button
                key={id}
                type="button"
                role="tab"
                id={`mod-tab-${id}`}
                aria-selected={seleccionado}
                aria-controls="mod-panel"
                tabIndex={seleccionado ? 0 : -1}
                className="l-modulo-nav"
                data-conectado={conectado ? "1" : "0"}
                onClick={() => setActivo(i)}
              >
                <Icono aria-hidden />
                {nombre}
                {conectado && !seleccionado && (
                  <span className="l-modulo-nav__punto" aria-hidden />
                )}
              </button>
            );
          })}
        </div>

        <div
          key={actual.id}
          className="l-ventana__panel"
          role="tabpanel"
          id="mod-panel"
          aria-labelledby={`mod-tab-${actual.id}`}
          tabIndex={0}
        >
          <div className="l-ventana__panel-cabecera">
            <div>
              <p className="l-ventana__panel-orden">
                Módulo {String(activo + 1).padStart(2, "0")} de {MODULOS.length}
              </p>
              <h3 className="l-ventana__panel-titulo">{actual.nombre}</h3>
            </div>

            <div className="l-conecta">
              <span className="l-conecta__titulo">Conecta con</span>
              {actual.conecta.map((id) => {
                const destino = MODULOS.findIndex((m) => m.id === id);
                return (
                  <button
                    key={id}
                    type="button"
                    className="l-conecta__chip"
                    onClick={() => setActivo(destino)}
                  >
                    {MODULOS[destino].nombre}
                  </button>
                );
              })}
            </div>
          </div>

          <Mosaicos datos={actual.mosaicos} />
          {actual.viz.tipo === "barras" ? (
            <Barras datos={actual.viz.datos} />
          ) : (
            <Filas datos={actual.viz.datos} />
          )}
        </div>
      </div>
    </div>
  );
}
