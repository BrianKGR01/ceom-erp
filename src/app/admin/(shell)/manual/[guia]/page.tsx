import { notFound, redirect } from "next/navigation";
import { hrefCapitulo, obtenerGuia } from "@/lib/manual/contenido";

export const dynamic = "force-dynamic";

/**
 * `/admin/manual/<guia>` no tiene pantalla propia: una guía es su lista de
 * capítulos, que ya está en el índice. Manda al primer capítulo, que es lo
 * que se espera al abrir una guía.
 */
export default async function GuiaPage({ params }: { params: Promise<{ guia: string }> }) {
  const { guia } = await params;
  const datos = await obtenerGuia(guia);
  if (!datos) notFound();

  redirect(hrefCapitulo(datos.slug, datos.capitulos[0].slug));
}
