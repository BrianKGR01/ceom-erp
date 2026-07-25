import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { hrefCapitulo, listarGuias } from "@/lib/manual/contenido";

export const dynamic = "force-dynamic";

/**
 * Panel derecho cuando todavía no se eligió capítulo: las tres guías con sus
 * capítulos, como entrada alternativa al índice de la izquierda (que en
 * móvil arranca colapsado, así que esta pantalla es lo primero que se ve).
 */
export default async function ManualIndicePage() {
  const guias = await listarGuias();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Manual de usuario de CEOM</CardTitle>
          <CardDescription>
            Tres guías, una por actor del sistema. El texto sale directo de los archivos de{" "}
            <code className="rounded bg-pastel-blue-bg px-1 py-0.5 text-[11px] text-navy">
              docs/manual/
            </code>{" "}
            del repositorio: lo que se lee acá es lo que dice el archivo en este despliegue.
          </CardDescription>
        </CardHeader>
      </Card>

      {guias.map((guia) => (
        <Card key={guia.slug}>
          <CardHeader>
            <CardTitle>{guia.titulo}</CardTitle>
            <CardDescription>
              {guia.descripcion} · {guia.capitulos.length} capítulos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-gray-border">
              {guia.capitulos.map((capitulo) => (
                <li key={capitulo.slug}>
                  <Link
                    href={hrefCapitulo(guia.slug, capitulo.slug)}
                    className="group flex items-center gap-3 py-2 text-sm text-text-body transition-colors hover:text-navy"
                  >
                    <span className="w-6 shrink-0 text-right text-xs font-semibold text-text-muted group-hover:text-primary">
                      {capitulo.numero}
                    </span>
                    <span className="min-w-0 flex-1">{capitulo.titulo}</span>
                    <ChevronRight className="size-4 shrink-0 text-text-muted group-hover:text-primary" />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
