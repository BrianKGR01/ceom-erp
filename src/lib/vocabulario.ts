// Vocabulario de usuario para valores que vienen de la base de datos.
//
// Origen: docs/manual/glosario.md. La regla del glosario es "una decisión por
// término", pero algunos términos no viven en una cadena de JSX sino en una
// fila de la tabla `roles` — el nombre del rol se muestra tal cual en 6
// lugares de 3 pantallas distintas.
//
// Se traduce **al mostrar**, no renombrando el dato: cambiar `roles.nombre`
// en la base sería una migración con impacto en permisos y en los seeds, y el
// glosario pide cambiar lo que se ve, no los identificadores.

const ROLES_SISTEMA_VISIBLES: Record<string, string> = {
  Owner: "Dueño",
  "CEOM Admin": "Administrador CEOM",
};

/** Nombre de un rol tal como debe leerlo el usuario. Los roles que crea el
 * negocio se muestran tal cual los escribió su dueño. */
export function nombreRolVisible(nombre: string): string {
  return ROLES_SISTEMA_VISIBLES[nombre] ?? nombre;
}
