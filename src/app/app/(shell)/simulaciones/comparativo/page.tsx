import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { comparativoMultiSku } from "@/modules/simulaciones/actions";
import { ComparativoCliente } from "./comparativo-cliente";

export default async function ComparativoPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const resultado = await comparativoMultiSku(usuario, usuario.tenantId);

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-5xl space-y-4 py-6">
        <ComparativoCliente datosIniciales={resultado} />
      </div>
    </div>
  );
}
