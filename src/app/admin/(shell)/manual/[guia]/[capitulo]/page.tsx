import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, List } from "lucide-react";
import { ManualMarkdown } from "@/components/shared/manual-markdown";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { BASE_MANUAL, hrefCapitulo, obtenerCapitulo, obtenerGuia } from "@/lib/manual/contenido";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ guia: string; capitulo: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { guia, capitulo } = await params;
  const datos = await obtenerCapitulo(guia, capitulo);
  return { title: datos ? `${datos.numero}. ${datos.titulo} — Manual CEOM` : "Manual CEOM" };
}

export default async function CapituloPage({ params }: Params) {
  const { guia, capitulo } = await params;
  const [datosGuia, datosCapitulo] = await Promise.all([
    obtenerGuia(guia),
    obtenerCapitulo(guia, capitulo),
  ]);
  if (!datosGuia || !datosCapitulo) notFound();

  const indice = datosGuia.capitulos.findIndex((c) => c.slug === datosCapitulo.slug);
  const anterior = indice > 0 ? datosGuia.capitulos[indice - 1] : null;
  const siguiente =
    indice >= 0 && indice < datosGuia.capitulos.length - 1
      ? datosGuia.capitulos[indice + 1]
      : null;

  return (
    <div className="space-y-4">
      {/* Barra de vuelta pegajosa: su bloque contenedor es la columna de
          contenido, que es tan alta como el capítulo, así que acompaña el
          scroll hasta el final. Es lo que mantiene "volver" a la vista en
          móvil, donde el índice de la izquierda está colapsado. */}
      <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-x-3 gap-y-1 bg-gray-bg/95 px-1 py-2 backdrop-blur-sm">
        <Link
          href={BASE_MANUAL}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-navy"
        >
          <ArrowLeft className="size-4 shrink-0" />
          Índice
        </Link>
        {/* El breadcrumb llega hasta la guía y no repite el nombre del
            capítulo: está justo abajo como título, y a 375px el título
            completo hacía tres renglones dentro de una barra pegajosa. */}
        <Breadcrumb
          items={[{ label: "Manual", href: BASE_MANUAL }, { label: datosGuia.titulo }]}
        />
      </div>

      <Card>
        <CardContent className="space-y-5">
          <div>
            <p className="text-[11px] font-semibold tracking-wide text-text-muted uppercase">
              {datosGuia.titulo} · Capítulo {datosCapitulo.numero}
            </p>
            <h2 className="mt-1 font-heading text-2xl leading-tight font-semibold text-navy">
              {datosCapitulo.titulo}
            </h2>
          </div>
          <ManualMarkdown markdown={datosCapitulo.cuerpo} guiaSlug={datosGuia.slug} />
        </CardContent>
      </Card>

      <nav
        aria-label="Capítulos vecinos"
        className="flex flex-wrap items-stretch justify-between gap-3"
      >
        {anterior ? (
          <Link
            href={hrefCapitulo(datosGuia.slug, anterior.slug)}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl bg-card px-4 py-3 text-sm text-text-body shadow-card transition-colors hover:text-navy"
          >
            <ArrowLeft className="size-4 shrink-0 text-primary" />
            <span className="min-w-0">
              <span className="block text-[11px] text-text-muted">Anterior</span>
              <span className="block truncate">
                {anterior.numero}. {anterior.titulo}
              </span>
            </span>
          </Link>
        ) : (
          <span className="flex-1" />
        )}
        {siguiente ? (
          <Link
            href={hrefCapitulo(datosGuia.slug, siguiente.slug)}
            className="flex min-w-0 flex-1 items-center justify-end gap-2 rounded-2xl bg-card px-4 py-3 text-right text-sm text-text-body shadow-card transition-colors hover:text-navy"
          >
            <span className="min-w-0">
              <span className="block text-[11px] text-text-muted">Siguiente</span>
              <span className="block truncate">
                {siguiente.numero}. {siguiente.titulo}
              </span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-primary" />
          </Link>
        ) : (
          <span className="flex-1" />
        )}
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-2">
        <Link
          href={BASE_MANUAL}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-navy"
        >
          <List className="size-4 shrink-0" />
          Volver al índice del manual
        </Link>
        {/* Para el equipo: qué archivo hay que editar para cambiar esto. */}
        <p className="text-xs text-text-muted">
          Fuente: <code className="text-[11px]">{datosCapitulo.rutaRelativa}</code>
        </p>
      </div>
    </div>
  );
}
