import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";

// Inicio de /app — placeholder hasta que se construya el Dashboard real
// (Resumen Ejecutivo, Modulo 14). La navegacion y la identidad de sesion ya
// no viven acá — pasaron al sidebar (src/components/shared/app-sidebar.tsx).
export default async function AppHomePage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-5xl space-y-6 py-6">
        <PageHeader
          title={`¡Hola, ${usuario.nombreCompleto}!`}
          description="Acá vas a ver el resumen de tu negocio — todavía lo estamos construyendo."
        />
      </div>
    </div>
  );
}
