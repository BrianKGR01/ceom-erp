import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { PageHeader } from "@/components/shared/page-header";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import {
  VENTAS_POR_PAGINA,
  listarCanalesVenta,
  listarPaginaHistorialVentas,
} from "@/modules/ventas/actions";
import { HistorialCliente } from "./historial-cliente";

const ESTADOS = ["pendiente", "parcial", "pagado"] as const;
type EstadoPago = (typeof ESTADOS)[number];

function primero(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? "";
}

export default async function HistorialVentasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  // Los filtros y la pagina viajan en la URL: el servidor trae SOLO esa pagina, ya filtrada.
  // Antes el navegador recibia las ventas completas del tenant y filtraba en memoria.
  const params = await searchParams;
  const estadoCrudo = primero(params.estado);
  const estado = (ESTADOS as readonly string[]).includes(estadoCrudo)
    ? (estadoCrudo as EstadoPago)
    : undefined;
  const canalCrudo = primero(params.canal);
  const busqueda = primero(params.q).slice(0, 80);
  const paginaPedida = Number.parseInt(primero(params.pagina), 10);
  const pagina = Number.isFinite(paginaPedida) && paginaPedida > 0 ? paginaPedida : 1;

  const canalesResultado = await listarCanalesVenta(usuario, usuario.tenantId);
  const canales = canalesResultado.ok ? canalesResultado.data : [];
  // Un canal que no es del tenant se ignora en vez de filtrar por el.
  const canalVentaId = canales.some((c) => c.id === canalCrudo) ? canalCrudo : undefined;

  const paginaResultado = await listarPaginaHistorialVentas(usuario, usuario.tenantId, {
    pagina,
    porPagina: VENTAS_POR_PAGINA,
    filtros: { estadoPago: estado, canalVentaId, busquedaCliente: busqueda || undefined },
  });

  const datos = paginaResultado.ok
    ? paginaResultado.data
    : { ventas: [], cantidadTotal: 0, pagina: 1, porPagina: VENTAS_POR_PAGINA };
  const canalPorId = new Map(canales.map((c) => [c.id, c.nombre]));

  return (
    <div className="min-h-screen bg-gray-bg p-6 xl:p-8">
      <div className="mx-auto max-w-4xl space-y-4 py-6">
        <Breadcrumb items={[{ label: "Ventas", href: "/app/ventas" }, { label: "Historial de ventas" }]} />
        <PageHeader title="Historial de ventas" description="Todas tus ventas registradas." />

        {!paginaResultado.ok && (
          <p className="rounded-2xl bg-card p-4 text-sm text-text-muted shadow-card">
            {paginaResultado.error}
          </p>
        )}

        <HistorialCliente
          canales={canales.map((c) => ({ id: c.id, nombre: c.nombre }))}
          filtros={{ estado: estado ?? "todas", canalId: canalVentaId ?? "todos", busqueda }}
          pagina={datos.pagina}
          porPagina={datos.porPagina}
          cantidadTotal={datos.cantidadTotal}
          ventas={datos.ventas.map((venta) => ({
            id: venta.id,
            fechaVenta: venta.fechaVenta.toString(),
            clienteNombre: venta.clienteId ? (venta.clienteNombre ?? "Cliente") : "Sin cliente",
            canalId: venta.canalVentaId,
            canalNombre: canalPorId.get(venta.canalVentaId) ?? "—",
            estadoPago: venta.estadoPago,
            total: Number(venta.total),
          }))}
        />
      </div>
    </div>
  );
}
