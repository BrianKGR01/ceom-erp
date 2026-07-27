import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import {
  listarCapacidadesEspecialesAction,
  listarRolesAction,
  listarUsuariosAction,
  obtenerTopeSucursalesAction,
} from "../actions";
import { CapacidadesCliente } from "./capacidades-cliente";

export default async function CapacidadesPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");
  if (!usuario.esOwner) redirect("/app");

  const [capacidadesRes, rolesRes, usuariosRes, topeRes] = await Promise.all([
    listarCapacidadesEspecialesAction(),
    listarRolesAction(),
    listarUsuariosAction(),
    obtenerTopeSucursalesAction(),
  ]);

  return (
    <CapacidadesCliente
      capacidadesPorRol={capacidadesRes.ok ? capacidadesRes.data.porRol : []}
      capacidadesPorUsuario={capacidadesRes.ok ? capacidadesRes.data.porUsuario : []}
      roles={(rolesRes.ok ? rolesRes.data : []).filter((r) => !r.esRolSistema)}
      colaboradores={(usuariosRes.ok ? usuariosRes.data : []).filter((u) => !u.esOwner)}
      mostrarSucursales={topeRes.ok && topeRes.data.maxSucursales !== 1}
    />
  );
}
