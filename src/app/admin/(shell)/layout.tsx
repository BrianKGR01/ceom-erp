import { redirect } from "next/navigation";
import { AdminShell } from "@/components/shared/admin-shell";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";

// Shell real de /admin (primera vez, ver admin-shell.tsx) — route group
// separado de la landing provisoria en src/app/admin/page.tsx, mismo
// criterio que /app/(shell) vs /app/onboarding.
export default async function AdminShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  return <AdminShell nombreCompleto={usuario.nombreCompleto}>{children}</AdminShell>;
}
