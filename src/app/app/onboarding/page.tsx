import Link from "next/link";
import { redirect } from "next/navigation";
import { obtenerTenantPorId, obtenerUsuarioActual } from "@/modules/identidad/actions";
import { OnboardingWizard } from "./onboarding-wizard";

// Server Component: solo el Owner configura el negocio (Modulo_01 seccion
// 4). El gate de "hay sesion" ya lo cubre el layout de /app — acá se suma
// el gate de esOwner.
export default async function OnboardingPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");
  if (!usuario.esOwner) redirect("/app");

  const tenantResultado = await obtenerTenantPorId(usuario, usuario.tenantId);
  if (!tenantResultado.ok) redirect("/app");
  const tenant = tenantResultado.data;

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-2xl py-10">
        <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium">
          <span className="text-navy">Negocio</span>
          <Link href="/app/mi-negocio/colaboradores" className="text-primary hover:underline">
            Colaboradores
          </Link>
          <Link href="/app/mi-negocio/roles" className="text-primary hover:underline">
            Roles
          </Link>
          <Link href="/app/mi-negocio/capacidades" className="text-primary hover:underline">
            Capacidades Especiales
          </Link>
        </div>
        <OnboardingWizard
          tenant={{
            nombreNegocio: tenant.nombreNegocio,
            ciudadBase: tenant.ciudadBase,
            monedaPrincipal: tenant.monedaPrincipal,
            canalesVenta: tenant.canalesVenta,
            nichoId: tenant.nichoId,
            logoUrl: tenant.logoUrl,
          }}
        />
      </div>
    </div>
  );
}
