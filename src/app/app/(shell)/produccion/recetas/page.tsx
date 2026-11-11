import { redirect } from "next/navigation";
import {
  listarComposicionesDeRecetas,
  listarInsumos,
  listarRecetas,
} from "@/modules/operativo/nichos/nicho-1/actions";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { AvisoRecetas } from "./aviso-recetas";
import { RecetasCliente } from "./recetas-cliente";

export default async function RecetasPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  // Composicion completa de cada receta, cargada de una — evita un fetch client-side al
  // cambiar de seleccion en el maestro-detalle. Antes pedia la ficha de CADA receta por
  // separado (~3 consultas por receta); ahora es una sola consulta para todas.
  const [recetasResultado, insumosResultado, composicionesResultado] = await Promise.all([
    listarRecetas(usuario, usuario.tenantId),
    listarInsumos(usuario, usuario.tenantId),
    listarComposicionesDeRecetas(usuario, usuario.tenantId),
  ]);
  const recetas = recetasResultado.ok ? recetasResultado.data : [];
  const insumos = insumosResultado.ok ? insumosResultado.data : [];
  const composiciones = composicionesResultado.ok ? composicionesResultado.data : null;
  const insumoPorId = new Map(insumos.map((i) => [i.id, i]));

  return (
    <div className="min-h-screen bg-gray-bg p-6 xl:p-8">
      <div className="mx-auto max-w-6xl py-6">
        <AvisoRecetas />
        <RecetasCliente
          recetas={recetas.map((r) => {
            const composicion = (composiciones?.get(r.id) ?? []).map((c) => ({
              insumoId: c.insumoId,
              cantidadPorLote: c.cantidadPorLote,
              insumoNombre: c.insumoNombre,
            }));
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
