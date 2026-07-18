import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { listarCodigosAcceso } from "@/modules/consentimiento/actions";
import { CodigosCliente } from "./codigos-cliente";

export default async function CodigosAccesoPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const resultado = await listarCodigosAcceso(usuario, usuario.tenantId);

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-3xl space-y-4 py-6">
        <CodigosCliente datosIniciales={resultado} />
      </div>
    </div>
  );
}
