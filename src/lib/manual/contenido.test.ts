import { describe, expect, it } from "vitest";
import { listarGuias, obtenerCapitulo, obtenerGuia } from "./contenido";

// Estos tests corren contra los archivos reales de docs/manual/ a propósito:
// la fuente del manual es el disco, así que un test con un directorio
// inventado no probaría lo que importa (que el descubrimiento dinámico
// enganche con la estructura que hay de verdad).

describe("listarGuias", () => {
  it("lista las tres guías en el orden del manual", async () => {
    const guias = await listarGuias();
    expect(guias.map((g) => g.slug)).toEqual(["negocio", "equipo-ceom", "instituciones"]);
  });

  it("descubre los capítulos listando el directorio, ordenados por su número de archivo", async () => {
    const [negocio] = await listarGuias();
    expect(negocio.capitulos.map((c) => c.numero)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(negocio.capitulos[0].slug).toBe("01-primeros-pasos");
  });

  it("deja afuera los documentos internos de desarrollo y los README", async () => {
    const guias = await listarGuias();
    const slugs = guias.flatMap((g) => g.capitulos.map((c) => c.slug));
    for (const interno of [
      "hallazgos",
      "glosario",
      "auditoria-por-actor",
      "propuesta-roles-por-defecto",
      "README",
      "readme",
    ]) {
      expect(slugs).not.toContain(interno);
    }
  });

  it("saca la numeración del título, que es la del archivo y no la del texto", async () => {
    const [negocio] = await listarGuias();
    // negocio/04-gastos.md abre con "# 5. Gastos": manda el archivo.
    const gastos = negocio.capitulos.find((c) => c.slug === "04-gastos");
    expect(gastos).toMatchObject({ numero: 4, titulo: "Gastos" });
    expect(gastos?.titulo).not.toMatch(/^\d/);
  });
});

describe("obtenerGuia", () => {
  it("devuelve la guía pedida", async () => {
    const guia = await obtenerGuia("equipo-ceom");
    expect(guia?.titulo).toBe("Equipo CEOM");
    expect(guia?.capitulos).toHaveLength(6);
  });

  it("devuelve null para un directorio que no es una guía", async () => {
    expect(await obtenerGuia("no-existe")).toBeNull();
  });
});

describe("obtenerCapitulo", () => {
  it("devuelve el markdown tal cual está en el archivo", async () => {
    const capitulo = await obtenerCapitulo("negocio", "01-primeros-pasos");
    expect(capitulo?.markdown).toMatch(/^# 1\. Primeros pasos/);
    expect(capitulo?.rutaRelativa).toBe("docs/manual/negocio/01-primeros-pasos.md");
  });

  it("saca el encabezado principal del cuerpo, que se muestra aparte", async () => {
    const capitulo = await obtenerCapitulo("negocio", "01-primeros-pasos");
    expect(capitulo?.cuerpo.startsWith("#")).toBe(false);
    expect(capitulo?.cuerpo).toContain("Este capítulo te lleva desde el correo");
  });

  it("devuelve null para un capítulo inexistente", async () => {
    expect(await obtenerCapitulo("negocio", "99-inventado")).toBeNull();
  });

  it("no lee nada fuera de la guía pedida", async () => {
    // Los documentos internos viven en la raíz de docs/manual/: aunque se
    // escriba la ruta a mano, no se sirven.
    for (const intento of [
      "../hallazgos",
      "..%2Fhallazgos",
      "../../design-system",
      "hallazgos",
      "glosario",
      "README",
      "/etc/passwd",
      "..",
    ]) {
      expect(await obtenerCapitulo("negocio", intento)).toBeNull();
      expect(await obtenerCapitulo(intento, "01-primeros-pasos")).toBeNull();
    }
  });
});
