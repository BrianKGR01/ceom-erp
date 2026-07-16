import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/shared/app-sidebar";
import { obtenerTenantPorId, obtenerUsuarioActual } from "@/modules/identidad/actions";

// Shell real de /app (design-system.md seccion 5.1): sidebar navy +
// redirect forzado a Onboarding en el primer ingreso del Owner. Vive en un
// route group (shell) separado de /app/onboarding a proposito — asi
// Onboarding nunca lleva este sidebar y nunca puede quedar en loop de
// redirect (ver identidad/ANCLA.md, decision de "onboardingCompletadoEn").
export default async function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const tenantResultado = await obtenerTenantPorId(usuario, usuario.tenantId);
  const tenant = tenantResultado.ok ? tenantResultado.data : null;

  if (usuario.esOwner && tenant && !tenant.onboardingCompletadoEn) {
    redirect("/app/onboarding");
  }

  return (
    <div className="flex min-h-screen">
      <AppSidebar
        nombreCompleto={usuario.nombreCompleto}
        rolNombre={usuario.rol.nombre}
        tenantNombre={tenant?.nombreNegocio ?? ""}
        esOwner={usuario.esOwner}
      />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
