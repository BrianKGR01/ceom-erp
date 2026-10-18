import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { hoyLocal, sumarDias, zonaHorariaTenant } from "@/lib/periodo";
import { listarSucursalesPorTenant, obtenerUsuarioActual } from "@/modules/identidad/actions";
import {
  consultarBajasPorMotivo,
  listarBajas,
  listarInsumos,
} from "@/modules/operativo/nichos/nicho-1/actions";
import { listarProductos } from "@/modules/productos/actions";
import { BajasCliente } from "./bajas-cliente";

export default async function BajasPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  // Ultimos 7 dias segun el dia del negocio (no el UTC del servidor).
  const zona = await zonaHorariaTenant(usuario.tenantId);
  const hoy = hoyLocal(zona);
  const periodo = { desde: sumarDias(hoy, -6), hasta: hoy };

  const [sucursalesRes, insumosRes, productosRes, bajasRes, resumenRes] = await Promise.all([
    listarSucursalesPorTenant(usuario, usuario.tenantId),
    listarInsumos(usuario, usuario.tenantId),
    listarProductos(usuario, usuario.tenantId),
    listarBajas(usuario, usuario.tenantId, periodo),
    consultarBajasPorMotivo(usuario, usuario.tenantId, periodo),
  ]);

  const insumos = insumosRes.ok ? insumosRes.data : [];
  const productos = productosRes.ok ? productosRes.data : [];
  const nombreProducto = new Map(productos.map((p) => [p.id, p.nombre]));
  const sucursales = sucursalesRes.ok ? sucursalesRes.data : [];
  const nombreSucursal = new Map(sucursales.map((s) => [s.id, s.nombre]));

  return (
    <div className="min-h-screen bg-gray-bg p-6 xl:p-8">
      <div className="mx-auto max-w-6xl space-y-6 py-6">
        <PageHeader
          title="Bajas"
          description="Pérdidas que no son una venta: leche derramada, un café mal preparado, un insumo vencido."
        />

        <BajasCliente
          sucursales={sucursales.filter((s) => !s.congeladaEn).map((s) => ({ id: s.id, nombre: s.nombre }))}
          insumos={insumos.map((i) => ({ id: i.id, nombre: i.nombre, unidadMedida: i.unidadMedida }))}
          productos={productos.map((p) => ({ id: p.id, nombre: p.nombre }))}
          bajas={(bajasRes.ok ? bajasRes.data : []).map((b) => ({
            id: b.id,
            fecha: b.creadoEn.toISOString(),
            sucursal: nombreSucursal.get(b.sucursalId) ?? "",
            tipo: b.tipo,
            nombre:
              b.tipo === "insumo"
                ? (b.insumoNombre ?? "Insumo")
                : (nombreProducto.get(b.productoId ?? "") ?? "Producto"),
            cantidad: b.cantidad,
            motivo: b.motivo,
            nota: b.nota,
            costoTotal: b.costoTotal,
            costoDesconocido: b.costoDesconocido,
          }))}
          resumen={
            resumenRes.ok
              ? {
                  costoTotal: resumenRes.data.costoTotal,
                  bajasSinCostoConocido: resumenRes.data.bajasSinCostoConocido,
                }
              : null
          }
        />
      </div>
    </div>
  );
}
