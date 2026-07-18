import { redirect } from "next/navigation";
import { AppShell } from "@/components/shared/app-shell";
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
    <AppShell
      nombreCompleto={usuario.nombreCompleto}
      rolNombre={usuario.rol.nombre}
      tenantNombre={tenant?.nombreNegocio ?? ""}
      esOwner={usuario.esOwner}
    >
      {children}
    </AppShell>
  );
}
