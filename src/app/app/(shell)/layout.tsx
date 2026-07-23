import { redirect } from "next/navigation";
import { AppShell } from "@/components/shared/app-shell";
import { nombreRolVisible } from "@/lib/vocabulario";
import { calcularEstadoAcceso, obtenerTenantPorId, obtenerUsuarioActual } from "@/modules/identidad/actions";

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

  // Derivado igual que en cualquier otro lugar del código — nunca se lee
  // tenant.estadoAcceso directo (Modulo_01 seccion 1.1, ver identidad/ANCLA.md).
  // El bloqueo real de crear/editar ya lo hace tienePermiso() server-side
  // (identidad/actions.ts); este banner es solo la señal visual.
  const estadoAcceso = tenant ? calcularEstadoAcceso(tenant) : "activo";

  return (
    <AppShell
      nombreCompleto={usuario.nombreCompleto}
      rolNombre={nombreRolVisible(usuario.rol.nombre)}
      tenantNombre={tenant?.nombreNegocio ?? ""}
      esOwner={usuario.esOwner}
      estadoAcceso={estadoAcceso}
      fechaProximoPago={tenant?.fechaProximoPago ?? null}
    >
      {children}
    </AppShell>
  );
}
