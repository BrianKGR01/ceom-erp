import { describe, expect, it } from "vitest";
import {
  diaLocalDe,
  instanteDeDiaLocal,
  rangoInstantes,
  ZONA_HORARIA_NEGOCIO,
  zonaHorariaTenant,
} from "./periodo";

// Tests puros: ni base de datos ni reloj. Cada caso fija el instante que
// quiere probar, asi que dan lo mismo a las 09:00 que a las 21:00 y en
// cualquier huso donde corra CI — que es el requisito de H-49, porque el modo
// de falla original era justamente "el numero cambia segun la hora en que se
// mira". Ver docs/auditoria-prelanzamiento/05-dia-local-y-reportes.md, seccion 9.1.

const LA_PAZ = "America/La_Paz";

describe("instanteDeDiaLocal", () => {
  it("el dia local de Bolivia empieza a las 04:00 UTC, no a medianoche UTC", () => {
    // El corazon de H-49: `new Date("2026-07-27")` daba 00:00Z, que en Bolivia
    // son las 20:00 del 26. El dia local real arranca 4 horas despues.
    expect(instanteDeDiaLocal("2026-07-27", LA_PAZ).toISOString()).toBe("2026-07-27T04:00:00.000Z");
  });

  it("rechaza una fecha que no sea YYYY-MM-DD", () => {
    expect(() => instanteDeDiaLocal("27/07/2026", LA_PAZ)).toThrow(/YYYY-MM-DD/);
  });

  it("cruza el borde de anio sin correrse", () => {
    expect(instanteDeDiaLocal("2026-01-01", LA_PAZ).toISOString()).toBe("2026-01-01T04:00:00.000Z");
  });

  it("en UTC el dia local empieza a medianoche UTC", () => {
    expect(instanteDeDiaLocal("2026-07-27", "UTC").toISOString()).toBe("2026-07-27T00:00:00.000Z");
  });
});

