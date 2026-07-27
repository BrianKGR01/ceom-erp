import { redirect } from "next/navigation";
import { listarSucursalesPorTenant, obtenerTenantPorId, obtenerUsuarioActual } from "@/modules/identidad/actions";
import { listarProductos } from "@/modules/productos/actions";
import { construirDashboard, obtenerCapacidadAlmacenamientoWidget } from "./inicio-actions";
import { InicioContenido } from "./inicio-contenido";
import { calcularRangoPreset, zonaHorariaTenant } from "@/lib/periodo";

// Inicio de /app — checklist de sub-onboarding mientras el tenant no
// tiene productos (o hasta que se cierre a mano), Dashboard real
// (Modulo 14) apenas eso pasa. Los datos del Dashboard se resuelven acá
// (server-side, periodo "Este mes" por defecto) para que la primera
// carga no tenga flash de loading — el cierre manual del checklist vive
// en localStorage, el server no lo puede saber, así que siempre se
// calculan (si el tenant no tiene datos, simplemente da 0/vacío, barato).
export default async function AppHomePage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");
  const zona = await zonaHorariaTenant(usuario.tenantId);

  const [productosResultado, tenantResultado, sucursalesResultado] = await Promise.all([
    listarProductos(usuario, usuario.tenantId),
    obtenerTenantPorId(usuario, usuario.tenantId),
    listarSucursalesPorTenant(usuario, usuario.tenantId),
  ]);
  const tieneProductos = productosResultado.ok && productosResultado.data.length > 0;
  // H-15: el checklist de inicio se daba por cumplido con el primer producto,
  // tuviera costo o no. Este contador habilita el segundo paso.
  const productosSinCosto = productosResultado.ok
    ? productosResultado.data.filter((p) => p.activo && p.costoOperativoVigente === null).length
    : 0;
  const nombreNegocio = tenantResultado.ok ? tenantResultado.data.nombreNegocio : usuario.nombreCompleto;
  const sucursales = sucursalesResultado.ok ? sucursalesResultado.data : [];

  const [datosInicialesRes, capacidadAlmacenamiento] = await Promise.all([
    construirDashboard(calcularRangoPreset("mes", zona)),
    obtenerCapacidadAlmacenamientoWidget(),
  ]);
  // usuario ya se validó arriba — este resultado solo puede fallar en la
  // sesión (revocada entre esa validación y esta llamada, milisegundos
  // después); ante esa carrera, mismo destino que el chequeo original.
  if (!datosInicialesRes.ok) redirect("/login");
  const datosIniciales = datosInicialesRes.data;

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-5xl space-y-6 py-6">
        <InicioContenido
          tenantId={usuario.tenantId}
          nombreNegocio={nombreNegocio}
          tieneProductos={tieneProductos}
          productosSinCosto={productosSinCosto}
          sucursales={sucursales.map((s) => ({ id: s.id, nombre: s.nombre }))}
          datosIniciales={datosIniciales}
          capacidadAlmacenamiento={capacidadAlmacenamiento}
          zona={zona}
        />
      </div>
    </div>
  );
}
