import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyOtp = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  crearClienteServidor: async () => ({ auth: { verifyOtp } }),
}));

import { GET } from "./route";

const BASE = "http://localhost:3000/app/auth/callback";

function pedir(query: string) {
  return GET(new Request(`${BASE}${query}`));
}

/** Next devuelve un 307 con Location; alcanza con leer el header. */
async function destinoDe(query: string) {
  const res = await pedir(query);
  return res.headers.get("location");
}

describe("callback de Auth de /app", () => {
  beforeEach(() => {
    verifyOtp.mockReset();
    verifyOtp.mockResolvedValue({ error: null });
  });

  it("canjea una invitacion y manda a fijar contraseña", async () => {
    expect(await destinoDe("?token_hash=abc123&type=invite")).toBe(
      "http://localhost:3000/app/definir-contrasena?motivo=invitacion"
    );
    expect(verifyOtp).toHaveBeenCalledWith({ type: "invite", token_hash: "abc123" });
  });

  it("canjea una recuperacion con el mismo destino pero otro motivo", async () => {
    expect(await destinoDe("?token_hash=abc123&type=recovery")).toBe(
      "http://localhost:3000/app/definir-contrasena?motivo=recuperacion"
    );
  });

  it("rechaza el enlace sin token", async () => {
    expect(await destinoDe("?type=invite")).toBe(
      "http://localhost:3000/login?error=enlace_invalido"
    );
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("rechaza un tipo que este proyecto no emite, sin canjearlo", async () => {
    expect(await destinoDe("?token_hash=abc123&type=email_change")).toBe(
      "http://localhost:3000/login?error=enlace_invalido"
    );
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("distingue el enlace vencido del invalido", async () => {
    verifyOtp.mockResolvedValue({ error: { code: "otp_expired", status: 403 } });
    expect(await destinoDe("?token_hash=abc123&type=recovery")).toBe(
      "http://localhost:3000/login?error=enlace_vencido"
    );

    verifyOtp.mockResolvedValue({ error: { code: "validation_failed", status: 400 } });
    expect(await destinoDe("?token_hash=abc123&type=recovery")).toBe(
      "http://localhost:3000/login?error=enlace_invalido"
    );
  });

  it("nunca deja pasar a la app cuando el canje falla", async () => {
    verifyOtp.mockResolvedValue({ error: { code: "otp_expired", status: 403 } });
    const destino = await destinoDe("?token_hash=abc123&type=invite");
    expect(destino).not.toContain("/app/");
  });
});
