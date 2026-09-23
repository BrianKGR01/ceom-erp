import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProductForm } from "./product-form";

/**
 * El costo de un producto con receta se muestra bloqueado. Antes se bloqueaba
 * solo con el atributo HTML `disabled`, que react-hook-form ignora: el valor
 * cargado al abrir el formulario se enviaba igual, y el servidor rechazaba
 * todo el guardado (reporte de CAFIATTO del 2026-09-23: no podían cambiarle el
 * precio a ningún café). El bloqueo tiene que ir en `register(...)`.
 */
function renderForm(costoBloqueado: boolean, onSubmit = vi.fn().mockResolvedValue({ ok: true })) {
  render(
    <ProductForm
      mode="editar"
      initialValues={{ nombre: "LATTE", unidadVenta: "unidad", precioVenta: 12, costoOperativoVigente: 5.997, activo: true }}
      categorias={[]}
      sucursales={[{ id: "suc-1", nombre: "Principal" }]}
      costoBloqueado={costoBloqueado}
      onSubirImagen={vi.fn()}
      onSubmit={onSubmit}
    />
  );
  return onSubmit;
}

async function cambiarPrecioYGuardar(precio: string) {
  fireEvent.change(screen.getByLabelText("Precio de venta"), { target: { value: precio } });
  fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
}

describe("ProductForm — costo bloqueado de un producto con receta", () => {
  it("con el costo bloqueado: se ve, está deshabilitado, y NO viaja al guardar", async () => {
    const onSubmit = renderForm(true);
    const costo = screen.getByLabelText(/^Costo por/) as HTMLInputElement;
    expect(costo).toBeDisabled();
    expect(costo.value).toBe("5.997");

    await cambiarPrecioYGuardar("13");

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const enviado = onSubmit.mock.calls[0][0];
    expect(enviado.precioVenta).toBe(13);
    expect(enviado.costoOperativoVigente).toBeUndefined();
  });

  it("control: con el costo editable, el costo sí viaja", async () => {
    const onSubmit = renderForm(false);

    await cambiarPrecioYGuardar("13");

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].costoOperativoVigente).toBe(5.997);
  });
});
