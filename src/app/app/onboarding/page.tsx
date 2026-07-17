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
