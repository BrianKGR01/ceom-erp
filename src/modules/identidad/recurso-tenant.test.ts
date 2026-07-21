import { describe, expect, it } from "vitest";
import { recursoPerteneceAlTenant } from "./actions";
import type { UsuarioConRol } from "./actions";
import { ROL_CEOM_ADMIN_ID } from "./constants";

// Guard de aislamiento de tenant — la red que ataja la clase de bug de la
// auditoría de autorización (docs/security/AUDITORIA-AUTORIZACION.md): toda
// función por-id debe atar el recurso a este guard. Este test falla si
// alguien afloja su lógica. No necesita DB (el guard es puro).

const TENANT_A = "00000000-0000-0000-0000-00000000000a";
const TENANT_B = "00000000-0000-0000-0000-00000000000b";

function usuario(opts: {
  tenantId: string;
  rolId?: string;
  esRolSistema?: boolean;
}): UsuarioConRol {
  return {
    id: "usuario-test",
    tenantId: opts.tenantId,
    rolId: opts.rolId ?? "rol-normal",
    esOwner: true,
    rol: { esRolSistema: opts.esRolSistema ?? false },
  } as unknown as UsuarioConRol;
}

describe("recursoPerteneceAlTenant", () => {
  it("acepta un recurso del mismo tenant", () => {
    expect(recursoPerteneceAlTenant(usuario({ tenantId: TENANT_A }), TENANT_A)).toBe(true);
  });

  it("rechaza un recurso de otro tenant (la clase de bug de la auditoría)", () => {
    expect(recursoPerteneceAlTenant(usuario({ tenantId: TENANT_A }), TENANT_B)).toBe(false);
  });

  it("rechaza un recurso de sistema (tenantId null) — no pertenece a ningún tenant", () => {
    expect(recursoPerteneceAlTenant(usuario({ tenantId: TENANT_A }), null)).toBe(false);
  });

  it("rechaza tenantId undefined", () => {
    expect(recursoPerteneceAlTenant(usuario({ tenantId: TENANT_A }), undefined)).toBe(false);
  });

  it("ceom_admin puede cross-tenant (bypass, mismo criterio que tienePermiso)", () => {
    const admin = usuario({ tenantId: TENANT_A, rolId: ROL_CEOM_ADMIN_ID, esRolSistema: true });
    expect(recursoPerteneceAlTenant(admin, TENANT_B)).toBe(true);
  });

  it("un rol de sistema que NO es ceom_admin no bypassea", () => {
    const otroSistema = usuario({ tenantId: TENANT_A, rolId: "otro-rol-sistema", esRolSistema: true });
    expect(recursoPerteneceAlTenant(otroSistema, TENANT_B)).toBe(false);
  });
});
