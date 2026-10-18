import Link from "next/link";
import { redirect } from "next/navigation";
import { Package } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import {
  listarSucursalesPorTenant,
  obtenerUsuarioActual,
  tieneCapacidadEspecial,
} from "@/modules/identidad/actions";
import {
  listarModificadoresParaVenta,
  listarProductosAlVender,
  listarProductosConRecetaIncompleta,
} from "@/modules/operativo/actions";
import { listarCategorias, listarProductos, listarStockPorSucursal } from "@/modules/productos/actions";
import {
  listarCanalesVenta,
  listarClientes,
  listarEventos,
  listarMetodosPago,
} from "@/modules/ventas/actions";
import { estadoDeCajas, puedeOperarSinTurno } from "@/modules/caja/actions";
import { PosCliente } from "./pos-cliente";

export default async function PuntoDeVentaPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const [
    productosResultado,
    sucursalesResultado,
    clientesResultado,
    canalesResultado,
    metodosResultado,
    categoriasResultado,
    eventosResultado,
  ] = await Promise.all([
    listarProductos(usuario, usuario.tenantId),
    listarSucursalesPorTenant(usuario, usuario.tenantId),
    listarClientes(usuario, usuario.tenantId),
    listarCanalesVenta(usuario, usuario.tenantId),
    listarMetodosPago(usuario, usuario.tenantId),
    listarCategorias(usuario, usuario.tenantId),
    listarEventos(usuario, usuario.tenantId),
  ]);

  const productosActivos = (productosResultado.ok ? productosResultado.data : []).filter((p) => p.activo);
  const sucursales = sucursalesResultado.ok ? sucursalesResultado.data : [];
  const clientes = clientesResultado.ok ? clientesResultado.data : [];
  const canales = canalesResultado.ok ? canalesResultado.data : [];
  const metodos = metodosResultado.ok ? metodosResultado.data : [];
  const categorias = categoriasResultado.ok ? categoriasResultado.data : [];
  const eventos = (eventosResultado.ok ? eventosResultado.data : []).filter(
    (e) => e.estado === "abierto"
  );

  const sucursalPrincipal = sucursales.find((s) => s.esPrincipal) ?? sucursales[0];

  // Fase 3 Cafiatto: que se prepara al vender y que modificadores ofrece cada producto.
  const [alVenderResultado, incompletosResultado] = await Promise.all([
    listarProductosAlVender(usuario, usuario.tenantId),
    listarProductosConRecetaIncompleta(usuario, usuario.tenantId),
  ]);
  // Fase 6: lo que se prepara al vender con la receta vacia no se ofrece (no descontaria ni costaria nada).
  const recetaIncompleta = new Set(incompletosResultado.ok ? incompletosResultado.data : []);
  const productos = productosActivos.filter((p) => !recetaIncompleta.has(p.id));
  const modificadoresResultado = await listarModificadoresParaVenta(
    usuario,
    usuario.tenantId,
    productos.map((p) => p.id)
  );
  const alVender = new Set(alVenderResultado.ok ? alVenderResultado.data : []);

  // Fase 5 Cafiatto: que motivos de bonificacion ofrece la pantalla (el servidor los exige igual).
  const [puedeConsumoPersonal, puedeCortesia] = await Promise.all([
    tieneCapacidadEspecial(usuario, "bonificar_consumo_personal"),
    tieneCapacidadEspecial(usuario, "bonificar_cortesia"),
  ]);

  // Fase 4 Cafiatto: estado de la caja en la sucursal donde se vende.
  const cajasResultado = await estadoDeCajas(usuario, usuario.tenantId);
  const cajaDeLaSucursal =
    cajasResultado.ok && cajasResultado.data.habilitada
      ? cajasResultado.data.cajas.filter((c) => c.sucursalId === sucursalPrincipal?.id)
      : [];
  const turnoAbierto = cajaDeLaSucursal.find((c) => c.turno)?.turno ?? null;
  // Excepcion administrativa: el dueño/administrador puede vender sin turno aunque se exija.
  const sinTurnoPermitido = await puedeOperarSinTurno(usuario, usuario.tenantId);
  const caja =
    cajasResultado.ok && cajasResultado.data.habilitada
      ? {
          exigirTurno: cajasResultado.data.exigirTurno,
          puedeVenderSinTurno: sinTurnoPermitido,
          turnoNumero: turnoAbierto?.numero ?? null,
          cajaNombre: cajaDeLaSucursal.find((c) => c.turno)?.nombre ?? cajaDeLaSucursal[0]?.nombre ?? "Caja",
        }
      : null;
  const modificadoresPorProducto = modificadoresResultado.ok ? modificadoresResultado.data : {};

  // H-37: el stock de cada producto, en una sola consulta. Sin permiso de ver
  // inventario la pantalla no muestra números — no inventa un "0".
  const stockResultado = sucursalPrincipal
    ? await listarStockPorSucursal(usuario, usuario.tenantId, sucursalPrincipal.id)
    : null;
  const stockPorProducto = stockResultado?.ok
    ? Object.fromEntries(stockResultado.data.map((s) => [s.productoId, s.cantidadActual]))
    : null;

  return (
    <div className="min-h-screen bg-gray-bg p-6 xl:p-8">
      <div className="mx-auto max-w-5xl space-y-6 py-6">
        <PageHeader
          title="Vender"
          description="Elegí los productos y confirmá la venta."
          action={
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium">
              <Link href="/app/ventas/historial" className="text-primary hover:underline">
                Historial
              </Link>
              <Link href="/app/ventas/clientes" className="text-primary hover:underline">
                Clientes
              </Link>
              <Link href="/app/ventas/canales" className="text-primary hover:underline">
                Canales
              </Link>
              <Link href="/app/ventas/metodos-pago" className="text-primary hover:underline">
                Métodos de pago
              </Link>
              <Link href="/app/ventas/eventos" className="text-primary hover:underline">
                Eventos
              </Link>
              <Link href="/app/ventas/importar" className="text-primary hover:underline">
                Importar historial
              </Link>
            </div>
          }
        />

        {productos.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Todavía no tenés productos para vender"
            description="Cargá tu primer producto para poder empezar a vender."
            action={{ label: "Cargar producto", href: "/app/productos/nuevo" }}
          />
        ) : !sucursalPrincipal ? (
          <p className="text-sm text-text-muted">
            Tu negocio todavía no tiene una sucursal configurada.
          </p>
        ) : (
          <PosCliente
            sucursalId={sucursalPrincipal.id}
            stockPorProducto={stockPorProducto}
            productos={productos.map((p) => ({
              id: p.id,
              categoriaId: p.categoriaId,
              nombre: p.nombre,
              imagenUrl: p.imagenUrl,
              unidadVenta: p.unidadVenta,
              precioVenta: p.precioVenta,
              costoOperativoVigente: p.costoOperativoVigente,
              grupoVariantes: p.grupoVariantes,
              etiquetaVariante: p.etiquetaVariante,
              alVender: alVender.has(p.id),
            }))}
            modificadoresPorProducto={modificadoresPorProducto}
            caja={caja}
            puedeBonificar={{ consumoPersonal: puedeConsumoPersonal, cortesia: puedeCortesia }}
            categorias={categorias.map((c) => ({ id: c.id, nombre: c.nombre }))}
            clientesIniciales={clientes.map((c) => ({ id: c.id, nombre: c.nombre }))}
            canalesIniciales={canales.map((c) => ({ id: c.id, nombre: c.nombre }))}
            metodosIniciales={metodos.map((m) => ({ id: m.id, nombre: m.nombre }))}
            eventosIniciales={eventos.map((e) => ({ id: e.id, nombre: e.nombre }))}
          />
        )}
      </div>
    </div>
  );
}
