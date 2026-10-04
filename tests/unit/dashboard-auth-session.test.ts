import { afterEach, describe, expect, it, vi } from "vitest";
import { getOwnerSession } from "../../lib/dashboard/auth-session";
import { backendOrigin } from "../../lib/backend-origin";

afterEach(() => vi.unstubAllGlobals());
describe("sessão do painel na autoridade", () => {
  it("não consulta autoridade sem Cookie", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    expect(await getOwnerSession(new Headers())).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("encaminha somente Cookie à origem fixa, sem cache ou redirects", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ user: { id: "owner-test", name: "Teste", email: "test@example.com" } }));
    vi.stubGlobal("fetch", fetch);
    expect(await getOwnerSession(new Headers({ cookie: "session=synthetic", host: "evil.example", authorization: "private" }))).toMatchObject({ user: { id: "owner-test" } });
    expect(fetch).toHaveBeenCalledWith(`${backendOrigin}/api/auth/get-session`, expect.objectContaining({ headers: { cookie: "session=synthetic" }, cache: "no-store", redirect: "error", signal: expect.any(AbortSignal) }));
  });
  it("sessão ausente redirecionável", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(null)));
    expect(await getOwnerSession(new Headers({ cookie: "session=expired" }))).toBeNull();
  });
  it.each([new Response("sensitive", { status: 500 }), Response.json({ user: { id: "" } })])("falha fechada e segura com resposta inválida", async (response) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    await expect(getOwnerSession(new Headers({ cookie: "session=synthetic" }))).rejects.toThrow("Não foi possível verificar seu acesso. Tente novamente.");
  });
  it("falha de rede não publica segredo nem equivale a sessão ausente", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("secret-internal")));
    await expect(getOwnerSession(new Headers({ cookie: "session=synthetic" }))).rejects.toThrow(/^Não foi possível verificar seu acesso/);
  });
});
