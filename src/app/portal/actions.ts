"use server";

import { canjearCodigoAcceso } from "@/modules/consentimiento/actions";
import type { DatosInstitucion } from "@/modules/consentimiento/actions";

export async function canjearCodigoAccesoAction(input: {
  codigo: string;
  institucionNueva: DatosInstitucion;
}) {
  return canjearCodigoAcceso(input);
}
