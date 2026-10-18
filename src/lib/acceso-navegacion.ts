/**
 * Que pantallas de /app ve cada usuario, segun sus permisos de rol.
 *
 * UNA sola tabla ("ruta -> permiso") la usan el menu lateral y la pantalla "no podes entrar
 * aca", asi que no pueden contradecirse: lo que el menu oculta, la pantalla lo bloquea.
 *
 * **Esto es presentacion, no seguridad.** El servidor sigue exigiendo el permiso en cada
 * accion (`tienePermiso`); esto solo evita mostrar pantallas vacias o formularios que van a
 * fallar al guardar. Una ruta sin regla (Inicio, Mi cuenta) la ve cualquiera.
 */

export interface PermisosPropios {
  /** Dueño: tiene todo, no hace falta la lista. */
  todos: boolean;
  /** "modulo.accion" que el rol tiene permitidos. */
  permitidos: string[];
}

export interface ReglaAcceso {
  prefijo: string;
  /** Todos estos permisos hacen falta. */
  requiere?: string[];
  /** Solo el dueño (gestion del negocio y del consentimiento). */
  soloDueno?: boolean;
}

export const REGLAS_ACCESO: ReglaAcceso[] = [
  { prefijo: "/app/ventas", requiere: ["ventas.ver"] },
  { prefijo: "/app/productos", requiere: ["productos.ver"] },
  { prefijo: "/app/patrimonio", requiere: ["patrimonio.ver"] },
  { prefijo: "/app/proveedores", requiere: ["proveedores.ver"] },
  { prefijo: "/app/gastos", requiere: ["costos_gastos.ver"] },
  { prefijo: "/app/produccion", requiere: ["operativo.ver"] },
  // El resumen operativo muestra ventas ademas de produccion.
  { prefijo: "/app/produccion/resumen", requiere: ["operativo.ver", "ventas.ver"] },
  { prefijo: "/app/caja", requiere: ["ventas.ver"] },
  { prefijo: "/app/simulaciones", requiere: ["simulaciones.ver"] },
  { prefijo: "/app/reportes", requiere: ["reportes.ver"] },
  { prefijo: "/app/mi-negocio", soloDueno: true },
  { prefijo: "/app/consentimiento", soloDueno: true },
];

/** La regla mas especifica que cubre la ruta (por segmentos: /app/caja no cubre /app/cajas). */
export function reglaDeRuta(pathname: string): ReglaAcceso | null {
  let mejor: ReglaAcceso | null = null;
  for (const regla of REGLAS_ACCESO) {
    const cubre = pathname === regla.prefijo || pathname.startsWith(`${regla.prefijo}/`);
    if (cubre && (!mejor || regla.prefijo.length > mejor.prefijo.length)) mejor = regla;
  }
  return mejor;
}

export function puedeEntrar(
  pathname: string,
  permisos: PermisosPropios,
  esOwner: boolean
): boolean {
  const regla = reglaDeRuta(pathname);
  if (!regla) return true;
  if (esOwner || permisos.todos) return true;
  if (regla.soloDueno) return false;
  return (regla.requiere ?? []).every((p) => permisos.permitidos.includes(p));
}
