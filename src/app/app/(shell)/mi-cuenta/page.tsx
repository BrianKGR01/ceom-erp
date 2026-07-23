import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { nombreRolVisible } from "@/lib/vocabulario";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { CambiarContrasenaForm } from "./cambiar-contrasena-form";

// Mi Cuenta es de cualquier usuario del tenant, no solo del Owner — por eso
// no vive dentro de /app/mi-negocio, que esta gateado a Owner. Cambiar la
// propia contraseña le toca a todos.
export default async function MiCuentaPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mi cuenta"
        description="Tus datos de acceso a CEOM."
      />

      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-[11px] tracking-wide text-text-muted uppercase">Nombre</p>
            <p className="mt-0.5 text-sm text-navy">{usuario.nombreCompleto}</p>
          </div>
          <div>
            <p className="text-[11px] tracking-wide text-text-muted uppercase">
              Correo electrónico
            </p>
            <p className="mt-0.5 text-sm text-navy">{usuario.email}</p>
          </div>
          <div>
            <p className="text-[11px] tracking-wide text-text-muted uppercase">Rol</p>
            <p className="mt-0.5 text-sm text-navy">{nombreRolVisible(usuario.rol.nombre)}</p>
          </div>
        </CardContent>
      </Card>

      <CambiarContrasenaForm />
    </div>
  );
}
