import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { cerrarSesion } from "@/lib/supabase/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Landing minima de /admin — mismo proposito que src/app/app/page.tsx:
// probar el loop de sesion completo para el rol ceom_admin. El Panel
// Administrativo CEOM real (gestion de tenants/planes) es trabajo aparte.
export default async function AdminHomePage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-bg p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardDescription>Panel CEOM Admin</CardDescription>
          <CardTitle>¡Hola, {usuario.nombreCompleto}!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-text-body">
            Entraste como <span className="font-medium text-navy">{usuario.rol.nombre}</span>.
            Esta es una pantalla provisoria — la gestión de tenants y planes se construye más
            adelante.
          </p>
          <form action={cerrarSesion}>
            <Button type="submit" variant="outline" className="w-full justify-center">
              Cerrar sesión
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
