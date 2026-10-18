import { describe, expect, it } from "vitest";
import { puedeEntrar, reglaDeRuta, type PermisosPropios } from "./acceso-navegacion";

const cajero: PermisosPropios = {
  todos: false,
  permitidos: ["ventas.ver", "ventas.crear", "productos.ver", "productos.crear", "inventario.ver"],
};
const dueno: PermisosPropios = { todos: true, permitidos: [] };

describe("acceso a pantallas por permisos", () => {
  it("el cajero entra a Vender, Caja y Catalogo, no a Produccion ni al Resumen", () => {
    expect(puedeEntrar("/app/ventas", cajero, false)).toBe(true);
    expect(puedeEntrar("/app/ventas/historial", cajero, false)).toBe(true);
    expect(puedeEntrar("/app/caja/turnos/abc", cajero, false)).toBe(true);
    expect(puedeEntrar("/app/productos/nuevo", cajero, false)).toBe(true);
    expect(puedeEntrar("/app/produccion", cajero, false)).toBe(false);
    expect(puedeEntrar("/app/produccion/insumos", cajero, false)).toBe(false);
    expect(puedeEntrar("/app/produccion/resumen", cajero, false)).toBe(false);
  });

  it("el resumen operativo pide operativo Y ventas", () => {
    const soloOperativo: PermisosPropios = { todos: false, permitidos: ["operativo.ver"] };
    const ambos: PermisosPropios = { todos: false, permitidos: ["operativo.ver", "ventas.ver"] };
    expect(puedeEntrar("/app/produccion/insumos", soloOperativo, false)).toBe(true);
    expect(puedeEntrar("/app/produccion/resumen", soloOperativo, false)).toBe(false);
    expect(puedeEntrar("/app/produccion/resumen", ambos, false)).toBe(true);
  });

  it("Mi negocio y Compartir datos son solo del dueño", () => {
    expect(puedeEntrar("/app/mi-negocio/roles", cajero, false)).toBe(false);
    expect(puedeEntrar("/app/consentimiento", cajero, false)).toBe(false);
    expect(puedeEntrar("/app/mi-negocio/roles", dueno, true)).toBe(true);
  });

  it("Inicio y Mi cuenta no tienen regla: los ve cualquiera", () => {
    const nadie: PermisosPropios = { todos: false, permitidos: [] };
    expect(puedeEntrar("/app", nadie, false)).toBe(true);
    expect(puedeEntrar("/app/mi-cuenta", nadie, false)).toBe(true);
  });

  it("el dueño entra a todo", () => {
    for (const ruta of ["/app/produccion/bajas", "/app/gastos", "/app/reportes", "/app/caja"]) {
      expect(puedeEntrar(ruta, dueno, true)).toBe(true);
    }
  });

  it("la regla se busca por segmentos, no por texto", () => {
    expect(reglaDeRuta("/app/cajas")).toBeNull();
    expect(reglaDeRuta("/app/caja")?.prefijo).toBe("/app/caja");
    expect(reglaDeRuta("/app/produccion/resumen")?.prefijo).toBe("/app/produccion/resumen");
  });
});
