import { ManualIndice } from "@/components/shared/manual-indice";
import { PageHeader } from "@/components/shared/page-header";
import { BASE_MANUAL, listarGuias } from "@/lib/manual/contenido";

/**
 * Los `.md` se leen del disco en cada request (opción A). `force-dynamic`
 * deja explícito que esta rama no se prerenderiza: si Next decidiera
 * generarla en la build, el texto quedaría congelado ahí y editar el archivo
 * ya no alcanzaría para actualizar el manual.
 */
export const dynamic = "force-dynamic";

/**
 * Manual de usuario — solo equipo CEOM.
 *
 * El gate de rol es el de toda la superficie: `src/app/admin/layout.tsx`
 * exige `ROL_CEOM_ADMIN_ID` antes de que se renderice nada de acá, y este
 * árbol no expone ninguna Server Action ni Route Handler propio, así que no
 * hay una segunda puerta que pudiera quedar sin gatear.
 */
export default async function ManualLayout({ children }: { children: React.ReactNode }) {
  const guias = await listarGuias();

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      {/* max-w-5xl y no el 6xl que la tabla de docs/design-system.md 7.2 da
          para maestro-detalle: acá el panel derecho es texto corrido, y con
          6xl la línea de lectura se va a ~88 caracteres. Con 5xl queda en
          ~74, dentro de la medida cómoda, y las tablas anchas ya tienen su
          propio scroll horizontal. */}
      <div className="mx-auto max-w-5xl space-y-4 py-6">
        <PageHeader
          title="Manual"
          description="Documentación interna de consulta para el equipo de CEOM."
        />
        <div className="manual-layout">
          <ManualIndice
            base={BASE_MANUAL}
            guias={guias.map((guia) => ({
              slug: guia.slug,
              titulo: guia.titulo,
              descripcion: guia.descripcion,
              capitulos: guia.capitulos.map((c) => ({
                slug: c.slug,
                numero: c.numero,
                titulo: c.titulo,
              })),
            }))}
          />
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
