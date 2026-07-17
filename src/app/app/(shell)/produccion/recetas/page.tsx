import { redirect } from "next/navigation";
import {
  fichaReceta,
  listarInsumos,
  listarRecetas,
} from "@/modules/operativo/nichos/nicho-1/actions";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { RecetasCliente } from "./recetas-cliente";

export default async function RecetasPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const [recetasResultado, insumosResultado] = await Promise.all([
    listarRecetas(usuario, usuario.tenantId),
    listarInsumos(usuario, usuario.tenantId),
  ]);
  const recetas = recetasResultado.ok ? recetasResultado.data : [];
  const insumos = insumosResultado.ok ? insumosResultado.data : [];

  // Composicion completa de cada receta, cargada de una — evita un
  // fetch client-side al cambiar de seleccion en el maestro-detalle
  // (mismo criterio que fichaProveedor() por fila en el Directorio de
  // Proveedores).
  const fichas = await Promise.all(recetas.map((r) => fichaReceta(usuario, r.id)));
  const insumoPorId = new Map(insumos.map((i) => [i.id, i]));

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-6xl py-6">
        <RecetasCliente
          recetas={recetas.map((r, index) => {
            const ficha = fichas[index];
            const composicion =
              ficha.ok && ficha.data.composicion
                ? ficha.data.composicion.map((c) => ({
                    insumoId: c.insumoId,
                    cantidadPorLote: c.cantidadPorLote,
                    insumoNombre: c.insumoNombre,
                  }))
                : [];
            return {
              id: r.id,
              nombre: r.nombre,
              rendimientoPorLote: r.rendimientoPorLote,
              unidadRendimiento: r.unidadRendimiento,
              composicion,
            };
          })}
          insumos={insumos.map((i) => ({
            id: i.id,
            nombre: i.nombre,
            unidadMedida: insumoPorId.get(i.id)?.unidadMedida ?? "unidad",
          }))}
        />
      </div>
    </div>
  );
}
