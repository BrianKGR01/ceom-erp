import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { listarSucursalesAction, obtenerTopeSucursalesAction } from "../actions";
import { SucursalesCliente } from "./sucursales-cliente";

// H-02: si el plan no incluye sucursales, esta pantalla queda AUSENTE, no
// deshabilitada — mismo criterio en el link del sub-nav (ver los 4 archivos
// hermanos) y acá, por si alguien llega por URL directa.
export default async function SucursalesPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");
  if (!usuario.esOwner) redirect("/app");

  const topeRes = await obtenerTopeSucursalesAction();
  if (!topeRes.ok || topeRes.data.maxSucursales === 1) redirect("/app/mi-negocio/colaboradores");

  const sucursalesRes = await listarSucursalesAction();

  return (
    <SucursalesCliente
      sucursales={sucursalesRes.ok ? sucursalesRes.data : []}
      maxSucursales={topeRes.data.maxSucursales}
    />
  );
}
