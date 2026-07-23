import { describe, expect, it } from "vitest";
import {
  contrasenaNuevaSchema,
  LARGO_MINIMO_CONTRASENA,
  mensajeErrorContrasena,
} from "./contrasena";

describe("contrasenaNuevaSchema", () => {
  it("acepta una contraseña larga y repetida igual", () => {
    const r = contrasenaNuevaSchema.safeParse({
      contrasena: "unaClaveLarga1",
      confirmacion: "unaClaveLarga1",
    });
    expect(r.success).toBe(true);
  });

  it("rechaza la que no llega al largo minimo", () => {
    const r = contrasenaNuevaSchema.safeParse({ contrasena: "corta", confirmacion: "corta" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toContain(String(LARGO_MINIMO_CONTRASENA));
  });

  it("rechaza cuando las dos no coinciden", () => {
    const r = contrasenaNuevaSchema.safeParse({
      contrasena: "unaClaveLarga1",
      confirmacion: "otraClaveLarga1",
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toBe("Las dos contraseñas no coinciden.");
  });
});

describe("mensajeErrorContrasena", () => {
  it("traduce los codigos conocidos de Supabase", () => {
    expect(mensajeErrorContrasena({ code: "same_password" })).toContain("distinta");
    expect(mensajeErrorContrasena({ code: "weak_password" })).toContain("adivinar");
  });

  it("no filtra el mensaje crudo de Supabase cuando el codigo es desconocido", () => {
    const mensaje = mensajeErrorContrasena({
      code: "algo_nuevo",
      message: "Database error updating user",
    });
    expect(mensaje).not.toContain("Database");
    expect(mensaje).toBe("No pudimos guardar la contraseña — intentá de nuevo.");
  });
});
