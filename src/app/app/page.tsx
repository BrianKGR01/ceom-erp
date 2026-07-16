import Link from "next/link";
import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { cerrarSesion } from "@/lib/supabase/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Landing minima de /app — solo para probar el loop de sesion completo
// (login -> redirect -> ruta protegida -> logout). El dashboard real
// (sidebar + Resumen Ejecutivo) es un paso propio de Etapa B, todavia no
// construido.
export default async function AppHomePage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-bg p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardDescription>Sesión iniciada</CardDescription>
          <CardTitle>¡Hola, {usuario.nombreCompleto}!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-text-body">
            Entraste como <span className="font-medium text-navy">{usuario.rol.nombre}</span>.
            Esta es una pantalla provisoria — el catálogo y el resto de{" "}
            <span className="font-medium">/app</span> se construyen en los próximos pasos.
          </p>
          <Button
            render={<Link href="/app/ventas" />}
            nativeButton={false}
            className="w-full justify-center"
          >
            Vender
          </Button>

          <Button
            render={<Link href="/app/productos" />}
            nativeButton={false}
            variant="outline"
            className="w-full justify-center"
          >
            Ver catálogo
          </Button>

          {usuario.esOwner && (
            <Button
              render={<Link href="/app/onboarding" />}
              nativeButton={false}
              variant="outline"
              className="w-full justify-center"
            >
              Configurar mi negocio
            </Button>
          )}

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
