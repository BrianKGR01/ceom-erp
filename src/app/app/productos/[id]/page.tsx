import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { listarSucursalesPorTenant, obtenerUsuarioActual } from "@/modules/identidad/actions";
import { fichaProducto } from "@/modules/productos/actions";
import { FichaCliente } from "./ficha-cliente";

export default async function FichaProductoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const [fichaResultado, sucursalesResultado] = await Promise.all([
    fichaProducto(usuario, id),
    listarSucursalesPorTenant(usuario, usuario.tenantId),
  ]);

  if (!fichaResultado.ok || !fichaResultado.data.producto) redirect("/app/productos");
  const { producto, stockPorSucursal } = fichaResultado.data;
  const sucursales = sucursalesResultado.ok ? sucursalesResultado.data : [];

  const precio = Number(producto!.precioVenta);
  const costo =
    producto!.costoOperativoVigente !== null ? Number(producto!.costoOperativoVigente) : null;
  const margenPct = costo !== null && precio > 0 ? ((precio - costo) / precio) * 100 : null;

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-2xl space-y-6 py-6">
        <PageHeader
          title={producto!.nombre}
          description={producto!.activo ? "Visible para la venta" : "Oculto del catálogo"}
        />

        <Card>
          <CardHeader>
            <CardDescription>Precio y margen</CardDescription>
            <CardTitle>
              {precio.toFixed(2)}{" "}
              <span className="text-sm font-normal text-text-muted">/ {producto!.unidadVenta}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            {costo !== null ? (
              <span className="text-sm text-text-muted">Costo: {costo.toFixed(2)}</span>
            ) : (
              <span className="text-sm text-text-muted">Sin costo cargado</span>
            )}
            {margenPct !== null && <Badge variant="success">{margenPct.toFixed(0)}% margen</Badge>}
          </CardContent>
        </Card>

        <FichaCliente
          productoId={id}
          stockPorSucursal={stockPorSucursal.map((f) => ({
            sucursalId: f.sucursalId,
            cantidadActual: f.cantidadActual,
            stockMinimo: f.stockMinimo,
          }))}
          sucursales={sucursales.map((s) => ({ id: s.id, nombre: s.nombre }))}
        />
      </div>
    </div>
  );
}
