import type { NextConfig } from "next";

// Rutas del manual de /admin. Las tres leen los .md con fs en runtime, asi
// que las tres necesitan que los archivos viajen al servidor.
const RUTAS_DEL_MANUAL = ["/admin/manual", "/admin/manual/[guia]", "/admin/manual/[guia]/[capitulo]"];

const nextConfig: NextConfig = {
  // El manual de /admin lee los .md de docs/manual/ con fs en tiempo de
  // ejecucion (src/lib/manual/contenido.ts). El trazado de dependencias de
  // Next solo empaqueta lo que ve importado, y un readFile con la ruta
  // armada a mano no se ve: sin esto, en Vercel los archivos no llegan al
  // servidor y el manual sale vacio. Esto los suma al bundle de la funcion
  // sin convertirlos en imports — se siguen leyendo del disco en cada
  // request, que es el punto: editar el .md y desplegar alcanza para
  // actualizar el manual, no hay copia intermedia que sincronizar.
  //
  // Nota: el glob no acota nada en la practica. Se probo con `*/*.md`,
  // `*/[0-9]*.md` y hasta `negocio/*.md`, y tambien con
  // outputFileTracingExcludes: en los .nft.json de las tres rutas Next
  // termina siempre trazando docs/manual/ completo, incluidos los cuatro
  // documentos internos de desarrollo de la raiz. Viajan al bundle, pero
  // ninguna ruta los sirve: obtenerCapitulo() solo abre archivos numerados
  // dentro de un directorio de guia (ver contenido.test.ts).
  outputFileTracingIncludes: Object.fromEntries(
    RUTAS_DEL_MANUAL.map((ruta) => [ruta, ["./docs/manual/**/*.md"]])
  ),
  experimental: {
    // Default de Next.js es 1MB — insuficiente para las imagenes de hasta
    // 5MB que aceptan los dropzones de logo/producto
    // (src/lib/supabase/storage-config.ts, TAMANO_MAXIMO_IMAGEN_BYTES).
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