describe("instanteDeDiaLocal con horario de verano", () => {
  // Bolivia no tiene horario de verano, pero `zonaHorariaTenant` esta pensada
  // para volverse configurable por negocio. Estos dos casos prueban que el
  // helper no asume offset fijo — si alguien lo "simplifica" a un -4 cableado,
  // fallan.
  const SANTIAGO = "America/Santiago";

  it("un dia normal de verano austral arranca con offset -03", () => {
    expect(instanteDeDiaLocal("2026-01-15", SANTIAGO).toISOString()).toBe(
      "2026-01-15T03:00:00.000Z"
    );
  });

  it("un dia normal de invierno austral arranca con offset -04", () => {
    expect(instanteDeDiaLocal("2026-06-15", SANTIAGO).toISOString()).toBe(
      "2026-06-15T04:00:00.000Z"
    );
  });

  it("cuando la medianoche local no existe, devuelve el primer instante real del dia", () => {
    // Chile adelanta el reloj el 6/9/2026: a las 23:59 del 5 le sigue la 01:00
    // del 6, asi que el 6 NO tiene 00:00. El primer instante real de ese dia es
    // la transicion misma — verificado contra la base IANA, no supuesto.
    const inicio = instanteDeDiaLocal("2026-09-06", SANTIAGO);
    expect(inicio.toISOString()).toBe("2026-09-06T04:00:00.000Z");
    expect(diaLocalDe(inicio, SANTIAGO)).toBe("2026-09-06");
    // Y un milisegundo antes todavia es el dia anterior — o sea que no se comio
    // ni invento tiempo.
    expect(diaLocalDe(new Date(inicio.getTime() - 1), SANTIAGO)).toBe("2026-09-05");
  });

  it("el dia siguiente al salto dura 24 horas normales", () => {
    const { inicio, fin } = rangoInstantes({ desde: "2026-09-07", hasta: "2026-09-07" }, SANTIAGO);
    expect(fin.getTime() - inicio.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("el dia del salto dura 23 horas — el rango lo refleja en vez de asumir 24", () => {
    const { inicio, fin } = rangoInstantes({ desde: "2026-09-06", hasta: "2026-09-06" }, SANTIAGO);
    expect(fin.getTime() - inicio.getTime()).toBe(23 * 60 * 60 * 1000);
  });
});

describe("diaLocalDe", () => {
  it("una venta de las 22:00 de Bolivia es del dia local, no del dia UTC siguiente", () => {
    const instante = new Date("2026-07-28T02:00:00Z"); // 27/07 22:00 en La Paz
    expect(diaLocalDe(instante, LA_PAZ)).toBe("2026-07-27");
    expect(diaLocalDe(instante, "UTC")).toBe("2026-07-28");
  });

  it("una venta de las 00:30 de Bolivia no pertenece al dia anterior", () => {
    const instante = new Date("2026-07-27T04:30:00Z"); // 27/07 00:30 en La Paz
    expect(diaLocalDe(instante, LA_PAZ)).toBe("2026-07-27");
  });
});

describe("rangoInstantes", () => {
  it("el borde superior es EXCLUSIVO y cubre el dia `hasta` completo", () => {
    // El defecto de H-49 en una linea: con `<= hasta` el filtro cortaba en
    // 2026-07-27T00:00Z. Ahora llega hasta el final del dia local del 27.
    const { inicio, fin } = rangoInstantes({ desde: "2026-07-01", hasta: "2026-07-27" }, LA_PAZ);
    expect(inicio.toISOString()).toBe("2026-07-01T04:00:00.000Z");
    expect(fin.toISOString()).toBe("2026-07-28T04:00:00.000Z");
  });

  it("el borde inferior NO incluye la noche anterior", () => {
    // El otro borde, que el arreglo parcial de `2ea20e5` habia dejado abierto:
    // 2026-07-01T00:00Z son las 20:00 del 30 de junio en Bolivia.
    const { inicio } = rangoInstantes({ desde: "2026-07-01", hasta: "2026-07-27" }, LA_PAZ);
    const nocheAnterior = new Date("2026-07-01T02:00:00Z"); // 30/06 22:00 local
    expect(nocheAnterior.getTime()).toBeLessThan(inicio.getTime());
  });

  it("un solo dia es una ventana de 24 horas exactas, no de ancho cero", () => {
    // El preset "Hoy" mandaba desde == hasta, lo que producia un unico
    // instante: no podia mostrar nada nunca.
    const { inicio, fin } = rangoInstantes({ desde: "2026-07-27", hasta: "2026-07-27" }, LA_PAZ);
    expect(fin.getTime() - inicio.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("una venta de cualquier hora del dia local cae dentro del rango de ese dia", () => {
    const { inicio, fin } = rangoInstantes({ desde: "2026-07-27", hasta: "2026-07-27" }, LA_PAZ);
    const dentro = [
      "2026-07-27T04:00:00Z", // 00:00 local, primer instante
      "2026-07-27T12:00:00Z", // 08:00 local (el ancla de las ventas importadas)
      "2026-07-27T14:00:00Z", // 10:00 local
      "2026-07-27T23:00:00Z", // 19:00 local
      "2026-07-28T02:00:00Z", // 22:00 local — el caso que hoy se pierde
      "2026-07-28T03:59:59Z", // 23:59:59 local, ultimo instante
    ];
    for (const iso of dentro) {
      const t = new Date(iso);
      expect(t >= inicio && t < fin, `${iso} deberia contar en el 27`).toBe(true);
    }
  });

  it("no se pasa de largo: la noche del dia anterior y el dia siguiente quedan afuera", () => {
    const { inicio, fin } = rangoInstantes({ desde: "2026-07-27", hasta: "2026-07-27" }, LA_PAZ);
    const afuera = [
      "2026-07-27T03:00:00Z", // 23:00 del 26 local
      "2026-07-27T03:59:59Z", // 23:59:59 del 26 local
      "2026-07-28T04:00:00Z", // 00:00 del 28 local, primer instante excluido
      "2026-07-28T05:00:00Z", // 01:00 del 28 local
    ];
    for (const iso of afuera) {
      const t = new Date(iso);
      expect(t >= inicio && t < fin, `${iso} NO deberia contar en el 27`).toBe(false);
    }
  });

  it("el fin de un mes empalma exactamente con el inicio del siguiente", () => {
    const julio = rangoInstantes({ desde: "2026-07-01", hasta: "2026-07-31" }, LA_PAZ);
    const agosto = rangoInstantes({ desde: "2026-08-01", hasta: "2026-08-31" }, LA_PAZ);
    // Ni un hueco ni un solapamiento: nada se pierde ni se cuenta dos veces.
    expect(julio.fin.toISOString()).toBe(agosto.inicio.toISOString());
  });

  it("cruza el fin de anio sin perder el 31 de diciembre", () => {
    const { fin } = rangoInstantes({ desde: "2026-12-01", hasta: "2026-12-31" }, LA_PAZ);
    expect(fin.toISOString()).toBe("2027-01-01T04:00:00.000Z");
    const nocheVieja = new Date("2027-01-01T03:00:00Z"); // 31/12 23:00 local
    expect(nocheVieja < fin).toBe(true);
  });

  it("un anio bisiesto no se saltea el 29 de febrero", () => {
    const { fin } = rangoInstantes({ desde: "2028-02-01", hasta: "2028-02-29" }, LA_PAZ);
    expect(fin.toISOString()).toBe("2028-03-01T04:00:00.000Z");
  });
});

describe("zonaHorariaTenant", () => {
  it("devuelve la zona del negocio", async () => {
    expect(await zonaHorariaTenant("cualquier-tenant")).toBe(ZONA_HORARIA_NEGOCIO);
  });

  it("hoy es la misma para todos los tenants — la firma existe para poder cambiar eso sin barrer archivos", async () => {
    const [a, b] = await Promise.all([zonaHorariaTenant("tenant-a"), zonaHorariaTenant("tenant-b")]);
    expect(a).toBe(b);
  });
});
