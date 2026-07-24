"use client";

import { useEffect } from "react";

/**
 * Entrada por seccion y sombra del encabezado al scrollear.
 *
 * Es una sola isla de cliente para toda la pagina en vez de envolver cada
 * bloque en su propio componente: observa `[data-revelar]` esté donde esté, así
 * las secciones siguen siendo Server Components y no se paga un boundary por
 * cada una.
 *
 * **El contenido nunca depende de esto para verse.** El HTML del servidor sale
 * visible; lo que se hace acá es ocultar, ya montado, solo los bloques que en
 * ese momento están debajo del pliegue, y revelarlos cuando entran. Lo que ya
 * se ve al cargar no se anima nunca — animar el hero seria justo tapar la
 * primera lectura, que es lo contrario de lo que la animacion tiene que hacer.
 */
export function Revelaciones() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const alto = window.innerHeight;
    const bloques = Array.from(document.querySelectorAll<HTMLElement>("[data-revelar]"));
    // Solo lo que todavia no se ve. El 0.9 deja fuera lo que asoma apenas: si
    // ya entro en pantalla, esconderlo para animarlo seria un parpadeo.
    const porRevelar = bloques.filter((el) => el.getBoundingClientRect().top > alto * 0.9);
    porRevelar.forEach((el) => el.setAttribute("data-oculto", ""));

    const mostrar = (el: HTMLElement) => el.setAttribute("data-visible", "");

    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (!entrada.isIntersecting) continue;
          mostrar(entrada.target as HTMLElement);
          observador.unobserve(entrada.target);
        }
      },
      // Dispara un poco antes de que el bloque entre del todo, para que la
      // transicion termine cuando el ojo llega.
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 }
    );
    porRevelar.forEach((el) => observador.observe(el));

    // Red de seguridad: si algo impidiera que el observer dispare, a los 4s se
    // muestra todo igual.
    const red = window.setTimeout(() => porRevelar.forEach(mostrar), 4000);

    const cabecera = document.querySelector<HTMLElement>("[data-cabecera]");
    const alScrollear = () => {
      cabecera?.setAttribute("data-scroll", window.scrollY > 8 ? "1" : "0");
    };
    alScrollear();
    window.addEventListener("scroll", alScrollear, { passive: true });

    return () => {
      observador.disconnect();
      window.clearTimeout(red);
      window.removeEventListener("scroll", alScrollear);
    };
  }, []);

  return null;
}
