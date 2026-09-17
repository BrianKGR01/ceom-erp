import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { listarCodigosAcceso } from "@/modules/consentimiento/actions";
import { CodigosCliente } from "./codigos-cliente";

export default async function CodigosAccesoPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const resultado = await listarCodigosAcceso(usuario, usuario.tenantId);

  return (
    <div className="min-h-screen bg-gray-bg p-6 xl:p-8">
      <div className="mx-auto max-w-4xl space-y-4 py-6">
        <CodigosCliente datosIniciales={resultado} />
      </div>
    </div>
  );
}
