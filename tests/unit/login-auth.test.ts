import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { requestMagicLink } from "../../lib/magic-link";

describe("requestMagicLink security & error integrity", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns auth_unavailable on HTTP 500 in real /login route, NEVER simulated success", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: "Internal Server Error" }),
    });

    const result = await requestMagicLink("dono@studio.com", "/login");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("auth_unavailable");
      expect(result.message).toContain("indisponível");
    }
  });

  it("returns unknown error on network / SMTP failure in real /login route, NEVER simulated success", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network connection refused"));

    const result = await requestMagicLink("dono@studio.com", "/login");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("unknown");
      expect(result.message).toContain("Sem conexão com o servidor");
    }
  });

  it("returns invalid_email on 400 client error", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: "E-mail inválido ou domínio não permitido" }),
    });

    const result = await requestMagicLink("invalido@teste", "/login");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid_email");
      expect(result.message).toBe("E-mail inválido ou domínio não permitido");
    }
  });

  it("returns ok: true on real 200 HTTP response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: true }),
    });

    const result = await requestMagicLink("dono@studio.com", "/login");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.simulated).toBeUndefined();
    }
  });

  it("posts same-origin to the app's Better Auth route with a relative callback", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: true }) });
    global.fetch = fetchMock;

    await requestMagicLink(" Dono@Studio.com ", "/login");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/sign-in/magic-link");
    expect(init.credentials).toBe("same-origin");
    expect(JSON.parse(init.body)).toEqual({ email: "dono@studio.com", callbackURL: "/dashboard", errorCallbackURL: "/login" });
  });

  it("sends link errors back to /login preserving a non-default destination", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: true }) });
    global.fetch = fetchMock;

    await requestMagicLink("dono@studio.com", "/onboarding", "/onboarding/concluir");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.callbackURL).toBe("/onboarding/concluir");
    expect(body.errorCallbackURL).toBe("/login?next=%2Fonboarding%2Fconcluir");
  });

  it("allows simulation ONLY when explicitly under /preview pathname", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    const previewResult = await requestMagicLink("dono@studio.com", "/preview/login");
    expect(previewResult.ok).toBe(true);
    if (previewResult.ok) {
      expect(previewResult.simulated).toBe(true);
    }
  });
});
