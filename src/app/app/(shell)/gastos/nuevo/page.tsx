import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listarCategoriasGasto, listarCategoriasGastoSugeridas } from "@/modules/gastos/actions";
import { obtenerUsuarioActual } from "@/modules/identidad/actions";
import { listarProveedores } from "@/modules/proveedores/actions";
import { NuevoGastoCliente } from "./nuevo-gasto-cliente";

export default async function NuevoGastoPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  const [categoriasResultado, proveedoresResultado, categoriasSugeridas] = await Promise.all([
    listarCategoriasGasto(usuario, usuario.tenantId),
    listarProveedores(usuario, usuario.tenantId),
    listarCategoriasGastoSugeridas({ soloActivas: true }),
  ]);
  const categorias = categoriasResultado.ok ? categoriasResultado.data : [];
  const proveedores = proveedoresResultado.ok ? proveedoresResultado.data : [];

  return (
    <div className="min-h-screen bg-gray-bg p-6">
      <div className="mx-auto max-w-2xl space-y-4 py-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" render={<Link href="/app/gastos" />} nativeButton={false}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="font-heading text-xl font-semibold text-navy">Registrar Gasto</h1>
            <p className="text-sm text-text-muted">Ingresá los detalles del nuevo movimiento.</p>
          </div>
        </div>

        <NuevoGastoCliente
          categorias={categorias.map((c) => ({ id: c.id, nombre: c.nombre }))}
          proveedores={proveedores.map((p) => ({ id: p.id, nombre: p.nombre }))}
          categoriasSugeridas={categoriasSugeridas.map((c) => ({ id: c.id, nombre: c.nombre }))}
        />
      </div>
    </div>
  );
}
