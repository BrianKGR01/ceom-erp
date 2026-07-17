"use server";

import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { listarLogsAcceso } from "@/modules/consentimiento/actions";

export async function listarLogsAccesoAction(opts: { tenantId?: string; desde?: string; hasta?: string } = {}) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario)
    return { ok: false as const, error: "Tu sesión expiró — iniciá sesión de nuevo." };
  return listarLogsAcceso(usuario, opts);
}
