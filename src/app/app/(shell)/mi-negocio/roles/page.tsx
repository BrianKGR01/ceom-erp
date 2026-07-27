import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { listarRolesAction, listarUsuariosAction, obtenerTopeSucursalesAction } from "../actions";
import { RolesCliente } from "./roles-cliente";

export default async function RolesPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");
  if (!usuario.esOwner) redirect("/app");

  const [rolesRes, usuariosRes, topeRes] = await Promise.all([
    listarRolesAction(),
    listarUsuariosAction(),
    obtenerTopeSucursalesAction(),
  ]);

  return (
    <RolesCliente
      roles={rolesRes.ok ? rolesRes.data : []}
      colaboradores={usuariosRes.ok ? usuariosRes.data : []}
      mostrarSucursales={topeRes.ok && topeRes.data.maxSucursales !== 1}
    />
  );
}
