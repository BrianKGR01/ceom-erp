import { listarPlanesAction } from "./actions";
import { PlanesCliente } from "./planes-cliente";

export default async function PlanesPage() {
  const planes = await listarPlanesAction();

  return (
    <PlanesCliente
      planesIniciales={planes.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        precioMensual: p.precioMensual,
        moneda: p.moneda,
        incluyeSucursales: p.incluyeSucursales,
        permiteMultiplesOwners: p.permiteMultiplesOwners,
        permiteDowngradeAutogestionado: p.permiteDowngradeAutogestionado,
        duracionInvitacionDias: p.duracionInvitacionDias,
        duracionEtapaSoloLecturaDias: p.duracionEtapaSoloLecturaDias,
        modulosVeedorPermitidos: p.modulosVeedorPermitidos,
        activo: p.activo,
      }))}
    />
  );
}
