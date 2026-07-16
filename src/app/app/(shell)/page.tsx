import { redirect } from "next/navigation";
import { obtenerTenantPorId, obtenerUsuarioActual } from "@/modules/identidad/actions";
import { listarProductos } from "@/modules/productos/actions";
import { InicioContenido } from "./inicio-contenido";

// Inicio de /app — mientras no exista el Dashboard real (Resumen
// Ejecutivo, Modulo 14), esta pantalla prioriza guiar al Owner a cargar su
// primer producto (unico paso real y disponible hoy — Proveedores y
// Patrimonio todavia no tienen pantalla propia, no se linkean acá).
export default async function AppHomePage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const [productosResultado, tenantResultado] = await Promise.all([
    listarProductos(usuario, usuario.tenantId),
    obtenerTenantPorId(usuario, usuario.tenantId),
  ]);
  const tieneProductos = productosResultado.ok && productosResultado.data.length > 0;
  const nombreNegocio = tenantResultado.ok ? tenantResultado.data.nombreNegocio : usuario.nombreCompleto;

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-5xl space-y-6 py-6">
        <InicioContenido
          tenantId={usuario.tenantId}
          nombreNegocio={nombreNegocio}
          tieneProductos={tieneProductos}
        />
      </div>
    </div>
  );
}
