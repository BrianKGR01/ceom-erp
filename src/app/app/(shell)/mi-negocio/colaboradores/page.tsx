import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { listarRolesAction, listarUsuariosAction } from "../actions";
import { ColaboradoresCliente } from "./colaboradores-cliente";

export default async function ColaboradoresPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");
  if (!usuario.esOwner) redirect("/app");

  const [usuariosRes, rolesRes] = await Promise.all([listarUsuariosAction(), listarRolesAction()]);

  return (
    <ColaboradoresCliente
      usuarioActualId={usuario.id}
      colaboradores={usuariosRes.ok ? usuariosRes.data : []}
      roles={rolesRes.ok ? rolesRes.data : []}
    />
  );
}
