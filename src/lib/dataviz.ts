// Paleta categorica de graficas.
//
// El design system v1.0 no define una paleta de dataviz: solo la escala de
// rentabilidad de 5 pasos (heatmap de margenes), que es secuencial y sirve
// para "que tan bueno es este margen", no para "que categoria es esta".
// Para series categoricas hace falta una rampa aparte.
//
// La rampa esta validada para daltonismo contra la superficie real de las
// cards (--surface-white #FFFFFF): CVD ΔE minimo 16.2, con banda de
// lightness y chroma controlada. El primer color es el azul de marca del
// sistema nuevo (--brand-primary #1A76FD); los otros cinco NO son colores
// de marca sino separadores categoricos elegidos por distinguibilidad, y
// por eso se mantienen tal cual: recolorearlos "para que combinen" rompe
// la validacion de CVD sin ganar nada.
//
// El orden es fijo y se asigna por orden estable de categoria, nunca por
// rank de valor — si no, la misma categoria cambia de color entre dos
// cargas de la misma pantalla.
export const COLORES_CATEGORIA = [
  "#1a76fd",
  "#1baf7a",
  "#eda100",
  "#4a3aa7",
  "#e34948",
  "#eb6834",
] as const;

// Par usado cuando una grafica contrasta exactamente dos series (ventas
// regulares vs. ventas de evento): primero y quinto de la misma rampa.
export const COLOR_SERIE_PRIMARIA = COLORES_CATEGORIA[0];
export const COLOR_SERIE_SECUNDARIA = COLORES_CATEGORIA[4];
